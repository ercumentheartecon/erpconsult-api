import { Server, Socket } from "socket.io";
import { prisma } from "../../config/database";

// Track pending offline timers per userId so reconnect cancels them
const offlineTimers = new Map<string, NodeJS.Timeout>();
const OFFLINE_GRACE_PERIOD = 15000; // 15 seconds grace period

export function registerConsultantHandlers(io: Server, socket: Socket) {
  socket.on("consultant:join-room", async (data: { roomCode: string }) => {
    try {
      const userId = socket.data.userId;

      // Cancel any pending offline timer (reconnect scenario)
      const existingTimer = offlineTimers.get(userId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        offlineTimers.delete(userId);
      }

      const consultant = await prisma.consultant.findUnique({
        where: { userId },
      });
      if (!consultant) {
        console.log(`[consultant:join-room] No consultant found for userId=${userId}`);
        return;
      }

      // If already in the same room and available, just ensure socket is joined (no broadcast)
      const alreadyInRoom = consultant.isAvailable && consultant.currentRoom === data.roomCode;

      // Leave previous room if switching rooms
      if (consultant.currentRoom && consultant.currentRoom !== data.roomCode) {
        socket.leave(`room:${consultant.currentRoom}`);
      }

      // Update DB only if state actually changed
      if (!alreadyInRoom) {
        await prisma.consultant.update({
          where: { id: consultant.id },
          data: { isAvailable: true, currentRoom: data.roomCode },
        });
        await prisma.user.update({
          where: { id: userId },
          data: { isOnline: true, lastSeen: new Date() },
        });
      }

      // Always ensure socket is in the room
      socket.join(`room:${data.roomCode}`);

      // Only broadcast if state actually changed (prevents infinite loops)
      if (!alreadyInRoom) {
        console.log(`[consultant:join-room] Consultant ${consultant.id} now online in room ${data.roomCode}`);
        io.emit("consultant:status-changed", {
          consultantId: consultant.id,
          userId,
          isAvailable: true,
          currentRoom: data.roomCode,
        });
      }
    } catch (err) {
      console.error("[consultant:join-room] Error:", err);
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  socket.on("consultant:go-offline", async () => {
    try {
      const userId = socket.data.userId;
      console.log(`[consultant:go-offline] userId=${userId}`);

      // Cancel any pending offline timer
      const existingTimer = offlineTimers.get(userId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        offlineTimers.delete(userId);
      }

      const consultant = await prisma.consultant.findUnique({
        where: { userId },
      });
      if (!consultant) return;

      const previousRoom = consultant.currentRoom;

      await prisma.consultant.update({
        where: { id: consultant.id },
        data: { isAvailable: false, currentRoom: null },
      });
      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: false, lastSeen: new Date() },
      });

      if (previousRoom) {
        socket.leave(`room:${previousRoom}`);
      }

      console.log(`[consultant:go-offline] Consultant ${consultant.id} now offline`);

      io.emit("consultant:status-changed", {
        consultantId: consultant.id,
        userId,
        isAvailable: false,
        currentRoom: null,
      });
    } catch (err) {
      console.error("[consultant:go-offline] Error:", err);
      socket.emit("error", { message: "Failed to go offline" });
    }
  });

  socket.on("disconnect", async () => {
    try {
      if (socket.data.role !== "CONSULTANT") return;
      const userId = socket.data.userId;

      const consultant = await prisma.consultant.findUnique({
        where: { userId },
      });
      if (!consultant || !consultant.isAvailable) return;

      // Check if another socket for the same user is still connected
      const sockets = await io.fetchSockets();
      const otherSocket = sockets.find(
        (s) => s.data.userId === userId && s.id !== socket.id
      );
      if (otherSocket) {
        return;
      }

      // Grace period: wait before going offline (allows page navigation / reconnect)
      const timer = setTimeout(async () => {
        offlineTimers.delete(userId);
        try {
          // Re-check: another socket may have connected during grace period
          const currentSockets = await io.fetchSockets();
          const reconnected = currentSockets.find((s) => s.data.userId === userId);
          if (reconnected) {
            return;
          }

          // Re-check DB: consultant may have already gone offline explicitly
          const freshConsultant = await prisma.consultant.findUnique({ where: { userId } });
          if (!freshConsultant || !freshConsultant.isAvailable) return;

          await prisma.consultant.update({
            where: { id: freshConsultant.id },
            data: { isAvailable: false, currentRoom: null },
          });
          await prisma.user.update({
            where: { id: userId },
            data: { isOnline: false, lastSeen: new Date() },
          });

          console.log(`[consultant:disconnect] Consultant ${freshConsultant.id} set offline after grace period`);

          io.emit("consultant:status-changed", {
            consultantId: freshConsultant.id,
            userId,
            isAvailable: false,
            currentRoom: null,
          });
        } catch (err) {
          console.error("[consultant:disconnect] Grace period error:", err);
        }
      }, OFFLINE_GRACE_PERIOD);

      offlineTimers.set(userId, timer);
    } catch {
      // ignore disconnect cleanup errors
    }
  });
}
