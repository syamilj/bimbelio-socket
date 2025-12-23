import express from "express";
import Controller from "../_controller/system/_core";

const SystemRouter = express.Router();

SystemRouter.get("/health", Controller.health);
SystemRouter.get("/user", Controller.user);

export { SystemRouter };
