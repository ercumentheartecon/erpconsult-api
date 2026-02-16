import { Router } from "express";
import { ZoomController } from "./zoom.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();
const controller = new ZoomController();

router.post("/meeting", authenticate, controller.createMeeting);
router.get("/meeting/:sessionId", authenticate, controller.getMeeting);

export default router;
