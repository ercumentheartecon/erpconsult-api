import { Request, Response, NextFunction } from "express";
import { SettingsService } from "./settings.service";
import { sendSuccess } from "../../utils/api-response";

const service = new SettingsService();

export class SettingsController {
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params;
      const value = await service.get(key as string);
      sendSuccess(res, value);
    } catch (err) {
      next(err);
    }
  }

  async set(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params;
      const { value } = req.body;
      const result = await service.set(key as string, value);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params;
      const result = await service.delete(key as string);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.list();
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async bulkSet(req: Request, res: Response, next: NextFunction) {
    try {
      const { entries } = req.body;
      const result = await service.bulkSet(entries);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}
