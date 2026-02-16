import { Request, Response, NextFunction } from "express";
import { NotificationsService } from "./notifications.service";
import { sendSuccess } from "../../utils/api-response";

const notificationsService = new NotificationsService();

export class NotificationsController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await notificationsService.listForUser(req.user!.userId, {
        unreadOnly: req.query.unreadOnly === "true",
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationsService.markAsRead(req.user!.userId, req.params.id as string);
      sendSuccess(res, { message: "Notification marked as read" });
    } catch (err) {
      next(err);
    }
  }

  async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationsService.markAllAsRead(req.user!.userId);
      sendSuccess(res, { message: "All notifications marked as read" });
    } catch (err) {
      next(err);
    }
  }
}
