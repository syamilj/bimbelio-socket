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
  users: z.array(
    z.object({
      userId: z.string(),
      email: z.string().optional().nullable(),
      whatsApp: z.string().optional().nullable(),
    })
  ),
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
  retryCount: z.number(),
  maxRetries: z.number(),
});

export const addMany = async (req: Request, res: Response): ReturnType => {
  try {
    const body = req.body as z.infer<typeof Schema>;

    console.log(body);
    if (body.runAt) {
      console.log("new Date runAt : ", new Date(body.runAt));
    }
    console.log("new Date : ", new Date());

    checkZodSchema(Schema, body);

    const { users: usersData } = body;

    if (!usersData || usersData.length === 0) {
      throw throwError(400, "users harus diisi jika bukan broadcast!");
    }

    let users = usersData.map((user) => ({
      notifId: crypto.randomUUID(),
      userId: user.userId,
      email: user.email,
      whatsApp: user.whatsApp,
    }));

    let data = body;

    const isTimeout = data.runAt ? true : false;

    const scheduledTimeDate = isTimeout ? new Date(data.runAt!) : new Date();

    const scheduledTime = scheduledTimeDate.getTime();

    const now = new Date().getTime();
    const delayInMs = scheduledTime - now;

    console.log(`Dischedule kan pada ${scheduledTimeDate.toISOString()}`);

    if (delayInMs < 0) {
      throw throwError(400, "Waktu yang dijadwalkan sudah lewat");
    }

    console.log(
      `[${new Date().toISOString()}] [SCHEDULE] Notifikasi dijadwalkan dalam ${delayInMs}ms`
    );

    let successDataCount = 0;

    if (isTimeout) {
      // ✅ Save to DB with error check
      try {
        await prisma.notificationQueue.createMany({
          data: users.map((user) => {
            const notifId = user.notifId;
            const userId = user.userId;
            const email = user.email;
            const whatsApp = user.whatsApp;
            return {
              id: notifId,
              content: data.content,
              isBroadcast: false,
              isPopUp: data.isPopUp,
              userId,
              title: data.title,
              description: data.description,
              type: data.type as any,
              category: data.category as any,
              priority: data.priority as any,
              relatedResourceId: data.relatedResourceId,
              relatedResourceType: data.relatedResourceType as any,
              actionUrl: data.actionUrl,
              metadata: data.metadata as any,
              email,
              whatsApp,
              retryCount: data.retryCount,
              maxRetries: data.maxRetries,
              runAt: scheduledTimeDate,
              failedAt: null,
              failureReason: null,
              sentAt: null,
            };
          }),
        });
      } catch (dbError) {
        console.error(`Error saving to DB:`, dbError);
        throw throwError(500, "Gagal menyimpan notifikasi ke database");
      }
    }

    if (isTimeout) {
      for (const user of users) {
        const notifId = user.notifId;
        const userId = user.userId;
        const email = user.email;
        const whatsApp = user.whatsApp;
        // ✅ Create timeout
        const timeout = setTimeout(async () => {
          await sendNotification({
            id: notifId,
            content: data.content,
            userId: userId || null,
            isBroadcast: false,
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
            email: email || null,
            whatsApp: whatsApp || null,
          });
        }, delayInMs);

        const existingJob = await jobManager.jobExists(notifId);
        if (existingJob) {
          await jobManager.deleteJob(notifId);
        }

        // ✅ Store job in Redis
        await jobManager.createJob({
          id: notifId,
          content: data.content,
          userId: userId || null,
          isBroadcast: false,
          title: data.title,
          description: data.description,
          type: data.type as any,
          category: data.category as any,
          priority: data.priority as any,
          relatedResourceId: data.relatedResourceId || null,
          relatedResourceType: (data.relatedResourceType as any) || null,
          actionUrl: data.actionUrl,
          metadata: data.metadata as any,
          email: email || null,
          whatsApp: whatsApp || null,
          retryCount: data.retryCount,
          maxRetries: data.maxRetries,
          runAt: scheduledTimeDate,
          failedAt: null,
          failureReason: null,
          sentAt: null,
        });

        // ✅ Store timeout reference in-memory
        jobManager.setTimeout(notifId, timeout);
        successDataCount++;
      }
    } else {
      for (const user of users) {
        const notifId = user.notifId;
        const userId = user.userId;
        const email = user.email;
        const whatsApp = user.whatsApp;
        await sendNotification({
          id: notifId,
          content: data.content,
          userId: userId || null,
          isBroadcast: false,
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
          email: email || null,
          whatsApp: whatsApp || null,
          isNoTimeout: true,
        });
        successDataCount++;
      }
    }

    return response(res, 200, "Notifikasi dijadwalkan berhasil", {
      successDataCount,
    });
  } catch (error) {
    console.error(`Error scheduling notification:`, error);
    return responseError(res, error);
  }
};
