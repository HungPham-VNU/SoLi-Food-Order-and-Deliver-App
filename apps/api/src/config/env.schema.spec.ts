import { validate } from './env.schema';

const baseConfig = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/uitfood',
};

describe('environment schema observability settings', () => {
  it('accepts the mobile payment return deep link', () => {
    const env = validate({
      ...baseConfig,
      MOBILE_PAYMENT_RETURN_URL: 'uitfood://payment/vnpay-return',
    });

    expect(env.MOBILE_PAYMENT_RETURN_URL).toBe(
      'uitfood://payment/vnpay-return',
    );
  });

  it('accepts Grafana Cloud direct OTLP settings', () => {
    const env = validate({
      ...baseConfig,
      GRAFANA_CLOUD_OTLP_ENDPOINT:
        'https://otlp-gateway-prod-us-central1.grafana.net/otlp',
      GRAFANA_CLOUD_OTLP_USERNAME_OR_INSTANCE_ID: '123456',
      GRAFANA_CLOUD_OTLP_TOKEN: 'grafana-token',
    });

    expect(env.GRAFANA_CLOUD_OTLP_ENDPOINT).toBe(
      'https://otlp-gateway-prod-us-central1.grafana.net/otlp',
    );
    expect(env.GRAFANA_CLOUD_OTLP_USERNAME_OR_INSTANCE_ID).toBe('123456');
    expect(env.GRAFANA_CLOUD_OTLP_TOKEN).toBe('grafana-token');
  });

  it('requires Grafana Cloud auth when using the Grafana Cloud endpoint shortcut', () => {
    expect(() =>
      validate({
        ...baseConfig,
        GRAFANA_CLOUD_OTLP_ENDPOINT:
          'https://otlp-gateway-prod-us-central1.grafana.net/otlp',
      }),
    ).toThrow(/Grafana Cloud direct OTLP export requires/);
  });

  it('accepts an explicit OpenTelemetry OTLP auth header', () => {
    const env = validate({
      ...baseConfig,
      OTEL_EXPORTER_OTLP_ENDPOINT:
        'https://otlp-gateway-prod-us-central1.grafana.net/otlp',
      OTEL_EXPORTER_OTLP_HEADERS:
        'Authorization=Basic%20base64-instance-id-and-token',
    });

    expect(env.OTEL_EXPORTER_OTLP_HEADERS).toBe(
      'Authorization=Basic%20base64-instance-id-and-token',
    );
  });
});
