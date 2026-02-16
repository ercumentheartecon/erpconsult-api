import { createServer } from "http";
import app from "./app";
import { env } from "./config/env";
import { connectRedis } from "./config/redis";
import { initializeSocket } from "./socket";

async function main() {
  await connectRedis();

  const httpServer = createServer(app);
  initializeSocket(httpServer);

  httpServer.listen(Number(env.PORT), () => {
    console.log(`ERPConsult API running on port ${env.PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
