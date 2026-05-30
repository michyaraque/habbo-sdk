/**
 * HTTP transport layer.
 *
 * A thin wrapper around `fetch` that adds JSON encoding/decoding, request
 * timeouts, retry with exponential backoff for transient failures, and mapping
 * of failed responses onto the SDK's {@link HabboError} hierarchy.
 */

import {
  HabboAuthError,
  HabboError,
  HabboNetworkError,
  HabboNotFoundError,
  HabboRateLimitError,
  MaintenanceError,
  UserInvalidError,
} from "./errors.js";

/**
 * The subset of the `fetch` signature the SDK relies on. Any compatible
 * implementation may be injected through the client configuration.
 */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

/**
 * Returns the runtime's global `fetch`, throwing a descriptive error when it is
 * unavailable so misconfiguration is caught early rather than at the first call.
 */
export function defaultFetch(): FetchLike {
  if (typeof fetch === "function") {
    return fetch as unknown as FetchLike;
  }
  throw new HabboError(
    "Global fetch is not available in this runtime. Upgrade to Node 18+ or pass a custom `fetch` implementation in the client configuration.",
  );
}

/**
 * The HTTP methods used across the SDK.
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Options for a single request issued through {@link HttpClient.request}.
 */
export interface RequestOptions {
  /** Absolute request URL. */
  url: string;
  /** HTTP method. Defaults to `GET`. */
  method?: HttpMethod;
  /** Query string parameters. `undefined` values are omitted. */
  query?: Record<string, string | number | boolean | undefined>;
  /** Request body, serialized to JSON when present. */
  body?: unknown;
  /** Extra request headers, merged over the transport defaults. */
  headers?: Record<string, string>;
  /**
   * When `true`, the response body is returned as a raw string instead of being
   * parsed as JSON, and the `Accept` header is not forced to JSON. Used for
   * endpoints that return XML or plain text.
   */
  raw?: boolean;
}

/**
 * Configuration consumed by the {@link HttpClient}.
 */
export interface HttpClientOptions {
  fetch: FetchLike;
  timeout: number;
  maxRetries: number;
  userAgent: string;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function appendQuery(
  url: string,
  query: Record<string, string | number | boolean | undefined> | undefined,
): string {
  if (!query) {
    return url;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs.length > 0 ? `${url}?${qs}` : url;
}

function parseRetryAfter(headerValue: string | null): number | undefined {
  if (headerValue === null) {
    return undefined;
  }
  const seconds = Number(headerValue);
  return Number.isFinite(seconds) ? seconds : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reusable HTTP client shared by all resource groups.
 */
export class HttpClient {
  private readonly fetch: FetchLike;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly userAgent: string;

  constructor(options: HttpClientOptions) {
    this.fetch = options.fetch;
    this.timeout = options.timeout;
    this.maxRetries = options.maxRetries;
    this.userAgent = options.userAgent;
  }

  /**
   * Issues a request and decodes the response as JSON.
   *
   * @typeParam T - The expected shape of the decoded response body.
   * @returns The parsed response body, or `undefined` for empty (`204`)
   *   responses.
   * @throws {@link HabboError} or one of its subclasses on any failure.
   */
  async request<T>(options: RequestOptions): Promise<T> {
    const url = appendQuery(options.url, options.query);
    const method = options.method ?? "GET";

    const headers: Record<string, string> = {
      Accept: options.raw ? "*/*" : "application/json",
      "User-Agent": this.userAgent,
      ...options.headers,
    };

    let serializedBody: string | undefined;
    if (options.body !== undefined) {
      serializedBody = JSON.stringify(options.body);
      headers["Content-Type"] = "application/json";
    }

    let attempt = 0;
    let lastError: HabboError | undefined;

    while (attempt <= this.maxRetries) {
      try {
        const response = await this.dispatch(url, method, headers, serializedBody);
        const text = await response.text();

        if (response.ok) {
          return options.raw ? (text as T) : this.decode<T>(text);
        }

        const error = this.mapErrorResponse(response.status, response.headers, text);
        if (RETRYABLE_STATUS.has(response.status) && attempt < this.maxRetries) {
          lastError = error;
          await sleep(this.backoffDelay(attempt, error));
          attempt += 1;
          continue;
        }
        throw error;
      } catch (error) {
        if (error instanceof HabboError && !(error instanceof HabboNetworkError)) {
          throw error;
        }
        const networkError =
          error instanceof HabboNetworkError
            ? error
            : new HabboNetworkError(this.describeTransportError(error), { cause: error });
        if (attempt < this.maxRetries) {
          lastError = networkError;
          await sleep(this.backoffDelay(attempt));
          attempt += 1;
          continue;
        }
        throw networkError;
      }
    }

    throw lastError ?? new HabboError("Request failed after exhausting retries.");
  }

  private async dispatch(
    url: string,
    method: HttpMethod,
    headers: Record<string, string>,
    body: string | undefined,
  ): Promise<Awaited<ReturnType<FetchLike>>> {
    const controller = this.timeout > 0 ? new AbortController() : undefined;
    const timer =
      controller !== undefined ? setTimeout(() => controller.abort(), this.timeout) : undefined;

    try {
      return await this.fetch(url, {
        method,
        headers,
        ...(body !== undefined ? { body } : {}),
        ...(controller !== undefined ? { signal: controller.signal } : {}),
      });
    } catch (error) {
      if (controller?.signal.aborted) {
        throw new HabboNetworkError(`Request to ${url} timed out after ${this.timeout}ms.`, {
          cause: error,
        });
      }
      throw error;
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }

  private decode<T>(text: string): T {
    if (text.length === 0) {
      return undefined as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new HabboError("Failed to parse the API response as JSON.", {
        body: text,
        cause: error,
      });
    }
  }

  private describeTransportError(error: unknown): string {
    const detail = error instanceof Error ? error.message : String(error);
    return `Network request failed: ${detail}`;
  }

  private backoffDelay(attempt: number, error?: HabboError): number {
    if (error instanceof HabboRateLimitError && error.retryAfter !== undefined) {
      return error.retryAfter * 1_000;
    }
    const base = 300 * 2 ** attempt;
    const jitter = Math.random() * 100;
    return base + jitter;
  }

  /**
   * Maps a non-2xx response onto the appropriate {@link HabboError} subclass,
   * mirroring the error semantics of the Habbo APIs.
   */
  private mapErrorResponse(
    status: number,
    headers: { get(name: string): string | null },
    text: string,
  ): HabboError {
    const body = this.safeJson(text);
    const message = this.extractMessage(body, text);

    if (text.includes("maintenance")) {
      return new MaintenanceError("The hotel API is down for maintenance.", { status, body });
    }
    if (message === "user.invalid_name") {
      return new UserInvalidError("The supplied user name is invalid.", { status, body });
    }

    switch (status) {
      case 401:
      case 403:
        return new HabboAuthError(
          message ?? "Authentication failed. Verify the X-Wired-Write-Key.",
          { status, body },
        );
      case 404:
        return new HabboNotFoundError(message ?? "The requested resource was not found.", {
          status,
          body,
        });
      case 429:
        return new HabboRateLimitError(message ?? "Rate limit exceeded.", {
          status,
          body,
          retryAfter: parseRetryAfter(headers.get("Retry-After")),
        });
      default:
        return new HabboError(message ?? `Request failed with status ${status}.`, {
          status,
          body,
        });
    }
  }

  private safeJson(text: string): unknown {
    if (text.length === 0 || (text[0] !== "{" && text[0] !== "[")) {
      return undefined;
    }
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }

  /**
   * Extracts a human-readable message from a Habbo error body. Both APIs use a
   * couple of shapes: `{ "errors": [{ "msg": "..." }] }` and `{ "error": "..." }`,
   * with `{ "message": "..." }` also seen on the Wired API.
   */
  private extractMessage(body: unknown, fallback: string): string | undefined {
    if (body !== null && typeof body === "object") {
      const record = body as Record<string, unknown>;
      const errors = record["errors"];
      if (Array.isArray(errors) && errors.length > 0) {
        const first = errors[0];
        if (first !== null && typeof first === "object" && "msg" in first) {
          const msg = (first as Record<string, unknown>)["msg"];
          if (typeof msg === "string") {
            return msg;
          }
        }
      }
      for (const key of ["error", "message"] as const) {
        const value = record[key];
        if (typeof value === "string") {
          return value;
        }
      }
    }
    return fallback.length > 0 && fallback.length < 200 ? fallback : undefined;
  }
}
