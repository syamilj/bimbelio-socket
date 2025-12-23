import { Request, Response } from "express";
import { jobManager } from "../../../utils/redisJob";
import { sendNotification } from "../../../service/notification/sendNotification";
import z from "zod";
import {
  checkZodSchema,
  response,
  responseError,
  throwError,
} from "../../../utils/response";
import { ReturnType } from "../../../types";

import { prisma } from "../../../utils/db";
import {
  NotificationCategory,
  NotificationPriority,
  NotificationRelatedType,
  NotificationType,
} from "@prisma/client";

const Schema = z.object({
  relatedResourceId: z.string(),
  relatedResourceType: z
    .string()
    .refine(
      (val) => val as NotificationRelatedType,
      "Invalid related resource type"
    ),
  runAt: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), "Invalid runAt date format"),
  metadata: z.union([z.record(z.any(), z.any()), z.array(z.any())]),
});

export const checkQueueRelated = async (
  req: Request,
  res: Response
): ReturnType => {
  try {
    const body = req.body as z.infer<typeof Schema>;

    console.log(body);
    if (body.runAt) {
      console.log("new Date runAt : ", new Date(body.runAt));
    }
    console.log("new Date : ", new Date());

    checkZodSchema(Schema, body);

    const { metadata, relatedResourceId, relatedResourceType, runAt } = body;

    const allRelatedNotification = await prisma.notificationQueue.findMany({
      where: {
        relatedResourceType: relatedResourceType as NotificationRelatedType,
        relatedResourceId,
        runAt: {
          not: undefined,
        },
      },
    });

    if (allRelatedNotification.length === 0) {
      return response(res, 200, "Tidak ada notifikasi baru untuk dijadwalkan");
    }

    let successData: any[] = [];

    const scheduledTimeDate = new Date(runAt);

    const scheduledTime = scheduledTimeDate.getTime();

    if (scheduledTimeDate.getTime() < new Date().getTime()) {
      throw throwError(400, "Waktu yang dijadwalkan sudah lewat");
    }

    await prisma.$transaction(async (prisma) => {
      for (const data of allRelatedNotification) {
        if (!data.id) {
          data.id = crypto.randomUUID();
        }

        const notifId = data.id;

        const existingJob = await jobManager.jobExists(notifId);
        if (!existingJob) {
          continue;
        }

        await jobManager.deleteJob(notifId);

        const now = new Date().getTime();
        const delayInMs = scheduledTime - now;

        console.log(`Dischedule kan pada ${scheduledTimeDate.toISOString()}`);

        if (delayInMs < 0) {
          throw throwError(400, "Waktu yang dijadwalkan sudah lewat");
        }

        console.log(
          `[${new Date().toISOString()}] [SCHEDULE] Notifikasi '${notifId}' dijadwalkan dalam ${delayInMs}ms`
        );

        try {
          await prisma.notificationQueue.update({
            where: {
              id: notifId,
            },
            data: {
              runAt: scheduledTimeDate,
              metadata,
            },
          });
        } catch (dbError) {
          console.error(`Error saving to DB:`, dbError);
          return; // ✅ Don't schedule if DB save fails
        }

        // ✅ Create timeout
        const timeout = setTimeout(async () => {
          await sendNotification({
            id: notifId,
            content: data.content,
            userId: data.userId || null,
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
            email: data.email || null,
            whatsApp: data.whatsApp || null,
          });
        }, delayInMs);

        // ✅ Store job in Redis
        await jobManager.createJob({
          id: notifId,
          content: data.content,
          userId: data.userId || null,
          isBroadcast: data.isBroadcast,
          title: data.title,
          description: data.description,
          type: data.type as any,
          category: data.category as any,
          priority: data.priority as any,
          relatedResourceId: data.relatedResourceId || null,
          relatedResourceType: (data.relatedResourceType as any) || null,
          actionUrl: data.actionUrl,
          metadata: data.metadata as any,
          email: data.email || null,
          whatsApp: data.whatsApp || null,
          retryCount: data.retryCount,
          maxRetries: data.maxRetries,
          runAt: scheduledTimeDate,
          failedAt: null,
          failureReason: null,
          sentAt: null,
        });

        // ✅ Store timeout reference in-memory
        jobManager.setTimeout(notifId, timeout);
        successData.push({
          id: notifId,
          content: data.content,
          userId: data.userId || null,
          isBroadcast: data.isBroadcast,
          title: data.title,
          description: data.description,
          type: data.type as any,
          category: data.category as any,
          priority: data.priority as any,
          relatedResourceId: data.relatedResourceId || null,
          relatedResourceType: (data.relatedResourceType as any) || null,
          actionUrl: data.actionUrl,
          metadata: data.metadata as any,
          email: data.email || null,
          whatsApp: data.whatsApp || null,
          retryCount: data.retryCount,
          maxRetries: data.maxRetries,
          runAt: scheduledTimeDate,
          failedAt: null,
          failureReason: null,
          sentAt: null,
        });
      }
    });

    return response(res, 200, "Notifikasi diupdate berhasil", {
      updatedCount: successData.length,
    });
  } catch (error) {
    console.error(`Error scheduling notification:`, error);
    return responseError(res, error);
  }
};
