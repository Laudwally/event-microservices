import { initTracing } from "@event-demo/shared";

initTracing("worker");

const {
  connectWithRetry,
  publish,
  subscribe,
  ROUTING_KEYS,
  OrderCreated,
  PaymentCompleted,
  PaymentFailed,
  startSagaSpan,
} = await import("@event-demo/shared");

const AMQP_URL = process.env.AMQP_URL ?? "amqp://localhost:5672";

// Demo rule: orders over this amount are declined, to make the failure/compensation
// path reproducible without relying on randomness.
const DECLINE_THRESHOLD = 1000;

const { channel } = await connectWithRetry(AMQP_URL);

await subscribe(channel, "worker.orders", [ROUTING_KEYS.orderCreated], async (raw) => {
  const order = OrderCreated.parse(raw);

  await startSagaSpan("saga.payment.process", order.traceparent, async () => {
    // Simulate payment processing latency.
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (order.amount > DECLINE_THRESHOLD) {
      const event = PaymentFailed.parse({
        type: "payment.failed",
        orderId: order.orderId,
        sagaId: order.sagaId,
        reason: `amount ${order.amount} exceeds decline threshold ${DECLINE_THRESHOLD}`,
        traceparent: order.traceparent,
      });
      console.log(`[worker] declined payment for order ${order.orderId}`);
      await publish(channel, ROUTING_KEYS.paymentFailed, event);
      return;
    }

    const event = PaymentCompleted.parse({
      type: "payment.completed",
      orderId: order.orderId,
      sagaId: order.sagaId,
      amount: order.amount,
      traceparent: order.traceparent,
    });
    console.log(`[worker] captured payment for order ${order.orderId}`);
    await publish(channel, ROUTING_KEYS.paymentCompleted, event);
  });
});

console.log("[worker] listening for order.created events");
