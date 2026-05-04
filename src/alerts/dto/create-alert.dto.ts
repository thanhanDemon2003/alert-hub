import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { AlertSeverity } from '../alert.entity';

export class CreateAlertDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  @IsUUID()
  deviceId: string;

  @ApiProperty({ example: 'temperature_high' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  eventType: string;

  @ApiPropertyOptional({ enum: AlertSeverity, default: AlertSeverity.MEDIUM })
  @IsEnum(AlertSeverity)
  severity: AlertSeverity = AlertSeverity.MEDIUM;

  @ApiProperty({ example: 'Temperature exceeded 80°C' })
  @IsString()
  @IsNotEmpty()
  message: string;
}
