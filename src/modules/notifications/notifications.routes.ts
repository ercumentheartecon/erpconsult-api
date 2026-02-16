import { Router } from "express";
import { NotificationsController } from "./notifications.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();
const controller = new NotificationsController();

router.get("/", authenticate, controller.list);
router.patch("/:id/read", authenticate, controller.markAsRead);
router.patch("/read-all", authenticate, controller.markAllAsRead);

export default router;
