import Redis from "ioredis";

// ✅ Create singleton Redis instance
export const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    console.log(`[REDIS] Retrying connection in ${delay}ms...`);
    return delay;
  },
  maxRetriesPerRequest: null,
});

// ✅ Event listeners
redis.on("connect", () => {
  console.log("[REDIS] Connected successfully");
});

redis.on("error", (err) => {
  console.error("[REDIS ERROR]", err.message);
});

redis.on("close", () => {
  console.log("[REDIS] Connection closed");
});

export default redis;
