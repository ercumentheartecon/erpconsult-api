import Redis from "ioredis";
import { env } from "./env";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redis.on("error", (err) => {
      console.error("Redis connection error:", err.message);
    });

    redis.on("connect", () => {
      console.log("Redis connected");
    });
  }
  return redis;
}

export async function connectRedis(): Promise<void> {
  try {
    const client = getRedis();
    await client.connect();
  } catch (err) {
    console.warn("Redis not available, running without cache:", (err as Error).message);
  }
}
