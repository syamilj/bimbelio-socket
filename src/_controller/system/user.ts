import { Request, Response } from "express";
import { jobManager } from "../../utils/redisJob";
import { activeUserManager } from "../../utils/redisUser";

export const user = async (req: Request, res: Response) => {
  try {
    const isRedisConnected = await jobManager.isConnected();
    const activeUsers = await activeUserManager.getAllActiveUsers();
    const activeUserCount = await activeUserManager.getActiveUserCount();

    res.json({
      status: isRedisConnected ? "ok" : "degraded",
      redis: isRedisConnected ? "connected" : "disconnected",
      activeUsers: activeUserCount,
      users: activeUsers.map((user) => ({
        userId: user.userId,
        socketId: user.socketId,
        connectedAt: new Date(user.connectedAt).toISOString(),
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching active users:", error);
    res.status(500).json({
      message: "Gagal mengambil data user aktif",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
