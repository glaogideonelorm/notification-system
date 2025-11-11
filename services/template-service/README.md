
# Template Service

This microservice stores, manages, and renders notification templates used by the notification system (email & push). It supports variable substitution, versions, multi-language templates and exposes both HTTP (synchronous) APIs and message-based (asynchronous) usage patterns.

This README describes how other services should communicate with the Template Service, the endpoints available.

## Quick contract
- Inputs: template_id or template_name + variables (snake_case) and optional language
- Outputs: rendered template text/object or template metadata
- Error modes: standard error field in the response wrapper; permanent template-not-found is a 404
- Success criteria: returned `success: true` and `data` contains requested payload

All request/response/model property names follow snake_case.

## Response wrapper
All HTTP responses use the following wrapper:

{
	"success": boolean,
	"data": object | array | null,
	"error": string | null,
	"message": string,
	"meta": PaginationMeta | null
}

PaginationMeta example:
{
	"total": 100,
	"limit": 20,
	"page": 1,
	"total_pages": 5,
	"has_next": true,
	"has_previous": false
}

## How other services should communicate

1) Synchronous (REST) — when the caller needs templates or metadata immediately (user service, API gateway for validation): use the Template Service REST APIs described below.

 - Use REST when you need template metadata, list templates, fetch specific template versions, or perform quick validation.

2) Asynchronous (Message Queue) — when producing notifications to be processed by Email or Push services: publish messages onto the message broker (RabbitMQ/Kafka). The Template Service offers an optional render worker or REST render endpoint for pre-rendering templates prior to enqueueing.

 - Preferred pattern for notifications: API Gateway or Notification producer resolves user preferences, decides channel (email/push), then enqueue message to Exchange `notifications.direct` with routing key `email` or `push`. The Email/Push service may call Template Service synchronously to fetch templates, or include template_id + variables in the queue message and let the Email/Push service call Template Service to render.

Examples below show both approaches.

## Endpoints

Base path: `/` unless otherwise configured. Authentication is expected (JWT/API keys) — attach Authorization header.

### Health
- GET /health
	- Returns 200 with service status.
	- Response: { "success": true, "data": { "status": "ok", "version": "x.y.z" }, "message": "service healthy" }

### Templates collection
- GET /templates
	- Query: `page`, `limit`, `language`, `name` (all snake_case)
	- Returns paginated list of templates.

- POST /templates
	- Create a new template.
	- Body (snake_case):
		{
			"name": "welcome_email",
			"language": "en",
			"subject": "Welcome, {{name}}",
			"body": "Hello {{name}}, welcome to our service.",
			"metadata": { "channel": "email" }
		}

	- Returns created template with `id`, `version`.

### Template item
- GET /templates/{template_id}
	- Get latest template version and metadata.

- PUT /templates/{template_id}
	- Update template (creates new version). Body same as POST.

### Versions
- GET /templates/{template_id}/versions
	- List versions for a template.

- GET /templates/{template_id}/versions/{version_id}
	- Fetch a specific version.

### Render (synchronous)
- POST /templates/{template_id}/render
	- Render a template server-side and return rendered payload.
	- Body:
		{
			"request_id": "uuid-v4",      // idempotency / correlation id
			"variables": { "name": "Alice", "expiry_date": "2025-01-01" },
			"language": "en"
		}

	- Response data:
		{
			"subject": "...",
			"body": "...",
			"rendered_html": "..." // optional
		}


Processing flow:
 - Email/Push service consumes from queue.
 - It calls Template Service `/templates/{template_id}/render` to get rendered body (or uses a local cache of templates) and sends notification.

Pattern B — Pre-rendered (Template Service or gateway did rendering):

Message body (snake_case):
{
	"request_id": "uuid-v4",
	"recipient": "user@example.com",
	"rendered": { "subject": "...", "body": "..." },
	"channel": "email",
	"metadata": { "original_template_id": "..." }
}

Processing flow:
 - Email/Push service consumes and sends directly (no render call needed).

Notes:
 - Use correlation_id/request_id for tracing.
 - Implement retries with exponential backoff; on permanent failure, publish to `failed.queue`.

## Security

 - All HTTP APIs should require authentication (JWT or API key) and be TLS-only in production.
 - Sanitize variables before rendering to avoid injection into HTML outputs.

## Naming conventions

 - Use snake_case for all request/response properties, for example: `template_id`, `request_id`, `rendered_html`, `has_next`.

## Health & observability

 - `/health` for liveness and readiness.
 - Expose metrics (Prometheus endpoint /metrics) if possible.
 - Use correlation/request IDs for logs. Log template_id, version, request_id in lifecycle events.

## Example usage

1) Synchronous: API Gateway wants to preview a template before enqueueing

POST /templates/{template_id}/render
Body:
{
	"request_id": "123e4567-e89b-12d3-a456-426614174000",
	"variables": { "name": "Alex" },
	"language": "en"
}

Response.data:
{
	"subject": "Welcome Alex",
	"body": "Hello Alex, ...",
	"rendered_html": "<p>Hello Alex</p>"
}

2) Asynchronous: Producer publishes to RabbitMQ

Exchange: `notifications.direct`
Routing key: `email`
Message body (snake_case):
{
	"request_id": "uuid-v4",
	"recipient": "user@example.com",
	"template_id": "welcome_email",
	"variables": { "name": "Alex" },
	"language": "en"
}

The Email Service consumes, calls `/templates/{template_id}/render` (or uses cached template) and sends the mail. On success, it updates the central status store and logs delivery.
