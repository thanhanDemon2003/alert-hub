import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER ?? 'alerthub',
  password: process.env.DATABASE_PASSWORD ?? 'alerthub',
  database: process.env.DATABASE_NAME ?? 'alerthub',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
});
