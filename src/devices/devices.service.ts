import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { Device, DeviceStatus } from './device.entity';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly repo: Repository<Device>,
  ) {}

  async create(dto: CreateDeviceDto): Promise<Device> {
    const device = this.repo.create({
      name: dto.name,
      status: dto.status ?? DeviceStatus.ACTIVE,
      metadata: dto.metadata ?? null,
    });
    return this.repo.save(device);
  }

  async findAll(
    status?: DeviceStatus,
    page = 1,
    pageSize = 20,
  ): Promise<{ items: Device[]; total: number }> {
    const where = status ? { status } : {};
    const [items, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total };
  }

  async findOne(id: string): Promise<Device> {
    const device = await this.repo.findOneBy({ id });
    if (!device) throw new NotFoundException(`Device ${id} not found`);
    return device;
  }

  async update(id: string, dto: UpdateDeviceDto): Promise<Device> {
    const device = await this.findOne(id);
    if (dto.name !== undefined) device.name = dto.name;
    if (dto.status !== undefined) device.status = dto.status;
    if (dto.metadata !== undefined) device.metadata = dto.metadata;
    return this.repo.save(device);
  }
}
