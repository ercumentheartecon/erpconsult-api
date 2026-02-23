import { Router } from "express";
import { LocalInvoicesController } from "./local-invoices.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();
const controller = new LocalInvoicesController();

router.use(authenticate);

router.get("/", controller.list);
router.post("/", controller.create);
router.post("/bulk", controller.bulkCreate);
router.patch("/odoo/:odooInvoiceId", controller.updateByOdooId);
router.get("/:id", controller.getById);
router.patch("/:id", controller.update);
router.delete("/:id", controller.delete);

export default router;
