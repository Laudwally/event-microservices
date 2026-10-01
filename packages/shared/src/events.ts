import { z } from "zod";

export const EXCHANGE = "saga.events" as const;

export const OrderCreated = z.object({
  type: z.literal("order.created"),
  orderId: z.string(),
  amount: z.number().positive(),
  sagaId: z.string(),
  traceparent: z.string().optional(),
});
export type OrderCreated = z.infer<typeof OrderCreated>;

export const PaymentCompleted = z.object({
  type: z.literal("payment.completed"),
  orderId: z.string(),
  sagaId: z.string(),
  amount: z.number().positive(),
  traceparent: z.string().optional(),
});
export type PaymentCompleted = z.infer<typeof PaymentCompleted>;

export const PaymentFailed = z.object({
  type: z.literal("payment.failed"),
  orderId: z.string(),
  sagaId: z.string(),
  reason: z.string(),
  traceparent: z.string().optional(),
});
export type PaymentFailed = z.infer<typeof PaymentFailed>;

export const NotificationSent = z.object({
  type: z.literal("notification.sent"),
  orderId: z.string(),
  sagaId: z.string(),
  channel: z.literal("email"),
  outcome: z.enum(["success", "compensated"]),
  traceparent: z.string().optional(),
});
export type NotificationSent = z.infer<typeof NotificationSent>;

export const ROUTING_KEYS = {
  orderCreated: "order.created",
  paymentCompleted: "payment.completed",
  paymentFailed: "payment.failed",
  notificationSent: "notification.sent",
} as const;

export type SagaEvent = OrderCreated | PaymentCompleted | PaymentFailed | NotificationSent;
