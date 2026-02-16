import { Server, Socket } from "socket.io";
import { prisma } from "../../config/database";

export function registerChatHandlers(io: Server, socket: Socket) {
  socket.on("chat:message", async (data: { sessionId: string; message: string; messageType?: string }) => {
    try {
      const session = await prisma.session.findUnique({ where: { id: data.sessionId } });
      if (!session || session.status !== "ACTIVE") {
        socket.emit("error", { message: "Session is not active" });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: socket.data.userId },
        select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true },
      });
      if (!user) return;

      const chatMessage = await prisma.chatMessage.create({
        data: {
          sessionId: data.sessionId,
          userId: socket.data.userId,
          userRole: user.role,
          message: data.message,
          messageType: (data.messageType as any) || "TEXT",
        },
      });

      io.to(`session:${data.sessionId}`).emit("chat:new-message", {
        id: chatMessage.id,
        sessionId: data.sessionId,
        message: data.message,
        messageType: chatMessage.messageType,
        sentAt: chatMessage.sentAt.toISOString(),
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          avatarUrl: user.avatarUrl,
          role: user.role,
        },
      });
    } catch (err) {
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  socket.on("chat:mark-read", async (data: { sessionId: string }) => {
    try {
      await prisma.chatMessage.updateMany({
        where: {
          sessionId: data.sessionId,
          userId: { not: socket.data.userId },
          readAt: null,
        },
        data: { readAt: new Date() },
      });

      io.to(`session:${data.sessionId}`).emit("chat:messages-read", {
        sessionId: data.sessionId,
        readBy: socket.data.userId,
      });
    } catch {
      // ignore read errors
    }
  });
}
