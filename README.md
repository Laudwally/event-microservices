# Event-Driven Microservices Demo

An order saga spread across three services, coordinated with RabbitMQ events instead of
synchronous calls, with distributed tracing and a consumer-driven contract test for the one
public HTTP entry point.

## Services

| Service    | Role                                                                                   |
|------------|------------------------------------------------------------------------------------------|
| `gateway`  | Public REST API (`POST /orders`, `GET /sagas/:id`). Publishes `order.created`, tracks saga status from downstream events. |
| `worker`   | Consumes `order.created`, simulates payment capture, publishes `payment.completed` or `payment.failed`. |
| `notifier` | Consumes payment outcomes, "sends" an email (logged) — a confirmation on success, or a **compensating** notice on failure. |

## Saga flow (orchestration via events)

```
client -> POST /orders -> gateway
                              │ publish order.created
                              ▼
                           worker (simulates payment; amount > 1000 is declined)
                 ┌────────────┴────────────┐
         payment.completed          payment.failed
                 │                         │
                 ▼                         ▼
             notifier sends            notifier sends compensating
             confirmation email        "order failed" email
                 │                         │
                 └──────────┬──────────────┘
                             ▼
                 notification.sent -> gateway updates saga status
```

`gateway` holds saga state in memory and exposes it via `GET /sagas/:sagaId` so a client can poll
for the final outcome (`completed` or `failed`) instead of blocking on the HTTP response.

## Tracing

Every service calls `initTracing()` (in `packages/shared/src/tracing.ts`) on boot, using the
OpenTelemetry Node SDK with auto-instrumentation for Express/amqplib/HTTP. The W3C `traceparent`
is carried as a field on each event payload so a single saga's spans — gateway → worker → notifier
— link into one trace even though the services only ever talk through RabbitMQ.

By default spans are collected but not exported anywhere. Set `OTEL_EXPORTER_OTLP_ENDPOINT`
(e.g. `http://localhost:4318`) on each service to ship traces to a collector/Jaeger/Tempo.

## Contract testing (Pact)

`services/gateway/pact/` has a consumer/provider pair for the gateway's REST API:

- `consumer.pact.test.ts` — plays the role of a client calling `gateway`, recording expected
  request/response shapes into `pact/pacts/order-client-gateway.json`.
- `provider.pact.test.ts` — boots the real Express app (`src/app.ts`, with the RabbitMQ channel
  swapped for a no-op stub) and replays the recorded contract against it with Pact's `Verifier`.

```bash
npm run test --workspace services/gateway
```

## Running locally

### With Docker Compose (RabbitMQ + all three services)

```bash
docker compose up --build
curl -X POST http://localhost:3000/orders -H "Content-Type: application/json" -d '{"amount": 250}'
curl http://localhost:3000/sagas/<sagaId-from-response>
```

Try `{"amount": 1500}` to trigger the decline/compensation path.

### Without Docker (services on the host, RabbitMQ in a container)

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3.13-management
npm install
npm run build
npm run dev:gateway    # terminal 1
npm run dev:worker     # terminal 2
npm run dev:notifier   # terminal 3
```

RabbitMQ's management UI is at http://localhost:15672 (guest/guest) if you want to watch the
`saga.events` exchange and queues directly.

## Project layout

```
packages/shared/   Event schemas (Zod), RabbitMQ helpers, OTel tracing setup — shared by all services
services/gateway/  REST API + saga status tracking + Pact contract tests
services/worker/   Payment simulation
services/notifier/ Notification + compensation
docker-compose.yml RabbitMQ + all three services
```

## Roadmap

- [x] Milestone 1: RabbitMQ topology, saga happy/decline paths, OTel tracing, docker-compose
- [x] Milestone 2: Pact consumer/provider contract tests for the gateway API, CI pipeline
- [ ] Milestone 3: persist saga state (currently in-memory, lost on gateway restart), add a
      metrics/collector stack to actually visualize the OTel traces end-to-end
