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
  id: z.string().optional(),
  userId: z.string().optional().nullable(),
  isBroadcast: z.boolean(),
  isPopUp: z.boolean(),
  title: z.string(),
  content: z.string(),
  description: z.string().nullable(),
  type: z
    .string()
    .refine((val) => val as NotificationType, "Invalid notification type"),
  category: z
    .string()
    .refine((val) => val as NotificationCategory, "Invalid category"),
  priority: z
    .string()
    .refine((val) => val as NotificationPriority, "Invalid priority"),
  relatedResourceId: z.string().nullable(),
  relatedResourceType: z
    .string()
    .refine(
      (val) => val as NotificationRelatedType,
      "Invalid related resource type"
    )
    .nullable(),
  actionUrl: z.string().nullable(),
  metadata: z.union([z.record(z.any(), z.any()), z.array(z.any())]).nullable(),
  runAt: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), "Invalid runAt date format")
    .optional()
    .nullable(),
  sentAt: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), "Invalid sentAt date format")
    .optional(),
  email: z.string().optional().nullable(),
  whatsApp: z.string().optional().nullable(),
  retryCount: z.number(),
  maxRetries: z.number(),
});

export const _post = async (req: Request, res: Response): ReturnType => {
  try {
    const body = req.body as z.infer<typeof Schema>;

    console.log(body);
    // if (body.runAt) {
    //   console.log("new Date runAt : ", new Date(body.runAt));
    // }
    // console.log("new Date : ", new Date());

    checkZodSchema(Schema, body);

    const { isBroadcast, userId } = body;

    if (!userId && !isBroadcast) {
      throw throwError(400, "userId harus diisi jika bukan broadcast!");
    }

    if (isBroadcast && userId) {
      throw throwError(400, "userId tidak boleh diisi jika broadcast!");
    }

    let data = body;

    const isTimeout = data.runAt ? true : false;

    if (!data.id) {
      data.id = crypto.randomUUID();
    }

    const scheduledTimeDate = isTimeout ? new Date(data.runAt!) : new Date();

    const scheduledTime = scheduledTimeDate.getTime();

    const notifId = data.id;

    if (isTimeout) {
      const existingJob = await jobManager.jobExists(notifId);
      if (existingJob) {
        throw throwError(409, `Notifikasi '${notifId}' sudah dijadwalkan`);
      }
    }

    const now = new Date().getTime();
    const delayInMs = scheduledTime - now;

    console.log(`Dischedule kan pada ${scheduledTimeDate.toISOString()}`);

    if (delayInMs < 0) {
      throw throwError(400, "Waktu yang dijadwalkan sudah lewat");
    }

    console.log(
      `[${new Date().toISOString()}] [SCHEDULE] Notifikasi '${notifId}' dijadwalkan dalam ${delayInMs}ms`
    );

    if (isTimeout) {
      // ✅ Save to DB with error check
      try {
        await prisma.notificationQueue.create({
          data: {
            id: notifId,
            content: data.content,
            isBroadcast: data.isBroadcast,
            isPopUp: data.isPopUp,
            userId: data.userId,
            title: data.title,
            description: data.description,
            type: data.type as any,
            category: data.category as any,
            priority: data.priority as any,
            relatedResourceId: data.relatedResourceId,
            relatedResourceType: data.relatedResourceType as any,
            actionUrl: data.actionUrl,
            metadata: data.metadata as any,
            email: data.email,
            whatsApp: data.whatsApp,
            retryCount: data.retryCount,
            maxRetries: data.maxRetries,
            runAt: scheduledTimeDate,
            failedAt: null,
            failureReason: null,
            sentAt: null,
          },
        });
      } catch (dbError) {
        console.error(`Error saving to DB:`, dbError);
        throw throwError(500, "Gagal menyimpan notifikasi ke database");
      }
    }

    if (isTimeout) {
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
    } else {
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
        isNoTimeout: true,
      });
    }

    const successData = {
      id: notifId,
      userId: data.userId,
      title: data.title,
      content: data.content,
      description: data.description,
      type: data.type,
      category: data.category,
      priority: data.priority,
      relatedResourceId: data.relatedResourceId,
      relatedResourceType: data.relatedResourceType,
      actionUrl: data.actionUrl,
      metadata: data.metadata,
      retryCount: data.retryCount,
      maxRetries: data.maxRetries,
      runAt: scheduledTimeDate.toISOString(),
      scheduledIn: `${delayInMs}ms`,
      status: "scheduled",
    };
    return response(res, 200, "Notifikasi dijadwalkan berhasil", successData);
  } catch (error) {
    console.error(`Error scheduling notification:`, error);
    return responseError(res, error);
  }
};
