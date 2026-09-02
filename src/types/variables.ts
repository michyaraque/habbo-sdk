/**
 * Type definitions for the Wired Variables API (`variables` resource).
 */

/**
 * The scope a wired variable is bound to.
 *
 * - `user` variables are attached to a user, a pet, or a bot.
 * - `furni` variables are attached to a floor item or a wall item.
 * - Global variables are room-wide and use their own dedicated routes, so they
 *   are not part of this union.
 */
export type VariableScope = "user" | "furni";

/**
 * Target kinds valid when {@link VariableScope} is `user`.
 */
export type UserTargetKind = "users" | "pets" | "bots";

/**
 * Target kinds valid when {@link VariableScope} is `furni`.
 */
export type FurniTargetKind = "furni" | "furni-bc" | "wall-items" | "wall-items-bc";

/**
 * Any target kind accepted by the scoped variable routes.
 */
export type TargetKind = UserTargetKind | FurniTargetKind;

/**
 * Maps a scope onto the target kinds the API accepts for it, so an invalid
 * scope/kind pairing such as `("user", "wall-items")` fails to compile.
 */
export type TargetKindFor<S extends VariableScope> = S extends "user"
  ? UserTargetKind
  : FurniTargetKind;

/**
 * The value type a wired variable can hold.
 *
 * The API stores wired variables as signed 64-bit whole numbers only; strings
 * and booleans are rejected. Within the safe integer range the value is a
 * plain `number`; beyond it the SDK uses `bigint`, which carries every
 * value the API accepts. Values are validated by {@link assertVariableValue}
 * before any write leaves the SDK.
 */
export type VariableValue = number | bigint;

/**
 * A stored wired variable value together with its timestamps.
 */
export interface WiredVariable {
  /** The current value: a `number` up to 2^53, a `bigint` beyond it. */
  value: VariableValue;
  /** ISO 8601 timestamp of when the value was first stored. */
  creation_time: string;
  /** ISO 8601 timestamp of the most recent update. */
  update_time: string;
}

/**
 * The variable names configured in a room, grouped by scope.
 *
 * Returned by {@link VariablesResource.list}. These are names only: use the
 * scoped read methods to fetch values.
 */
export interface RoomVariables {
  /** Names of the user-scoped variables. */
  users: string[];
  /** Names of the furni-scoped variables. */
  furni: string[];
  /** Names of the room-wide global variables. */
  global: string[];
}

/**
 * A single entry of a paged variable listing: the stored value plus the entity
 * it belongs to.
 */
export interface PagedVariableItem extends WiredVariable {
  /** Identifier of the entity holding this value, when reported. */
  id?: number;
  /** Display name of the entity, for target kinds that have one. */
  name?: string;
  /** Unique identifier of the entity, for user targets. */
  unique_id?: string;
  /** Any additional fields the server may add for a given target kind. */
  [key: string]: unknown;
}

/**
 * One page of variable values for a target kind, as returned by
 * {@link VariablesResource.listByKind}.
 */
export interface PagedVariables {
  /** The values on this page. */
  items: PagedVariableItem[];
  /** The zero-based page index this result represents. */
  page: number;
  /** The page size used to produce this result. */
  size: number;
}

/**
 * Query options accepted by {@link VariablesResource.listByKind}.
 */
export interface ListByKindOptions {
  /**
   * The field to sort by.
   *
   * @defaultValue the server's own ordering
   */
  orderBy?: "value" | "creation_time" | "update_time";
  /**
   * The sort direction.
   *
   * @defaultValue the server's own direction
   */
  orderDir?: "asc" | "desc";
  /** Zero-based page index. */
  page?: number;
  /** Number of items per page. */
  size?: number;
}

/**
 * Request body used to write a single variable value.
 */
export interface ValueWriteInput {
  /** The whole number to store. */
  value: VariableValue;
}

/**
 * A map of variable names to their stored values, as held by a variables
 * profile.
 */
export type VariableMap = Record<string, WiredVariable>;

/**
 * A floor or wall item a variables profile belongs to. Items are identified by
 * id alone.
 */
export interface ItemProfileTarget {
  /** Numeric identifier of the item. */
  id: number;
}

/**
 * A pet or bot a variables profile belongs to.
 */
export interface NamedProfileTarget extends ItemProfileTarget {
  /** Display name of the pet or bot. */
  name?: string;
}

/**
 * The user a variables profile belongs to.
 */
export interface UserProfileTarget extends NamedProfileTarget {
  /** The user's Habbo unique id. */
  unique_id?: string;
}

/**
 * Any entity a variables profile can belong to.
 *
 * Which fields are present depends on the target: users carry `name` and
 * `unique_id`, pets and bots carry `name`, and items carry only `id`.
 */
export type ProfileTarget = UserProfileTarget;

/**
 * The variables profile of a user.
 */
export interface UserProfile {
  /** The user the profile belongs to. */
  user: UserProfileTarget;
  /** The user's variables, keyed by name. */
  variables: VariableMap;
}

/**
 * The variables profile of a pet.
 */
export interface PetProfile {
  /** The pet the profile belongs to. */
  pet: NamedProfileTarget;
  /** The pet's variables, keyed by name. */
  variables: VariableMap;
}

/**
 * The variables profile of a bot.
 */
export interface BotProfile {
  /** The bot the profile belongs to. */
  bot: NamedProfileTarget;
  /** The bot's variables, keyed by name. */
  variables: VariableMap;
}

/**
 * The variables profile of a floor item.
 */
export interface FurniProfile {
  /** The furni the profile belongs to. */
  furni: ItemProfileTarget;
  /** The furni's variables, keyed by name. */
  variables: VariableMap;
}

/**
 * The variables profile of a builders-club floor item.
 */
export interface FurniBcProfile {
  /** The builders-club furni the profile belongs to. */
  furni_bc: ItemProfileTarget;
  /** The furni's variables, keyed by name. */
  variables: VariableMap;
}

/**
 * The variables profile of a wall item.
 */
export interface WallItemProfile {
  /** The wall item the profile belongs to. */
  wall_item: ItemProfileTarget;
  /** The wall item's variables, keyed by name. */
  variables: VariableMap;
}

/**
 * The variables profile of a builders-club wall item.
 */
export interface WallItemBcProfile {
  /** The builders-club wall item the profile belongs to. */
  wall_item_bc: ItemProfileTarget;
  /** The wall item's variables, keyed by name. */
  variables: VariableMap;
}

/**
 * The room-wide variables profile, which has no owning entity.
 */
export interface GlobalProfile {
  /** The room's global variables, keyed by name. */
  variables: VariableMap;
}

/**
 * Any profile returned by the user-scoped profile routes.
 *
 * Narrow it by checking which owner key is present:
 *
 * ```ts
 * if ("pet" in profile) {
 *   console.log(profile.pet.name);
 * }
 * ```
 */
export type AnyUserProfile = UserProfile | PetProfile | BotProfile;

/**
 * Any profile returned by the furni-scoped profile routes.
 */
export type AnyFurniProfile =
  | FurniProfile
  | FurniBcProfile
  | WallItemProfile
  | WallItemBcProfile;

/**
 * Any variables profile the API can return.
 */
export type VariablesProfile = AnyUserProfile | AnyFurniProfile | GlobalProfile;

/**
 * Maps a user target kind onto the exact profile type that route returns, so
 * `get("users", …)` narrows to {@link UserProfile} without a manual cast.
 */
export type UserProfileFor<K extends UserTargetKind> = K extends "users"
  ? UserProfile
  : K extends "pets"
    ? PetProfile
    : BotProfile;

/**
 * Maps a furni target kind onto the exact profile type that route returns.
 */
export type FurniProfileFor<K extends FurniTargetKind> = K extends "furni"
  ? FurniProfile
  : K extends "furni-bc"
    ? FurniBcProfile
    : K extends "wall-items"
      ? WallItemProfile
      : WallItemBcProfile;

/**
 * Patch body for a user, pet, bot, or furni variables profile.
 *
 * Only the listed variables are touched. A `null` value deletes the stored
 * value for that variable; the variable itself stays configured in the room.
 */
export interface VariablesPatch {
  /** Variable names mapped to a new value, or to `null` to delete the value. */
  variables: Record<string, VariableValue | null>;
}

/**
 * Patch body for the global variables profile.
 *
 * Unlike scoped profiles, global variables cannot be deleted through a patch,
 * so `null` is not accepted here.
 */
export interface GlobalVariablesPatch {
  /** Variable names mapped to their new values. */
  variables: Record<string, VariableValue>;
}

/**
 * Body carried by `PUT` and `PATCH` batch operations.
 */
export interface BatchOperationBody {
  /** The whole number to store. */
  value: VariableValue;
}

/**
 * A single operation inside a batch request.
 *
 * All operations in one batch act on the variable named in the route; `path`
 * selects the entity, in the form `<targetKind>/<entityId>` with no leading
 * slash, for example `users/44`.
 */
export type BatchOperation =
  | { op_id?: string; method: "GET"; path: string }
  | { op_id?: string; method: "DELETE"; path: string }
  | { op_id?: string; method: "PUT"; path: string; body: BatchOperationBody }
  | { op_id?: string; method: "PATCH"; path: string; body: BatchOperationBody };

/**
 * The error reported for a failed operation within a batch.
 */
export interface BatchOperationError {
  /** Machine-readable error code, e.g. `wired.variables.invalid_target`. */
  code: string;
  /** Human-readable message. The server currently mirrors the code here. */
  message: string;
}

/**
 * The result of a single batch operation.
 *
 * Narrow on `status`: `200` carries a `body`, `204` carries neither `body` nor
 * `error`, and any other status carries an `error`. The helper
 * {@link isBatchOperationSuccess} does this narrowing for you.
 */
export type BatchOperationResult =
  | { op_id?: string | null; status: 200; body: WiredVariable }
  | { op_id?: string | null; status: 204 }
  | { op_id?: string | null; status: 400 | 403 | 404 | 429 | 500; error: BatchOperationError };

/**
 * Narrows a {@link BatchOperationResult} to the operations that succeeded.
 *
 * @param result - A single result from a {@link BatchResults} response.
 * @returns `true` when the operation returned `200` or `204`.
 *
 * @example
 * ```ts
 * const { results } = await habbo.variables.batch(796, "user", "coins")
 *   .patch("users/44", 7)
 *   .execute();
 *
 * const failed = results.filter((r) => !isBatchOperationSuccess(r));
 * ```
 */
export function isBatchOperationSuccess(
  result: BatchOperationResult,
): result is Extract<BatchOperationResult, { status: 200 | 204 }> {
  return result.status === 200 || result.status === 204;
}

/**
 * The response of a batch request: one result per submitted operation, in the
 * order the operations were sent.
 */
export interface BatchResults {
  /** One entry per operation in the request. */
  results: BatchOperationResult[];
}

/**
 * The body of a batch request.
 *
 * Built for you by {@link BatchBuilder}; you only need this type when you
 * assemble a batch by hand.
 */
export interface BatchRequest {
  /** Between 1 and {@link BATCH_MAX_OPERATIONS} operations. */
  requests: BatchOperation[];
}

/**
 * The response of the variable count endpoint.
 *
 * {@link VariablesResource.count} unwraps this and returns the number directly.
 */
export interface VariableCount {
  /** How many values are stored. */
  count: number;
}

/**
 * Request body listing the variables whose stored values should be deleted.
 */
export interface BulkDeleteInput {
  /**
   * Names of user or furni variables whose stored values will be deleted. The
   * variable definitions themselves remain configured in the room.
   */
  variables: string[];
}

/**
 * The machine-readable error codes the Wired Variables API can return.
 *
 * Read it off `error.body` to tell apart failures that share an HTTP status.
 * A `403`, for instance, means a bad key, a room with the API switched off, or
 * an operation the room does not permit — three very different fixes.
 *
 * Unknown strings are allowed so a newly added code does not break typing.
 *
 * | Code | HTTP | Meaning |
 * | --- | --- | --- |
 * | `wired.variables.invalid_target` | 400 | The target kind or entity id is not valid for the scope. |
 * | `wired.variables.invalid_value` | 400 | The value is not an accepted whole number. |
 * | `wired.variables.bulk_delete_empty` | 400 | The bulk delete listed no variables. |
 * | `wired.variables.bulk_delete_invalid_variable` | 400 | A named variable is not configured in the room. |
 * | `wired.variables.batch_empty` | 400 | The batch carried no operations. |
 * | `wired.variables.batch_limit_exceeded` | 400 | The batch exceeded 50 operations. |
 * | `wired.variables.key_missing` | 403 | No key was sent. |
 * | `wired.variables.key_invalid` | 403 | The key does not match the room. |
 * | `wired.variables.api_disabled` | 403 | The room has the API switched off. |
 * | `wired.variables.user_not_participating` | 403 | The user is not taking part in the room. |
 * | `wired.variables.operation_not_allowed` | 403 | The room does not permit this operation. |
 * | `wired.variables.bulk_delete_not_enabled` | 403 | The room does not permit bulk deletes. |
 * | `room.not_found` | 404 | No such room. |
 * | `wired.variables.not_found` | 404 | No such variable. |
 * | `wired.variables.entity_not_found` | 404 | No such user, pet, bot, or item. |
 * | `wired.variables.too_many_requests` | 429 | Rate limit exceeded. |
 *
 * @example
 * ```ts
 * import { HabboAuthError, type WiredErrorBody } from "habbo-sdk";
 *
 * try {
 *   await habbo.variables.updateGlobal(796, "jackpot", 10);
 * } catch (error) {
 *   if (error instanceof HabboAuthError) {
 *     const code = (error.body as WiredErrorBody | undefined)?.error;
 *     if (code === "wired.variables.api_disabled") {
 *       // the room owner has to switch the API on
 *     }
 *   }
 * }
 * ```
 */
export type WiredErrorCode =
  | "wired.variables.invalid_target"
  | "wired.variables.invalid_value"
  | "wired.variables.bulk_delete_empty"
  | "wired.variables.bulk_delete_invalid_variable"
  | "wired.variables.batch_empty"
  | "wired.variables.batch_limit_exceeded"
  | "wired.variables.key_missing"
  | "wired.variables.key_invalid"
  | "wired.variables.api_disabled"
  | "wired.variables.user_not_participating"
  | "wired.variables.operation_not_allowed"
  | "wired.variables.bulk_delete_not_enabled"
  | "room.not_found"
  | "wired.variables.not_found"
  | "wired.variables.entity_not_found"
  | "wired.variables.too_many_requests"
  | (string & {});

/**
 * The error body returned by the Wired Variables API on a failed request.
 *
 * Reachable through the `body` of any thrown {@link HabboError}.
 */
export interface WiredErrorBody {
  /** The error code. See {@link WiredErrorCode}. */
  error: WiredErrorCode;
}

/**
 * The maximum number of operations the API accepts in a single batch request.
 */
export const BATCH_MAX_OPERATIONS = 50;

/**
 * The threshold at which a furni identifier wraps back to its unsigned form.
 */
export const FURNI_ID_WRAP = 2147418112;

const INT64_MIN = -(2n ** 63n);
const INT64_MAX = 2n ** 63n - 1n;

/**
 * Throws when a value cannot be stored as a wired variable.
 *
 * Wired variables are signed 64-bit whole numbers; the SDK rejects anything
 * else up front so callers get a precise error instead of an opaque `400`
 * from the server.
 *
 * @param value - The value about to be written.
 * @throws {@link TypeError} when the value is not a whole number the API can
 *   store.
 */
export function assertVariableValue(value: VariableValue): void {
  if (typeof value === "bigint") {
    if (value < INT64_MIN || value > INT64_MAX) {
      throw new TypeError(
        `Wired variable values must fit in a signed 64-bit integer. Received: ${value.toString()}`,
      );
    }
    return;
  }
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(
      `Wired variable values must be whole numbers; use bigint beyond 2^53. Received: ${String(value)}`,
    );
  }
}

/**
 * Normalizes a furni (floor or wall item) identifier for use in a Wired
 * Variables URL.
 *
 * In-room item ids may be negative or above {@link FURNI_ID_WRAP}, and the API
 * expects the wrapped, non-negative form. The SDK applies this automatically to
 * every furni-scoped path; callers building their own batch paths can use it
 * directly.
 *
 * @param furniId - The item identifier as reported by the room.
 * @returns The sanitized, positive item identifier.
 */
export function sanitizeFurniId(furniId: string | number): number {
  return toApiFurniId(furniId).id;
}

export interface ApiFurniId {
  /** The target kind under which the API addresses the item. */
  kind: FurniTargetKind;
  /** The sanitized, positive identifier used in API paths. */
  id: number;
}

export function toApiFurniId(furniId: string | number): ApiFurniId {
  let id = typeof furniId === "number" ? furniId : Number.parseInt(furniId, 10);
  const isWall = id < 0;
  if (isWall) {
    id = -id;
  }
  let kind: FurniTargetKind = isWall ? "wall-items" : "furni";
  if (id >= FURNI_ID_WRAP) {
    id -= FURNI_ID_WRAP;
    kind = isWall ? "wall-items-bc" : "furni-bc";
  }
  return { kind, id };
}

export function fromApiFurniId(furniId: ApiFurniId): number {
  const isBc = furniId.kind === "furni-bc" || furniId.kind === "wall-items-bc";
  const isWall = furniId.kind === "wall-items" || furniId.kind === "wall-items-bc";
  const base = isBc ? furniId.id + FURNI_ID_WRAP : furniId.id;
  return isWall ? -base : base;
}
