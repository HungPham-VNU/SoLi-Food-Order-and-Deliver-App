# Observability Implementation Plan

## Project

Turborepo monorepo containing:

- `apps/web`: Vite + React frontend
- `apps/api`: NestJS backend
- `apps/mobile`: Expo React Native mobile app
- shared packages under `packages/*`

## Selected Observability Stack

The selected stack is:

- **OpenTelemetry** for backend instrumentation and telemetry portability
- **Grafana Cloud** for hosted logs, metrics, traces, dashboards, and alerting
- **Sentry** for frontend and mobile error monitoring, crash reporting, performance debugging, source maps, and release tracking
- **PostHog** for product analytics, feature flags, funnels, and optional session replay
- **Uptime monitoring** through Grafana Cloud Synthetic Monitoring if available in the chosen plan, or Uptime Kuma as a self-hosted fallback

## Goals

The goal is to implement a practical, low-maintenance observability setup that gives the team visibility into backend performance, frontend errors, mobile crashes, user behavior, and production availability.

This implementation should prioritize:

1. Fast setup
2. Free-tier compatibility where possible
3. Strong documentation
4. Low vendor lock-in through OpenTelemetry
5. Compatibility with coding agents and future automation
6. Clear separation between system observability and product analytics

---

# 1. Architecture Overview

## High-level architecture

```txt
Vite/React Web App
  ├── Sentry: errors, source maps, frontend performance
  └── PostHog: product analytics, feature flags, optional replay

Expo React Native App
  ├── Sentry React Native SDK: crashes, errors, source maps, releases
  └── PostHog React Native SDK: analytics, feature flags, optional replay

NestJS API
  ├── OpenTelemetry SDK: traces, metrics, resource attributes
  ├── Structured logger: application logs
  └── OTLP HTTP exporters
        ↓
Grafana Cloud
  ├── Traces
  ├── Metrics
  ├── Logs
  ├── Dashboards
  └── Alerts
```

## Telemetry flow

The API exports directly to Grafana Cloud:

```txt
NestJS API
  ↓
OpenTelemetry SDK
  ↓
Grafana Cloud OTLP endpoint
```

---

# 2. Tool Responsibilities

## OpenTelemetry

Used for backend instrumentation.

Responsibilities:

- Instrument NestJS HTTP requests
- Instrument outgoing HTTP calls
- Instrument database calls if supported by current ORM/database client
- Instrument Redis calls if used
- Export traces to Grafana Cloud
- Export metrics to Grafana Cloud
- Attach common resource attributes:
  - `service.name`
  - `service.version`
  - `deployment.environment`
  - `commit.sha`
  - `runtime.name`

OpenTelemetry should be treated as the portability layer.

Application code should not depend directly on Grafana-specific APIs.

## Grafana Cloud

Used as the hosted observability backend.

Responsibilities:

- Receive OTLP telemetry
- Store and visualize traces
- Store and visualize metrics
- Store and search logs
- Provide dashboards
- Provide alerting
- Optionally provide synthetic monitoring

Grafana Cloud should be configured through environment variables and deployment configuration, not hard-coded into application source.

## Sentry

Used for error monitoring and crash reporting.

Responsibilities:

- Capture frontend web runtime errors
- Capture mobile crashes and errors
- Capture unhandled exceptions
- Upload source maps for readable stack traces
- Track releases and commits
- Capture useful breadcrumbs
- Capture frontend/mobile performance data where appropriate

Sentry should be used for application debugging, especially client-side issues that are hard to diagnose from backend telemetry alone.

## PostHog

Used for product analytics.

Responsibilities:

- Track user actions
- Track funnels
- Track feature usage
- Support feature flags
- Support optional session replay, if privacy and free-tier limits allow

PostHog should not replace Grafana or Sentry. It answers product questions, not infrastructure health questions.

## Uptime Monitoring

Used for external availability checks.

Responsibilities:

- Check public API health endpoint
- Check frontend availability
- Optionally check mobile backend API availability
- Notify the team when production is unreachable

Preferred option: Grafana Cloud Synthetic Monitoring.

Fallback option: Uptime Kuma.

---

# 3. Environment Variables

## Shared environment variables

```env
NODE_ENV=production
APP_ENV=production
APP_VERSION=1.0.0
COMMIT_SHA=<git-commit-sha>
```

## NestJS / OpenTelemetry / Grafana Cloud

```env
OTEL_SERVICE_NAME=project-api
GRAFANA_CLOUD_OTLP_ENDPOINT=<grafana-cloud-otlp-endpoint>
GRAFANA_CLOUD_OTLP_USERNAME_OR_INSTANCE_ID=<instance-id>
GRAFANA_CLOUD_OTLP_TOKEN=<access-policy-token>
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,service.version=1.0.0,commit.sha=<git-commit-sha>
OTEL_TRACES_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
```

## Sentry web

```env
VITE_SENTRY_DSN=<sentry-web-dsn>
VITE_APP_ENV=production
VITE_APP_VERSION=1.0.0
VITE_COMMIT_SHA=<git-commit-sha>
```

## Sentry mobile

```env
EXPO_PUBLIC_SENTRY_DSN=<sentry-mobile-dsn>
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_APP_VERSION=1.0.0
EXPO_PUBLIC_COMMIT_SHA=<git-commit-sha>
SENTRY_AUTH_TOKEN=<sentry-auth-token-for-ci-only>
SENTRY_ORG=<sentry-org>
SENTRY_PROJECT=<sentry-mobile-project>
```

`SENTRY_AUTH_TOKEN` must only be stored in CI/CD secrets, never in client-side code.

## PostHog web

```env
VITE_POSTHOG_KEY=<posthog-project-api-key>
VITE_POSTHOG_HOST=https://app.posthog.com
```

For EU-hosted PostHog, use the appropriate EU host.

## PostHog mobile

```env
EXPO_PUBLIC_POSTHOG_KEY=<posthog-project-api-key>
EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

# 4. Backend Implementation: NestJS + OpenTelemetry

## Required work

1. Add OpenTelemetry dependencies to `apps/api`.
2. Create `src/telemetry.ts`.
3. Initialize telemetry before the NestJS application starts.
4. Add service metadata.
5. Enable auto-instrumentation where stable.
6. Add custom spans for important business operations.
7. Configure direct OTLP export to Grafana Cloud.
8. Add structured logging.
9. Add a `/health` endpoint for uptime checks.

## Startup order requirement

Telemetry must be initialized before importing and starting the NestJS app where possible.

Recommended pattern:

```ts
// main.ts
import './telemetry';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
```

## Required resource attributes

Every backend telemetry event should include:

```txt
service.name=project-api
service.version=<app-version>
deployment.environment=<local|staging|production>
commit.sha=<git-sha>
```

## Recommended spans

Auto-instrumentation should capture the common request/DB/HTTP spans.

Add custom spans around important business operations, such as:

- user registration
- login
- payment flow
- order creation
- file upload
- notification sending
- external API calls

## Metrics to expose

Minimum metrics:

- request count
- request duration
- error rate
- process memory
- process CPU
- active requests
- database query latency if available
- queue length if queues are used

## Logs

Use structured JSON logs.

Recommended fields:

```json
{
  "level": "info",
  "message": "Order created",
  "service": "project-api",
  "environment": "production",
  "requestId": "...",
  "userId": "...",
  "traceId": "...",
  "spanId": "...",
  "commitSha": "..."
}
```

Sensitive data must not be logged.

Never log:

- passwords
- access tokens
- refresh tokens
- full payment data
- private keys
- raw authorization headers
- personally sensitive data unless explicitly approved

---

# 6. Direct Grafana Cloud OTLP Export

## Recommendation

Use the OpenTelemetry Node SDK in the API and export OTLP HTTP telemetry
directly to Grafana Cloud. The API owns exporter endpoint selection and Basic
auth header creation from environment variables.

## Configuration

Direct export requires:

- `GRAFANA_CLOUD_OTLP_ENDPOINT`
- `GRAFANA_CLOUD_OTLP_USERNAME_OR_INSTANCE_ID`
- `GRAFANA_CLOUD_OTLP_TOKEN`

The endpoint should be the Grafana Cloud OTLP gateway URL, usually ending in
`/otlp`. The API appends the signal path for traces, metrics, and logs.

## Sampling

For early-stage projects, start with full tracing at low volume.

When traffic grows, use sampling to control cost:

- Always keep error traces
- Sample successful high-volume endpoints
- Keep important business transaction traces
- Drop noisy health-check traces

---

# 7. Frontend Web Implementation: Vite + React

## Required work

1. Install Sentry React SDK.
2. Create `src/sentry.ts`.
3. Initialize Sentry before rendering the app.
4. Configure environment and release.
5. Upload source maps in CI/CD.
6. Install PostHog JS SDK.
7. Create `src/analytics.ts`.
8. Track key user events.
9. Ensure privacy-safe event properties.

## Sentry web requirements

Sentry should capture:

- unhandled exceptions
- React rendering errors
- route-level performance if configured
- release version
- environment
- commit SHA
- useful breadcrumbs

The team must configure source map upload so production stack traces are readable.

## PostHog web requirements

PostHog should capture:

- page views
- sign-up flow events
- login events
- core feature usage
- checkout/order events if applicable
- feature flag exposure

Do not track sensitive form fields.

---

# 8. Mobile Implementation: Expo React Native

## Required work

1. Install `@sentry/react-native` using the official Expo-compatible setup.
2. Configure Sentry in the Expo app.
3. Configure EAS build/source map upload.
4. Track release, environment, and commit SHA.
5. Install `posthog-react-native` and Expo peer dependencies.
6. Configure PostHog provider.
7. Track important product events.
8. Validate behavior in development build and production build.

## Sentry mobile requirements

Sentry should capture:

- native crashes
- JavaScript errors
- unhandled promise rejections
- release version
- environment
- commit SHA
- OTA update context if applicable
- readable stack traces through source map upload

Expo SDK 50 and newer should use `@sentry/react-native`, not the older `sentry-expo` package.

## PostHog mobile requirements

PostHog should capture:

- app opened
- app backgrounded
- screen viewed
- sign-up events
- login events
- key feature usage
- feature flag exposure

Session replay should be enabled only after privacy review.

---

# 9. CI/CD Requirements

## Required CI secrets

The CI/CD platform must store:

```txt
GRAFANA_CLOUD_OTLP_ENDPOINT
GRAFANA_CLOUD_OTLP_USERNAME_OR_INSTANCE_ID
GRAFANA_CLOUD_OTLP_TOKEN
SENTRY_AUTH_TOKEN
SENTRY_ORG
SENTRY_WEB_PROJECT
SENTRY_MOBILE_PROJECT
POSTHOG_WEB_KEY
POSTHOG_MOBILE_KEY
```

Never commit these values to the repository.

## Build metadata

Every deployment should inject:

```txt
APP_VERSION
COMMIT_SHA
DEPLOYMENT_ENVIRONMENT
```

These values must be visible in:

- Grafana traces/logs/metrics
- Sentry releases
- PostHog event properties where useful

## Web CI/CD tasks

For `apps/web`:

1. Install dependencies
2. Lint
3. Typecheck
4. Test
5. Build Vite app
6. Upload source maps to Sentry
7. Deploy frontend

## API CI/CD tasks

For `apps/api`:

1. Install dependencies
2. Lint
3. Typecheck
4. Test
5. Build NestJS app
6. Build Docker image if applicable
7. Deploy API
8. Verify `/health`
9. Verify telemetry appears in Grafana Cloud

## Mobile CI/CD tasks

For `apps/mobile`:

1. Install dependencies
2. Lint
3. Typecheck
4. Test
5. Local build on github actions
6. Upload source maps to Sentry
7. Verify Sentry release and source maps

---

# 10. Dashboard Requirements

## Grafana dashboard: API overview

Must include:

- request rate
- error rate
- p95 latency
- p99 latency
- top slow endpoints
- top failing endpoints
- memory usage
- CPU usage
- database latency if available
- external API latency if available

## Grafana dashboard: API traces

Must include:

- trace search by service
- trace search by endpoint
- trace search by error status
- slow trace view
- trace-to-log correlation if configured

## Grafana dashboard: logs

Must include filters for:

- environment
- service name
- log level
- request ID
- trace ID
- user ID, only if allowed by privacy policy

## Sentry dashboard: web

Must show:

- new issues
- high-frequency issues
- affected users
- release health
- source map status
- frontend performance if enabled

## Sentry dashboard: mobile

Must show:

- crashes
- crash-free sessions
- affected users
- release health
- source map status
- OTA update context if applicable

## PostHog dashboard

Must show:

- active users
- sign-up funnel
- login success/failure funnel
- key feature usage
- retention if applicable
- feature flag exposure

---

# 11. Alerting Requirements

## Critical alerts

Create alerts for:

- API unavailable
- frontend unavailable
- high API error rate
- high API p95 latency
- database connection failures
- repeated mobile crash spike
- repeated frontend error spike

## Suggested alert thresholds

Initial thresholds can be simple:

```txt
API uptime failure: 2 consecutive failed checks
API 5xx error rate: >5% for 5 minutes
API p95 latency: >1.5s for 10 minutes
Mobile crash spike: sudden increase compared to baseline
Frontend error spike: sudden increase compared to baseline
```

Thresholds should be tuned after one or two weeks of real usage.

## Notification channels

Configure at least one notification channel:

- email
- Slack/Discord if used by the team
- Telegram if preferred

Avoid SMS unless required, because it can create cost and setup complexity.

---

# 12. Privacy and Security Rules

## Data minimization

Only collect data needed for debugging, reliability, and product improvement.

## Sensitive data restrictions

Do not send the following to Grafana, Sentry, or PostHog:

- passwords
- access tokens
- refresh tokens
- private keys
- raw Authorization headers
- payment card data
- secret API responses
- unnecessary personally identifiable information

## User identification

If user identification is required, use stable internal IDs instead of emails where possible.

Preferred:

```txt
user.id = internal-user-id
```

Avoid:

```txt
user.email = user@example.com
```

unless the product/privacy policy explicitly allows it.

## Session replay

Session replay must be disabled by default until the team reviews privacy implications.

If enabled, masking must be configured for:

- input fields
- personal data
- payment fields
- private user-generated content

---

# 13. Rollout Plan

## Phase 1: Foundation

Implement:

- Grafana Cloud account and stack
- Sentry projects for web and mobile
- PostHog project
- shared environment variable strategy
- `/health` endpoint in API

Deliverables:

- accounts created
- secrets configured in CI/CD
- environments created: local, staging, production

## Phase 2: Backend observability

Implement:

- OpenTelemetry in NestJS
- basic traces
- basic metrics
- structured logs
- Grafana Cloud export
- API overview dashboard

Acceptance check:

- one API request appears as a trace in Grafana Cloud
- service name and environment are correct
- errors are visible
- request latency is visible

## Phase 3: Web observability

Implement:

- Sentry for Vite/React
- web source map upload
- PostHog web analytics
- key event tracking

Acceptance check:

- test error appears in Sentry
- source map resolves stack trace
- test product event appears in PostHog

## Phase 4: Mobile observability

Implement:

- Sentry for Expo React Native
- EAS/source map upload
- PostHog React Native
- basic mobile event tracking

Acceptance check:

- test error appears in Sentry
- source map resolves stack trace
- app open event appears in PostHog

## Phase 5: Dashboards and alerts

Implement:

- API dashboard
- basic uptime alert
- API error rate alert
- API latency alert
- Sentry issue alerts
- PostHog product dashboard

Acceptance check:

- team receives alert from a controlled test
- dashboard can answer basic operational questions

---

# 14. Acceptance Criteria

The implementation is complete when:

1. NestJS telemetry reaches Grafana Cloud.
2. API traces include service name, environment, version, and commit SHA.
3. API logs are structured and searchable.
4. API errors can be correlated with traces.
5. Vite/React errors appear in Sentry.
6. Web source maps are uploaded and stack traces are readable.
7. Expo errors/crashes appear in Sentry.
8. Mobile source maps are uploaded and stack traces are readable.
9. PostHog receives web and mobile analytics events.
10. At least one uptime check is configured.
11. At least one API error-rate or availability alert is configured.
12. Secrets are stored only in CI/CD or hosting provider secret storage.
13. No sensitive data is intentionally sent to telemetry vendors.
14. A short `OBSERVABILITY.md` guide exists in the repository.

# 15. Official Documentation to Follow

The implementation should follow official documentation from:

- Grafana Cloud OpenTelemetry / OTLP ingestion documentation
- OpenTelemetry JavaScript documentation
- Sentry React documentation
- Sentry React Native Expo documentation
- Sentry source map upload documentation
- PostHog JavaScript documentation
- PostHog React Native / Expo documentation
- Expo Sentry guide

When documentation conflicts with generated code or coding-agent suggestions, official documentation should take priority.
