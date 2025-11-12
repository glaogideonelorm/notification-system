import { z } from "zod";

import * as dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  PORT: z.string().default("3000"),

  DATABASE_URL: z.string().url(),

  RABBITMQ_URL: z.string().url(),

  USER_SERVICE_BASE_URL: z.string().url().optional(),

  TEMPLATE_SERVICE_BASE_URL: z.string().url().optional(),

  INTERNAL_SERVICE_TOKEN: z.string().min(1).optional(),

  JWT_PUBLIC_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
