import { FastifyInstance } from "fastify";
import { healthcheck } from "../lib/db";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    await healthcheck();
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  });
}
