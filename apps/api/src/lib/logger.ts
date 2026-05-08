import winston from "winston";
import path from "path";

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const isDev = process.env.NODE_ENV !== "production";

// Dev console: readable coloured lines
const devFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const extra = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
    return `${timestamp} [${level}] ${message}${stack ? "\n" + stack : ""}${extra}`;
  })
);

// Production: structured JSON for log aggregators
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

const transports: winston.transport[] = [
  new winston.transports.Console({ format: isDev ? devFormat : prodFormat }),
];

if (!isDev) {
  transports.push(
    new winston.transports.File({
      filename: path.join("logs", "error.log"),
      level: "error",
      format: prodFormat,
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
      tailable: true,
    }),
    new winston.transports.File({
      filename: path.join("logs", "combined.log"),
      format: prodFormat,
      maxsize: 20 * 1024 * 1024,
      maxFiles: 10,
      tailable: true,
    })
  );
}

export const logger = winston.createLogger({
  level: isDev ? "debug" : "info",
  transports,
});

// Domain-specific child loggers
export const dealLogger      = logger.child({ domain: "deal" });
export const paymentLogger   = logger.child({ domain: "payment" });
export const commissionLogger = logger.child({ domain: "commission" });
export const authLogger      = logger.child({ domain: "auth" });
export const jobLogger       = logger.child({ domain: "job" });
