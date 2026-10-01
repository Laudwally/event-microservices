import amqp, { type ChannelModel, type Channel, type ConsumeMessage } from "amqplib";
import { EXCHANGE } from "./events.js";

export type { Channel };

export interface AmqpConnection {
  model: ChannelModel;
  channel: Channel;
}

export async function connectWithRetry(url: string, retries = 10, delayMs = 2000): Promise<AmqpConnection> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const model = await amqp.connect(url);
      const channel = await model.createChannel();
      await channel.assertExchange(EXCHANGE, "topic", { durable: true });
      return { model, channel };
    } catch (err) {
      lastErr = err;
      console.warn(`[amqp] connect attempt ${attempt}/${retries} failed: ${(err as Error).message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}

export async function publish(channel: Channel, routingKey: string, payload: unknown): Promise<void> {
  channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), {
    contentType: "application/json",
    persistent: true,
  });
}

export async function subscribe(
  channel: Channel,
  queueName: string,
  routingKeys: string[],
  handler: (payload: unknown, msg: ConsumeMessage) => Promise<void>,
): Promise<void> {
  await channel.assertQueue(queueName, { durable: true });
  await Promise.all(routingKeys.map((key) => channel.bindQueue(queueName, EXCHANGE, key)));
  await channel.prefetch(10);

  await channel.consume(queueName, (msg) => {
    if (!msg) return;
    const run = async () => {
      try {
        const payload = JSON.parse(msg.content.toString("utf8"));
        await handler(payload, msg);
        channel.ack(msg);
      } catch (err) {
        console.error(`[amqp] handler failed for ${msg.fields.routingKey}:`, err);
        channel.nack(msg, false, false);
      }
    };
    void run();
  });
}
