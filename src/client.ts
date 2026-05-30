/**
 * The {@link HabboClient} entry point.
 */

import { type HabboClientConfig, resolveConfig } from "./config.js";
import { HttpClient } from "./http.js";
import { ProfilesResource } from "./resources/profiles.js";
import { VariablesResource } from "./resources/variables.js";

/**
 * The main SDK client. It exposes two independent resource groups that map onto
 * two separate Habbo contracts:
 *
 * - {@link HabboClient.profiles} — the public, unauthenticated Habbo API for
 *   reading user, group, and room data.
 * - {@link HabboClient.variables} — the authenticated Wired Variables API for
 *   reading and writing room variables and variable profiles.
 *
 * @example
 * ```ts
 * import { HabboClient } from "habbo-sdk";
 *
 * const habbo = new HabboClient({
 *   writeKey: process.env.WIRED_WRITE_KEY,
 *   hotel: "es",
 * });
 *
 * const user = await habbo.profiles.get("Cebolla1");
 * const variables = await habbo.variables.list("796");
 * await habbo.variables.updateGlobal("796", "scoreboard", 10);
 * ```
 *
 * @example
 * Passing only a write key as a string is shorthand for `{ writeKey }`:
 * ```ts
 * const habbo = new HabboClient(process.env.WIRED_WRITE_KEY!);
 * ```
 */
export class HabboClient {
  /**
   * The public Habbo API resource. Requires no authentication.
   */
  public readonly profiles: ProfilesResource;

  /**
   * The Wired Variables API resource. Requires a configured `writeKey`; the
   * server URL defaults to `https://www.habbo.<hotel>/server/v1`.
   */
  public readonly variables: VariablesResource;

  /**
   * Creates a new client.
   *
   * @param config - Either a full {@link HabboClientConfig} object, or a bare
   *   `X-Wired-Write-Key` string as shorthand for `{ writeKey }`.
   */
  constructor(config: string | HabboClientConfig) {
    const resolved = resolveConfig(config);
    const http = new HttpClient({
      fetch: resolved.fetch,
      timeout: resolved.timeout,
      maxRetries: resolved.maxRetries,
      userAgent: resolved.userAgent,
    });

    this.profiles = new ProfilesResource(http, resolved);
    this.variables = new VariablesResource(http, resolved);
  }
}
