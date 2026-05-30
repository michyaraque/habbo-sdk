/**
 * The `variables` resource: a wrapper over the Wired Variables API.
 *
 * Every endpoint is authenticated with the configured `X-Wired-Write-Key`. The
 * key is sent on all requests, including reads, since the same key gates the
 * room. The server URL defaults to `https://www.habbo.<hotel>/server/v1`. Calls
 * made without a configured `writeKey` fail fast with {@link HabboAuthError}.
 *
 * The nested {@link VariablesProfileResource}, exposed as
 * `habbo.variables.profiles`, covers the `variables_profile` endpoints.
 */

import type { HttpClient, HttpMethod } from "../http.js";
import type { ResolvedConfig } from "../config.js";
import { HabboAuthError } from "../errors.js";
import { BatchBuilder } from "./batch-builder.js";
import type {
  BatchResult,
  BulkDeleteResult,
  SetVariableResult,
  SetVariableInput,
  TargetKind,
  VariableScope,
  VariableValue,
  VariablesProfileResult,
  VariablesProfilePatch,
  WiredVariable,
} from "../types/variables.js";

/** The write-key header name required by the Wired Variables API. */
const WRITE_KEY_HEADER = "X-Wired-Write-Key";

/**
 * Shared request plumbing for the Wired Variables resources: base URL and
 * write-key validation plus a small typed request helper.
 */
abstract class WiredResource {
  protected constructor(
    protected readonly http: HttpClient,
    protected readonly config: ResolvedConfig,
  ) {}

  /**
   * Builds an absolute Wired API URL from the configured base URL.
   */
  protected url(path: string): string {
    return `${this.config.wiredBaseUrl}${path}`;
  }

  /**
   * Returns the authentication headers, asserting that a write key is present.
   */
  protected authHeaders(): Record<string, string> {
    if (this.config.writeKey === undefined || this.config.writeKey.length === 0) {
      throw new HabboAuthError(
        `The Wired Variables API requires a write key. Configure it as \`writeKey\` so it can be sent in the ${WRITE_KEY_HEADER} header.`,
      );
    }
    return { [WRITE_KEY_HEADER]: this.config.writeKey };
  }

  protected async send<T>(
    method: HttpMethod,
    path: string,
    options: { body?: unknown; query?: Record<string, string | number | boolean | undefined> } = {},
  ): Promise<T> {
    const url = this.url(path);
    const headers = this.authHeaders();
    return this.http.request<T>({
      method,
      url,
      headers,
      ...(options.body !== undefined ? { body: options.body } : {}),
      ...(options.query !== undefined ? { query: options.query } : {}),
    });
  }
}

/**
 * Covers the `variables_profile` endpoints: reading and patching the full set
 * of variables attached to users, pets, bots, furni, and the room globally.
 */
export class VariablesProfileResource extends WiredResource {
  constructor(http: HttpClient, config: ResolvedConfig) {
    super(http, config);
  }

  private root(roomId: string): string {
    return `/rooms/${encodeURIComponent(roomId)}/variables_profile`;
  }

  /**
   * Resolves a user variables profile by display name or unique id.
   *
   * @param roomId - The room identifier.
   * @param lookup - Either `{ name }` or `{ uniqueId }` identifying the user.
   * @returns The user's {@link VariablesProfile}.
   *
   * @remarks
   * UNVERIFIED: the query parameter names (`name`, `unique_id`) and the response
   * shape are inferred ahead of the public release and may change.
   */
  getUserByLookup(
    roomId: string,
    lookup: { name: string } | { uniqueId: string },
  ): Promise<VariablesProfileResult> {
    const query = "name" in lookup ? { name: lookup.name } : { unique_id: lookup.uniqueId };
    return this.send<VariablesProfileResult>("GET", `${this.root(roomId)}/user/users`, { query });
  }

  /**
   * Reads a user, pet, or bot variables profile by target kind and entity id.
   *
   * @param roomId - The room identifier.
   * @param targetKind - The entity kind (user, pet, or bot).
   * @param entityId - The entity identifier.
   */
  getUser(roomId: string, targetKind: TargetKind, entityId: string): Promise<VariablesProfileResult> {
    return this.send<VariablesProfileResult>(
      "GET",
      `${this.root(roomId)}/user/${encodeURIComponent(targetKind)}/${encodeURIComponent(entityId)}`,
    );
  }

  /**
   * Patches a user, pet, or bot variables profile. Keys set to `null` are
   * removed; other keys are created or updated.
   *
   * @param roomId - The room identifier.
   * @param targetKind - The entity kind (user, pet, or bot).
   * @param entityId - The entity identifier.
   * @param patch - The partial update to apply.
   *
   * @remarks
   * UNVERIFIED: the patch body shape, including using `null` to remove a key, is
   * inferred ahead of the public release and may change.
   */
  patchUser(
    roomId: string,
    targetKind: TargetKind,
    entityId: string,
    patch: VariablesProfilePatch,
  ): Promise<VariablesProfileResult> {
    return this.send<VariablesProfileResult>(
      "PATCH",
      `${this.root(roomId)}/user/${encodeURIComponent(targetKind)}/${encodeURIComponent(entityId)}`,
      { body: patch },
    );
  }

  /**
   * Deletes a user, pet, or bot variables profile in its entirety.
   *
   * @param roomId - The room identifier.
   * @param targetKind - The entity kind (user, pet, or bot).
   * @param entityId - The entity identifier.
   */
  deleteUser(roomId: string, targetKind: TargetKind, entityId: string): Promise<void> {
    return this.send<void>(
      "DELETE",
      `${this.root(roomId)}/user/${encodeURIComponent(targetKind)}/${encodeURIComponent(entityId)}`,
    );
  }

  /**
   * Reads a furni variables profile.
   *
   * @param roomId - The room identifier.
   * @param targetKind - The furni target kind.
   * @param entityId - The furni entity identifier.
   */
  getFurni(roomId: string, targetKind: TargetKind, entityId: string): Promise<VariablesProfileResult> {
    return this.send<VariablesProfileResult>(
      "GET",
      `${this.root(roomId)}/furni/${encodeURIComponent(targetKind)}/${encodeURIComponent(entityId)}`,
    );
  }

  /**
   * Patches a furni variables profile.
   *
   * @param roomId - The room identifier.
   * @param targetKind - The furni target kind.
   * @param entityId - The furni entity identifier.
   * @param patch - The partial update to apply.
   *
   * @remarks
   * UNVERIFIED: the patch body shape, including using `null` to remove a key, is
   * inferred ahead of the public release and may change.
   */
  patchFurni(
    roomId: string,
    targetKind: TargetKind,
    entityId: string,
    patch: VariablesProfilePatch,
  ): Promise<VariablesProfileResult> {
    return this.send<VariablesProfileResult>(
      "PATCH",
      `${this.root(roomId)}/furni/${encodeURIComponent(targetKind)}/${encodeURIComponent(entityId)}`,
      { body: patch },
    );
  }

  /**
   * Reads the room's global variables profile.
   *
   * @param roomId - The room identifier.
   */
  getGlobal(roomId: string): Promise<VariablesProfileResult> {
    return this.send<VariablesProfileResult>("GET", `${this.root(roomId)}/global`);
  }

  /**
   * Patches the room's global variables profile.
   *
   * @param roomId - The room identifier.
   * @param patch - The partial update to apply.
   *
   * @remarks
   * UNVERIFIED: the patch body shape, including using `null` to remove a key, is
   * inferred ahead of the public release and may change.
   */
  patchGlobal(roomId: string, patch: VariablesProfilePatch): Promise<VariablesProfileResult> {
    return this.send<VariablesProfileResult>("PATCH", `${this.root(roomId)}/global`, { body: patch });
  }

  /**
   * Sets a single variable in the global variables profile.
   *
   * @param roomId - The room identifier.
   * @param variableName - The variable name.
   * @param value - The value to assign.
   *
   * @remarks
   * UNVERIFIED: the request uses `application/x-www-form-urlencoded` encoding.
   */
  setGlobalVariable(roomId: string, variableName: string, value: VariableValue): Promise<SetVariableResult> {
    return this.send<SetVariableResult>(
      "PATCH",
      `${this.root(roomId)}/global/${encodeURIComponent(variableName)}`,
      { body: { value } },
    );
  }
}

/**
 * Provides access to wired variables within a room: listing, reading, writing,
 * counting, batching, and bulk deletion. The nested {@link profiles} resource
 * exposes the variables profile endpoints.
 */
export class VariablesResource extends WiredResource {
  /**
   * Access to the `variables_profile` endpoints.
   */
  public readonly profiles: VariablesProfileResource;

  constructor(http: HttpClient, config: ResolvedConfig) {
    super(http, config);
    this.profiles = new VariablesProfileResource(http, config);
  }

  private root(roomId: string): string {
    return `/rooms/${encodeURIComponent(roomId)}/variables`;
  }

  private scopedPath(roomId: string, scope: VariableScope, variableName: string): string {
    return `${this.root(roomId)}/${encodeURIComponent(scope)}/${encodeURIComponent(variableName)}`;
  }

  /**
   * Lists every wired variable configured in a room.
   *
   * @param roomId - The room identifier.
   *
   * @example
   * ```ts
   * const variables = await habbo.variables.list("796");
   * ```
   */
  list(roomId: string): Promise<WiredVariable[]> {
    return this.send<WiredVariable[]>("GET", this.root(roomId));
  }

  /**
   * Reads a single user or furni wired variable.
   *
   * @param roomId - The room identifier.
   * @param scope - The variable scope (`user` or `furni`).
   * @param variableName - The variable name.
   * @param targetKind - The target kind the variable is attached to.
   * @param entityId - The identifier of the entity the variable is attached to.
   */
  get(
    roomId: string,
    scope: Exclude<VariableScope, "global">,
    variableName: string,
    targetKind: TargetKind,
    entityId: string,
  ): Promise<WiredVariable> {
    return this.send<WiredVariable>(
      "GET",
      `${this.scopedPath(roomId, scope, variableName)}/${encodeURIComponent(targetKind)}/${encodeURIComponent(entityId)}`,
    );
  }

  /**
   * Sets (creates or replaces) a single user or furni wired variable.
   *
   * @param roomId - The room identifier.
   * @param scope - The variable scope (`user` or `furni`).
   * @param variableName - The variable name.
   * @param targetKind - The target kind the variable is attached to.
   * @param entityId - The identifier of the entity the variable is attached to.
   * @param value - The value to assign.
   *
   * @remarks
   * UNVERIFIED: the request body wraps the value as `{ value }` and the response
   * shape is inferred ahead of the public release; both may change.
   */
  set(
    roomId: string,
    scope: Exclude<VariableScope, "global">,
    variableName: string,
    targetKind: TargetKind,
    entityId: string,
    value: VariableValue,
  ): Promise<WiredVariable> {
    const body: SetVariableInput = { value };
    return this.send<WiredVariable>(
      "PUT",
      `${this.scopedPath(roomId, scope, variableName)}/${encodeURIComponent(targetKind)}/${encodeURIComponent(entityId)}`,
      { body },
    );
  }

  /**
   * Updates an existing single user or furni wired variable.
   *
   * @param roomId - The room identifier.
   * @param scope - The variable scope (`user` or `furni`).
   * @param variableName - The variable name.
   * @param targetKind - The target kind the variable is attached to.
   * @param entityId - The identifier of the entity the variable is attached to.
   * @param value - The new value.
   *
   * @remarks
   * UNVERIFIED: the request body wraps the value as `{ value }` and the response
   * shape is inferred ahead of the public release; both may change.
   */
  update(
    roomId: string,
    scope: Exclude<VariableScope, "global">,
    variableName: string,
    targetKind: TargetKind,
    entityId: string,
    value: VariableValue,
  ): Promise<WiredVariable> {
    const body: SetVariableInput = { value };
    return this.send<WiredVariable>(
      "PATCH",
      `${this.scopedPath(roomId, scope, variableName)}/${encodeURIComponent(targetKind)}/${encodeURIComponent(entityId)}`,
      { body },
    );
  }

  /**
   * Deletes a single user or furni wired variable.
   *
   * @param roomId - The room identifier.
   * @param scope - The variable scope (`user` or `furni`).
   * @param variableName - The variable name.
   * @param targetKind - The target kind the variable is attached to.
   * @param entityId - The identifier of the entity the variable is attached to.
   */
  delete(
    roomId: string,
    scope: Exclude<VariableScope, "global">,
    variableName: string,
    targetKind: TargetKind,
    entityId: string,
  ): Promise<void> {
    return this.send<void>(
      "DELETE",
      `${this.scopedPath(roomId, scope, variableName)}/${encodeURIComponent(targetKind)}/${encodeURIComponent(entityId)}`,
    );
  }

  /**
   * Lists every value of a wired variable for a given target kind.
   *
   * @param roomId - The room identifier.
   * @param scope - The variable scope (`user` or `furni`).
   * @param variableName - The variable name.
   * @param targetKind - The target kind to enumerate.
   */
  listByKind(
    roomId: string,
    scope: Exclude<VariableScope, "global">,
    variableName: string,
    targetKind: TargetKind,
  ): Promise<WiredVariable[]> {
    return this.send<WiredVariable[]>(
      "GET",
      `${this.scopedPath(roomId, scope, variableName)}/${encodeURIComponent(targetKind)}`,
    );
  }

  /**
   * Counts the values of a wired variable for a given target kind.
   *
   * @param roomId - The room identifier.
   * @param scope - The variable scope (`user` or `furni`).
   * @param variableName - The variable name.
   * @param targetKind - The target kind to count.
   * @returns The number of stored values.
   *
   * @remarks
   * UNVERIFIED: the response is assumed to be `{ count }`, inferred ahead of the
   * public release; it may change.
   */
  async count(
    roomId: string,
    scope: Exclude<VariableScope, "global">,
    variableName: string,
    targetKind: TargetKind,
  ): Promise<number> {
    const result = await this.send<{ count: number }>(
      "GET",
      `${this.scopedPath(roomId, scope, variableName)}/${encodeURIComponent(targetKind)}/count`,
    );
    return result.count;
  }

  /**
   * Deletes multiple wired variables across the room by name.
   *
   * @param roomId - The room identifier.
   * @param names - The variable names to delete.
   *
   * @remarks
   * UNVERIFIED: the request body `{ names }` and the response shape are inferred
   * ahead of the public release; both may change.
   */
  bulkDelete(roomId: string, variables: string[]): Promise<BulkDeleteResult> {
    return this.send<BulkDeleteResult>("POST", `${this.root(roomId)}/bulk-delete`, {
      body: { variables },
    });
  }

  /**
   * Begins a batch of operations against a single wired variable.
   *
   * Returns a fluent {@link BatchBuilder}: chain `set`, `update`, and `delete`
   * calls to queue operations, then call `execute()` to send them in one
   * request.
   *
   * @param roomId - The room identifier.
   * @param scope - The variable scope (`user` or `furni`).
   * @param variableName - The variable name the operations target.
   * @returns A builder that dispatches the queued operations on `execute()`.
   *
   * @remarks
   * UNVERIFIED: the request body `{ operations }`, the per-operation shape, and
   * the response shape are inferred ahead of the public release; all may change.
   *
   * @example
   * ```ts
   * await habbo.variables
   *   .batch("796", "user", "coins")
   *   .set("user", "111", 10)
   *   .set("user", "222", 20)
   *   .delete("user", "333")
   *   .execute();
   * ```
   */
  batch(
    roomId: string,
    scope: Exclude<VariableScope, "global">,
    variableName: string,
  ): BatchBuilder {
    const path = `${this.scopedPath(roomId, scope, variableName)}/batch`;
    return new BatchBuilder((operations) =>
      this.send<BatchResult>("POST", path, { body: { requests: operations } }),
    );
  }

  /**
   * Reads a global room wired variable.
   *
   * @param roomId - The room identifier.
   * @param variableName - The variable name.
   */
  getGlobal(roomId: string, variableName: string): Promise<WiredVariable> {
    return this.send<WiredVariable>(
      "GET",
      `${this.root(roomId)}/global/${encodeURIComponent(variableName)}`,
    );
  }

  /**
   * Updates a global room wired variable.
   *
   * @param roomId - The room identifier.
   * @param variableName - The variable name.
   * @param value - The new value.
   *
   * @remarks
   * UNVERIFIED: the request body wraps the value as `{ value }` and the response
   * shape is inferred ahead of the public release; both may change.
   */
  updateGlobal(roomId: string, variableName: string, value: VariableValue): Promise<WiredVariable> {
    const body: SetVariableInput = { value };
    return this.send<WiredVariable>(
      "PATCH",
      `${this.root(roomId)}/global/${encodeURIComponent(variableName)}`,
      { body },
    );
  }
}
