import { Request, Response } from "express";
import { jobManager } from "../../../utils/redisJob";
import { sendNotification } from "../../../service/notification/sendNotification";

export const _get = async (req: Request, res: Response) => {
  try {
    // ✅ Get all jobs from Redis
    const jobs = await jobManager.getAllJobs();

    const scheduledList = jobs.map((job) => {
      const { timeout, ...jobWithoutTimeout } = job;
      return jobWithoutTimeout;
    });

    res.json({
      totalScheduled: jobs.length,
      scheduledNotifications: scheduledList,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching scheduled notifications:", error);
    res.status(500).json({
      message: "Gagal mengambil notifikasi yang dijadwalkan",
    });
  }
};
