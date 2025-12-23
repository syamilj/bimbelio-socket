import { Request, Response } from "express";
import { jobManager } from "../../utils/redisJob";

export const health = async (req: Request, res: Response) => {
  try {
    const isRedisConnected = await jobManager.isConnected();
    const jobCount = await jobManager.getJobCount();

    res.json({
      status: isRedisConnected ? "ok" : "degraded",
      redis: isRedisConnected ? "connected" : "disconnected",
      scheduledNotifications: jobCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({
      message: "Gagal mengambil status kesehatan server",
    });
  }
};
