import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

let sdk;

export function initTelemetry() {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  sdk = new NodeSDK({
    serviceName: 'match-service',
    traceExporter: new OTLPTraceExporter({
      url: endpoint ? `${endpoint}/v1/traces` : undefined,
    }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: endpoint ? `${endpoint}/v1/metrics` : undefined,
      }),
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
}

export async function shutdownTelemetry() {
  await sdk?.shutdown();
}
