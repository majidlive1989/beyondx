import pino, { type Logger, type LoggerOptions } from "pino";
export interface LoggerConfiguration { level: string; service: string; environment: string; }
export function createLogger(configuration: LoggerConfiguration): Logger {
  const options: LoggerOptions = {
    level: configuration.level,
    base: { service: configuration.service, environment: configuration.environment },
    redact: { paths: ["req.headers.authorization", "password", "token", "accessToken", "refreshToken", "*.secret"], censor: "[REDACTED]" },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  return pino(options);
}
