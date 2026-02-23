import { Request, Response, NextFunction } from "express";
import { LocalInvoicesService } from "./local-invoices.service";
import { sendSuccess } from "../../utils/api-response";

const service = new LocalInvoicesService();

export class LocalInvoicesController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, odooCompanyId, parentCompanyId } = req.query;
      const result = await service.list({
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        odooCompanyId: odooCompanyId ? Number(odooCompanyId) : undefined,
        parentCompanyId: parentCompanyId ? Number(parentCompanyId) : undefined,
      });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.getById(req.params.id as string);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.create(req.body);
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.update(req.params.id as string, req.body);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.delete(req.params.id as string);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async bulkCreate(req: Request, res: Response, next: NextFunction) {
    try {
      const { invoices } = req.body;
      const result = await service.bulkCreate(invoices);
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async updateByOdooId(req: Request, res: Response, next: NextFunction) {
    try {
      const odooInvoiceId = Number(req.params.odooInvoiceId);
      const result = await service.updateByOdooId(odooInvoiceId, req.body);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}
