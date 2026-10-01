import express, { type Express } from "express";
import { v4 as uuid } from "uuid";
import { OrderCreated, ROUTING_KEYS, currentTraceparent, startSagaSpan, type Channel } from "@event-demo/shared";
import { createSaga, getSaga } from "./sagaStore.js";

export interface AppDeps {
  publish: (channel: Channel, routingKey: string, payload: unknown) => Promise<void>;
  channel: Channel;
}

export function createApp({ publish, channel }: AppDeps): Express {
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

  return app;
}
