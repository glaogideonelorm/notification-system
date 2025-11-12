import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";

import { buildApp } from "./app";

let app: Awaited<ReturnType<typeof buildApp>>;

describe("API Gateway - Notifications", () => {
  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health should return ok", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();

    expect(body.status).toBe("ok");
  });

  it("POST /api/v1/notifications/ should create notification", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/notifications/",
      payload: {
        notification_type: "email",
        user_id: "11111111-1111-1111-1111-111111111111",
        template_code: "welcome_email",
        variables: {
          name: "Test User",
          link: "https://example.com",
          meta: { env: "test" },
        },
        request_id: "vitest-req-1",
        priority: 1,
        metadata: { source: "vitest" },
      },
    });

    expect(res.statusCode).toBe(201);

    const body = res.json();

    expect(body.success).toBe(true);

    expect(body.data.notification_id).toBeDefined();

    expect(body.data.request_id).toBe("vitest-req-1");

    expect(body.data.status).toBe("pending");
  });

  it("POST /api/v1/notifications/ should be idempotent by request_id", async () => {
    const payload = {
      notification_type: "email",
      user_id: "11111111-1111-1111-1111-111111111111",
      template_code: "welcome_email",
      variables: {
        name: "Test User",
        link: "https://example.com",
        meta: { env: "test" },
      },
      request_id: "vitest-req-2",
      priority: 1,
      metadata: { source: "vitest" },
    };

    const res1 = await app.inject({
      method: "POST",
      url: "/api/v1/notifications/",
      payload,
    });

    const body1 = res1.json();

    const id1 = body1.data.notification_id as string;

    const res2 = await app.inject({
      method: "POST",
      url: "/api/v1/notifications/",
      payload,
    });

    const body2 = res2.json();

    const id2 = body2.data.notification_id as string;

    expect(id2).toBe(id1);
  });

  it("POST /api/v1/email/status/ should update status", async () => {
    // First create a notification
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/notifications/",
      payload: {
        notification_type: "email",
        user_id: "33333333-3333-3333-3333-333333333333",
        template_code: "welcome_email",
        variables: {
          name: "Status Test",
          link: "https://example.com",
        },
        request_id: "vitest-req-status",
        priority: 1,
      },
    });

    const created = createRes.json();

    const id = created.data.notification_id as string;

    const statusRes = await app.inject({
      method: "POST",
      url: "/api/v1/email/status/",
      payload: {
        notification_id: id,
        status: "delivered",
      },
    });

    expect(statusRes.statusCode).toBe(200);

    const statusBody = statusRes.json();

    expect(statusBody.data.status).toBe("delivered");

    const getRes = await app.inject({
      method: "GET",
      url: `/api/v1/notifications/${id}`,
    });

    const getBody = getRes.json();

    expect(getBody.data.status).toBe("delivered");
  });
});
