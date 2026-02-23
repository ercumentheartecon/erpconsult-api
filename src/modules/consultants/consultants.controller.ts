import { Request, Response, NextFunction } from "express";
import { ConsultantsService } from "./consultants.service";
import { sendSuccess } from "../../utils/api-response";

const service = new ConsultantsService();

export class ConsultantsController {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.list();
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
}
