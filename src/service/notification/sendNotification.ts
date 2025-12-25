import { DefaultEventsMap, Server, Socket } from "socket.io";
import { jobManager } from "../../utils/redisJob";
import { prisma } from "../../utils/db";
import { getIO } from "../..";
import { Notification } from "../../types/database";
import { NotificationQueue } from "@prisma/client";
import { web } from "../../lib/web/_core";
import { is } from "zod/v4/locales";
import { crm } from "../../lib/crm/_core";
import { env } from "../../env";

export const sendNotification = async (
  data: Omit<
    NotificationQueue,
    | "status"
    | "runAt"
    | "sentAt"
    | "failedAt"
    | "failureReason"
    | "createdAt"
    | "updatedAt"
  > & {
    isNoTimeout?: boolean;
  }
): Promise<void> => {
  const io = getIO();
  const notifId = data.id;
  const userId = data.userId;
  const isNoTimeout = data.isNoTimeout;

  console.log({ isNoTimeout });

  try {
    console.log(
      `[${new Date().toISOString()}] [NOTIFICATION] ⏰ WAKTU TIBA! Notifikasi '${notifId}' dikirim`
    );

    console.log(`[DEBUG] Emitting to : notification:${userId}`);

    const newNotification: Omit<Notification, "createdAt" | "updatedAt"> = {
      ...data,
      isRead: false,
      readAt: null,
      isArchived: false,
      archivedAt: null,
    };

    const isSendingWhatsApp = data.whatsApp ? true : false;
    const isSendingEmail = data.email ? true : false;

    let isLooping = true;
    let retryCount = data.retryCount || 0;
    const maxRetries = data.maxRetries || 3;

    let isWebSuccess = false;
    let isWhatsAppSuccess = false;

    while (retryCount <= maxRetries && isLooping) {
      if (isWebSuccess === false) {
        const isSuccess = await web.notification.addNotification({
          id: notifId,
          userId: data.userId || undefined,
          isBroadcast: data.isBroadcast,
          isPopUp: data.isPopUp,
          title: data.title,
          content: data.content,
          description: data.description || undefined,
          type: data.type,
          category: data.category,
          relatedResourceId: data.relatedResourceId || undefined,
          relatedResourceType: data.relatedResourceType || undefined,
          actionUrl: data.actionUrl || undefined,
          metadata: (data.metadata as any[] | Record<string, any>) || undefined,
          isSendingEmail,
          isSendingWhatsApp,
        });

        if (isSuccess) {
          isWebSuccess = true;
          // ✅ Kirim ke semua device user via userId
          if (data.isBroadcast) {
            io.emit(`notification:broadcast`, newNotification);
          } else {
            io.emit(`notification:${userId}`, newNotification);
          }
        }
      }

      if (isSendingWhatsApp && isWhatsAppSuccess === false) {
        let text = `*${data.title}*\n`;
        text += `\n${data.content}`;

        if (data.description) text += `\n\n_${data.description}_`;

        text += `\n\n━━━━━━━━━━━━━━━`;
        text += `\n📌 Kategori: *${data.category}*`;
        text += `\n📋 Tipe: ${data.type}`;

        if (
          data.actionUrl &&
          data.actionUrl.length > 0 &&
          data.actionUrl.startsWith("/")
        ) {
          text += `\n🔗 Buka: ${env.FE_API_URL}${data.actionUrl}`;
        }
        if (
          data.actionUrl &&
          data.actionUrl.length > 0 &&
          data.actionUrl.startsWith("http")
        ) {
          text += `\n🔗 Buka: ${data.actionUrl}`;
        }
        const isSuccess = await crm.sendRich({
          phoneNumber: data.whatsApp!,
          text,
          useHumanBehavior: true,
          useQueue: true,
        });
        if (isSuccess) {
          isWhatsAppSuccess = true;
        }
      }

      if (isSendingWhatsApp && isWhatsAppSuccess && isWebSuccess) {
        isLooping = false;
      }

      if (!isSendingWhatsApp && isWebSuccess) {
        isLooping = false;
      }

      retryCount++;
      if (retryCount <= maxRetries && isLooping) {
        const delayMs = 10000 * Math.pow(2, retryCount - 1);
        console.log(
          `[RETRY] Menunggu ${delayMs}ms sebelum retry ke-${retryCount}`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    if (isNoTimeout !== true) {
      // ✅ Delete dari DB dengan await
      try {
        await prisma.notificationQueue.delete({
          where: { id: notifId },
        });
      } catch (dbError) {
        console.error(
          `[ERROR] Failed to delete notification ${notifId} from DB:`,
          dbError
        );
        // Continue cleanup bahkan jika DB delete gagal
      }
    }
  } catch (error) {
    console.error(`[ERROR] sendNotification failed for ${notifId}:`, error);
  } finally {
    if (isNoTimeout !== true) {
      // ✅ ALWAYS cleanup from Redis, regardless of errors
      try {
        await jobManager.deleteJob(notifId);
        console.log(
          `[${new Date().toISOString()}] [CLEANUP] Notifikasi '${notifId}' dihapus dari Redis`
        );
      } catch (cleanupError) {
        console.error(
          `[CLEANUP ERROR] Failed to delete ${notifId} from Redis:`,
          cleanupError
        );
      }
    }
  }
};
