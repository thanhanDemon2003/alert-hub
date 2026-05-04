import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { DeviceStatus } from '../device.entity';

export class CreateDeviceDto {
  @ApiProperty({ example: 'Sensor-Floor-1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ enum: DeviceStatus, default: DeviceStatus.ACTIVE })
  @IsEnum(DeviceStatus)
  @IsOptional()
  status?: DeviceStatus = DeviceStatus.ACTIVE;

  @ApiPropertyOptional({ example: { location: 'floor-1' } })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
