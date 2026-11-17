import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./helpers.js";

const validIntake = {
  kind: "legal-assessment",
  fullName: "Rajesh Sharma",
  email: "rajesh@example.com",
  phone: "+91 98765 43210",
  jurisdiction: "Mumbai, Bombay High Court",
  practiceArea: "civil-property",
  urgency: "urgent-48h",
  matterSummary:
    "Builder has delayed possession by four years and is refusing to refund the booking amount.",
  adverseParties: "Example Builders Pvt Ltd",
  consentAcknowledged: true,
};

describe("intake and newsletter routes", () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ seed: false });
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("creates and tracks an intake request", async () => {
    const createResponse = await testApp.app.inject({
      method: "POST",
      url: "/api/v1/intake",
      payload: validIntake,
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json().data;
    expect(created.reference).toMatch(/^NS-\d{8}-[0-9A-F]{6}$/);
    expect(created.kind).toBe("legal-assessment");
    expect(created.status).toBe("received");

    const trackResponse = await testApp.app.inject({
      method: "GET",
      url: created.trackingUrl,
    });

    expect(trackResponse.statusCode).toBe(200);
    expect(trackResponse.json().data).toMatchObject({
      reference: created.reference,
      kind: "legal-assessment",
      status: "received",
    });
    expect(trackResponse.json().data).not.toHaveProperty("email");
  });

  it("normalizes legacy urgency values", async () => {
    const response = await testApp.app.inject({
      method: "POST",
      url: "/api/v1/intake",
      payload: { ...validIntake, urgency: "none-yet" },
    });

    expect(response.statusCode).toBe(201);
  });

  it("rejects intake without consent", async () => {
    const response = await testApp.app.inject({
      method: "POST",
      url: "/api/v1/intake",
      payload: { ...validIntake, consentAcknowledged: false },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation_error");
  });

  it("rejects a invalid email", async () => {
    const response = await testApp.app.inject({
      method: "POST",
      url: "/api/v1/intake",
      payload: { ...validIntake, email: "not-an-email" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("subscribes and resubscribes idempotently", async () => {
    const first = await testApp.app.inject({
      method: "POST",
      url: "/api/v1/newsletter",
      payload: { email: "Reader@Example.com" },
    });

    expect(first.statusCode).toBe(202);
    expect(first.json().data.email).toBe("reader@example.com");

    const second = await testApp.app.inject({
      method: "POST",
      url: "/api/v1/newsletter",
      payload: { email: "reader@example.com" },
    });

    expect(second.statusCode).toBe(202);
  });
});
