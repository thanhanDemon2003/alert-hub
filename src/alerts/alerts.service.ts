import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { Alert, AlertSeverity } from './alert.entity';
import { AlertFilterDto } from './dto/alert-filter.dto';
import { CreateAlertDto } from './dto/create-alert.dto';
import { EscalationService, REDIS_CLIENT } from './escalation.service';
import { Device } from '../devices/device.entity';

const ALERT_STREAM_KEY = 'alerthub:alert_stream';
const STREAM_MAX_LEN = 1000;

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,

    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,

    private readonly escalation: EscalationService,

    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async ingest(dto: CreateAlertDto): Promise<Alert> {
    const device = await this.deviceRepo.findOneBy({ id: dto.deviceId });
    if (!device) {
      throw new NotFoundException(`Device ${dto.deviceId} not found`);
    }

    const shouldEscalate = await this.escalation.checkAndEscalate(
      dto.deviceId,
      dto.eventType,
    );

    if (shouldEscalate) {
      this.logger.log(
        `Auto-escalating: device=${dto.deviceId} event_type=${dto.eventType} → critical`,
      );
    }

    const alert = this.alertRepo.create({
      deviceId: dto.deviceId,
      eventType: dto.eventType,
      severity: shouldEscalate ? AlertSeverity.CRITICAL : dto.severity,
      message: dto.message,
      escalated: shouldEscalate,
    });
    const saved = await this.alertRepo.save(alert);

    const full = await this.alertRepo.findOne({
      where: { id: saved.id },
      relations: ['device'],
    });

    this.publishToStream(full!).catch((err) =>
      this.logger.error(`Stream publish failed: ${err}`),
    );

    return full!;
  }

  async findAll(filters: AlertFilterDto): Promise<{ items: Alert[]; total: number }> {
    const qb = this.alertRepo
      .createQueryBuilder('alert')
      .leftJoinAndSelect('alert.device', 'device')
      .orderBy('alert.occurredAt', 'DESC')
      .skip(filters.offset)
      .take(filters.pageSize);

    if (filters.deviceId) {
      qb.andWhere('alert.device_id = :deviceId', { deviceId: filters.deviceId });
    }
    if (filters.severity) {
      qb.andWhere('alert.severity = :severity', { severity: filters.severity });
    }
    if (filters.fromTime) {
      qb.andWhere('alert.occurred_at >= :fromTime', { fromTime: filters.fromTime });
    }
    if (filters.toTime) {
      qb.andWhere('alert.occurred_at <= :toTime', { toTime: filters.toTime });
    }

    if (filters.keyword) {
      qb.andWhere(
        `alert.search_vector @@ plainto_tsquery('english', :keyword)`,
        { keyword: filters.keyword },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findOne(id: string): Promise<Alert> {
    const alert = await this.alertRepo.findOne({
      where: { id },
      relations: ['device'],
    });
    if (!alert) throw new NotFoundException(`Alert ${id} not found`);
    return alert;
  }

  private async publishToStream(alert: Alert): Promise<void> {
    await this.redis.xadd(
      ALERT_STREAM_KEY,
      'MAXLEN', '~', String(STREAM_MAX_LEN),
      '*',
      'id',          alert.id,
      'deviceId',    alert.deviceId,
      'deviceName',  alert.device?.name ?? '',
      'eventType',   alert.eventType,
      'severity',    alert.severity,
      'message',     alert.message,
      'occurredAt',  alert.occurredAt.toISOString(),
      'escalated',   String(alert.escalated),
    );
  }
}
