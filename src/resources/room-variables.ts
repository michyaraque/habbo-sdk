/**
 * The wired variables of one room: per-variable reads and writes, lists,
 * counts, bulk deletes, and batches.
 *
 * Instances are bound to a room id and its Wired keys, so none of the
 * methods repeat either. Obtain one from a room-bound wired client.
 */

import type { HttpClient } from "../http.js";
import type { ResolvedConfig } from "../config.js";
import { BatchBuilder } from "./batch-builder.js";
import { RoomVariablesProfileResource } from "./room-profile-variables.js";
import {
  assertVariableValue,
  type BatchResults,
  type ListByKindOptions,
  type PagedVariables,
  type RoomVariables,
  type TargetKindFor,
  type ValueWriteInput,
  type VariableCount,
  type VariableScope,
  type VariableValue,
  type WiredVariable,
} from "../types/variables.js";
import {
  scopedEntityId,
  WiredResource,
  type ResolvedWiredKeys,
  type RoomId,
} from "./wired-resource.js";
/**
 * Reads and writes individual wired variables in a room, lists and counts their
 * values, deletes them in bulk, and executes batches.
 *
 * Used through a room-bound wired client. Whole-entity operations live on
 * {@link RoomVariablesResource.profiles}.
 */
export class RoomVariablesResource extends WiredResource {
  /**
   * Whole-profile operations: read or patch every variable of one entity at
   * once. See {@link RoomVariablesProfileResource}.
   */
  public readonly profiles: RoomVariablesProfileResource;

  constructor(
    http: HttpClient,
    config: ResolvedConfig,
    keys: ResolvedWiredKeys,
    private readonly roomId: RoomId,
  ) {
    super(http, config, keys);
    this.profiles = new RoomVariablesProfileResource(http, config, keys, roomId);
  }

  private scoped(scope: VariableScope, variableName: string): string {
    return `/variables/${scope}/${encodeURIComponent(variableName)}`;
  }

  /**
   * Lists the names of every wired variable configured in a room, grouped by
   * scope.
   *
   * This returns names only. Use {@link RoomVariablesResource.get},
   * {@link RoomVariablesResource.listByKind}, or the profile methods to read values.
   *
   * @returns The configured variable names, grouped into `users`, `furni`, and
   *   `global`.
   * @throws {@link HabboAuthError} when no `readKey` is configured.   */
  list(): Promise<RoomVariables> {
    return this.send<RoomVariables>("GET", "read", this.roomId, "/variables");
  }

  /**
   * Reads one variable of one entity.
   *
   * @param scope - `"user"` or `"furni"`. It constrains which target kinds the
   *   next argument accepts.
   * @param variableName - The configured variable name.
   * @param targetKind - The entity kind, valid for the chosen scope.
   * @param entityId - The entity's in-room identifier.
   * @returns The stored value with its creation and update timestamps.
   * @throws {@link HabboAuthError} when no `readKey` is configured.
   * @throws {@link HabboNotFoundError} when the variable has no stored value
   *   for that entity.   */
  get<S extends VariableScope>(
        scope: S,
    variableName: string,
    targetKind: TargetKindFor<S>,
    entityId: string | number,
  ): Promise<WiredVariable> {
    return this.send<WiredVariable>(
      "GET",
      "read",
      this.roomId,
      `${this.scoped(scope, variableName)}/${targetKind}/${scopedEntityId(scope, entityId)}`,
    );
  }

  /**
   * Creates or replaces one variable value of one entity.
   *
   * Use {@link RoomVariablesResource.update} instead when the value is expected to
   * already exist.
   *
   * @param scope - `"user"` or `"furni"`.
   * @param variableName - The configured variable name.
   * @param targetKind - The entity kind, valid for the chosen scope.
   * @param entityId - The entity's in-room identifier.
   * @param value - The whole number to store.
   * @returns The stored value with its timestamps.
   * @throws {@link HabboAuthError} when no `writeKey` is configured.
   * @throws {@link TypeError} when the value is not a whole number.   */
  async set<S extends VariableScope>(
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
      this.roomId,
      `${this.scoped(scope, variableName)}/${targetKind}/${scopedEntityId(scope, entityId)}`,
      { body },
    );
  }

  /**
   * Updates one existing variable value of one entity.
   *
   * @param scope - `"user"` or `"furni"`.
   * @param variableName - The configured variable name.
   * @param targetKind - The entity kind, valid for the chosen scope.
   * @param entityId - The entity's in-room identifier.
   * @param value - The new whole number.
   * @returns The stored value with its timestamps.
   * @throws {@link HabboAuthError} when no `writeKey` is configured.
   * @throws {@link TypeError} when the value is not a whole number.   */
  async update<S extends VariableScope>(
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
      this.roomId,
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
   * @param scope - `"user"` or `"furni"`.
   * @param variableName - The configured variable name.
   * @param targetKind - The entity kind, valid for the chosen scope.
   * @param entityId - The entity's in-room identifier.
   * @throws {@link HabboAuthError} when no `writeKey` is configured.   */
  delete<S extends VariableScope>(
        scope: S,
    variableName: string,
    targetKind: TargetKindFor<S>,
    entityId: string | number,
  ): Promise<void> {
    return this.send<void>(
      "DELETE",
      "write",
      this.roomId,
      `${this.scoped(scope, variableName)}/${targetKind}/${scopedEntityId(scope, entityId)}`,
    );
  }

  /**
   * Lists one page of stored values of a variable across every entity of a
   * target kind. This is what you want for a leaderboard.
   *
   * @param scope - `"user"` or `"furni"`.
   * @param variableName - The configured variable name.
   * @param targetKind - The entity kind to enumerate.
   * @param options - Sorting and pagination. See {@link ListByKindOptions}.
   * @returns One page of values, each with the entity it belongs to.
   * @throws {@link HabboAuthError} when no `readKey` is configured.   */
  listByKind<S extends VariableScope>(
        scope: S,
    variableName: string,
    targetKind: TargetKindFor<S>,
    options: ListByKindOptions = {},
  ): Promise<PagedVariables> {
    return this.send<PagedVariables>(
      "GET",
      "read",
      this.roomId,
      `${this.scoped(scope, variableName)}/${targetKind}`,
      {
        query: {
          order_by: options.orderBy,
          order_dir: options.orderDir,
          page: normalizePage(options.page),
          size: normalizePageSize(options.size),
        },
      },
    );
  }

  /**
   * Iterates every stored value of a variable across a target kind, fetching
   * one page at a time.
   *
   * Use this instead of {@link RoomVariablesResource.listByKind} when you need all
   * values rather than a single page, and you would rather not manage the page
   * counter yourself. Iteration stops as soon as the server returns a short or
   * empty page.
   *
   * @param scope - `"user"` or `"furni"`.
   * @param variableName - The configured variable name.
   * @param targetKind - The entity kind to enumerate.
   * @param options - Sorting, plus the `size` used as the page size and the
   *   `page` used as the starting page.
   * @yields Each stored value, in server order.
   * @throws {@link HabboAuthError} when no `readKey` is configured.   */
  async *iterateByKind<S extends VariableScope>(
        scope: S,
    variableName: string,
    targetKind: TargetKindFor<S>,
    options: ListByKindOptions = {},
  ): AsyncGenerator<PagedVariables["items"][number], void, undefined> {
    const size = normalizePageSize(options.size) ?? 100;
    let page = normalizePage(options.page) ?? 1;

    for (;;) {
      const result = await this.listByKind(scope, variableName, targetKind, {
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
   * @param scope - `"user"` or `"furni"`.
   * @param variableName - The configured variable name.
   * @param targetKind - The entity kind to count.
   * @returns The number of stored values.
   * @throws {@link HabboAuthError} when no `readKey` is configured.   */
  async count<S extends VariableScope>(
        scope: S,
    variableName: string,
    targetKind: TargetKindFor<S>,
  ): Promise<number> {
    const result = await this.send<VariableCount>(
      "GET",
      "read",
      this.roomId,
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
   * @param variables - Names of the user or furni variables to clear.
   * @throws {@link HabboAuthError} when no `writeKey` is configured.   */
  bulkDelete(variables: string[]): Promise<void> {
    return this.send<void>("POST", "write", this.roomId, "/variables/bulk-delete", {
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
   * @param scope - `"user"` or `"furni"`.
   * @param variableName - The variable every operation acts on.
   * @returns A {@link BatchBuilder} that sends the queued operations.   *   */
  batch<S extends VariableScope>(
        scope: S,
    variableName: string,
  ): BatchBuilder {
    const path = `${this.scoped(scope, variableName)}/batch`;
    return new BatchBuilder((requests) =>
      this.send<BatchResults>("POST", "both", this.roomId, path, { body: { requests } }),
    );
  }

  /**
   * Reads a room-wide global variable.
   *
   * @param variableName - The configured variable name.
   * @returns The stored value with its timestamps.
   * @throws {@link HabboAuthError} when no `readKey` is configured.   */
  getGlobal(variableName: string): Promise<WiredVariable> {
    return this.send<WiredVariable>(
      "GET",
      "read",
      this.roomId,
      `/variables/global/${encodeURIComponent(variableName)}`,
    );
  }

  /**
   * Updates a room-wide global variable.
   *
   * @param variableName - The configured variable name.
   * @param value - The new whole number.
   * @returns The stored value with its timestamps.
   * @throws {@link HabboAuthError} when no `writeKey` is configured.
   * @throws {@link TypeError} when the value is not a whole number.   */
  async updateGlobal(
        variableName: string,
    value: VariableValue,
  ): Promise<WiredVariable> {
    assertVariableValue(value);
    const body: ValueWriteInput = { value };
    return this.send<WiredVariable>(
      "PATCH",
      "write",
      this.roomId,
      `/variables/global/${encodeURIComponent(variableName)}`,
      { body },
    );
  }
}

const MAX_LIST_PAGE_SIZE = 100;

function normalizePageSize(size: number | undefined): number | undefined {
  if (size === undefined || !Number.isFinite(size) || size <= 0) {
    return undefined;
  }
  return Math.min(MAX_LIST_PAGE_SIZE, Math.floor(size));
}

function normalizePage(page: number | undefined): number | undefined {
  if (page === undefined || !Number.isFinite(page)) {
    return undefined;
  }
  return Math.max(1, Math.floor(page));
}