import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
vi.mock("server-only", () => ({}));
import { authSettings } from "../src/lib/auth/session";
import { assertSameOrigin, readJson, failure } from "../src/lib/http";

afterEach(() => vi.unstubAllEnvs());
describe("Browser session boundary", () => {
  it("uses Secure host-only cookies on HTTPS and permits HTTP only on loopback", () => {
    vi.stubEnv("APP_ORIGIN", "https://research.example");
    const settings = authSettings();
    expect(settings.cookieName).toBe("__Host-rcp-session");
    expect(settings.options).toMatchObject({
      secure: true,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 2592000,
    });
    expect(settings.options).not.toHaveProperty("domain");
    vi.stubEnv("APP_ORIGIN", "http://research.example");
    expect(() => authSettings()).toThrow();
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    expect(authSettings().options.secure).toBe(false);
  });
  it("rejects cross-site and missing Origin mutations, including login CSRF", () => {
    vi.stubEnv("APP_ORIGIN", "https://research.example");
    for (const headers of [
      {},
      { Origin: "https://attacker.example" },
      { Origin: "https://research.example", "Sec-Fetch-Site": "cross-site" },
    ] as Record<string, string>[]) {
      expect(() =>
        assertSameOrigin(
          new Request("https://research.example/api/auth/sign-in", {
            method: "POST",
            headers,
          }),
        ),
      ).toThrow();
    }
    expect(() =>
      assertSameOrigin(
        new Request("https://research.example/api/auth/sign-in", {
          method: "POST",
          headers: { Origin: "https://research.example" },
        }),
      ),
    ).not.toThrow();
  });
  it("bounds actual request bodies without relying on Content-Length", async () => {
    const body = "x".repeat(16385);
    await expect(
      readJson(
        new Request("http://localhost", {
          method: "POST",
          body,
          headers: { "Content-Type": "application/json" },
        }),
        z.unknown(),
      ),
    ).rejects.toThrow("too large");
  });
  it("does not echo upstream or database error text", async () => {
    const response = failure(
      new Error("Bearer secret-token; postgres password"),
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(/secret-token|postgres/);
  });
});
