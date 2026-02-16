import { Server, Socket } from "socket.io";
import { prisma } from "../../config/database";

export function registerConsultantHandlers(io: Server, socket: Socket) {
  socket.on("consultant:join-room", async (data: { roomCode: string }) => {
    try {
      const consultant = await prisma.consultant.findUnique({
        where: { userId: socket.data.userId },
      });
      if (!consultant) return;

      // Leave previous room if any
      if (consultant.currentRoom) {
        socket.leave(`room:${consultant.currentRoom}`);
      }

      await prisma.consultant.update({
        where: { id: consultant.id },
        data: { isAvailable: true, currentRoom: data.roomCode },
      });
      await prisma.user.update({
        where: { id: socket.data.userId },
        data: { isOnline: true, lastSeen: new Date() },
      });

      socket.join(`room:${data.roomCode}`);

      io.emit("consultant:status-changed", {
        consultantId: consultant.id,
        userId: socket.data.userId,
        isAvailable: true,
        currentRoom: data.roomCode,
      });
    } catch (err) {
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  socket.on("consultant:go-offline", async () => {
    try {
      const consultant = await prisma.consultant.findUnique({
        where: { userId: socket.data.userId },
      });
      if (!consultant) return;

      const previousRoom = consultant.currentRoom;

      await prisma.consultant.update({
        where: { id: consultant.id },
        data: { isAvailable: false, currentRoom: null },
      });
      await prisma.user.update({
        where: { id: socket.data.userId },
        data: { isOnline: false, lastSeen: new Date() },
      });

      if (previousRoom) {
        socket.leave(`room:${previousRoom}`);
      }

      io.emit("consultant:status-changed", {
        consultantId: consultant.id,
        userId: socket.data.userId,
        isAvailable: false,
        currentRoom: null,
      });
    } catch (err) {
      socket.emit("error", { message: "Failed to go offline" });
    }
  });

  socket.on("disconnect", async () => {
    try {
      if (socket.data.role !== "CONSULTANT") return;

      const consultant = await prisma.consultant.findUnique({
        where: { userId: socket.data.userId },
      });
      if (!consultant || !consultant.isAvailable) return;

      await prisma.consultant.update({
        where: { id: consultant.id },
        data: { isAvailable: false, currentRoom: null },
      });
      await prisma.user.update({
        where: { id: socket.data.userId },
        data: { isOnline: false, lastSeen: new Date() },
      });

      io.emit("consultant:status-changed", {
        consultantId: consultant.id,
        userId: socket.data.userId,
        isAvailable: false,
        currentRoom: null,
      });
    } catch {
      // ignore disconnect cleanup errors
    }
  });
}
