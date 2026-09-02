/**
 * The authenticated entry point to the Wired Variables API of one room.
 *
 * Rooms are created through {@link HabboClient.room}, which binds the room
 * to the client's transport — the hotel, fetch, and timeouts live on the
 * client exactly once, and the keys are the only thing the room adds:
 *
 * ```ts
 * const habbo = new HabboClient({ hotel: "es" });
 * const room = habbo.room({
 *   roomId: 796,
 *   readKey: process.env.WIRED_READ_KEY,
 *   writeKey: process.env.WIRED_WRITE_KEY,
 * });
 *
 * const names = await room.variables.list();
 * ```
 */

import type { HttpClient } from "./http.js";
import type { ResolvedConfig } from "./config.js";
import { RoomVariablesResource } from "./resources/room-variables.js";
import type { ResolvedWiredKeys, RoomId } from "./resources/wired-resource.js";

/**
 * The room binding passed to {@link HabboClient.room}: the room id and its
 * Wired keys. The transport is the client's; a room adds nothing else.
 */
export interface RoomInstanceConfig {
  /** The room whose wired variables this instance manages. */
  roomId: RoomId;

  /**
   * The room's `X-Wired-Read-Key`, from its Wired settings. Required by
   * every read; calls that need it reject when it is missing.
   */
  readKey?: string;

  /**
   * The room's `X-Wired-Write-Key`, from its Wired settings. Required by
   * every write; calls that need it reject when it is missing.
   */
  writeKey?: string;
}

/**
 * Binds the Wired Variables API of one room: the room id and its keys,
 * sharing the transport of the {@link HabboClient} that created it.
 *
 * Create one instance per room you manage; several rooms with different
 * keys are several instances of the same client. The constructor is
 * internal: obtain instances through {@link HabboClient.room}.
 */
export class RoomInstance {
  /** The room every wired call targets. */
  public readonly roomId: RoomId;

  /**
   * Per-variable reads and writes, lists, counts, bulk deletes, batches,
   * and global variables of this room.
   */
  public readonly variables: RoomVariablesResource;

  /**
   * @param roomId - The room to bind.
   * @param keys - The room's effective Wired keys.
   * @param http - The shared HTTP transport of the owning client.
   * @param config - The shared resolved configuration of the owning client.
   */
  constructor(
    roomId: RoomId,
    keys: ResolvedWiredKeys,
    http: HttpClient,
    config: ResolvedConfig,
  ) {
    this.roomId = roomId;
    this.variables = new RoomVariablesResource(http, config, keys, roomId);
  }
}
