/**
 * The {@link HabboClient} entry point.
 */

import { type HabboClientConfig, resolveConfig } from "./config.js";
import { HttpClient } from "./http.js";
import { OriginsResource } from "./resources/origins.js";
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
 *   hotel: "es",
 *   readKey: process.env.WIRED_READ_KEY,
 *   writeKey: process.env.WIRED_WRITE_KEY,
 * });
 *
 * const user = await habbo.profiles.get("Cebolla1");
 * const names = await habbo.variables.list(796);
 * await habbo.variables.updateGlobal(796, "jackpot", 1500);
 * ```
 *
 * @example
 * A read-only client needs no write key:
 * ```ts
 * const habbo = new HabboClient({ readKey: process.env.WIRED_READ_KEY });
 * ```
 *
 * @example
 * A bare string is used as both the read and the write key:
 * ```ts
 * const habbo = new HabboClient(process.env.WIRED_KEY!);
 * ```
 */
export class HabboClient {
  /**
   * The public Habbo API resource. Requires no authentication.
   */
  public readonly profiles: ProfilesResource;

  /**
   * The Wired Variables API resource. Reads require a configured `readKey` and
   * writes a `writeKey`; both are issued from the room's Wired settings.
   */
  public readonly variables: VariablesResource;

  /**
   * The Habbo Origins resource: minigame matches, the fishing derby, and skill
   * leaderboards. Requires no authentication, though the derby endpoints accept
   * an optional `originsApiKey`.
   */
  public readonly origins: OriginsResource;

  /**
   * Creates a new client.
   *
   * @param config - Either a full {@link HabboClientConfig} object, or a bare
   *   string used as both the read and the write key.
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
    this.origins = new OriginsResource(http, resolved);
  }
}
