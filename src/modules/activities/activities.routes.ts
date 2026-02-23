import { Router } from "express";
import { ActivitiesController } from "./activities.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { createActivitySchema, updateActivitySchema, bulkCreateSchema } from "./activities.schema";

const router = Router();
const controller = new ActivitiesController();

// All routes require authentication
router.use(authenticate);

router.get("/", controller.list);
router.post("/", validate(createActivitySchema), controller.create);
router.post("/bulk", validate(bulkCreateSchema), controller.bulkCreate);
router.patch("/:id", validate(updateActivitySchema), controller.update);
router.delete("/:id", controller.delete);

export default router;
