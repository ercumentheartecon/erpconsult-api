import { Request, Response, NextFunction } from "express";
import { UsersService } from "./users.service";
import { sendSuccess } from "../../utils/api-response";

const usersService = new UsersService();

export class UsersController {
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.getProfile(req.user!.userId);
      sendSuccess(res, user);
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.updateProfile(req.user!.userId, req.body);
      sendSuccess(res, user);
    } catch (err) {
      next(err);
    }
  }
}
