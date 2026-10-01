import { initTracing } from "@event-demo/shared";

initTracing("notifier");

const {
  connectWithRetry,
  publish,
  subscribe,
  ROUTING_KEYS,
  PaymentCompleted,
  PaymentFailed,
  NotificationSent,
  startSagaSpan,
} = await import("@event-demo/shared");

const AMQP_URL = process.env.AMQP_URL ?? "amqp://localhost:5672";

const { channel } = await connectWithRetry(AMQP_URL);

await subscribe(channel, "notifier.payment-outcomes", [ROUTING_KEYS.paymentCompleted, ROUTING_KEYS.paymentFailed], async (raw) => {
  if (PaymentCompleted.safeParse(raw).success) {
    const event = PaymentCompleted.parse(raw);
    await startSagaSpan("saga.notification.success", event.traceparent, async () => {
      console.log(`[notifier] email: order ${event.orderId} confirmed, charged $${event.amount}`);
      const notification = NotificationSent.parse({
        type: "notification.sent",
        orderId: event.orderId,
        sagaId: event.sagaId,
        channel: "email",
        outcome: "success",
        traceparent: event.traceparent,
      });
      await publish(channel, ROUTING_KEYS.notificationSent, notification);
    });
    return;
  }

  if (PaymentFailed.safeParse(raw).success) {
    const event = PaymentFailed.parse(raw);
    // Compensating action for the saga: tell the customer the order did not go through.
    await startSagaSpan("saga.notification.compensate", event.traceparent, async () => {
      console.log(`[notifier] email: order ${event.orderId} failed (${event.reason}), no charge made`);
      const notification = NotificationSent.parse({
        type: "notification.sent",
        orderId: event.orderId,
        sagaId: event.sagaId,
        channel: "email",
        outcome: "compensated",
        traceparent: event.traceparent,
      });
      await publish(channel, ROUTING_KEYS.notificationSent, notification);
    });
  }
});

console.log("[notifier] listening for payment outcomes");
