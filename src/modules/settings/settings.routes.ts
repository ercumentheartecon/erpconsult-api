import { Router } from "express";
import { SettingsController } from "./settings.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();
const controller = new SettingsController();

// All settings routes require authentication
router.use(authenticate);

router.get("/", controller.list);
router.post("/bulk", controller.bulkSet);
router.get("/:key", controller.get);
router.put("/:key", controller.set);
router.delete("/:key", controller.delete);

export default router;
