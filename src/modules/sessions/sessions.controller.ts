import { Request, Response, NextFunction } from "express";
import { SessionsService } from "./sessions.service";
import { sendSuccess } from "../../utils/api-response";
import { getIO } from "../../socket";

const sessionsService = new SessionsService();

export class SessionsController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const session = await sessionsService.create(req.user!.userId, req.body);

      // Emit to consultants in the room
      try {
        const io = getIO();
        if (session.room) {
          io.to(`room:${session.room.code}`).emit("session:new-request", {
            sessionId: session.id,
            sessionNumber: session.sessionNumber,
            client: session.client,
            problem: session.problemDescription,
            room: session.room,
            createdAt: session.createdAt,
          });
        }
      } catch {
        // Socket not initialized, ignore
      }

      sendSuccess(res, session, 201);
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await sessionsService.listForUser(req.user!.userId, req.user!.role, {
        status: req.query.status as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const session = await sessionsService.getById(
        req.params.id as string,
        req.user!.userId,
        req.user!.role
      );
      sendSuccess(res, session);
    } catch (err) {
      next(err);
    }
  }

  async end(req: Request, res: Response, next: NextFunction) {
    try {
      const session = await sessionsService.end(
        req.params.id as string,
        req.user!.userId,
        req.user!.role,
        req.body
      );

      try {
        const io = getIO();
        io.to(`session:${session.id}`).emit("session:status-changed", {
          sessionId: session.id,
          status: "COMPLETED",
          endedAt: session.endedAt,
          durationMinutes: session.durationMinutes,
        });
      } catch {
        // Socket not initialized
      }

      sendSuccess(res, session);
    } catch (err) {
      next(err);
    }
  }

  async rate(req: Request, res: Response, next: NextFunction) {
    try {
      const session = await sessionsService.rate(
        req.params.id as string,
        req.user!.userId,
        req.body
      );
      sendSuccess(res, session);
    } catch (err) {
      next(err);
    }
  }
}
