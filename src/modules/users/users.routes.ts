import { Router } from "express";
import { UsersController } from "./users.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();
const controller = new UsersController();

router.get("/me", authenticate, controller.getProfile);
router.patch("/me", authenticate, controller.updateProfile);

export default router;
