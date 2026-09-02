/**
 * Whole-profile operations for one room: every variable attached to a
 * single user, pet, bot, furni, wall item, or to the room itself.
 *
 * Instances are bound to a room id and its Wired keys, so none of the
 * methods repeat either. Prefer these over per-variable reads whenever you
 * need more than one variable of the same entity, since a profile call
 * returns them all in one request.
 */

import type { HttpClient } from "../http.js";
import type { ResolvedConfig } from "../config.js";
import {
  assertVariableValue,
  type FurniProfileFor,
  type FurniTargetKind,
  type GlobalProfile,
  type GlobalVariablesPatch,
  type UserProfile,
  type UserProfileFor,
  type UserTargetKind,
  type VariableValue,
  type VariablesPatch,
} from "../types/variables.js";
import {
  furniEntityId,
  WiredResource,
  type ResolvedWiredKeys,
  type RoomId,
} from "./wired-resource.js";

/** Validates every non-null value of a profile patch before sending it. */
function assertPatchValues(variables: Record<string, VariableValue | null>): void {
  for (const value of Object.values(variables)) {
    if (value !== null) {
      assertVariableValue(value);
    }
  }
}
export class RoomVariablesProfileResource extends WiredResource {
  constructor(
    http: HttpClient,
    config: ResolvedConfig,
    keys: ResolvedWiredKeys,
    private readonly roomId: RoomId,
  ) {
    super(http, config, keys);
  }

  /**
   * Reads a user's variables profile by display name or unique id.
   *
   * Use this when you know who the user is but not their numeric in-room id.
   * Exactly one of `name` or `uniqueId` must be supplied.
   *
   * @param lookup - Either `{ name }` or `{ uniqueId }`.
   * @returns The user's profile, including the resolved target.
   * @throws {@link HabboAuthError} when no `readKey` is configured.
   * @throws {@link HabboNotFoundError} when the room or user does not exist.   */
  findUser(lookup: { name: string } | { uniqueId: string }): Promise<UserProfile> {
    const query = "name" in lookup ? { name: lookup.name } : { unique_id: lookup.uniqueId };
    return this.send<UserProfile>("GET", "read", this.roomId, "/variables_profile/user/users", {
      query,
    });
  }

  /**
   * Reads the variables profile of a user, pet, or bot by its in-room id.
   *
   * The return type narrows to match the target kind, so `"pets"` yields a
   * profile carrying a `pet` field rather than a union.
   *
   * @param targetKind - `"users"`, `"pets"`, or `"bots"`.
   * @param entityId - The entity's in-room identifier.
   * @returns The entity's profile.
   * @throws {@link HabboAuthError} when no `readKey` is configured.   */
  getUser<K extends UserTargetKind>(
        targetKind: K,
    entityId: string | number,
  ): Promise<UserProfileFor<K>> {
    return this.send<UserProfileFor<K>>(
      "GET",
      "read",
      this.roomId,
      `/variables_profile/user/${targetKind}/${encodeURIComponent(String(entityId))}`,
    );
  }

  /**
   * Updates several variables of a user, pet, or bot in a single request.
   *
   * Only the variables you list are touched. Passing `null` as a value deletes
   * that stored value while leaving the variable configured in the room.
   *
   * @param targetKind - `"users"`, `"pets"`, or `"bots"`.
   * @param entityId - The entity's in-room identifier.
   * @param variables - Variable names mapped to a whole number, or to `null` to
   *   delete the value.
   * @returns The profile as it stands after the patch.
   * @throws {@link HabboAuthError} when no `writeKey` is configured.
   * @throws {@link TypeError} when a value is not a whole number.   */
  async patchUser<K extends UserTargetKind>(
        targetKind: K,
    entityId: string | number,
    variables: Record<string, VariableValue | null>,
  ): Promise<UserProfileFor<K>> {
    assertPatchValues(variables);
    const body: VariablesPatch = { variables };
    return this.send<UserProfileFor<K>>(
      "PATCH",
      "write",
      this.roomId,
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
   * @param targetKind - `"users"`, `"pets"`, or `"bots"`.
   * @param entityId - The entity's in-room identifier.
   * @throws {@link HabboAuthError} when no `writeKey` is configured.   */
  deleteUser(
        targetKind: UserTargetKind,
    entityId: string | number,
  ): Promise<void> {
    return this.send<void>(
      "DELETE",
      "write",
      this.roomId,
      `/variables_profile/user/${targetKind}/${encodeURIComponent(String(entityId))}`,
    );
  }

  /**
   * Reads the variables profile of a floor or wall item.
   *
   * @param targetKind - `"furni"`, `"furni-bc"`, `"wall-items"`, or
   *   `"wall-items-bc"`.
   * @param entityId - The item's in-room identifier.
   * @returns The item's profile.
   * @throws {@link HabboAuthError} when no `readKey` is configured.   */
  getFurni<K extends FurniTargetKind>(
        targetKind: K,
    entityId: string | number,
  ): Promise<FurniProfileFor<K>> {
    return this.send<FurniProfileFor<K>>(
      "GET",
      "read",
      this.roomId,
      `/variables_profile/furni/${targetKind}/${furniEntityId(entityId)}`,
    );
  }

  /**
   * Updates several variables of a floor or wall item in a single request.
   *
   * Passing `null` as a value deletes that stored value.
   *
   * @param targetKind - `"furni"`, `"furni-bc"`, `"wall-items"`, or
   *   `"wall-items-bc"`.
   * @param entityId - The item's in-room identifier.
   * @param variables - Variable names mapped to a whole number, or to `null`.
   * @returns The profile as it stands after the patch.
   * @throws {@link HabboAuthError} when no `writeKey` is configured.
   * @throws {@link TypeError} when a value is not a whole number.   */
  async patchFurni<K extends FurniTargetKind>(
        targetKind: K,
    entityId: string | number,
    variables: Record<string, VariableValue | null>,
  ): Promise<FurniProfileFor<K>> {
    assertPatchValues(variables);
    const body: VariablesPatch = { variables };
    return this.send<FurniProfileFor<K>>(
      "PATCH",
      "write",
      this.roomId,
      `/variables_profile/furni/${targetKind}/${furniEntityId(entityId)}`,
      { body },
    );
  }

  /**
   * Reads every global variable of the room in one request.
   *
   * @returns The room's global profile.
   * @throws {@link HabboAuthError} when no `readKey` is configured.   */
  getGlobal(): Promise<GlobalProfile> {
    return this.send<GlobalProfile>("GET", "read", this.roomId, "/variables_profile/global");
  }

  /**
   * Updates several global variables of the room in a single request.
   *
   * Unlike scoped profiles, global variables cannot be deleted this way, so
   * `null` is not accepted here.
   *
   * @param variables - Variable names mapped to their new whole-number values.
   * @returns The global profile as it stands after the patch.
   * @throws {@link HabboAuthError} when no `writeKey` is configured.
   * @throws {@link TypeError} when a value is not a whole number.   */
  async patchGlobal(variables: Record<string, VariableValue>): Promise<GlobalProfile> {
    for (const value of Object.values(variables)) {
      assertVariableValue(value);
    }
    const body: GlobalVariablesPatch = { variables };
    return this.send<GlobalProfile>("PATCH", "write", this.roomId, "/variables_profile/global", {
      body,
    });
  }
}