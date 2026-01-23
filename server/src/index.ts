import { env } from "./config/env";
import { buildServer } from "./server";

const app = buildServer();

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    app.log.info(`🚀 API lista en http://localhost:${env.PORT}`);
    
    // Keep the process alive
    process.on('uncaughtException', (err) => {
      console.error('Uncaught exception:', err);
    });
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();

const shutdownSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
shutdownSignals.forEach((signal) => {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
});
