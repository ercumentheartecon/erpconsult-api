import { Router } from "express";
import { RoomsController } from "./rooms.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();
const controller = new RoomsController();

router.get("/", authenticate, controller.getAll);
router.get("/:id", authenticate, controller.getById);

export default router;
