/**
 * Client configuration and its resolution logic.
 *
 * The public endpoints need no authentication. The Wired Variables API is
 * authenticated per room, so its keys do not belong on this client: bind
 * them on a {@link RoomInstance} instead.
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
 * Transport options shared by every client kind: the target host, the
 * `fetch` implementation, and the HTTP behaviour.
 */
export interface TransportConfig {
  /**
   * The hotel domain used by the API.
   *
   * @defaultValue `"es"`
   */
  hotel?: Hotel;

  /**
   * Overrides the host serving the Wired Variables API, without a trailing
   * slash. Defaults to the same value as
   * {@link TransportConfig.publicBaseUrl}.
   */
  wiredBaseUrl?: string;

  /**
   * Overrides the host used by the public API. When set, it takes precedence
   * over {@link TransportConfig.hotel}. Useful for testing or for pointing at
   * a proxy. Provide it without a trailing slash.
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
 * Full configuration object accepted by the {@link HabboClient} constructor.
 */
export interface HabboClientConfig extends TransportConfig {
  /**
   * The optional `api_key` sent with the Habbo Origins fishing derby
   * endpoints. Only the derby routes accept it; every other endpoint ignores
   * it.
   */
  originsApiKey?: string;
}

/**
 * The fully normalized configuration consumed internally by the resources
 * and the HTTP transport.
 */
export interface ResolvedConfig {
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

/** Computes the public API host for a given hotel domain. */
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
 * Normalizes a transport configuration with defaults applied.
 *
 * @param config - The transport options to resolve.
 * @param originsApiKey - The optional Origins derby key; only the public
 *   client passes one.
 */
export function resolveConfig(config: TransportConfig, originsApiKey?: string): ResolvedConfig {
  const hotel = config.hotel ?? DEFAULT_HOTEL;
  const host = publicBaseUrlForHotel(hotel);
  const publicBaseUrl = stripTrailingSlash(config.publicBaseUrl ?? host);
  const wiredBaseUrl = stripTrailingSlash(config.wiredBaseUrl ?? publicBaseUrl);

  return {
    originsApiKey,
    publicBaseUrl,
    wiredBaseUrl,
    fetch: config.fetch ?? defaultFetch(),
    timeout: config.timeout ?? DEFAULT_TIMEOUT,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
    userAgent: config.userAgent ?? `habbo-sdk/${SDK_VERSION}`,
  };
}