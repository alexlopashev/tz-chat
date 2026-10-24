import "server-only";
import { randomUUID } from "node:crypto";
import { ServiceError } from "./service-error";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authSettings, currentSession } from "./auth/session";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function assertSameOrigin(request: Request) {
  if (
    request.headers.get("origin") !== authSettings(request).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    throw new HttpError(403, "This request must come from this application.");
  }
}
export async function readJson<T>(request: Request, schema: z.ZodType<T>) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Expected JSON.");
  // Bound actual bytes, including chunked requests without a Content-Length header.
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Missing request body.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) {
        await reader.cancel();
        throw new HttpError(413, "Request is too large.");
      }
      chunks.push(value);
    }
    const result = schema.safeParse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    if (!result.success)
      throw new HttpError(400, "Check your input and try again.");
    return result.data;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Check your input and try again.");
  } finally {
    reader.releaseLock();
  }
}
export async function requireSession() {
  const session = await currentSession();
  if (!session)
    throw new HttpError(
      401,
      "Your session has ended. Sign in again to continue.",
    );
  return session;
}
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function failure(
  error: unknown,
  context?: { operation: "sign-in"; stage: string },
) {
  if (error instanceof HttpError)
    return json({ error: error.message }, error.status);
  const reference = randomUUID();
  const code =
    error instanceof ServiceError ? error.code : "UNEXPECTED_FAILURE";
  // Emit only allowlisted diagnostics. Never log the exception, request, or token.
  console.error(
    JSON.stringify({
      event: "application_request_failed",
      code,
      reference,
      operation: context?.operation ?? "request",
      stage: context?.stage ?? "unknown",
    }),
  );
  const message =
    context?.operation === "sign-in"
      ? "Sign-in is temporarily unavailable. Your token could not be connected. Please contact support with this reference."
      : "We couldn't complete that request. Please try again shortly.";
  return json({ error: `${message} Reference: ${reference}`, reference }, 503);
}
