/**
 * Client configuration and its resolution logic.
 *
 * The public endpoints need no authentication, while the Wired Variables ones
 * are authenticated per room with a read key and a write key.
 */

import { type FetchLike, defaultFetch } from "./http.js";

/**
 * Hotel domain suffixes supported by the public Habbo API.
 *
 * The value is appended to `www.habbo.` to form the API host. The special value
 * Two values are not suffixes: `sandbox` targets `sandbox.habbo.com`, and
 * `origins` targets `origins.habbo.com`, the separate Habbo Origins hotel that
 * serves the `origins` resource.
 */
export type Hotel =
  | "com"
  | "es"
  | "com.br"
  | "de"
  | "fi"
  | "fr"
  | "it"
  | "nl"
  | "com.tr"
  | "sandbox"
  | "origins";

/**
 * Full configuration object accepted by the {@link HabboClient} constructor.
 */
export interface HabboClientConfig {
  /**
   * The `X-Wired-Read-Key` used to authenticate Wired Variables **reads**.
   *
   * Optional: omit it if you only use the public `profiles` API or only perform
   * writes. Any read that needs it throws {@link HabboAuthError} when it is
   * missing. Both keys are found in the room's Wired settings in the hotel.
   */
  readKey?: string;

  /**
   * The `X-Wired-Write-Key` used to authenticate Wired Variables **writes**.
   *
   * Optional: omit it for a read-only client. Any write that needs it throws
   * {@link HabboAuthError} when it is missing.
   */
  writeKey?: string;

  /**
   * The optional `api_key` sent with the Habbo Origins fishing derby endpoints.
   *
   * Only the derby routes accept it; every other endpoint ignores it.
   */
  originsApiKey?: string;

  /**
   * The hotel domain used by the public `profiles` API.
   *
   * @defaultValue `"es"`
   */
  hotel?: Hotel;

  /**
   * Overrides the host serving the Wired Variables API, without a trailing
   * slash.
   *
   * The Wired Variables endpoints live on the same host as the public API,
   * under `/api/public/rooms/...`, so this defaults to the same value as
   * {@link HabboClientConfig.publicBaseUrl}. Set it only to point the Wired
   * calls at a different host, such as a proxy or a test server.
   */
  wiredBaseUrl?: string;

  /**
   * Overrides the host used by the public `profiles` API. When set, it takes
   * precedence over {@link HabboClientConfig.hotel}. Useful for testing or for
   * pointing at a proxy. Provide it without a trailing slash.
   */
  publicBaseUrl?: string;

  /**
   * Custom `fetch` implementation. Defaults to the global `fetch`. Provide one
   * to run on older runtimes or to intercept requests in tests.
   */
  fetch?: FetchLike;

  /**
   * Request timeout in milliseconds. A value of `0` disables the timeout.
   *
   * @defaultValue `15000`
   */
  timeout?: number;

  /**
   * Number of times a failed request is retried for transient failures
   * (network errors and HTTP `429`/`5xx`). Set to `0` to disable retries.
   *
   * @defaultValue `2`
   */
  maxRetries?: number;

  /**
   * Value sent in the `User-Agent` header on every request.
   *
   * @defaultValue `"habbo-sdk/<version>"`
   */
  userAgent?: string;
}

/**
 * The fully normalized configuration consumed internally by the resources and
 * the HTTP transport.
 */
export interface ResolvedConfig {
  readonly readKey: string | undefined;
  readonly writeKey: string | undefined;
  readonly originsApiKey: string | undefined;
  readonly publicBaseUrl: string;
  readonly wiredBaseUrl: string;
  readonly fetch: FetchLike;
  readonly timeout: number;
  readonly maxRetries: number;
  readonly userAgent: string;
}

const DEFAULT_HOTEL: Hotel = "es";
const DEFAULT_TIMEOUT = 15_000;
const DEFAULT_MAX_RETRIES = 2;

/**
 * The package version, used to build the default `User-Agent`.
 *
 * `__SDK_VERSION__` is replaced at build time with the value from
 * `package.json`. The guard keeps the source runnable without the bundler (for
 * example under `tsx` or test runners), where the placeholder is undefined.
 */
declare const __SDK_VERSION__: string | undefined;
const SDK_VERSION = typeof __SDK_VERSION__ === "string" ? __SDK_VERSION__ : "0.0.0-dev";

/**
 * Computes the public API host for a given hotel domain.
 */
function publicBaseUrlForHotel(hotel: Hotel): string {
  if (hotel === "sandbox") {
    return "https://sandbox.habbo.com";
  }
  if (hotel === "origins") {
    return "https://origins.habbo.com";
  }
  return `https://www.habbo.${hotel}`;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Normalizes the two accepted constructor argument shapes into a single
 * {@link ResolvedConfig}.
 *
 * @param input - Either a full {@link HabboClientConfig} object, or a bare
 *   string, which is treated as both the read and the write key. Rooms that
 *   issue two distinct keys must use the object form.
 * @returns The resolved configuration with all defaults applied.
 */
export function resolveConfig(input: string | HabboClientConfig): ResolvedConfig {
  const config: HabboClientConfig =
    typeof input === "string" ? { readKey: input, writeKey: input } : input;

  const hotel = config.hotel ?? DEFAULT_HOTEL;
  const host = publicBaseUrlForHotel(hotel);
  const publicBaseUrl = stripTrailingSlash(config.publicBaseUrl ?? host);
  const wiredBaseUrl = stripTrailingSlash(config.wiredBaseUrl ?? publicBaseUrl);

  return {
    readKey: config.readKey,
    writeKey: config.writeKey,
    originsApiKey: config.originsApiKey,
    publicBaseUrl,
    wiredBaseUrl,
    fetch: config.fetch ?? defaultFetch(),
    timeout: config.timeout ?? DEFAULT_TIMEOUT,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
    userAgent: config.userAgent ?? `habbo-sdk/${SDK_VERSION}`,
  };
}
