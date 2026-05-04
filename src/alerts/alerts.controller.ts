import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import Redis from 'ioredis';
import { AlertsService } from './alerts.service';
import { AlertFilterDto } from './dto/alert-filter.dto';
import { CreateAlertDto } from './dto/create-alert.dto';
import { REDIS_CLIENT } from './escalation.service';

const ALERT_STREAM_KEY = 'alerthub:alert_stream';

@ApiTags('Alerts')
@Controller('api/v1/alerts')
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Device sends an alert event (Story #2 + #4)' })
  async ingest(@Body() dto: CreateAlertDto) {
    return this.alertsService.ingest(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List alerts with filters (Story #3 + #5)' })
  async findAll(@Query() filters: AlertFilterDto) {
    return this.alertsService.findAll(filters);
  }

  @Get('stream/live')
  @ApiOperation({ summary: 'Real-time alert stream via SSE (Story #2)' })
  async streamLive(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    res.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    });

    let lastId = '$';

    const heartbeat = setInterval(() => {
      res.raw.write(': heartbeat\n\n');
    }, 15_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      res.raw.end();
    };

    req.raw.on('close', cleanup);
    req.raw.on('error', cleanup);

    while (!req.raw.destroyed) {
      try {
        const results = await this.redis.xread(
          'COUNT', 10,
          'BLOCK', 2000,
          'STREAMS', ALERT_STREAM_KEY, lastId,
        ) as Array<[string, Array<[string, string[]]>]> | null;

        if (results) {
          for (const [, messages] of results) {
            for (const [msgId, fields] of messages) {
              lastId = msgId;
              const data: Record<string, string> = {};
              for (let i = 0; i < fields.length; i += 2) {
                data[fields[i]] = fields[i + 1];
              }
              res.raw.write(`id: ${msgId}\ndata: ${JSON.stringify(data)}\n\n`);
            }
          }
        }
      } catch {
        break;
      }
    }

    cleanup();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single alert' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.alertsService.findOne(id);
  }
}
