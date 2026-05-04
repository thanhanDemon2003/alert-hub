import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Device } from '../devices/device.entity';

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('alerts')
@Index('idx_alerts_device_id', ['deviceId'])
@Index('idx_alerts_severity', ['severity'])
@Index('idx_alerts_occurred_at', ['occurredAt'])
@Index('idx_alerts_escalation_window', ['deviceId', 'eventType', 'occurredAt'])
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'device_id' })
  deviceId: string;

  @Column({ name: 'event_type', length: 100 })
  eventType: string;

  @Column({ type: 'enum', enum: AlertSeverity })
  severity: AlertSeverity;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @Column({ default: false })
  escalated: boolean;

  @Column({
    name: 'search_vector',
    type: 'tsvector',
    nullable: true,
    select: false,
    insert: false,
    update: false,
  })
  searchVector: unknown;

  @ManyToOne(() => Device, (device) => device.alerts, {
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn({ name: 'device_id' })
  device: Device;
}
