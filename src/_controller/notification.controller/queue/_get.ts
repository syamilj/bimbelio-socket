import { Request, Response } from "express";
import { jobManager } from "../../../utils/redisJob";
import { sendNotification } from "../../../service/notification/sendNotification";
import { prisma } from "../../../utils/db";
import {
  checkZodSchema,
  response,
  responseError,
} from "../../../utils/response";
import z from "zod";
import { Prisma } from "@prisma/client";

const Schema = z.object({
  page: z.string().optional(),
  take: z.string().optional(),
  search: z.string().optional(),
  userType: z.enum(["PERSONAL", "BROADCAST"]).optional(),
});

export const _get = async (req: Request, res: Response) => {
  try {
    // // ✅ Get all jobs from Redis
    // const jobs = await jobManager.getAllJobs();

    // const scheduledList = jobs.map((job) => {
    //   const { timeout, ...jobWithoutTimeout } = job;
    //   return jobWithoutTimeout;
    // });

    const query = req.query as z.infer<typeof Schema>;

    const { page: pageString, take: takeString, userType, search } = query;

    checkZodSchema(Schema, query);

    const page = pageString ? parseInt(pageString) : 1;
    const take = takeString ? parseInt(takeString) : 10;
    const skip = page && take ? page * take - take : 0;

    const whereClause: Prisma.NotificationQueueWhereInput = {
      isBroadcast:
        userType === "BROADCAST"
          ? true
          : userType === "PERSONAL"
          ? false
          : undefined,
      title: search
        ? {
            contains: search,
            mode: "insensitive",
          }
        : undefined,
    };

    const data = await prisma.notificationQueue.findMany({
      where: whereClause,
      orderBy: {
        runAt: "asc",
      },
      take,
      skip,
    });

    const total_data = await prisma.notificationQueue.count({
      where: whereClause,
    });

    const total_pages = Math.ceil(total_data / take);

    const jobs = await Promise.all(
      data.map(async (item) => {
        const job = await jobManager.getJob(item.id);
        if (!job) return { ...item, job: null };
        const { timeout, ...jobWithoutTimeout } = job;
        return {
          ...item,
          job: {
            id: jobWithoutTimeout.id,
            runAt: jobWithoutTimeout.runAt,
          },
        };
      })
    );

    return response(
      res,
      200,
      "Berhasil mengambil notifikasi yang dijadwalkan",
      jobs,
      page,
      total_pages,
      total_data
    );
  } catch (error) {
    console.error("Error fetching scheduled notifications:", error);
    return responseError(res, error);
  }
};
