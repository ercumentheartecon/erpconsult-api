import { Request, Response, NextFunction } from "express";
import { RoomsService } from "./rooms.service";
import { sendSuccess } from "../../utils/api-response";

const roomsService = new RoomsService();

export class RoomsController {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const rooms = await roomsService.getAll();
      sendSuccess(res, rooms);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const room = await roomsService.getById(req.params.id as string);
      sendSuccess(res, room);
    } catch (err) {
      next(err);
    }
  }
}
