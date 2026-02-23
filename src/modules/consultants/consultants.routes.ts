import { Router } from "express";
import { ConsultantsController } from "./consultants.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/role.middleware";
import { createConsultantSchema, updateConsultantSchema } from "./consultants.schema";

const router = Router();
const controller = new ConsultantsController();

// All routes require authentication
router.use(authenticate);

// List & get — any authenticated user can read
router.get("/", controller.list);
router.get("/:id", controller.getById);

// Create, update, delete — ADMIN only
router.post("/", authorize("ADMIN"), validate(createConsultantSchema), controller.create);
router.patch("/:id", authorize("ADMIN"), validate(updateConsultantSchema), controller.update);
router.delete("/:id", authorize("ADMIN"), controller.delete);

export default router;
