import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
}));

export const dbConfig = registerAs('database', () => ({
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER ?? 'alerthub',
  password: process.env.DATABASE_PASSWORD ?? 'alerthub',
  database: process.env.DATABASE_NAME ?? 'alerthub',
}));

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379/0',
}));

export const escalationConfig = registerAs('escalation', () => ({
  windowSeconds: parseInt(process.env.ESCALATION_WINDOW_SECONDS ?? '60', 10),
  threshold: parseInt(process.env.ESCALATION_THRESHOLD ?? '5', 10),
}));
