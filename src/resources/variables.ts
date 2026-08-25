/**
 * The `variables` resource: the Wired Variables API.
 *
 * Authentication is per operation: reads send the `readKey`, writes send the
 * `writeKey`, and a batch sends both since it may mix the two. A call missing
 * the key it needs rejects with {@link HabboAuthError} before any request.
 */

import type { HttpClient, HttpMethod } from "../http.js";
import type { ResolvedConfig } from "../config.js";
import { HabboAuthError } from "../errors.js";
import { BatchBuilder } from "./batch-builder.js";
import {
  assertVariableValue,
  sanitizeFurniId,
  type AnyFurniProfile,
  type AnyUserProfile,
  type BatchResults,
  type FurniProfileFor,
  type FurniTargetKind,
  type GlobalProfile,
  type GlobalVariablesPatch,
  type ListByKindOptions,
  type PagedVariables,
  type RoomVariables,
  type TargetKindFor,
  type UserProfile,
  type UserProfileFor,
  type UserTargetKind,
  type ValueWriteInput,
  type VariableCount,
  type VariableScope,
  type VariableValue,
  type VariablesPatch,
  type WiredVariable,
} from "../types/variables.js";

const READ_KEY_HEADER = "X-Wired-Read-Key";
const WRITE_KEY_HEADER = "X-Wired-Write-Key";

/** Identifies a room. Numeric ids are accepted as strings for convenience. */
export type RoomId = number | string;

/**
 * Encodes an entity id for a path, sanitizing furni item ids first.
 *
 * @param scope - Whether the entity is a user-kind or a furni-kind entity.
 * @param entityId - The entity's in-room identifier.
 */
function scopedEntityId(scope: VariableScope, entityId: string | number): string {
  const id = scope === "furni" ? sanitizeFurniId(entityId) : entityId;
  return encodeURIComponent(String(id));
}

/** Encodes a furni item id for a path, sanitizing it first. */
function furniEntityId(entityId: string | number): string {
  return encodeURIComponent(String(sanitizeFurniId(entityId)));
}

/**
 * Shared plumbing for the Wired Variables resources: URL building, per-operation
 * key selection, and a typed request helper.
 */
abstract class WiredResource {
  protected constructor(
    protected readonly http: HttpClient,
    protected readonly config: ResolvedConfig,
  ) {}

  /** Builds an absolute Wired API URL for a room-scoped path. */
  protected url(roomId: RoomId, path: string): string {
    return `${this.config.wiredBaseUrl}/api/public/rooms/${encodeURIComponent(String(roomId))}${path}`;
  }

  /**
   * Builds the authentication headers for an operation.
   *
   * @param need - Which keys the operation requires. Batch requests need both.
   * @throws {@link HabboAuthError} when a required key is not configured.
   */
  protected authHeaders(need: "read" | "write" | "both"): Record<string, string> {
    const headers: Record<string, string> = {};

    if (need === "read" || need === "both") {
      headers[READ_KEY_HEADER] = this.requireKey(this.config.readKey, "readKey", READ_KEY_HEADER);
    }
    if (need === "write" || need === "both") {
      headers[WRITE_KEY_HEADER] = this.requireKey(
        this.config.writeKey,
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
        `This Wired Variables operation requires a \`${option}\`. Configure it on the client so it can be sent in the ${header} header. Both keys are found in the room's Wired settings inside the hotel.`,
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

/**
 * Reads and patches whole variables profiles: every variable attached to a
 * single user, pet, bot, furni, wall item, or to the room itself.
 *
 * Prefer these methods over the single-variable ones whenever you need more
 * than one variable of the same entity, since a profile call returns them all
 * in one request.
 *
 * Access it through `habbo.variables.profiles`.
 */
export class VariablesProfileResource extends WiredResource {
  constructor(http: HttpClient, config: ResolvedConfig) {
    super(http, config);
  }

  /**
   * Reads a user's variables profile by display name or unique id.
   *
   * Use this when you know who the user is but not their numeric in-room id.
   * Exactly one of `name` or `uniqueId` must be supplied.
   *
   * @param roomId - The room the variables belong to.
   * @param lookup - Either `{ name }` or `{ uniqueId }`.
   * @returns The user's profile, including the resolved target.
   * @throws {@link HabboAuthError} when no `readKey` is configured.
   * @throws {@link HabboNotFoundError} when the room or user does not exist.
   *
   * @example
   * ```ts
   * const profile = await habbo.variables.profiles.findUser(796, {
   *   name: "Cebolla1",
   * });
   *
   * console.log(profile.user.id, profile.variables["coins"]?.value);
   * ```
   */
  findUser(roomId: RoomId, lookup: { name: string } | { uniqueId: string }): Promise<UserProfile> {
    const query = "name" in lookup ? { name: lookup.name } : { unique_id: lookup.uniqueId };
    return this.send<UserProfile>("GET", "read", roomId, "/variables_profile/user/users", {
      query,
    });
  }

  /**
   * Reads the variables profile of a user, pet, or bot by its in-room id.
   *
   * The return type narrows to match the target kind, so `"pets"` yields a
   * profile carrying a `pet` field rather than a union.
   *
   * @param roomId - The room the variables belong to.
   * @param targetKind - `"users"`, `"pets"`, or `"bots"`.
   * @param entityId - The entity's in-room identifier.
   * @returns The entity's profile.
   * @throws {@link HabboAuthError} when no `readKey` is configured.
   *
   * @example
   * ```ts
   * const pet = await habbo.variables.profiles.getUser(796, "pets", 119);
   * console.log(pet.pet.name);
   * ```
   */
  getUser<K extends UserTargetKind>(
    roomId: RoomId,
    targetKind: K,
    entityId: string | number,
  ): Promise<UserProfileFor<K>> {
    return this.send<UserProfileFor<K>>(
      "GET",
      "read",
      roomId,
      `/variables_profile/user/${targetKind}/${encodeURIComponent(String(entityId))}`,
    );
  }

  /**
   * Updates several variables of a user, pet, or bot in a single request.
   *
   * Only the variables you list are touched. Passing `null` as a value deletes
   * that stored value while leaving the variable configured in the room.
   *
   * @param roomId - The room the variables belong to.
   * @param targetKind - `"users"`, `"pets"`, or `"bots"`.
   * @param entityId - The entity's in-room identifier.
   * @param variables - Variable names mapped to a whole number, or to `null` to
   *   delete the value.
   * @returns The profile as it stands after the patch.
   * @throws {@link HabboAuthError} when no `writeKey` is configured.
   * @throws {@link TypeError} when a value is not a whole number.
   *
   * @example
   * ```ts
   * await habbo.variables.profiles.patchUser(796, "users", 44, {
   *   coins: 50,
   *   wins: 3,
   *   temporary_flag: null,
   * });
   * ```
   */
  async patchUser<K extends UserTargetKind>(
    roomId: RoomId,
    targetKind: K,
    entityId: string | number,
    variables: Record<string, VariableValue | null>,
  ): Promise<UserProfileFor<K>> {
    assertPatchValues(variables);
    const body: VariablesPatch = { variables };
    return this.send<UserProfileFor<K>>(
      "PATCH",
      "write",
      roomId,
      `/variables_profile/user/${targetKind}/${encodeURIComponent(String(entityId))}`,
      { body },
    );
  }

  /**
   * Deletes every stored variable value of a user, pet, or bot.
   *
   * The room's variable definitions are unaffected; only this entity's values
   * are removed.
   *
   * @param roomId - The room the variables belong to.
   * @param targetKind - `"users"`, `"pets"`, or `"bots"`.
   * @param entityId - The entity's in-room identifier.
   * @throws {@link HabboAuthError} when no `writeKey` is configured.
   *
   * @example
   * ```ts
   * await habbo.variables.profiles.deleteUser(796, "users", 44);
   * ```
   */
  deleteUser(
    roomId: RoomId,
    targetKind: UserTargetKind,
    entityId: string | number,
  ): Promise<void> {
    return this.send<void>(
      "DELETE",
      "write",
      roomId,
      `/variables_profile/user/${targetKind}/${encodeURIComponent(String(entityId))}`,
    );
  }

  /**
   * Reads the variables profile of a floor or wall item.
   *
   * @param roomId - The room the variables belong to.
   * @param targetKind - `"furni"`, `"furni-bc"`, `"wall-items"`, or
   *   `"wall-items-bc"`.
   * @param entityId - The item's in-room identifier.
   * @returns The item's profile.
   * @throws {@link HabboAuthError} when no `readKey` is configured.
   *
   * @example
   * ```ts
   * const chest = await habbo.variables.profiles.getFurni(796, "furni", 5521);
   * console.log(chest.furni.id, chest.variables["uses_left"]?.value);
   * ```
   */
  getFurni<K extends FurniTargetKind>(
    roomId: RoomId,
    targetKind: K,
    entityId: string | number,
  ): Promise<FurniProfileFor<K>> {
    return this.send<FurniProfileFor<K>>(
      "GET",
      "read",
      roomId,
      `/variables_profile/furni/${targetKind}/${furniEntityId(entityId)}`,
    );
  }

  /**
   * Updates several variables of a floor or wall item in a single request.
   *
   * Passing `null` as a value deletes that stored value.
   *
   * @param roomId - The room the variables belong to.
   * @param targetKind - `"furni"`, `"furni-bc"`, `"wall-items"`, or
   *   `"wall-items-bc"`.
   * @param entityId - The item's in-room identifier.
   * @param variables - Variable names mapped to a whole number, or to `null`.
   * @returns The profile as it stands after the patch.
   * @throws {@link HabboAuthError} when no `writeKey` is configured.
   * @throws {@link TypeError} when a value is not a whole number.
   *
   * @example
   * ```ts
   * await habbo.variables.profiles.patchFurni(796, "furni", 5521, {
   *   uses_left: 2,
   * });
   * ```
   */
  async patchFurni<K extends FurniTargetKind>(
    roomId: RoomId,
    targetKind: K,
    entityId: string | number,
    variables: Record<string, VariableValue | null>,
  ): Promise<FurniProfileFor<K>> {
    assertPatchValues(variables);
    const body: VariablesPatch = { variables };
    return this.send<FurniProfileFor<K>>(
      "PATCH",
      "write",
      roomId,
      `/variables_profile/furni/${targetKind}/${furniEntityId(entityId)}`,
      { body },
    );
  }

  /**
   * Reads every global variable of the room in one request.
   *
   * @param roomId - The room to read.
   * @returns The room's global profile.
   * @throws {@link HabboAuthError} when no `readKey` is configured.
   *
   * @example
   * ```ts
   * const { variables } = await habbo.variables.profiles.getGlobal(796);
   * console.log(variables["jackpot"]?.value);
   * ```
   */
  getGlobal(roomId: RoomId): Promise<GlobalProfile> {
    return this.send<GlobalProfile>("GET", "read", roomId, "/variables_profile/global");
  }

  /**
   * Updates several global variables of the room in a single request.
   *
   * Unlike scoped profiles, global variables cannot be deleted this way, so
   * `null` is not accepted here.
   *
   * @param roomId - The room to update.
   * @param variables - Variable names mapped to their new whole-number values.
   * @returns The global profile as it stands after the patch.
   * @throws {@link HabboAuthError} when no `writeKey` is configured.
   * @throws {@link TypeError} when a value is not a whole number.
   *
   * @example
   * ```ts
   * await habbo.variables.profiles.patchGlobal(796, {
   *   jackpot: 1200,
   *   round: 4,
   * });
   * ```
   */
  async patchGlobal(roomId: RoomId, variables: Record<string, VariableValue>): Promise<GlobalProfile> {
    for (const value of Object.values(variables)) {
      assertVariableValue(value);
    }
    const body: GlobalVariablesPatch = { variables };
    return this.send<GlobalProfile>("PATCH", "write", roomId, "/variables_profile/global", {
      body,
    });
  }
}

/**
 * Reads and writes individual wired variables in a room, lists and counts their
 * values, deletes them in bulk, and executes batches.
 *
 * Access it through `habbo.variables`. Whole-entity operations live on
 * {@link VariablesResource.profiles}.
 */
export class VariablesResource extends WiredResource {
  /**
   * Whole-profile operations: read or patch every variable of one entity at
   * once. See {@link VariablesProfileResource}.
   */
  public readonly profiles: VariablesProfileResource;

  constructor(http: HttpClient, config: ResolvedConfig) {
    super(http, config);
    this.profiles = new VariablesProfileResource(http, config);
  }

  private scoped(scope: VariableScope, variableName: string): string {
    return `/variables/${scope}/${encodeURIComponent(variableName)}`;
  }

  /**
   * Lists the names of every wired variable configured in a room, grouped by
   * scope.
   *
   * This returns names only. Use {@link VariablesResource.get},
   * {@link VariablesResource.listByKind}, or the profile methods to read values.
   *
   * @param roomId - The room to inspect.
   * @returns The configured variable names, grouped into `users`, `furni`, and
   *   `global`.
   * @throws {@link HabboAuthError} when no `readKey` is configured.
   *
   * @example
   * ```ts
   * const names = await habbo.variables.list(796);
   * console.log(names.global); // ["jackpot", "round"]
   * ```
   */
  list(roomId: RoomId): Promise<RoomVariables> {
    return this.send<RoomVariables>("GET", "read", roomId, "/variables");
  }

  /**
   * Reads one variable of one entity.
   *
   * @param roomId - The room the variable belongs to.
   * @param scope - `"user"` or `"furni"`. It constrains which target kinds the
   *   next argument accepts.
   * @param variableName - The configured variable name.
   * @param targetKind - The entity kind, valid for the chosen scope.
   * @param entityId - The entity's in-room identifier.
   * @returns The stored value with its creation and update timestamps.
   * @throws {@link HabboAuthError} when no `readKey` is configured.
   * @throws {@link HabboNotFoundError} when the variable has no stored value
   *   for that entity.
   *
   * @example
   * ```ts
   * const coins = await habbo.variables.get(796, "user", "coins", "users", 44);
   * console.log(coins.value, coins.update_time);
   * ```
   */
  get<S extends VariableScope>(
    roomId: RoomId,
    scope: S,
    variableName: string,
    targetKind: TargetKindFor<S>,
    entityId: string | number,
  ): Promise<WiredVariable> {
    return this.send<WiredVariable>(
      "GET",
      "read",
      roomId,
      `${this.scoped(scope, variableName)}/${targetKind}/${scopedEntityId(scope, entityId)}`,
    );
  }

  /**
   * Creates or replaces one variable value of one entity.
   *
   * Use {@link VariablesResource.update} instead when the value is expected to
   * already exist.
   *
   * @param roomId - The room the variable belongs to.
   * @param scope - `"user"` or `"furni"`.
   * @param variableName - The configured variable name.
   * @param targetKind - The entity kind, valid for the chosen scope.
   * @param entityId - The entity's in-room identifier.
   * @param value - The whole number to store.
   * @returns The stored value with its timestamps.
   * @throws {@link HabboAuthError} when no `writeKey` is configured.
   * @throws {@link TypeError} when the value is not a whole number.
   *
   * @example
   * ```ts
   * await habbo.variables.set(796, "user", "coins", "users", 44, 100);
   * ```
   */
  async set<S extends VariableScope>(
    roomId: RoomId,
    scope: S,
    variableName: string,
    targetKind: TargetKindFor<S>,
    entityId: string | number,
    value: VariableValue,
  ): Promise<WiredVariable> {
    assertVariableValue(value);
    const body: ValueWriteInput = { value };
    return this.send<WiredVariable>(
      "PUT",
      "write",
      roomId,
      `${this.scoped(scope, variableName)}/${targetKind}/${scopedEntityId(scope, entityId)}`,
      { body },
    );
  }

  /**
   * Updates one existing variable value of one entity.
   *
   * @param roomId - The room the variable belongs to.
   * @param scope - `"user"` or `"furni"`.
   * @param variableName - The configured variable name.
   * @param targetKind - The entity kind, valid for the chosen scope.
   * @param entityId - The entity's in-room identifier.
   * @param value - The new whole number.
   * @returns The stored value with its timestamps.
   * @throws {@link HabboAuthError} when no `writeKey` is configured.
   * @throws {@link TypeError} when the value is not a whole number.
   *
   * @example
   * ```ts
   * await habbo.variables.update(796, "user", "coins", "users", 44, 120);
   * ```
   */
  async update<S extends VariableScope>(
    roomId: RoomId,
    scope: S,
    variableName: string,
    targetKind: TargetKindFor<S>,
    entityId: string | number,
    value: VariableValue,
  ): Promise<WiredVariable> {
    assertVariableValue(value);
    const body: ValueWriteInput = { value };
    return this.send<WiredVariable>(
      "PATCH",
      "write",
      roomId,
      `${this.scoped(scope, variableName)}/${targetKind}/${scopedEntityId(scope, entityId)}`,
      { body },
    );
  }

  /**
   * Deletes one stored variable value of one entity.
   *
   * The variable stays configured in the room; only this entity's value is
   * removed.
   *
   * @param roomId - The room the variable belongs to.
   * @param scope - `"user"` or `"furni"`.
   * @param variableName - The configured variable name.
   * @param targetKind - The entity kind, valid for the chosen scope.
   * @param entityId - The entity's in-room identifier.
   * @throws {@link HabboAuthError} when no `writeKey` is configured.
   *
   * @example
   * ```ts
   * await habbo.variables.delete(796, "user", "coins", "users", 44);
   * ```
   */
  delete<S extends VariableScope>(
    roomId: RoomId,
    scope: S,
    variableName: string,
    targetKind: TargetKindFor<S>,
    entityId: string | number,
  ): Promise<void> {
    return this.send<void>(
      "DELETE",
      "write",
      roomId,
      `${this.scoped(scope, variableName)}/${targetKind}/${scopedEntityId(scope, entityId)}`,
    );
  }

  /**
   * Lists one page of stored values of a variable across every entity of a
   * target kind. This is what you want for a leaderboard.
   *
   * @param roomId - The room the variable belongs to.
   * @param scope - `"user"` or `"furni"`.
   * @param variableName - The configured variable name.
   * @param targetKind - The entity kind to enumerate.
   * @param options - Sorting and pagination. See {@link ListByKindOptions}.
   * @returns One page of values, each with the entity it belongs to.
   * @throws {@link HabboAuthError} when no `readKey` is configured.
   *
   * @example
   * Top ten scores, highest first:
   * ```ts
   * const top = await habbo.variables.listByKind(796, "user", "score", "users", {
   *   orderBy: "value",
   *   orderDir: "desc",
   *   size: 10,
   * });
   *
   * for (const entry of top.items) {
   *   console.log(entry.name, entry.value);
   * }
   * ```
   */
  listByKind<S extends VariableScope>(
    roomId: RoomId,
    scope: S,
    variableName: string,
    targetKind: TargetKindFor<S>,
    options: ListByKindOptions = {},
  ): Promise<PagedVariables> {
    return this.send<PagedVariables>(
      "GET",
      "read",
      roomId,
      `${this.scoped(scope, variableName)}/${targetKind}`,
      {
        query: {
          order_by: options.orderBy,
          order_dir: options.orderDir,
          page: options.page,
          size: options.size,
        },
      },
    );
  }

  /**
   * Iterates every stored value of a variable across a target kind, fetching
   * one page at a time.
   *
   * Use this instead of {@link VariablesResource.listByKind} when you need all
   * values rather than a single page, and you would rather not manage the page
   * counter yourself. Iteration stops as soon as the server returns a short or
   * empty page.
   *
   * @param roomId - The room the variable belongs to.
   * @param scope - `"user"` or `"furni"`.
   * @param variableName - The configured variable name.
   * @param targetKind - The entity kind to enumerate.
   * @param options - Sorting, plus the `size` used as the page size and the
   *   `page` used as the starting page.
   * @yields Each stored value, in server order.
   * @throws {@link HabboAuthError} when no `readKey` is configured.
   *
   * @example
   * ```ts
   * for await (const entry of habbo.variables.iterateByKind(
   *   796, "user", "score", "users", { orderBy: "value", orderDir: "desc" },
   * )) {
   *   console.log(entry.name, entry.value);
   * }
   * ```
   */
  async *iterateByKind<S extends VariableScope>(
    roomId: RoomId,
    scope: S,
    variableName: string,
    targetKind: TargetKindFor<S>,
    options: ListByKindOptions = {},
  ): AsyncGenerator<PagedVariables["items"][number], void, undefined> {
    const size = options.size ?? 100;
    let page = options.page ?? 0;

    for (;;) {
      const result = await this.listByKind(roomId, scope, variableName, targetKind, {
        ...options,
        page,
        size,
      });

      for (const item of result.items) {
        yield item;
      }

      if (result.items.length < size) {
        return;
      }
      page += 1;
    }
  }

  /**
   * Counts how many entities of a target kind have a stored value for a
   * variable.
   *
   * @param roomId - The room the variable belongs to.
   * @param scope - `"user"` or `"furni"`.
   * @param variableName - The configured variable name.
   * @param targetKind - The entity kind to count.
   * @returns The number of stored values.
   * @throws {@link HabboAuthError} when no `readKey` is configured.
   *
   * @example
   * ```ts
   * const players = await habbo.variables.count(796, "user", "score", "users");
   * ```
   */
  async count<S extends VariableScope>(
    roomId: RoomId,
    scope: S,
    variableName: string,
    targetKind: TargetKindFor<S>,
  ): Promise<number> {
    const result = await this.send<VariableCount>(
      "GET",
      "read",
      roomId,
      `${this.scoped(scope, variableName)}/${targetKind}/count`,
    );
    return result.count;
  }

  /**
   * Deletes every stored value of the named variables, across all entities in
   * the room.
   *
   * The variable definitions stay configured; only their stored values are
   * cleared. This is the fastest way to reset a game between rounds.
   *
   * @param roomId - The room to clear.
   * @param variables - Names of the user or furni variables to clear.
   * @throws {@link HabboAuthError} when no `writeKey` is configured.
   *
   * @example
   * ```ts
   * await habbo.variables.bulkDelete(796, ["score", "lives"]);
   * ```
   */
  bulkDelete(roomId: RoomId, variables: string[]): Promise<void> {
    return this.send<void>("POST", "write", roomId, "/variables/bulk-delete", {
      body: { variables },
    });
  }

  /**
   * Starts a batch of operations against one variable, to be sent as a single
   * request.
   *
   * Every operation in the batch targets the same variable but a different
   * entity, and a batch may mix reads and writes freely. It therefore requires
   * both a `readKey` and a `writeKey`. Up to 50 operations are allowed.
   *
   * Chain the builder methods to queue operations, then `execute()` to send
   * them. The response reports one result per operation, in order.
   *
   * @param roomId - The room the variable belongs to.
   * @param scope - `"user"` or `"furni"`.
   * @param variableName - The variable every operation acts on.
   * @returns A {@link BatchBuilder} that sends the queued operations.
   *
   * @example
   * Award several players at once, and clear one:
   * ```ts
   * const { results } = await habbo.variables
   *   .batch(796, "user", "score")
   *   .patch("users/44", 10)
   *   .patch("users/45", 7)
   *   .delete("users/46")
   *   .get("users/47")
   *   .execute();
   *
   * for (const result of results) {
   *   if (!isBatchOperationSuccess(result)) {
   *     console.error(result.error.code);
   *   }
   * }
   * ```
   *
   * @example
   * Correlate results with your own ids by passing `opId`:
   * ```ts
   * const { results } = await habbo.variables
   *   .batch(796, "user", "score")
   *   .patch("users/44", 10, { opId: "winner" })
   *   .execute();
   *
   * const winner = results.find((r) => r.op_id === "winner");
   * ```
   */
  batch<S extends VariableScope>(
    roomId: RoomId,
    scope: S,
    variableName: string,
  ): BatchBuilder {
    const path = `${this.scoped(scope, variableName)}/batch`;
    return new BatchBuilder((requests) =>
      this.send<BatchResults>("POST", "both", roomId, path, { body: { requests } }),
    );
  }

  /**
   * Reads a room-wide global variable.
   *
   * @param roomId - The room the variable belongs to.
   * @param variableName - The configured variable name.
   * @returns The stored value with its timestamps.
   * @throws {@link HabboAuthError} when no `readKey` is configured.
   *
   * @example
   * ```ts
   * const jackpot = await habbo.variables.getGlobal(796, "jackpot");
   * ```
   */
  getGlobal(roomId: RoomId, variableName: string): Promise<WiredVariable> {
    return this.send<WiredVariable>(
      "GET",
      "read",
      roomId,
      `/variables/global/${encodeURIComponent(variableName)}`,
    );
  }

  /**
   * Updates a room-wide global variable.
   *
   * @param roomId - The room the variable belongs to.
   * @param variableName - The configured variable name.
   * @param value - The new whole number.
   * @returns The stored value with its timestamps.
   * @throws {@link HabboAuthError} when no `writeKey` is configured.
   * @throws {@link TypeError} when the value is not a whole number.
   *
   * @example
   * ```ts
   * await habbo.variables.updateGlobal(796, "jackpot", 1500);
   * ```
   */
  async updateGlobal(
    roomId: RoomId,
    variableName: string,
    value: VariableValue,
  ): Promise<WiredVariable> {
    assertVariableValue(value);
    const body: ValueWriteInput = { value };
    return this.send<WiredVariable>(
      "PATCH",
      "write",
      roomId,
      `/variables/global/${encodeURIComponent(variableName)}`,
      { body },
    );
  }
}

/** Validates every non-null value of a profile patch before sending it. */
function assertPatchValues(variables: Record<string, VariableValue | null>): void {
  for (const value of Object.values(variables)) {
    if (value !== null) {
      assertVariableValue(value);
    }
  }
}

export type { AnyFurniProfile, AnyUserProfile };
