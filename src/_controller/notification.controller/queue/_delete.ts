import { Request, Response } from "express";
import { jobManager } from "../../../utils/redisJob";
import { prisma } from "../../../utils/db";

export const _delete = async (req: Request, res: Response) => {
  try {
    const { notifId } = req.query as { notifId: string | undefined };

    if (!notifId?.trim()) {
      return res.status(400).json({
        message: "notifId diperlukan",
      });
    }

    // ✅ Check if job exists
    const existingJob = await jobManager.getJob(notifId);
    if (!existingJob) {
      return res.status(404).json({
        message: `Notifikasi '${notifId}' tidak ditemukan`,
      });
    }

    // ✅ Delete job
    await jobManager.deleteJob(notifId);
    await prisma.notificationQueue.delete({
      where: { id: notifId },
    });

    console.log(
      `[${new Date().toISOString()}] [CANCEL] Notifikasi '${notifId}' dibatalkan`
    );

    res.json({
      notifId,
      message: "Notifikasi berhasil dibatalkan",
    });
  } catch (error) {
    console.error(`Error cancelling notification:`, error);
    res.status(500).json({
      message: "Gagal membatalkan notifikasi",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
