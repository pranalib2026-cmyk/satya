import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./helpers.js";

describe("system and content routes", () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("reports liveness", async () => {
    const response = await testApp.app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "nyayasetu-api",
    });
  });

  it("reports readiness", async () => {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/health/ready",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      checks: { database: "up" },
    });
  });

  it("returns seeded practice areas", async () => {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/api/v1/practices",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toHaveLength(6);
    expect(body.data[0]).toHaveProperty("slug");
    expect(body.data[0]).toHaveProperty("whatWeHandle");
  });

  it("filters advocates by practice and language", async () => {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/api/v1/advocates?practice=Criminal%20Defense%20%26%20Bail&language=Hindi",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((advocate: { practice: string }) =>
      advocate.practice.includes("Criminal"),
    )).toBe(true);
    expect(body.meta.total).toBeGreaterThan(0);
  });

  it("returns paginated insights", async () => {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/api/v1/insights?limit=3",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toHaveLength(3);
    expect(body.meta).toMatchObject({ page: 1, limit: 3, total: 9 });
  });

  it("returns 404 for an unknown route", async () => {
    const response = await testApp.app.inject({
      method: "GET",
      url: "/api/v1/does-not-exist",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("not_found");
  });
});
