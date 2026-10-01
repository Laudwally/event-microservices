import { initTracing } from "@event-demo/shared";

initTracing("gateway");

const {
  connectWithRetry,
  publish,
  subscribe,
  ROUTING_KEYS,
  PaymentCompleted,
  PaymentFailed,
  NotificationSent,
} = await import("@event-demo/shared");
const { createApp } = await import("./app.js");
const { updateSaga } = await import("./sagaStore.js");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const AMQP_URL = process.env.AMQP_URL ?? "amqp://localhost:5672";

const { channel } = await connectWithRetry(AMQP_URL);

await subscribe(
  channel,
  "gateway.saga-updates",
  [ROUTING_KEYS.paymentCompleted, ROUTING_KEYS.paymentFailed, ROUTING_KEYS.notificationSent],
  async (raw) => {
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
  },
);

const app = createApp({ publish, channel });

app.listen(PORT, () => {
  console.log(`[gateway] listening on :${PORT}`);
});
