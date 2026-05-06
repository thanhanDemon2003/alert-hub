# AlertHub

Backend service quản lý thiết bị IoT và cảnh báo theo thời gian thực.

## Tech Stack

| Layer | Công nghệ | Lý do chọn |
|-------|-----------|------------|
| Framework | NestJS + Fastify | DI container rõ ràng, Fastify nhanh hơn Express ~20% cho SSE |
| ORM | TypeORM | Tích hợp sẵn với NestJS, migration CLI tốt |
| Database | PostgreSQL 16 | JSONB, native full-text search (`tsvector`), production-ready |
| Cache / Queue | Redis 7 | Sorted set cho sliding window, Stream cho SSE real-time |
| Validation | class-validator + class-transformer | Tích hợp tự nhiên với NestJS pipe |
| Docs | Swagger / OpenAPI | Tự động generate từ decorator |

---

## Yêu Cầu

- Node.js 20+
- Docker + Docker Compose

---

## Chạy với Docker (recommended)

```bash
docker-compose up --build
```

API chạy tại: `http://localhost:3000`
Swagger UI: `http://localhost:3000/docs`

---

## Chạy Local (venv)

```bash
# 1. Start PostgreSQL + Redis
docker-compose up postgres redis -d

# 2. Cài dependencies
npm install

# 3. Tạo file .env
cp .env.example .env

# 4. Chạy migration
npm run migration:run

# 5. Start server (hot-reload)
npm run start:dev
```

---

## Biến Môi Trường

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=alerthub
DATABASE_PASSWORD=alerthub
DATABASE_NAME=alerthub
REDIS_URL=redis://localhost:6379/0
NODE_ENV=development
PORT=3000
ESCALATION_WINDOW_SECONDS=60
ESCALATION_THRESHOLD=5
```

---

## API Endpoints

### Devices

| Method | Path | Mô tả |
|--------|------|-------|
| `POST` | `/api/v1/devices` | Đăng ký thiết bị mới |
| `GET` | `/api/v1/devices` | Danh sách thiết bị (filter theo `status`) |
| `GET` | `/api/v1/devices/:id` | Lấy thiết bị theo ID |
| `PATCH` | `/api/v1/devices/:id` | Cập nhật trạng thái / metadata |

### Alerts

| Method | Path | Mô tả |
|--------|------|-------|
| `POST` | `/api/v1/alerts` | Thiết bị gửi event cảnh báo |
| `GET` | `/api/v1/alerts` | Danh sách cảnh báo (filter + full-text search) |
| `GET` | `/api/v1/alerts/:id` | Lấy cảnh báo theo ID |
| `GET` | `/api/v1/alerts/stream/live` | Real-time stream qua SSE |

#### Query params cho `GET /api/v1/alerts`

| Param | Kiểu | Mô tả |
|-------|------|-------|
| `deviceId` | UUID | Lọc theo thiết bị |
| `severity` | `low\|medium\|high\|critical` | Lọc theo mức độ |
| `fromTime` | ISO 8601 | Từ thời điểm |
| `toTime` | ISO 8601 | Đến thời điểm |
| `keyword` | string | Full-text search trên nội dung cảnh báo |
| `page` | number | Trang (mặc định: 1) |
| `pageSize` | number | Số lượng mỗi trang (mặc định: 20) |

---

## Ví Dụ Curl

**Đăng ký thiết bị:**
```bash
curl -s -X POST http://localhost:3000/api/v1/devices \
  -H "Content-Type: application/json" \
  -d '{"name": "Sensor-Floor-1", "status": "active"}' | jq
```

**Gửi alert:**
```bash
curl -s -X POST http://localhost:3000/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "<device-id>",
    "eventType": "temperature_high",
    "severity": "medium",
    "message": "Temperature exceeded 80 degrees"
  }' | jq
```

**Test escalation — gửi 6 lần liên tiếp, lần 6 tự lên `critical`:**
```bash
for i in {1..6}; do
  curl -s -X POST http://localhost:3000/api/v1/alerts \
    -H "Content-Type: application/json" \
    -d '{"deviceId":"<device-id>","eventType":"temperature_high","severity":"low","message":"Test '$i'"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);console.log('Event '$i' → severity:',r.severity,'escalated:',r.escalated)})"
done
```

**Lọc cảnh báo:**
```bash
# Theo severity
curl "http://localhost:3000/api/v1/alerts?severity=critical"

# Theo khoảng thời gian
curl "http://localhost:3000/api/v1/alerts?fromTime=2024-01-01T00:00:00Z"

# Full-text search
curl "http://localhost:3000/api/v1/alerts?keyword=temperature"
```

**Subscribe real-time stream:**
```bash
curl -N http://localhost:3000/api/v1/alerts/stream/live
```

---

## Cấu Trúc Project

```
src/
├── main.ts                        # Entrypoint, Fastify + Swagger setup
├── app.module.ts                  # Root module
├── config/
│   ├── app.config.ts              # Tất cả config theo namespace
│   └── data-source.ts             # TypeORM CLI datasource
├── devices/
│   ├── device.entity.ts           # ORM entity
│   ├── devices.service.ts         # Business logic
│   ├── devices.controller.ts      # HTTP handlers
│   ├── devices.module.ts
│   └── dto/                       # Request/Response DTOs
├── alerts/
│   ├── alert.entity.ts
│   ├── alerts.service.ts          # Ingest + publish to Redis Stream
│   ├── alerts.controller.ts       # HTTP + SSE handlers
│   ├── alerts.module.ts
│   ├── escalation.service.ts      # ← Sliding window logic (Story #4)
│   ├── escalation.service.spec.ts # Unit tests
│   └── dto/
├── common/
│   └── redis.module.ts            # Global Redis provider
└── migrations/
    └── 1777714527375-Init.ts      # DB schema + triggers
```

---

## Kiến Trúc

```
Client / Device
      │
      ▼ REST / SSE
┌─────────────────────────────┐
│     NestJS (Fastify)        │
│  DevicesController          │
│  AlertsController ──────────┼──► Redis Stream ──► SSE subscribers
└──────────┬──────────────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
DevicesService  AlertsService
                    │
                    ├─► EscalationService ──► Redis (sliding window)
                    │
                    ▼
              TypeORM Repository
                    │
                    ▼
              PostgreSQL
```

---

## Architecture Decision Records

### ADR-1: NestJS + Fastify thay vì Express

NestJS cung cấp DI container built-in giúp tách biệt rõ ràng giữa các layer (Controller → Service → Repository). Fastify được chọn thay Express vì throughput cao hơn, đặc biệt quan trọng với SSE có nhiều concurrent connection.

### ADR-2: Redis Sorted Set cho Sliding Window (Story #4)

**Vấn đề:** Cần đếm số event cùng `(device_id, event_type)` trong 60 giây gần nhất một cách chính xác và atomic.

**Tại sao Sorted Set thay vì Fixed Window Counter (INCR + TTL)?**

Fixed window counter sẽ bỏ sót trường hợp: 4 event ở giây 58, 3 event ở giây 62 — tổng 7 event trong 60 giây nhưng counter reset và không trigger escalation.

Sliding window với Sorted Set (score = Unix timestamp) xử lý đúng trường hợp này.

**Tại sao không dùng DB query?**

`COUNT WHERE occurred_at > now()-60s` hoạt động nhưng tạo thêm read query trên hot write path. Redis O(log N) và không tạo load lên PostgreSQL.

**Atomic:** Tất cả operations (ZADD → ZREMRANGEBYSCORE → ZCARD → EXPIRE) trong một pipeline — không có race condition khi nhiều event đến đồng thời.

**Graceful degradation:** Nếu Redis down, `checkAndEscalate()` trả về `false` — alert vẫn được lưu, chỉ không escalate.

### ADR-3: Server-Sent Events + Redis Streams cho Real-time (Story #2)

SSE được chọn thay WebSocket vì alert streaming là **uni-directional** (server → client). SSE đơn giản hơn, tự reconnect theo spec trình duyệt, và không cần thư viện thêm.

Redis Streams (`XREAD BLOCK`) được dùng làm message bus giữa alert ingestion và SSE consumers. Đây là giải pháp đủ cho scope bài, đồng thời dễ nâng cấp lên Kafka sau nếu cần (chỉ thay implementation của `publishToStream` và consumer).

Kafka không được chọn vì tăng operational complexity (broker, KRaft, topic management) mà không mang lại giá trị thêm ở quy mô này.

### ADR-4: PostgreSQL Full-Text Search (Story #5)

`TSVECTOR` column được populate bởi DB trigger `BEFORE INSERT OR UPDATE`, không phải application layer. Ưu điểm: application không cần biết về FTS, chỉ cần `WHERE search_vector @@ plainto_tsquery(...)`.

Weighted: `message` → weight A (ưu tiên cao), `event_type` → weight B.

GIN index đảm bảo FTS query nhanh ngay cả với hàng triệu records.

Elasticsearch không được chọn vì chi phí infrastructure quá cao so với yêu cầu.

### ADR-5: TypeORM `synchronize: false` + Migrations

`synchronize: true` tiện cho development nhưng nguy hiểm khi production (có thể drop column). Tất cả schema change đi qua migration file để có lịch sử rõ ràng và rollback được.

---

## Chạy Test

```bash
npm test
```

Unit tests cho `EscalationService` dùng `ioredis-mock` — không cần Redis thật:

```
✓ does NOT escalate below threshold (5 events)
✓ escalates on the 6th event (threshold + 1)
✓ different event_types are independent windows
✓ different devices are independent windows
✓ getWindowCount returns current count
✓ evicts old entries outside the window
✓ returns false on Redis failure (graceful degradation)
```