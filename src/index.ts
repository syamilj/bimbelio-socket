import express from "express";
import { prisma } from "./utils/db";
import http from "http";
import { Server } from "socket.io";
import { createAdapter } from "socket.io-redis";
import { createClient } from "redis";

import cors from "cors";
import { jobManager } from "./utils/redisJob";
import { sendNotification } from "./service/notification/sendNotification";
import { activeUserManager } from "./utils/redisUser";
import Routes from "./_routes/_core";
import { env } from "./env";

const allowedOrigins = [
  "https://www.bimbelio.com",
  "https://bimbelio.com",
  "https://bimbelio-staging.vercel.app",
  "http://localhost:3000",
  "https://lz0fm4cw-3000.asse.devtunnels.ms",
  "http://localhost:3001",
];

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

// ✅ Redis adapter untuk PM2 cluster
(async () => {
  const pubClient = createClient({
    socket: {
      host: env.REDIS_HOST || "localhost",
      port: parseInt(env.REDIS_PORT || "6379"),
    },
    password: env.REDIS_PASSWORD || undefined,
  });

  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);

  io.adapter(createAdapter(pubClient as any, subClient as any));
  console.log("[SOCKET.IO] Redis adapter initialized");
})().catch((err) => {
  console.error("[SOCKET.IO] Failed to initialize Redis adapter:", err);
  process.exit(1);
});

app.use("/notification", Routes.NotificationRouter);

io.on("connection", (socket) => {
  console.log(`[SOCKET.IO] Client connected: ${socket.id}`);

  socket.on("user:auth", async (data: { userId: string }) => {
    await activeUserManager.setUserActive(data.userId, socket.id);
  });

  socket.on("notification:test", (data: { message: string }) => {
    try {
      io.emit("notification:reminder", {
        id: `test-${Date.now()}`,
        message: data?.message || "Ini adalah notifikasi test",
        sentAt: new Date().toISOString(),
      });
    } catch (error) {
      console.log(`Error sending test notification: ${error}`);
      socket.emit("error", {
        message: "Gagal mengirim notifikasi test",
      });
    }
  });

  socket.on("notification:refetch", async (data: { notifId: string }) => {});

  socket.on("disconnect", async () => {
    console.log(`[SOCKET.IO] Client disconnected: ${socket.id}`);
    await activeUserManager.removeUserBySocketId(socket.id);
  });
});

const restoreNotificationAfterRestart = async () => {
  try {
    const notifications = await prisma.notificationQueue.findMany({
      where: {
        runAt: {
          gt: new Date(),
        },
      },
    });
    for (const data of notifications) {
      const delayInMs = data.runAt.getTime() - new Date().getTime();
      const notifId = data.id;
      if (delayInMs < 0) {
        // Skip jika waktu sudah lewat
        continue;
      }
      // ✅ Create timeout
      const timeout = setTimeout(async () => {
        try {
          await sendNotification({
            id: notifId,
            content: data.content,
            userId: data.userId,
            isBroadcast: data.isBroadcast,
            isPopUp: data.isPopUp,
            title: data.title,
            description: data.description,
            type: data.type as any,
            category: data.category as any,
            priority: data.priority as any,
            relatedResourceId: data.relatedResourceId,
            relatedResourceType: data.relatedResourceType as any,
            actionUrl: data.actionUrl,
            metadata: data.metadata as any,
            retryCount: data.retryCount,
            maxRetries: data.maxRetries,
            whatsApp: data.whatsApp || null,
            email: data.email || null,
          });
        } catch (notifError) {
          console.error(
            `[ERROR] Notification callback failed for ${notifId}:`,
            notifError
          );
          await jobManager.deleteJob(notifId);
        }
      }, delayInMs);
      // ✅ Store job in Redis
      await jobManager.createJob({
        id: notifId,
        content: data.content,
        userId: data.userId,
        isBroadcast: data.isBroadcast,
        title: data.title,
        description: data.description,
        type: data.type as any,
        category: data.category as any,
        priority: data.priority as any,
        relatedResourceId: data.relatedResourceId,
        relatedResourceType: data.relatedResourceType as any,
        actionUrl: data.actionUrl,
        metadata: data.metadata as any,
        email: data.email || null,
        whatsApp: data.whatsApp || null,
        retryCount: data.retryCount,
        maxRetries: data.maxRetries,
        runAt: data.runAt,
        failedAt: null,
        failureReason: null,
        sentAt: null,
      });

      // ✅ Store timeout reference in-memory
      jobManager.setTimeout(notifId, timeout);
    }
    console.log(
      `[${new Date().toISOString()}] [RESTORE] Berhasil memuat ${
        notifications.length
      } notifikasi yang tertunda`
    );
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] [RESTORE ERROR] Gagal restore notifications:`,
      error
    );
    throw error;
  }
};

// ✅ Validate required environment variables
const validateEnvironment = () => {
  const requiredEnv = ["DATABASE_URL"];
  const missing = requiredEnv.filter((env) => !process.env[env]);

  if (missing.length > 0) {
    console.error(
      `❌ Missing required environment variables: ${missing.join(", ")}`
    );
    process.exit(1);
  }
};

validateEnvironment();

const PORT = parseInt(process.env.PORT || "4001", 10);
server.listen(PORT, async () => {
  try {
    console.log("Sedang Menunggu Restore Data.....");
    await restoreNotificationAfterRestart();
    console.log(`[${new Date().toISOString()}] Server running on port ${PORT}`);
    console.log(
      `[${new Date().toISOString()}] Socket.IO ready for WebSocket connections`
    );
    console.log(
      `[${new Date().toISOString()}] Test: http://localhost:${PORT}/health`
    );
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] FATAL: Server startup failed:`,
      error
    );
    process.exit(1);
  }
});

// ✅ Graceful shutdown - handle SIGTERM
process.on("SIGTERM", async () => {
  console.log("[SHUTDOWN] Server shutting down gracefully (SIGTERM)...");

  // Disconnect from Redis and cleanup
  await jobManager.disconnect();

  // Disconnect Prisma
  await prisma.$disconnect();

  console.log("[SHUTDOWN] Cleanup complete");
  process.exit(0);
});

// ✅ Graceful shutdown - handle SIGINT
process.on("SIGINT", async () => {
  console.log("[SHUTDOWN] Server interrupted, shutting down (SIGINT)...");

  // Disconnect from Redis and cleanup
  await jobManager.disconnect();

  // Disconnect Prisma
  await prisma.$disconnect();

  console.log("[SHUTDOWN] Cleanup complete");
  process.exit(0);
});

export const getIO = () => {
  if (!io) throw new Error("IO not initialized");
  return io;
};
