import { describe, it, expect } from 'vitest';
import { tracedHeaders } from '../src/http/trace';
import { startTelemetry } from '../src/telemetry';

describe('telemetry', () => {
  it('does not start the SDK when the OTLP endpoint is missing', () => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    expect(() => startTelemetry('pokenetes-api')).not.toThrow();
  });

  it('sends the trace id header used by the three clouds', () => {
    expect(tracedHeaders('demo-trace')).toMatchObject({
      'x-trace-id': 'demo-trace',
      Accept: 'application/json',
    });
  });
});
