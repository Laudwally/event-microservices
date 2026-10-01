import { initTracing } from "@event-demo/shared";

initTracing("gateway");

const { default: express } = await import("express");
const { v4: uuid } = await import("uuid");
const {
  connectWithRetry,
  publish,
  subscribe,
  ROUTING_KEYS,
  OrderCreated,
  PaymentCompleted,
  PaymentFailed,
  NotificationSent,
  startSagaSpan,
  currentTraceparent,
} = await import("@event-demo/shared");
const { createSaga, getSaga, updateSaga } = await import("./sagaStore.js");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const AMQP_URL = process.env.AMQP_URL ?? "amqp://localhost:5672";

const { channel } = await connectWithRetry(AMQP_URL);

await subscribe(channel, "gateway.saga-updates", [ROUTING_KEYS.paymentCompleted, ROUTING_KEYS.paymentFailed, ROUTING_KEYS.notificationSent], async (raw) => {
  if (PaymentCompleted.safeParse(raw).success) {
    const event = PaymentCompleted.parse(raw);
    updateSaga(event.sagaId, { status: "completed" });
  } else if (PaymentFailed.safeParse(raw).success) {
    const event = PaymentFailed.parse(raw);
    updateSaga(event.sagaId, { status: "failed", reason: event.reason });
  } else if (NotificationSent.safeParse(raw).success) {
    const event = NotificationSent.parse(raw);
    updateSaga(event.sagaId, { notification: event.outcome });
  }
});

const app = express();
app.use(express.json());

app.post("/orders", async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }

  const orderId = uuid();
  const sagaId = uuid();

  await startSagaSpan("saga.order.created", undefined, async () => {
    createSaga({ sagaId, orderId, amount, status: "pending", updatedAt: new Date().toISOString() });
    const event = OrderCreated.parse({
      type: "order.created",
      orderId,
      amount,
      sagaId,
      traceparent: currentTraceparent(),
    });
    await publish(channel, ROUTING_KEYS.orderCreated, event);
  });

  res.status(202).json({ orderId, sagaId, status: "pending" });
});

app.get("/sagas/:sagaId", (req, res) => {
  const saga = getSaga(req.params.sagaId);
  if (!saga) return res.status(404).json({ error: "saga not found" });
  res.json(saga);
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[gateway] listening on :${PORT}`);
});
