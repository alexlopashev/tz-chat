import "server-only";
import { cookies } from "next/headers";
import { database } from "../database";
import { Repository } from "../repository";
import { decryptToken, sessionHash, SESSION_SECONDS } from "./crypto";

export function authSettings() {
  const origin = process.env.APP_ORIGIN;
  if (!origin) throw new Error("APP_ORIGIN is not configured.");
  const url = new URL(origin);
  if (
    url.origin !== origin ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  ) {
    throw new Error(
      "APP_ORIGIN must be an HTTPS origin (HTTP is allowed only on localhost).",
    );
  }
  const secure = url.protocol === "https:";
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
  // Signed-out pages remain available before deployment configuration is supplied.
  if (!process.env.APP_ORIGIN) return undefined;
  const value = (await cookies()).get(authSettings().cookieName)?.value;
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
