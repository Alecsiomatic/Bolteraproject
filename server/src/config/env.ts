import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url("DATABASE_URL debe ser una URL válida"),
  DB_HOST: z.string().optional(),
  DB_PORT: z.coerce.number().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_NAME: z.string().optional(),
  JWT_SECRET: z.string().min(16, "JWT_SECRET debe tener al menos 16 caracteres"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  FRONTEND_URL: z.string().optional(),
});

const parsed = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  FRONTEND_URL: process.env.FRONTEND_URL,
});

const databaseUrl = new URL(parsed.DATABASE_URL);

export const env = {
  ...parsed,
  DB_HOST: parsed.DB_HOST ?? databaseUrl.hostname,
  DB_PORT: parsed.DB_PORT ?? Number(databaseUrl.port || 3306),
  DB_USER: parsed.DB_USER ?? decodeURIComponent(databaseUrl.username),
  DB_PASSWORD: parsed.DB_PASSWORD ?? decodeURIComponent(databaseUrl.password),
  DB_NAME: parsed.DB_NAME ?? databaseUrl.pathname.replace(/^\//, ""),
  JWT_SECRET: parsed.JWT_SECRET,
  JWT_EXPIRES_IN: parsed.JWT_EXPIRES_IN,
};
