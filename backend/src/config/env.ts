import "dotenv/config";
import { z } from "zod";

const booleanFromString = (defaultValue: "true" | "false") =>
  z
    .string()
    .default(defaultValue)
    .transform((value) => value.toLowerCase() !== "false");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  DATABASE_URL: z.string().min(1).default("./data/nyayasetu.db"),

  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  PUBLIC_BASE_URL: z.url().default("http://localhost:4000"),
  API_PREFIX: z.string().startsWith("/").default("/api/v1"),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),

  ENABLE_SWAGGER: booleanFromString("true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
