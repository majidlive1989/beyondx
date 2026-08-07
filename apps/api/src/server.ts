import { createApp } from "./app.js";
import { createRuntimeDependencies } from "./runtime.js";

const dependencies = await createRuntimeDependencies();
const app = await createApp(dependencies);
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "Graceful shutdown started");
  const timeout = setTimeout(() => { app.log.fatal({ signal }, "Graceful shutdown timed out"); process.exit(1); }, dependencies.config.SHUTDOWN_TIMEOUT_MS);
  timeout.unref();
  try { await app.close(); await dependencies.close(); clearTimeout(timeout); app.log.info({ signal }, "Graceful shutdown completed"); process.exit(0); }
  catch (error) { clearTimeout(timeout); app.log.error({ err: error, signal }, "Graceful shutdown failed"); process.exit(1); }
}
process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
process.once("SIGINT", () => { void shutdown("SIGINT"); });
try { await app.listen({ host: dependencies.config.API_HOST, port: dependencies.config.API_PORT }); app.log.info({ host: dependencies.config.API_HOST, port: dependencies.config.API_PORT }, "BeyondX API started"); }
catch (error) { app.log.fatal({ err: error }, "BeyondX API failed to start"); await dependencies.close(); process.exit(1); }
