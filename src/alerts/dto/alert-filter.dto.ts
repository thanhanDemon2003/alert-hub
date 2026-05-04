import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AlertSeverity } from '../alert.entity';

export class AlertFilterDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  deviceId?: string;

  @ApiPropertyOptional({ enum: AlertSeverity })
  @IsEnum(AlertSeverity)
  @IsOptional()
  severity?: AlertSeverity;

  @ApiPropertyOptional({ example: '2024-01-01T00:00:00Z' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  fromTime?: Date;

  @ApiPropertyOptional({ example: '2024-12-31T23:59:59Z' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  toTime?: Date;

  @ApiPropertyOptional({ description: 'Full-text search on message' })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  keyword?: string;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 20;

  get offset(): number {
    return ((this.page ?? 1) - 1) * (this.pageSize ?? 20);
  }
}
