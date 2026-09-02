/**
 * Shared plumbing for the room-bound Wired Variables resources.
 *
 * The Wired read/write keys are issued per room, so a resource binds the
 * room id and its keys once and then calls endpoints without repeating
 * either. This module centralizes URL building, key selection, and the
 * typed request helper those resources use.
 */

import type { HttpClient, HttpMethod } from "../http.js";
import type { ResolvedConfig } from "../config.js";
import { HabboAuthError } from "../errors.js";
import { sanitizeFurniId, type VariableScope } from "../types/variables.js";

const READ_KEY_HEADER = "X-Wired-Read-Key";
const WRITE_KEY_HEADER = "X-Wired-Write-Key";

/** Identifies a room. Numeric ids are accepted as strings for convenience. */
export type RoomId = number | string;

/**
 * The keys a room-bound resource sends. `undefined` means the operation has
 * no key and will reject when the endpoint needs one.
 */
export interface ResolvedWiredKeys {
  readonly readKey: string | undefined;
  readonly writeKey: string | undefined;
}

/**
 * Encodes an entity id for a path, sanitizing furni item ids first.
 *
 * @param scope - Whether the entity is a user-kind or a furni-kind entity.
 * @param entityId - The entity's in-room identifier.
 */
export function scopedEntityId(scope: VariableScope, entityId: string | number): string {
  const id = scope === "furni" ? sanitizeFurniId(entityId) : entityId;
  return encodeURIComponent(String(id));
}

/** Encodes a furni item id for a path, sanitizing it first. */
export function furniEntityId(entityId: string | number): string {
  return encodeURIComponent(String(sanitizeFurniId(entityId)));
}

/**
 * Base for the Wired Variables resources of one room.
 *
 * Holds the HTTP transport, the effective keys, and the room id, and offers
 * URL building plus a typed request helper that authenticates with the
 * bound keys.
 */
export abstract class WiredResource {
  protected constructor(
    protected readonly http: HttpClient,
    protected readonly config: ResolvedConfig,
    protected readonly keys: ResolvedWiredKeys,
  ) {}

  /** Builds an absolute Wired API URL for the bound room and a path. */
  protected url(roomId: RoomId, path: string): string {
    return `${this.config.wiredBaseUrl}/api/public/rooms/${encodeURIComponent(String(roomId))}${path}`;
  }

  /**
   * Builds the authentication headers for an operation.
   *
   * @param need - Which keys the operation requires. Batch requests need both.
   * @throws {@link HabboAuthError} when a required key is not available.
   */
  protected authHeaders(need: "read" | "write" | "both"): Record<string, string> {
    const headers: Record<string, string> = {};

    if (need === "read" || need === "both") {
      headers[READ_KEY_HEADER] = this.requireKey(this.keys.readKey, "readKey", READ_KEY_HEADER);
    }
    if (need === "write" || need === "both") {
      headers[WRITE_KEY_HEADER] = this.requireKey(
        this.keys.writeKey,
        "writeKey",
        WRITE_KEY_HEADER,
      );
    }
    return headers;
  }

  private requireKey(
    key: string | undefined,
    option: "readKey" | "writeKey",
    header: string,
  ): string {
    if (key === undefined || key.length === 0) {
      throw new HabboAuthError(
        `This Wired Variables operation requires a \`${option}\`. Configure it on your RoomInstance, alongside the room id. Both keys are found in the room's Wired settings inside the hotel.`,
      );
    }
    return key;
  }

  /**
   * `async` so a missing key surfaces as a rejected promise rather than a
   * synchronous throw, keeping every public method uniformly awaitable.
   */
  protected async send<T>(
    method: HttpMethod,
    need: "read" | "write" | "both",
    roomId: RoomId,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, string | number | boolean | undefined>;
    } = {},
  ): Promise<T> {
    return this.http.request<T>({
      method,
      url: this.url(roomId, path),
      headers: this.authHeaders(need),
      ...(options.body !== undefined ? { body: options.body } : {}),
      ...(options.query !== undefined ? { query: options.query } : {}),
    });
  }
}