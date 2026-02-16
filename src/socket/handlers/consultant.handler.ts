import { Server, Socket } from "socket.io";
import { prisma } from "../../config/database";

// Track pending offline timers per userId so reconnect cancels them
const offlineTimers = new Map<string, NodeJS.Timeout>();
const OFFLINE_GRACE_PERIOD = 15000; // 15 seconds grace period

export function registerConsultantHandlers(io: Server, socket: Socket) {
  socket.on("consultant:join-room", async (data: { roomCode: string }) => {
    try {
      const userId = socket.data.userId;
      console.log(`[consultant:join-room] userId=${userId} roomCode=${data.roomCode}`);

      // Cancel any pending offline timer (reconnect scenario)
      const existingTimer = offlineTimers.get(userId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        offlineTimers.delete(userId);
        console.log(`[consultant:join-room] Cancelled offline timer for userId=${userId}`);
      }

      const consultant = await prisma.consultant.findUnique({
        where: { userId },
      });
      if (!consultant) {
        console.log(`[consultant:join-room] No consultant found for userId=${userId}`);
        return;
      }

      // Leave previous room if any
      if (consultant.currentRoom) {
        socket.leave(`room:${consultant.currentRoom}`);
      }

      await prisma.consultant.update({
        where: { id: consultant.id },
        data: { isAvailable: true, currentRoom: data.roomCode },
      });
      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: true, lastSeen: new Date() },
      });

      socket.join(`room:${data.roomCode}`);

      console.log(`[consultant:join-room] Consultant ${consultant.id} now online in room ${data.roomCode}`);

      io.emit("consultant:status-changed", {
        consultantId: consultant.id,
        userId,
        isAvailable: true,
        currentRoom: data.roomCode,
      });
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

      console.log(`[consultant:disconnect] userId=${userId} socketId=${socket.id} - starting ${OFFLINE_GRACE_PERIOD}ms grace period`);

      // Check if another socket for the same user is still connected
      const sockets = await io.fetchSockets();
      const otherSocket = sockets.find(
        (s) => s.data.userId === userId && s.id !== socket.id
      );
      if (otherSocket) {
        console.log(`[consultant:disconnect] userId=${userId} has another active socket ${otherSocket.id}, skipping offline`);
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
            console.log(`[consultant:disconnect] userId=${userId} reconnected during grace period, skipping offline`);
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
