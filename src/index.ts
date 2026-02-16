import app from "./app";
import { env } from "./config/env";
import { connectRedis } from "./config/redis";

async function main() {
  await connectRedis();

  app.listen(Number(env.PORT), () => {
    console.log(`ERPConsult API running on port ${env.PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
