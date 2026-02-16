import { prisma } from "../../config/database";
import { ApiError } from "../../utils/api-error";
import { CreateSessionInput, EndSessionInput, RateSessionInput } from "./sessions.schema";

const sessionSelect = {
  client: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true, companyName: true },
  },
  consultant: {
    include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
  },
  room: { select: { id: true, code: true, name: true } },
};

export class SessionsService {
  private async generateSessionNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.session.count({
      where: { sessionNumber: { startsWith: `SES-${year}-` } },
    });
    const num = String(count + 1).padStart(5, "0");
    return `SES-${year}-${num}`;
  }

  async create(clientId: string, data: CreateSessionInput) {
    const room = await prisma.room.findUnique({ where: { id: data.roomId } });
    if (!room || !room.isActive) {
      throw new ApiError("ROOM_NOT_FOUND", "Room not found or inactive", 404);
    }

    if (data.consultantId) {
      const consultant = await prisma.consultant.findUnique({
        where: { id: data.consultantId },
      });
      if (!consultant || !consultant.isAvailable) {
        throw new ApiError("CONSULTANT_UNAVAILABLE", "Consultant is not available", 400);
      }
    }

    const companyUser = await prisma.companyUser.findFirst({
      where: { userId: clientId },
    });

    const sessionNumber = await this.generateSessionNumber();

    const session = await prisma.session.create({
      data: {
        sessionNumber,
        clientId,
        consultantId: data.consultantId || null,
        roomId: data.roomId,
        companyId: companyUser?.companyId || null,
        status: "PENDING",
        problemDescription: data.problemDescription,
        tags: data.tags || [],
      },
      include: sessionSelect,
    });

    return session;
  }

  async getById(sessionId: string, userId: string, role: string) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        ...sessionSelect,
        chatMessages: {
          orderBy: { sentAt: "asc" },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true } },
          },
        },
      },
    });

    if (!session) {
      throw new ApiError("SESSION_NOT_FOUND", "Session not found", 404);
    }

    // Authorization check
    if (role !== "ADMIN" && session.clientId !== userId) {
      const consultant = await prisma.consultant.findUnique({ where: { userId } });
      if (!consultant) {
        throw new ApiError("FORBIDDEN", "You do not have access to this session", 403);
      }
      // Consultant can access: their assigned sessions OR pending sessions in their current room
      const isAssigned = session.consultantId === consultant.id;
      const isPendingInRoom = session.status === "PENDING" && consultant.currentRoom && session.roomId != null;
      let isInSameRoom = false;
      if (isPendingInRoom) {
        const room = await prisma.room.findUnique({ where: { id: session.roomId! } });
        isInSameRoom = room?.code === consultant.currentRoom;
      }
      if (!isAssigned && !isInSameRoom) {
        throw new ApiError("FORBIDDEN", "You do not have access to this session", 403);
      }
    }

    return session;
  }

  async listForUser(userId: string, role: string, query: { status?: string; page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (role === "CLIENT") {
      where.clientId = userId;
      if (query.status) where.status = query.status;
    } else if (role === "CONSULTANT") {
      const consultant = await prisma.consultant.findUnique({ where: { userId } });
      if (!consultant) throw new ApiError("NOT_CONSULTANT", "Consultant profile not found", 404);

      if (query.status === "PENDING" && consultant.currentRoom) {
        // Show pending sessions in the consultant's current room
        const room = await prisma.room.findFirst({ where: { code: consultant.currentRoom } });
        where.status = "PENDING";
        if (room) where.roomId = room.id;
      } else {
        // Show consultant's own assigned sessions
        where.consultantId = consultant.id;
        if (query.status) where.status = query.status;
      }
    } else {
      // ADMIN sees all
      if (query.status) where.status = query.status;
    }

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: sessionSelect,
      }),
      prisma.session.count({ where }),
    ]);

    return { sessions, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async end(sessionId: string, userId: string, role: string, data: EndSessionInput) {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new ApiError("SESSION_NOT_FOUND", "Session not found", 404);
    if (session.status !== "ACTIVE") throw new ApiError("INVALID_STATUS", "Session is not active", 400);

    // Only consultant or admin can end
    if (role !== "ADMIN") {
      const consultant = await prisma.consultant.findUnique({ where: { userId } });
      if (!consultant || session.consultantId !== consultant.id) {
        throw new ApiError("FORBIDDEN", "Only the assigned consultant can end the session", 403);
      }
    }

    const now = new Date();
    const durationMinutes = session.startedAt
      ? Math.round((now.getTime() - session.startedAt.getTime()) / 60000)
      : 0;

    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        endedAt: now,
        durationMinutes,
        billableMinutes: durationMinutes,
        solutionSummary: data.solutionSummary,
        consultantNotes: data.consultantNotes,
      },
      include: sessionSelect,
    });

    // Update consultant stats
    if (session.consultantId) {
      await prisma.consultant.update({
        where: { id: session.consultantId },
        data: {
          totalSessions: { increment: 1 },
          totalHours: { increment: durationMinutes / 60 },
        },
      });
    }

    return updated;
  }

  async rate(sessionId: string, clientId: string, data: RateSessionInput) {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new ApiError("SESSION_NOT_FOUND", "Session not found", 404);
    if (session.clientId !== clientId) throw new ApiError("FORBIDDEN", "Only the client can rate", 403);
    if (session.status !== "COMPLETED") throw new ApiError("INVALID_STATUS", "Session must be completed to rate", 400);

    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: {
        clientRating: data.rating,
        clientFeedback: data.feedback,
      },
    });

    // Update consultant average rating
    if (session.consultantId) {
      const avgResult = await prisma.session.aggregate({
        where: { consultantId: session.consultantId, clientRating: { not: null } },
        _avg: { clientRating: true },
      });
      await prisma.consultant.update({
        where: { id: session.consultantId },
        data: { averageRating: avgResult._avg.clientRating || 0 },
      });
    }

    return updated;
  }
}
