/**
 * habbo-sdk
 *
 * A TypeScript SDK that wraps two distinct Habbo contracts behind a single
 * client:
 *
 * - The public Habbo API (`profiles`) for reading user, group, and room data.
 * - The Wired Variables API (`variables`) for reading and writing room
 *   variables and variable profiles.
 *
 * @packageDocumentation
 */

export { HabboClient } from "./client.js";

export type { HabboClientConfig, Hotel } from "./config.js";

export {
  HabboError,
  HabboNotFoundError,
  UserInvalidError,
  MaintenanceError,
  HabboAuthError,
  HabboRateLimitError,
  HabboNetworkError,
} from "./errors.js";

export type { FetchLike } from "./http.js";

export type { ProfilesResource } from "./resources/profiles.js";
export type {
  VariablesResource,
  VariablesProfileResource,
} from "./resources/variables.js";
export { BatchBuilder } from "./resources/batch-builder.js";
export type { BatchExecutor } from "./resources/batch-builder.js";

export type {
  Achievement,
  Badge,
  BadgeOwner,
  Group,
  Habbo,
  MarketplaceStats,
  MarketplaceStatsQuery,
  Photo,
  Profile,
  Room,
} from "./types/profiles.js";

export type {
  BatchOperation,
  BatchResult,
  BulkDeleteInput,
  BulkDeleteResult,
  SetVariableInput,
  TargetKind,
  VariableScope,
  VariableValue,
  VariablesProfile,
  VariablesProfilePatch,
  WiredVariable,
} from "./types/variables.js";
