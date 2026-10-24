/** Safe operational codes only; never attach raw SDK errors, SQL, or credentials. */
export type ServiceErrorCode =
  | "AUTH_ORIGIN_INVALID"
  | "TOKEN_KEY_MISSING"
  | "TOKEN_KEY_INVALID"
  | "DATABASE_NOT_CONFIGURED"
  | "DATABASE_SCHEMA_MISSING"
  | "DATABASE_PERMISSION_DENIED"
  | "DATABASE_UNAVAILABLE";
export class ServiceError extends Error {
  constructor(public readonly code: ServiceErrorCode) {
    super(code);
  }
}
