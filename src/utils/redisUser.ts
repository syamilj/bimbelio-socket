// SOCKET/src/utils/activeUsers.ts
import { redis } from "./redis";

export interface ActiveUser {
  userId: string;
  socketId: string;
  connectedAt: number;
}

export class ActiveUserManager {
  private readonly ACTIVE_USERS_KEY = "active:users"; // Hash: userId → socketId
  private readonly USER_SOCKETS_KEY = "user:sockets"; // Hash: socketId → userId
  private readonly EXPIRY_TIME = 86400; // 24 hours

  /**
   * ✅ Set user aktif saat socket connect
   */
  async setUserActive(userId: string, socketId: string): Promise<void> {
    try {
      const now = Date.now();

      // Store userId → socketId
      await redis.hset(
        this.ACTIVE_USERS_KEY,
        userId,
        JSON.stringify({
          socketId,
          connectedAt: now,
        })
      );

      // Store socketId → userId (untuk cleanup saat disconnect)
      await redis.hset(this.USER_SOCKETS_KEY, socketId, userId);

      // Set expiry
      await redis.expire(this.ACTIVE_USERS_KEY, this.EXPIRY_TIME);

      console.log(`[ACTIVE] User ${userId} connected with socket ${socketId}`);
    } catch (error) {
      console.error(`[REDIS ERROR] Failed to set user active:`, error);
      throw error;
    }
  }

  /**
   * ✅ Remove user aktif saat socket disconnect
   */
  async removeUserActive(userId: string): Promise<void> {
    try {
      // Get socketId sebelum delete
      const userData = await redis.hget(this.ACTIVE_USERS_KEY, userId);

      if (userData) {
        const { socketId } = JSON.parse(userData);

        // Remove dari user sockets
        await redis.hdel(this.USER_SOCKETS_KEY, socketId);
      }

      // Remove user
      await redis.hdel(this.ACTIVE_USERS_KEY, userId);

      console.log(`[ACTIVE] User ${userId} disconnected`);
    } catch (error) {
      console.error(`[REDIS ERROR] Failed to remove user active:`, error);
      throw error;
    }
  }

  /**
   * ✅ Remove user berdasarkan socketId (saat disconnect)
   */
  async removeUserBySocketId(socketId: string): Promise<void> {
    try {
      // Cari userId dari socketId
      const userId = await redis.hget(this.USER_SOCKETS_KEY, socketId);

      if (userId) {
        // Remove dari active users
        await redis.hdel(this.ACTIVE_USERS_KEY, userId);
      }

      // Remove socket mapping
      await redis.hdel(this.USER_SOCKETS_KEY, socketId);

      console.log(`[ACTIVE] Socket ${socketId} disconnected`);
    } catch (error) {
      console.error(`[REDIS ERROR] Failed to remove user by socket:`, error);
      throw error;
    }
  }

  /**
   * ✅ Get socketId dari userId
   */
  async getSocketId(userId: string): Promise<string | null> {
    try {
      const userData = await redis.hget(this.ACTIVE_USERS_KEY, userId);

      if (!userData) {
        return null;
      }

      const { socketId } = JSON.parse(userData);
      return socketId;
    } catch (error) {
      console.error(`[REDIS ERROR] Failed to get socket ID:`, error);
      return null;
    }
  }

  /**
   * ✅ Check apakah user aktif
   */
  async isUserActive(userId: string): Promise<boolean> {
    try {
      const exists = await redis.hexists(this.ACTIVE_USERS_KEY, userId);
      return exists === 1;
    } catch (error) {
      console.error(`[REDIS ERROR] Failed to check user active:`, error);
      return false;
    }
  }

  /**
   * ✅ Get semua user aktif
   */
  async getAllActiveUsers(): Promise<ActiveUser[]> {
    try {
      const users = await redis.hgetall(this.ACTIVE_USERS_KEY);

      const activeUsers: ActiveUser[] = [];
      for (const [userId, data] of Object.entries(users)) {
        const { socketId, connectedAt } = JSON.parse(data as string);
        activeUsers.push({
          userId,
          socketId,
          connectedAt,
        });
      }

      return activeUsers;
    } catch (error) {
      console.error(`[REDIS ERROR] Failed to get all active users:`, error);
      return [];
    }
  }

  /**
   * ✅ Get jumlah user aktif
   */
  async getActiveUserCount(): Promise<number> {
    try {
      return await redis.hlen(this.ACTIVE_USERS_KEY);
    } catch (error) {
      console.error(`[REDIS ERROR] Failed to get active user count:`, error);
      return 0;
    }
  }

  /**
   * ✅ Clear semua user aktif (untuk graceful shutdown)
   */
  async clearAllActiveUsers(): Promise<void> {
    try {
      await redis.del(this.ACTIVE_USERS_KEY);
      await redis.del(this.USER_SOCKETS_KEY);

      console.log("[ACTIVE] All active users cleared");
    } catch (error) {
      console.error(`[REDIS ERROR] Failed to clear active users:`, error);
    }
  }
}

// ✅ Export singleton instance
export const activeUserManager = new ActiveUserManager();
