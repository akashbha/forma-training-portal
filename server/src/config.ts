import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL environment variable is required'),
  APP_URL: z.string().default('http://localhost:3000'),
  CORS_ORIGIN: z.string().default('*'),
  JWT_SECRET: z.string().default('forma-super-secure-production-jwt-secret-key-2026'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().default(7),
  COOKIE_SECRET: z.string().default('forma-cookie-secret-signature-key-2026'),
});

export type EnvConfig = z.infer<typeof envSchema>;

function validateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - [${issue.path.join('.')}] ${issue.message}`)
      .join('\n');

    console.error('\n======================================================');
    console.error('❌ CONFIGURATION ERROR: Invalid environment variables:');
    console.error(errorDetails);
    console.error('======================================================\n');
    console.error('Please check your .env file or environment configuration.\n');
    process.exit(1);
  }

  return result.data;
}

export const config = validateEnv();
