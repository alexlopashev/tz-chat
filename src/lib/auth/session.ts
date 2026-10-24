import "server-only";
import { cookies, headers } from "next/headers";
import { ServiceError } from "../service-error";
import { database } from "../database";
import { Repository } from "../repository";
import { decryptToken, sessionHash, SESSION_SECONDS } from "./crypto";

export function authSettings(request?: Request | Headers) {
  // Match the browser Origin against the actual request host, as Next.js does
  // for Server Actions. Never derive the expected origin from the Origin header.
  // APP_ORIGIN is an optional strict override for custom reverse proxies.
  let origin = process.env.APP_ORIGIN;
  try {
    if (!origin) {
      const incoming = request instanceof Headers ? request : request?.headers;
      const host =
        incoming?.get("host") ??
        (request instanceof Request ? new URL(request.url).host : undefined);
      if (!host || /[\s,/@?#\\]/.test(host)) throw new Error();
      const parsed = new URL(`https://${host}`);
      const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
        parsed.hostname,
      );
      origin = `${loopback && process.env.VERCEL !== "1" ? "http" : "https"}://${host}`;
    }
    const url = new URL(origin);
    if (
      url.origin !== origin ||
      (url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
        ))
    ) {
      throw new Error();
    }
  } catch {
    throw new ServiceError("AUTH_ORIGIN_INVALID");
  }
  const secure = origin.startsWith("https:");
  return {
    origin,
    cookieName: secure ? "__Host-rcp-session" : "rcp-session-local",
    options: {
      httpOnly: true,
      secure,
      sameSite: "lax" as const,
      path: "/",
      maxAge: SESSION_SECONDS,
    },
  };
}
export function repository() {
  return new Repository(database());
}
export async function currentSessionId() {
  const settings = authSettings(await headers());
  const value = (await cookies()).get(settings.cookieName)?.value;
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
}
export async function currentSession() {
  const id = await currentSessionId();
  return id ? repository().session(sessionHash(id)) : null;
}
/** Only server-side MCP callers may resolve a session's encrypted credential. */
export async function currentRcpToken() {
  const id = await currentSessionId();
  if (!id) return null;
  const credential = await repository().credential(sessionHash(id));
  return credential
    ? decryptToken(credential.token_ciphertext, credential.user_id)
    : null;
}
