/**
 * The {@link HabboClient} entry point: the hotel's public API and the
 * factory of its wired rooms.
 */

import { type HabboClientConfig, resolveConfig } from "./config.js";
import { HttpClient } from "./http.js";
import { RoomInstance, type RoomInstanceConfig } from "./room-instance.js";
import { OriginsResource } from "./resources/origins.js";
import { ProfilesResource } from "./resources/profiles.js";

/**
 * Reads the public, unauthenticated Habbo API and creates the room-bound
 * Wired clients of its hotel.
 *
 * The transport — hotel, fetch, timeouts — is configured once here and
 * shared with every {@link RoomInstance} this client creates; the Wired
 * keys never live on the client, only on the rooms.
 *
 * @example
 * ```ts
 * import { HabboClient } from "habbo-sdk";
 *
 * const habbo = new HabboClient({ hotel: "es" });
 * const user = await habbo.profiles.get("Cebolla1");
 *
 * const room = habbo.room({
 *   roomId: 796,
 *   readKey: process.env.WIRED_READ_KEY,
 *   writeKey: process.env.WIRED_WRITE_KEY,
 * });
 * ```
 */
export class HabboClient {
  /**
   * The public Habbo API resource. Requires no authentication.
   */
  public readonly profiles: ProfilesResource;

  /**
   * The Habbo Origins resource: minigame matches, the fishing derby, and
   * skill leaderboards. Requires no authentication, though the derby
   * endpoints accept an optional `originsApiKey`.
   */
  public readonly origins: OriginsResource;

  private readonly http: HttpClient;
  private readonly resolved: ReturnType<typeof resolveConfig>;

  /**
   * Creates a new client.
   *
   * @param config - The hotel and transport configuration.
   */
  constructor(config: HabboClientConfig) {
    this.resolved = resolveConfig(config, config.originsApiKey);
    this.http = new HttpClient({
      fetch: this.resolved.fetch,
      timeout: this.resolved.timeout,
      maxRetries: this.resolved.maxRetries,
      userAgent: this.resolved.userAgent,
    });

    this.profiles = new ProfilesResource(this.http, this.resolved);
    this.origins = new OriginsResource(this.http, this.resolved);
  }

  /**
   * Binds the Wired Variables API of one room of this hotel.
   *
   * The room shares this client's transport; only the room id and its
   * Wired keys are supplied here:
   *
   * ```ts
   * const room = habbo.room({
   *   roomId: 796,
   *   readKey: process.env.WIRED_READ_KEY,
   *   writeKey: process.env.WIRED_WRITE_KEY,
   * });
   *
   * const coins = await room.variables.get("user", "coins", "users", 44);
   * ```
   *
   * @param config - The room id and its keys.
   * @returns A {@link RoomInstance} sharing this client's transport.
   */
  room(config: RoomInstanceConfig): RoomInstance {
    return new RoomInstance(
      config.roomId,
      { readKey: config.readKey, writeKey: config.writeKey },
      this.http,
      this.resolved,
    );
  }
}
