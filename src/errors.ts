/**
 * Error hierarchy for the Habbo SDK.
 *
 * Every failure surfaced by the SDK is an instance of {@link HabboError}, allowing
 * consumers to catch a single base type while still being able to narrow to a
 * specific subclass when finer-grained handling is required.
 */

/**
 * Base class for all errors thrown by the SDK.
 *
 * It carries the HTTP status code (when the error originated from a response) and
 * the raw response body, which is useful for diagnostics and logging.
 */
export class HabboError extends Error {
  /**
   * The HTTP status code associated with the failure, or `undefined` when the
   * error was raised before a response was received (for example a network or
   * timeout error).
   */
  public readonly status: number | undefined;

  /**
   * The raw, unparsed response body, when available.
   */
  public readonly body: unknown;

  constructor(
    message: string,
    options: { status?: number; body?: unknown; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.status = options.status;
    this.body = options.body;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a requested resource (Habbo, group, room, variable, profile) does
 * not exist. Corresponds to HTTP `404` responses.
 */
export class HabboNotFoundError extends HabboError {}

/**
 * Thrown when the supplied user name is rejected by the public API as invalid.
 */
export class UserInvalidError extends HabboError {}

/**
 * Thrown when the hotel API is unavailable because it is undergoing maintenance.
 */
export class MaintenanceError extends HabboError {}

/**
 * Thrown when a Wired Variables request is rejected for authentication or
 * authorization reasons. Corresponds to HTTP `401` and `403` responses, most
 * commonly a missing or invalid `X-Wired-Write-Key`.
 */
export class HabboAuthError extends HabboError {}

/**
 * Thrown when the API responds with HTTP `429`, signalling that the client has
 * exceeded the allowed request rate.
 */
export class HabboRateLimitError extends HabboError {
  /**
   * The value of the `Retry-After` response header in seconds, when provided by
   * the server.
   */
  public readonly retryAfter: number | undefined;

  constructor(
    message: string,
    options: {
      status?: number;
      body?: unknown;
      retryAfter?: number | undefined;
      cause?: unknown;
    } = {},
  ) {
    super(message, options);
    this.retryAfter = options.retryAfter;
  }
}

/**
 * Thrown when a request fails to complete at the transport level, for example a
 * DNS failure, a dropped connection, or a client-side timeout.
 */
export class HabboNetworkError extends HabboError {}
