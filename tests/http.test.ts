import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
vi.mock("server-only", () => ({}));
import { encryptionKey } from "../src/lib/auth/crypto";
import { ServiceError } from "../src/lib/service-error";
import { authSettings } from "../src/lib/auth/session";
import { assertSameOrigin, readJson, failure } from "../src/lib/http";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("Browser session boundary", () => {
  it("uses the deployment host without requiring APP_ORIGIN", () => {
    vi.stubEnv("APP_ORIGIN", "");
    vi.stubEnv("VERCEL", "1");
    const host = "tz-chat-alexlopashev-gmailcoms-projects.vercel.app";
    const request = new Request("https://internal.example/api/auth/sign-in", {
      headers: { Host: host, Origin: `https://${host}` },
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
    expect(authSettings(request).origin).toBe(`https://${host}`);
    expect(authSettings(request.headers).cookieName).toBe("__Host-rcp-session");
    expect(authSettings(request.headers).options.secure).toBe(true);
  });
  it("does not trust Origin or forwarded host to set the expected origin", () => {
    vi.stubEnv("APP_ORIGIN", "");
    const cases: Record<string, string>[] = [
      {},
      { "X-Forwarded-Host": "attacker.example" },
    ];
    for (const extra of cases) {
      const request = new Request("https://research.example/api/auth/sign-in", {
        headers: {
          Host: "research.example",
          Origin: "https://attacker.example",
          ...extra,
        },
      });
      expect(() => assertSameOrigin(request)).toThrow();
    }
    expect(() =>
      authSettings(new Headers({ Host: "research.example,attacker.example" })),
    ).toThrow();
  });
  it("supports localhost without APP_ORIGIN and rejects missing Origin", () => {
    vi.stubEnv("APP_ORIGIN", "");
    vi.stubEnv("VERCEL", "");
    const request = new Request("http://localhost:3000/api/auth/sign-in", {
      headers: { Origin: "http://localhost:3000" },
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
    expect(
      authSettings(new Headers({ host: "localhost:3000" })).options.secure,
    ).toBe(false);
    expect(() => assertSameOrigin(new Request(request.url))).toThrow();
  });
  it("reports encryption setup failures with safe diagnostic codes and no key material", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const [value, code] of [
      ["", "TOKEN_KEY_MISSING"],
      ["secret-invalid-key", "TOKEN_KEY_INVALID"],
    ]) {
      vi.stubEnv("RCP_TOKEN_ENCRYPTION_KEY", value);
      let error: unknown;
      try {
        encryptionKey();
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(ServiceError);
      const response = failure(error, {
        operation: "sign-in",
        stage: "encryption-key",
      });
      const body = await response.json();
      expect(response.status).toBe(503);
      expect(body.reference).toMatch(/^[a-f0-9-]{36}$/);
      expect(body.error).toContain(body.reference);
      expect(JSON.stringify(body)).not.toContain("secret-invalid-key");
      expect(JSON.parse(log.mock.calls.at(-1)![0])).toMatchObject({
        code,
        stage: "encryption-key",
        reference: body.reference,
      });
    }
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret-invalid-key");
  });
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
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = failure(
      new Error("Bearer secret-token; postgres password"),
    );
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret-token|postgres/);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(/secret-token|postgres/);
  });
});
