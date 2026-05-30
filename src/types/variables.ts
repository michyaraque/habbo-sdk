/**
 * Type definitions for the Wired Variables API (`variables` resource).
 *
 * These cover wired variable reads and writes as well as the variable profile
 * endpoints, under `/rooms/{roomId}/variables` and
 * `/rooms/{roomId}/variables_profile`.
 *
 * @remarks
 * UNVERIFIED: the endpoint paths and HTTP methods are confirmed, but some
 * request and response body shapes in this module are inferred ahead of the
 * public release and may change once it is available.
 */

/**
 * The scope a wired variable is bound to.
 *
 * - `user` and `furni` variables are scoped to a specific entity within a room.
 * - `global` variables are scoped to the room as a whole.
 */
export type VariableScope = "user" | "furni" | "global";

/**
 * The kind of entity a scoped variable is attached to.
 *
 * `user` covers users, pets, and bots on the user-scoped endpoints; `furni`
 * covers furniture on the furni-scoped endpoints.
 */
export type TargetKind = string;

/**
 * The primitive value types a wired variable can hold.
 */
export type VariableValue = string | number | boolean;

/**
 * A wired variable as returned by the read endpoints.
 */
export interface WiredVariable {
  /** The variable name. */
  name: string;
  /** The scope the variable is bound to. */
  scope: VariableScope;
  /** The target kind, present for non-global scopes. */
  targetKind?: TargetKind;
  /** The identifier of the entity the variable is attached to, for scoped variables. */
  entityId?: string;
  /** The current value. */
  value: VariableValue;
  /** ISO 8601 timestamp of the last update, when reported by the server. */
  updatedAt?: string;
}

/**
 * Payload used to set or update a single wired variable value.
 */
export interface SetVariableInput {
  /** The new value to assign. */
  value: VariableValue;
}

/**
 * Common response envelope returned by the Wired Variables API.
 */
export interface ApiEnvelope {
  status: string;
  errors: string[];
  errorDetails: Record<string, unknown>;
  userStatus?: string | null;
}

/**
 * A stored variable entry with creation and update timestamps.
 */
export interface VariableEntry {
  value: VariableValue;
  creation_time: string;
  update_time: string;
}

/**
 * A single operation within a batch request.
 *
 * The `op_id` is a caller-supplied identifier used to correlate results.
 * `method` and `path` describe the sub-request; `body` carries the payload
 * for mutating methods.
 */
export interface BatchOperation {
  /** Caller-supplied identifier to correlate this operation with its result. */
  op_id: string;
  /** HTTP method for the sub-request. */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path of the sub-request, e.g. `/pets/119`. */
  path: string;
  /** Optional body for mutating sub-requests. */
  body?: { value: VariableValue };
}

/**
 * A single result entry within a batch response.
 */
export interface BatchResultItem {
  /** HTTP status code of the sub-request. */
  status: number;
  /** The resulting variable entry. */
  body: VariableEntry;
}

/**
 * Result of executing a batch of variable operations.
 */
export interface BatchResult extends ApiEnvelope {
  content?: {
    results: BatchResultItem[];
  };
}

/**
 * Payload identifying the variable names to remove in a bulk delete request.
 */
export interface BulkDeleteInput {
  /** The variable names to delete across the room. */
  variables: string[];
}

/**
 * Result of a bulk delete request.
 */
export interface BulkDeleteResult extends ApiEnvelope {
  content?: {
    deleted: number;
  };
}

/**
 * A variables profile: the full set of variables attached to a single entity,
 * keyed by variable name.
 */
export type VariablesProfile = Record<string, VariableEntry>;

/**
 * The response envelope for variables profile endpoints.
 */
export interface VariablesProfileResult extends ApiEnvelope {
  content?: {
    variables: VariablesProfile;
  };
}

/**
 * Payload used to patch a variables profile.
 *
 * Provide only the keys to change. Setting a value to `null` removes the
 * corresponding variable.
 *
 * @remarks UNVERIFIED: null-removal behavior is inferred and may change.
 */
export type VariablesProfilePatch = {
  variables: Record<string, VariableValue | null>;
};

/**
 * Result of setting a single variable in the global profile.
 */
export interface SetVariableResult extends ApiEnvelope {
  content?: VariableEntry;
}
