import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { trace, propagation, context, type Span } from "@opentelemetry/api";

export function initTracing(serviceName: string): NodeSDK {
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  const sdk = new NodeSDK({
    serviceName,
    traceExporter: otlpEndpoint ? new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` }) : undefined,
    instrumentations: [getNodeAutoInstrumentations({ "@opentelemetry/instrumentation-fs": { enabled: false } })],
  });

  sdk.start();

  process.on("SIGTERM", () => {
    void sdk.shutdown().finally(() => process.exit(0));
  });

  return sdk;
}

const tracer = trace.getTracer("saga");

export function startSagaSpan<T>(name: string, incomingTraceparent: string | undefined, fn: (span: Span) => Promise<T>): Promise<T> {
  const parentContext = incomingTraceparent
    ? propagation.extract(context.active(), { traceparent: incomingTraceparent })
    : context.active();

  return context.with(parentContext, () => tracer.startActiveSpan(name, async (span) => {
    try {
      return await fn(span);
    } finally {
      span.end();
    }
  }));
}

export function currentTraceparent(): string | undefined {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier.traceparent;
}
