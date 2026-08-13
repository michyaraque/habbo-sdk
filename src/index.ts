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
export type { OriginsResource } from "./resources/origins.js";

export type {
  Derby,
  DerbyInfo,
  DerbyMetadata,
  DerbyParticipant,
  DerbyStatus,
  DerbyStatusResponse,
  HistoryQuery,
  Match,
  MatchInfo,
  MatchMetadata,
  MatchParticipant,
  MatchTeam,
  PlayerSkill,
  SkillLeaderboard,
  SkillLeaderboardEntry,
  SkillType,
} from "./types/origins.js";
export type {
  RoomId,
  VariablesResource,
  VariablesProfileResource,
} from "./resources/variables.js";
export { BatchBuilder } from "./resources/batch-builder.js";
export type { BatchExecutor, BatchOperationOptions } from "./resources/batch-builder.js";

export type {
  Achievement,
  AchievementDefinition,
  AchievementLevelRequirement,
  Badge,
  BadgeOwners,
  Group,
  GroupMember,
  Habbo,
  MarketplaceHistoryPoint,
  MarketplaceItemStats,
  MarketplaceStats,
  MarketplaceStatsQuery,
  Photo,
  Profile,
  Room,
} from "./types/profiles.js";

export {
  BATCH_MAX_OPERATIONS,
  assertVariableValue,
  isBatchOperationSuccess,
} from "./types/variables.js";

export type {
  AnyFurniProfile,
  AnyUserProfile,
  BatchOperation,
  BatchOperationBody,
  BatchOperationError,
  BatchOperationResult,
  BatchRequest,
  BatchResults,
  BotProfile,
  BulkDeleteInput,
  FurniBcProfile,
  FurniProfile,
  FurniProfileFor,
  FurniTargetKind,
  GlobalProfile,
  GlobalVariablesPatch,
  ListByKindOptions,
  PagedVariableItem,
  PagedVariables,
  PetProfile,
  ItemProfileTarget,
  NamedProfileTarget,
  ProfileTarget,
  UserProfileTarget,
  RoomVariables,
  TargetKind,
  TargetKindFor,
  UserProfile,
  UserProfileFor,
  UserTargetKind,
  ValueWriteInput,
  VariableCount,
  VariableMap,
  VariableScope,
  VariableValue,
  VariablesPatch,
  VariablesProfile,
  WallItemBcProfile,
  WallItemProfile,
  WiredErrorBody,
  WiredErrorCode,
  WiredVariable,
} from "./types/variables.js";
