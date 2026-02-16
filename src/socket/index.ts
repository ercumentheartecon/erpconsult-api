import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { createAdapter } from "@socket.io/redis-adapter";
import { getRedis } from "../config/redis";
import { env } from "../config/env";
import { socketAuthMiddleware } from "./middleware";
import { registerSessionHandlers } from "./handlers/session.handler";
import { registerChatHandlers } from "./handlers/chat.handler";
import { registerConsultantHandlers } from "./handlers/consultant.handler";

let io: Server;

export function getIO(): Server {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

export function initializeSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["websocket", "polling"],
  });

  // Redis adapter for pub/sub
  try {
    const pubClient = getRedis();
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    console.log("Socket.io Redis adapter attached");
  } catch (err) {
    console.warn("Socket.io running without Redis adapter:", (err as Error).message);
  }

  // Authentication middleware
  io.use(socketAuthMiddleware);

  // Connection handler
  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id} (user: ${socket.data.userId}, role: ${socket.data.role})`);

    // Join user's personal room for targeted notifications
    socket.join(`user:${socket.data.userId}`);

    registerConsultantHandlers(io, socket);
    registerSessionHandlers(io, socket);
    registerChatHandlers(io, socket);

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${socket.id} (reason: ${reason})`);
    });
  });

  console.log("Socket.io server initialized");
  return io;
}
