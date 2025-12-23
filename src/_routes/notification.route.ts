import express from "express";
import Controller from "../_controller/notification.controller/_core";

const NotificationRouter = express.Router();

NotificationRouter.get("/queue", Controller.queue._get);
NotificationRouter.post("/queue", Controller.queue._post);
NotificationRouter.delete("/queue", Controller.queue._delete);

NotificationRouter.post("/queue/addMany", Controller.queue.addMany);
NotificationRouter.post(
  "/queue/checkQueueRelated",
  Controller.queue.checkQueueRelated
);

export { NotificationRouter };
