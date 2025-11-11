# Push Service — Integration Guide

This document explains how other services in the notification platform should connect to and interact with the Push Service. It covers asynchronous integration via RabbitMQ, the service's REST endpoints (health and status), message schemas, idempotency, retries and dead-letter queue (DLQ) behavior.

## High-level overview

- The Push Service receives push notification work items asynchronously from the message queue (RabbitMQ). The Email Service uses its own queue.
- Exchange: `notifications.direct` (direct exchange)
- Push queue: `push.queue` — bound to `notifications.direct` using routing key `push`
- Dead Letter Queue: `failed.queue` — receives permanently failed messages
- Messages must use snake_case for fields and metadata.

Services that want to send push notifications should publish messages to the `notifications.direct` exchange with routing key `push` (or publish through the API Gateway which will route to the queue).

## Message queue configuration

- Exchange name: `notifications.direct`
- Push queue name: `push.queue`
- Failed / DLQ name: `failed.queue`
- Routing key for push: `push`
- Recommended queue arguments (RabbitMQ):
  - `x-dead-letter-exchange`: '' (default exchange) with routing key set to `failed` or a DLQ binding
  - `x-message-ttl` and/or a retry exchange can be configured by infrastructure but Push Service will implement application-level retry/backoff when necessary

Example queue bind (infrastructure):

- Declare exchange `notifications.direct` (type `direct`)
- Declare queue `push.queue` and bind to exchange with routing key `push`
- Declare `failed.queue` and bind appropriately

## Message schema (publisher -> push.queue)

All fields use snake_case. This is an example of a full message payload the Push Service expects.

Example: send a templated push to a user with device tokens

```json
{
  "request_id": "uuid-v4-or-other-unique-id",
  "notification_id": "optional-uuid-for-tracking",
  "user_id": 12345,
  "template_name": "welcome_v1",
  "template_variables": {
    "name": "Jane",
    "action_url": "https://app.example/verify"
  },
  "recipients": [
    {
      "device_token": "token_abc",
      "platform": "fcm",
      "device_id": "device-uuid"
    }
  ],
  "ttl": 3600,
  "priority": "high",
  "metadata": {"campaign": "onboarding"}
}
```

Required fields: `request_id`, `recipients` (or `user_id` with the Push Service able to fetch devices from User Service), and at least one of `template_name` or `title`/`body`.

Notes:
- `request_id` is mandatory for idempotency (see Idempotency below).
- `notification_id` is optional and can be used for cross-service tracking.
- Use snake_case for nested fields (e.g., `template_variables`).

## REST endpoints (service to service)

The Push Service exposes a minimal HTTP surface for health, diagnostics and optionally accepting synchronous requests (not recommended for large workloads):

- `GET /health` — returns HTTP 200 and JSON status info. Example response shape uses the standard response format below.

All service-to-service REST calls should use service tokens or mTLS as configured by platform security. If the API Gateway calls Push Service internal endpoints, ensure tokens are passed in `Authorization: Bearer <token>` header.

## Idempotency

- Every message MUST include a `request_id` (unique per logical request). Push Service uses `request_id` to deduplicate processing. If the same `request_id` reappears, the service should return the previous result (or skip duplicate processing).
- Deduplication is implemented using a short lived store (Redis) keyed by `request_id`. The client (publisher) should retry safely using the same `request_id` when retrying.

## Retry & Dead-letter queue

- Push Service will attempt delivery and implement retries with exponential backoff for transient errors.
- Permanently failed messages are published to `failed.queue` with failure metadata and reason.
- When publishing messages, set headers for tracing where possible: `correlation_id`, `request_id`, `sent_at`.

Example DLQ record (application-level):

```json
{
  "request_id": "...",
  "error": "invalid_device_token",
  "attempts": 3,
  "last_error_at": "2025-11-11T12:00:00Z",
  "payload": {...}
}
```

## Idempotency and ordering caveats

- Idempotency relies on the publisher providing a consistent `request_id`.
- Ordering across multiple recipients is not guaranteed. If ordering is required, use a separate workflow or embed sequence information in payloads.

## Authentication & Authorization

- Publishers (API Gateway, User Service, Template Service) should authenticate using the platform's service identity model (JWT service tokens or mutual TLS). The Push Service will validate the token when receiving HTTP requests. For RabbitMQ publishes, the broker enforces access control; messages published to the shared exchange are assumed to be from trusted internal services.

## Template & user lookups

- Push Service should be able to accept either a full payload with rendered title and body, or a `template_name` plus `template_variables` and fetch the template synchronously from the Template Service (REST call) before sending.
- When publishers include `template_name`, Push Service will call Template Service to retrieve the template. Use a short cache (Redis) to reduce latency for frequent templates.

## Device validation

- Publishers may include device tokens in the payload (`recipients`) or provide `user_id` and let Push Service query the User Service for active device tokens.
- Push Service validates tokens and platforms before attempting delivery.

## Environment variables

The Push Service supports the following environment variables (recommended names):

- `RABBITMQ_URL` — RabbitMQ connection string (e.g., amqp://user:pass@rabbitmq:5672/)
- `REDIS_URL` — redis://redis:6379/0
- `FCM_CREDENTIALS` — path or JSON for FCM service account

## Example end-to-end flow

1. API Gateway receives a notification request and validates/authenticates it.
2. API Gateway publishes a message to `notifications.direct` with routing key `push` (or calls an internal endpoint which publishes for it).
3. Push Service consumes from `push.queue`, checks idempotency (via `request_id` in Redis).
4. If not a duplicate, Push Service fetches templates (if needed), resolves device tokens (if only `user_id` provided), then attempts delivery via FCM/APNs/Web Push.
5. On success/failure Push Service writes status to the shared status store and emits metrics/logs. Permanent failures go to `failed.queue`.

