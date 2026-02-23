import { Request, Response, NextFunction } from "express";
import { ActivitiesService } from "./activities.service";
import { sendSuccess } from "../../utils/api-response";

const service = new ActivitiesService();

export class ActivitiesController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { odooCompanyId, product, startDate, endDate, billable, invoiced, page, limit } = req.query;
      const result = await service.list({
        userId: req.user!.userId,
        userRole: req.user!.role,
        odooCompanyId: odooCompanyId ? Number(odooCompanyId) : undefined,
        product: product as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        billable: billable !== undefined ? billable === "true" : undefined,
        invoiced: invoiced !== undefined ? invoiced === "true" : undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.create(req.user!.userId, req.body);
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.update(req.params.id as string, req.user!.userId, req.user!.role, req.body);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.delete(req.params.id as string, req.user!.userId, req.user!.role);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async bulkCreate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.bulkCreate(req.user!.userId, req.body);
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }
}
