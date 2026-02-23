import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error.middleware";
import authRoutes from "./modules/auth/auth.routes";
import roomsRoutes from "./modules/rooms/rooms.routes";
import usersRoutes from "./modules/users/users.routes";
import sessionsRoutes from "./modules/sessions/sessions.routes";
import notificationsRoutes from "./modules/notifications/notifications.routes";
import zoomRoutes from "./modules/zoom/zoom.routes";
import activitiesRoutes from "./modules/activities/activities.routes";
import settingsRoutes from "./modules/settings/settings.routes";
import localInvoicesRoutes from "./modules/local-invoices/local-invoices.routes";

const app = express();

// Trust proxy (Railway runs behind a reverse proxy)
app.set("trust proxy", 1);

// Middleware
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json());
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/zoom", zoomRoutes);
app.use("/api/activities", activitiesRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/local-invoices", localInvoicesRoutes);

// Error handler
app.use(errorHandler);

export default app;
