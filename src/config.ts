/**
 * Client configuration and its resolution logic.
 *
 * The SDK speaks to two distinct contracts that have different hosts and
 * authentication models:
 *
 * 1. The **public Habbo API** (`profiles`), reachable per hotel domain
 *    (`https://www.habbo.<hotel>`), which requires no authentication.
 * 2. The **Wired Variables API** (`variables`), reachable at a separate base URL
 *    and authenticated with an `X-Wired-Write-Key` header.
 *
 * {@link resolveConfig} normalizes the two accepted constructor shapes into a
 * single internal {@link ResolvedConfig}.
 */

import { type FetchLike, defaultFetch } from "./http.js";

/**
 * Hotel domain suffixes supported by the public Habbo API.
 *
 * The value is appended to `www.habbo.` to form the API host. The special value
 * `sandbox` targets `sandbox.habbo.com`.
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
  | "sandbox";

/**
 * Full configuration object accepted by the {@link HabboClient} constructor.
 */
export interface HabboClientConfig {
  /**
   * The `X-Wired-Write-Key` used to authenticate Wired Variables requests.
   *
   * Optional: omit it if you only intend to use the public `profiles` API. Any
   * `variables` call made without a configured key will throw
   * {@link HabboAuthError}.
   */
  writeKey?: string;

  /**
   * The hotel domain used by the public `profiles` API.
   *
   * @defaultValue `"es"`
   */
  hotel?: Hotel;

  /**
   * Overrides the base URL of the Wired Variables server, without a trailing
   * slash, up to and including the API version segment.
   *
   * By default this is derived from {@link HabboClientConfig.hotel} as
   * `https://www.habbo.<hotel>/server/v1`, since the Wired server is hosted on
   * the same domain as the public API. Set this only to target a different host
   * or version segment (for example a proxy or a test server).
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
  readonly writeKey: string | undefined;
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

/** The version segment appended to the host to form the Wired server base URL. */
const WIRED_PATH = "/server/v1";

/**
 * Computes the public API host for a given hotel domain.
 */
function publicBaseUrlForHotel(hotel: Hotel): string {
  if (hotel === "sandbox") {
    return "https://sandbox.habbo.com";
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
 * @param input - Either a bare `X-Wired-Write-Key` string, or a full
 *   {@link HabboClientConfig} object.
 * @returns The resolved configuration with all defaults applied.
 */
export function resolveConfig(input: string | HabboClientConfig): ResolvedConfig {
  const config: HabboClientConfig = typeof input === "string" ? { writeKey: input } : input;

  const hotel = config.hotel ?? DEFAULT_HOTEL;
  const host = publicBaseUrlForHotel(hotel);
  const publicBaseUrl = stripTrailingSlash(config.publicBaseUrl ?? host);
  const wiredBaseUrl = stripTrailingSlash(config.wiredBaseUrl ?? `${host}${WIRED_PATH}`);

  return {
    writeKey: config.writeKey,
    publicBaseUrl,
    wiredBaseUrl,
    fetch: config.fetch ?? defaultFetch(),
    timeout: config.timeout ?? DEFAULT_TIMEOUT,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
    userAgent: config.userAgent ?? `habbo-sdk/${SDK_VERSION}`,
  };
}
