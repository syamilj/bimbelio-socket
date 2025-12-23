import {
  NotificationCategory,
  NotificationPriority,
  NotificationRelatedType,
  NotificationType,
} from "@prisma/client";
import { redis } from "./redis";

export interface RedisJobData {
  id: string;
  userId: string;
  message: string;
}

// export interface RedisJob {
//   id: string;
//   runAt: Date;
//   data: {
//     userId: string;
//     message: string;
//   };
//   timeout?: NodeJS.Timeout; // Only in-memory, not serialized to Redis
// }

export type RedisJob = {
  id: string;
  userId: string | null;
  isBroadcast: boolean;
  title: string;
  content: string;
  description: string | null;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  relatedResourceId: string | null;
  relatedResourceType: NotificationRelatedType | null;
  actionUrl: string | null;
  metadata: JSON | null;
  runAt: Date;
  sentAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  whatsApp: string | null;
  email: string | null;
  retryCount: number;
  maxRetries: number;
  timeout?: NodeJS.Timeout; // Only in-memory, not serialized to Redis
};

export class RedisJobManager {
  private readonly JOBS_KEY = "notifications:jobs"; // Sorted set for time-based queries
  private readonly JOB_PREFIX = "notifications:job:"; // Hash for individual job data
  private inMemoryTimeouts: Map<string, NodeJS.Timeout> = new Map();

  async createJob(job: RedisJob): Promise<void> {
    try {
      const jobTimestamp = job.runAt.getTime();

      // Store job details in Redis hash
      const jobData: Record<string, string | null | number | boolean> = {
        id: job.id,
        content: job.content,
        userId: job.userId,
        title: job.title,
        description: job.description,
        type: job.type as any,
        category: job.category as any,
        priority: job.priority as any,
        relatedResourceId: job.relatedResourceId,
        relatedResourceType: job.relatedResourceType as any,
        actionUrl: job.actionUrl,
        metadata: job.metadata ? JSON.stringify(job.metadata || {}) : null,
        whatsApp: job.whatsApp || null,
        email: job.email || null,
        retryCount: job.retryCount,
        maxRetries: job.maxRetries,
        runAt: job.runAt.toString(),
        failedAt: null,
        failureReason: null,
        sentAt: null,
      };

      // ✅ Store in Redis hash (persistent storage)
      await redis.hset(`${this.JOB_PREFIX}${job.id}`, jobData);

      // ✅ Add to sorted set for efficient time-based queries
      // Score = timestamp, so we can query jobs by time
      await redis.zadd(this.JOBS_KEY, jobTimestamp, job.id);

      console.log(`[REDIS] Job ${job.id} created and stored`);
    } catch (error) {
      console.error(`[REDIS ERROR] Failed to create job ${job.id}:`, error);
      throw error;
    }
  }

  async getJob(jobId: string): Promise<RedisJob | null> {
    try {
      const jobData = await redis.hgetall(`${this.JOB_PREFIX}${jobId}`);

      // Job not found
      if (!jobData || Object.keys(jobData).length === 0) {
        return null;
      }

      let parsedMetadata = null;
      if (jobData.metadata) {
        try {
          parsedMetadata = JSON.parse(jobData.metadata as string);
        } catch (e) {
          console.warn(`Failed to parse metadata for job ${jobId}:`, e);
          parsedMetadata = null;
        }
      }

      return {
        id: jobData.id,
        userId: jobData.userId,
        isBroadcast: jobData.isBroadcast === "true" ? true : false,
        title: jobData.title,
        content: jobData.content,
        description: jobData.description,
        type: jobData.type as NotificationType,
        category: jobData.category as NotificationCategory,
        priority: jobData.priority as NotificationPriority,
        relatedResourceId: jobData.relatedResourceId || null,
        relatedResourceType:
          (jobData.relatedResourceType as NotificationRelatedType) || null,
        actionUrl: jobData.actionUrl,
        metadata: parsedMetadata,
        failedAt: jobData.failedAt || null,
        failureReason: jobData.failureReason || null,
        runAt: new Date(jobData.runAt),
        sentAt: jobData.sentAt || null,
        email: jobData.email || null,
        whatsApp: jobData.whatsApp || null,
        retryCount: Number(jobData.retryCount),
        maxRetries: Number(jobData.maxRetries),
        timeout: this.inMemoryTimeouts.get(jobId),
      };
    } catch (error) {
      console.error(`[REDIS ERROR] Failed to get job ${jobId}:`, error);
      throw error;
    }
  }

  async deleteJob(jobId: string): Promise<void> {
    try {
      // Remove from sorted set
      await redis.zrem(this.JOBS_KEY, jobId);

      // Remove from hash
      await redis.del(`${this.JOB_PREFIX}${jobId}`);

      // Clear in-memory timeout
      const timeout = this.inMemoryTimeouts.get(jobId);
      if (timeout) {
        clearTimeout(timeout);
        this.inMemoryTimeouts.delete(jobId);
      }

      console.log(`[REDIS] Job ${jobId} deleted`);
    } catch (error) {
      console.error(`[REDIS ERROR] Failed to delete job ${jobId}:`, error);
      throw error;
    }
  }

  async jobExists(jobId: string): Promise<boolean> {
    try {
      const exists = await redis.exists(`${this.JOB_PREFIX}${jobId}`);
      return exists === 1;
    } catch (error) {
      console.error(`[REDIS ERROR] Failed to check job existence:`, error);
      throw error;
    }
  }

  async getPendingJobs(maxTime?: number): Promise<RedisJob[]> {
    try {
      const beforeTime = maxTime || Date.now() + 86400000; // Default 24 hours ahead
      const jobIds = await redis.zrangebyscore(
        this.JOBS_KEY,
        "-inf",
        beforeTime
      );

      const jobs: RedisJob[] = [];
      for (const jobId of jobIds) {
        const job = await this.getJob(jobId);
        if (job) {
          jobs.push(job);
        }
      }

      return jobs;
    } catch (error) {
      console.error(`[REDIS ERROR] Failed to get pending jobs:`, error);
      throw error;
    }
  }

  setTimeout(jobId: string, timeout: NodeJS.Timeout): void {
    this.inMemoryTimeouts.set(jobId, timeout);
  }

  async getJobCount(): Promise<number> {
    try {
      return await redis.zcard(this.JOBS_KEY);
    } catch (error) {
      console.error(`[REDIS ERROR] Failed to get job count:`, error);
      return 0;
    }
  }

  async getAllJobs(): Promise<RedisJob[]> {
    try {
      const jobIds = await redis.zrange(this.JOBS_KEY, 0, -1);

      const jobs: RedisJob[] = [];
      for (const jobId of jobIds) {
        const job = await this.getJob(jobId);
        if (job) {
          jobs.push(job);
        }
      }

      return jobs;
    } catch (error) {
      console.error(`[REDIS ERROR] Failed to get all jobs:`, error);
      return [];
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      await redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      // Clear all in-memory timeouts
      this.inMemoryTimeouts.forEach((timeout) => clearTimeout(timeout));
      this.inMemoryTimeouts.clear();

      // Disconnect from Redis
      await redis.quit();
      console.log("[REDIS] Disconnected successfully");
    } catch (error) {
      console.error(`[REDIS ERROR] Failed to disconnect:`, error);
    }
  }
}

// ✅ Export singleton instance
export const jobManager = new RedisJobManager();
