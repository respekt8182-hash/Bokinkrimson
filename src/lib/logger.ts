// Domain/service module for logger.
type LogLevel = "info" | "warn" | "error";

function serializeContext(context?: Record<string, unknown>): string {
  if (!context) return "";

  try {
    return ` ${JSON.stringify(context)}`;
  } catch {
    return " [context_unserializable]";
  }
}

function write(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${serializeContext(context)}`;

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    write("info", message, context);
  },
  warn(message: string, context?: Record<string, unknown>) {
    write("warn", message, context);
  },
  error(message: string, context?: Record<string, unknown>) {
    write("error", message, context);
  },
};
