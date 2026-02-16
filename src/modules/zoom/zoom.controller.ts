import { Request, Response, NextFunction } from "express";
import { ZoomService } from "./zoom.service";
import { prisma } from "../../config/database";
import { sendSuccess } from "../../utils/api-response";
import { ApiError } from "../../utils/api-error";

const zoomService = new ZoomService();

export class ZoomController {
  /**
   * POST /api/zoom/meeting
   * Create a Zoom meeting for an active session
   * Only consultant or admin can create meetings
   */
  async createMeeting(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.body;
      if (!sessionId) {
        throw new ApiError("VALIDATION_ERROR", "sessionId is required", 400);
      }

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          client: { select: { firstName: true, lastName: true } },
          room: { select: { name: true } },
        },
      });

      if (!session) {
        throw new ApiError("SESSION_NOT_FOUND", "Session not found", 404);
      }

      if (session.status !== "ACTIVE") {
        throw new ApiError("INVALID_STATUS", "Session must be active to create a meeting", 400);
      }

      // Session participants or admin can create meetings
      if (req.user!.role !== "ADMIN") {
        const isClient = session.clientId === req.user!.userId;
        const consultant = await prisma.consultant.findUnique({ where: { userId: req.user!.userId } });
        const isConsultant = consultant && session.consultantId === consultant.id;
        if (!isClient && !isConsultant) {
          throw new ApiError("FORBIDDEN", "Only session participants can create meetings", 403);
        }
      }

      // If meeting already exists, return existing
      if (session.zoomMeetingUrl) {
        sendSuccess(res, {
          meetingId: session.zoomMeetingId,
          joinUrl: session.zoomMeetingUrl,
          password: session.zoomMeetingPassword,
        });
        return;
      }

      const clientName = `${session.client?.firstName || ""} ${session.client?.lastName || ""}`.trim();
      const topic = `${session.room?.name || "ERPConsult"} - ${clientName} - ${session.sessionNumber}`;

      const meeting = await zoomService.createMeeting(topic);

      // Update session with zoom meeting info
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          zoomMeetingId: meeting.meetingId,
          zoomMeetingUrl: meeting.joinUrl,
          zoomMeetingPassword: meeting.password,
          videoEnabled: true,
        },
      });

      sendSuccess(res, meeting, 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/zoom/meeting/:sessionId
   * Get Zoom meeting details for a session
   */
  async getMeeting(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = req.params.sessionId as string;

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          zoomMeetingId: true,
          zoomMeetingUrl: true,
          zoomMeetingPassword: true,
          clientId: true,
          consultantId: true,
          status: true,
        },
      });

      if (!session) {
        throw new ApiError("SESSION_NOT_FOUND", "Session not found", 404);
      }

      // Authorization: client, consultant, or admin
      if (req.user!.role !== "ADMIN" && session.clientId !== req.user!.userId) {
        const consultant = await prisma.consultant.findUnique({ where: { userId: req.user!.userId } });
        if (!consultant || session.consultantId !== consultant.id) {
          throw new ApiError("FORBIDDEN", "Access denied", 403);
        }
      }

      if (!session.zoomMeetingUrl) {
        sendSuccess(res, { meetingId: null, joinUrl: null, password: null });
        return;
      }

      sendSuccess(res, {
        meetingId: session.zoomMeetingId,
        joinUrl: session.zoomMeetingUrl,
        password: session.zoomMeetingPassword,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/zoom/signature
   * Generate a Meeting SDK JWT signature for embedding Zoom in the browser.
   * Any authenticated session participant can request a signature.
   */
  async getSignature(req: Request, res: Response, next: NextFunction) {
    try {
      const { meetingNumber, role } = req.body;

      if (!meetingNumber) {
        throw new ApiError("VALIDATION_ERROR", "meetingNumber is required", 400);
      }

      const meetingRole = role === 1 ? 1 : 0; // Default to participant

      const result = zoomService.generateSDKSignature(String(meetingNumber), meetingRole);

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}
