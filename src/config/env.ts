import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("3001"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default("4h"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),
  // Zoom Server-to-Server OAuth (meeting creation API)
  ZOOM_ACCOUNT_ID: z.string().default(""),
  ZOOM_CLIENT_ID: z.string().default(""),
  ZOOM_CLIENT_SECRET: z.string().default(""),
  // Zoom Meeting SDK (embedded video)
  ZOOM_SDK_KEY: z.string().default(""),
  ZOOM_SDK_SECRET: z.string().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
