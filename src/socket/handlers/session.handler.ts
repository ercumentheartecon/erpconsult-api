import { Server, Socket } from "socket.io";
import { prisma } from "../../config/database";
import { ZoomService } from "../../modules/zoom/zoom.service";
import { env } from "../../config/env";

const zoomService = new ZoomService();

export function registerSessionHandlers(io: Server, socket: Socket) {
  socket.on("session:accept", async (data: { sessionId: string }) => {
    try {
      const consultant = await prisma.consultant.findUnique({
        where: { userId: socket.data.userId },
      });
      if (!consultant) {
        socket.emit("error", { message: "Consultant profile not found" });
        return;
      }

      const session = await prisma.session.findUnique({ where: { id: data.sessionId } });
      if (!session || session.status !== "PENDING") {
        socket.emit("error", { message: "Session not available for acceptance" });
        return;
      }

      const updated = await prisma.session.update({
        where: { id: data.sessionId },
        data: {
          consultantId: consultant.id,
          status: "ACTIVE",
          startedAt: new Date(),
        },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          consultant: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } },
          room: { select: { id: true, code: true, name: true } },
        },
      });

      // Create Zoom meeting automatically when session is accepted
      let zoomMeeting: { meetingId: string; joinUrl: string; password: string } | null = null;
      if (env.ZOOM_ACCOUNT_ID && env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET) {
        try {
          const clientName = `${updated.client?.firstName || ""} ${updated.client?.lastName || ""}`.trim();
          const topic = `${updated.room?.name || "ERPConsult"} - ${clientName} - ${updated.sessionNumber}`;
          zoomMeeting = await zoomService.createMeeting(topic);

          await prisma.session.update({
            where: { id: data.sessionId },
            data: {
              zoomMeetingId: zoomMeeting.meetingId,
              zoomMeetingUrl: zoomMeeting.joinUrl,
              zoomMeetingPassword: zoomMeeting.password,
              videoEnabled: true,
            },
          });

          console.log(`Zoom meeting created for session ${updated.sessionNumber}: ${zoomMeeting.joinUrl}`);
        } catch (zoomErr) {
          console.error("Failed to create Zoom meeting (session will continue without video):", zoomErr);
        }
      }

      // Both parties join the session room
      socket.join(`session:${data.sessionId}`);
      io.to(`user:${updated.clientId}`).socketsJoin(`session:${data.sessionId}`);

      // Notify session participants (include zoom info)
      io.to(`session:${data.sessionId}`).emit("session:status-changed", {
        sessionId: updated.id,
        status: "ACTIVE",
        session: updated,
        zoomMeeting: zoomMeeting || null,
      });

      // Notify client specifically
      io.to(`user:${updated.clientId}`).emit("session:accepted", {
        sessionId: updated.id,
        consultant: updated.consultant,
        zoomMeeting: zoomMeeting || null,
      });

      // Remove from room queue
      if (updated.room) {
        io.to(`room:${updated.room.code}`).emit("session:removed-from-queue", {
          sessionId: updated.id,
        });
      }

      // Create notification for client
      const consultantName = `${updated.consultant?.user?.firstName || ""} ${updated.consultant?.user?.lastName || ""}`.trim();
      await prisma.notification.create({
        data: {
          userId: updated.clientId,
          type: "SESSION_REQUEST",
          title: "Session Accepted",
          message: `Your session ${updated.sessionNumber} has been accepted by ${consultantName}`,
          linkUrl: `/sessions/${updated.id}`,
        },
      });

      // Emit notification via socket
      const notification = await prisma.notification.findFirst({
        where: { userId: updated.clientId },
        orderBy: { createdAt: "desc" },
      });
      if (notification) {
        io.to(`user:${updated.clientId}`).emit("notification:new", notification);
      }
    } catch (err) {
      socket.emit("error", { message: "Failed to accept session" });
    }
  });

  socket.on("session:join", async (data: { sessionId: string }) => {
    try {
      const session = await prisma.session.findUnique({ where: { id: data.sessionId } });
      if (!session) return;

      // Verify user is part of this session
      const consultant = await prisma.consultant.findUnique({ where: { userId: socket.data.userId } });
      const isConsultant = consultant && session.consultantId === consultant.id;
      const isClient = session.clientId === socket.data.userId;
      const isAdmin = socket.data.role === "ADMIN";

      if (!isConsultant && !isClient && !isAdmin) {
        socket.emit("error", { message: "Not authorized to join this session" });
        return;
      }

      socket.join(`session:${data.sessionId}`);
      socket.emit("session:joined", { sessionId: data.sessionId });
    } catch (err) {
      socket.emit("error", { message: "Failed to join session" });
    }
  });
}
