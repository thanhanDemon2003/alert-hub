import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  appConfig,
  dbConfig,
  escalationConfig,
  redisConfig,
} from './config/app.config';
import { AlertsModule } from './alerts/alerts.module';
import { DevicesModule } from './devices/devices.module';
import { RedisModule } from './common/redis.module';
import { Device } from './devices/device.entity';
import { Alert } from './alerts/alert.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, redisConfig, escalationConfig],
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.database'),
        entities: [Device, Alert],
        synchronize: false,
        migrations: ['dist/migrations/*.js'],
        migrationsRun: true,
        logging: config.get('app.nodeEnv') === 'development',
        ssl: false,
      }),
    }),

    RedisModule,
    DevicesModule,
    AlertsModule,
  ],
})
export class AppModule {}
