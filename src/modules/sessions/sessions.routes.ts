import { Router } from "express";
import { SessionsController } from "./sessions.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import { createSessionSchema, endSessionSchema, rateSessionSchema } from "./sessions.schema";

const router = Router();
const controller = new SessionsController();

router.post("/", authenticate, authorize("CLIENT"), validate(createSessionSchema), controller.create);
router.get("/", authenticate, controller.list);
router.get("/:id", authenticate, controller.getById);
router.post("/:id/end", authenticate, validate(endSessionSchema), controller.end);
router.post("/:id/rate", authenticate, authorize("CLIENT"), validate(rateSessionSchema), controller.rate);

export default router;
