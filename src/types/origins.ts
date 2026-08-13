/**
 * Type definitions for the Habbo Origins endpoints: matches, the fishing derby,
 * skills, and player id resolution.
 *
 * Origins identifies players by a *unique player id* (`gp-...`), which differs
 * from the `uniqueId` (`hh...`) used elsewhere in the public API. Convert one
 * into the other with {@link OriginsResource.getHabboIds}.
 */

/**
 * The skills the API tracks. Only fishing is exposed today.
 */
export type SkillType = "FISHING";

/**
 * A player's progress in a single skill.
 */
export interface PlayerSkill {
  /** The current level of the skill. */
  level: number;
  /** Experience points accumulated in the skill. */
  experience: number;
}

/**
 * One entry of a skill leaderboard.
 */
export interface SkillLeaderboardEntry {
  /** The player's unique id. */
  uniqueId: string;
  /** The player's level in the skill. */
  level: number;
  /** The player's experience in the skill. */
  experience: number;
}

/**
 * One page of a skill leaderboard.
 */
export interface SkillLeaderboard {
  /** The players on this page, in ranking order. */
  entries: SkillLeaderboardEntry[];
  /** How many pages exist in total. */
  totalPages: number;
  /** The page number this result represents, starting at 1. */
  currentPage: number;
  /** How many entries each page holds. */
  pageSize: number;
}

/**
 * Time and pagination filters shared by the match and derby id listings.
 */
export interface HistoryQuery {
  /** How many items to skip before collecting results. */
  offset?: number;
  /** How many items to return. */
  limit?: number;
  /**
   * Only include games starting after this time, formatted as
   * `YYYY-MM-DD HH:mm:ss.SSS`, for example `2024-08-20 12:00:00.000`.
   */
  startTime?: string;
  /**
   * Only include games ending before this time, in the same format as
   * {@link HistoryQuery.startTime}.
   */
  endTime?: string;
}

/**
 * Identifiers describing a match and who took part in it.
 */
export interface MatchMetadata {
  /** The unique match id. */
  matchId: string;
  /** The unique player ids of everyone who took part. */
  participantPlayerIds: string[];
}

/**
 * A single player's performance within a match.
 *
 * Tile counters are specific to tile-capture game modes and read as `0` in
 * modes that do not use them.
 */
export interface MatchParticipant {
  /** The participant's unique player id. */
  gamePlayerId: string;
  /** Points scored by the participant. */
  gameScore: number;
  /** Where the participant finished, `1` being first. */
  playerPlacement: number;
  /** The team the participant belonged to. */
  teamId: number;
  /** Where the participant's team finished. */
  teamPlacement: number;
  /** How many times the participant was stunned. */
  timesStunned: number;
  /** How many power-ups the participant picked up. */
  powerUpPickups: number;
  /** How many power-ups the participant used. */
  powerUpActivations: number;
  /** Tiles the participant cleaned. */
  tilesCleaned: number;
  /** Tiles the participant coloured. */
  tilesColoured: number;
  /** Tiles the participant took from opponents. */
  tilesStolen: number;
  /** Tiles the participant locked. */
  tilesLocked: number;
  /** Tiles the participant coloured in an opponent's colour. */
  tilesColouredForOpponents: number;
}

/**
 * A team's result within a match.
 */
export interface MatchTeam {
  /** The team identifier. */
  teamId: number;
  /** Whether the team won. */
  win: boolean;
  /** Points scored by the team. */
  teamScore: number;
  /** Where the team finished, `1` being first. */
  teamPlacement: number;
}

/**
 * The details of how a match was played.
 *
 * Timestamps are Unix milliseconds and durations are milliseconds.
 */
export interface MatchInfo {
  /** When the match was created, as a Unix timestamp in milliseconds. */
  gameCreation: number;
  /** How long the match lasted, in milliseconds. */
  gameDuration: number;
  /** When the match ended, as a Unix timestamp in milliseconds. */
  gameEnd: number;
  /** The game mode, for example `"BOUNCER"`. */
  gameMode: string;
  /** The map the match was played on. */
  mapId: number;
  /** Whether the match counted towards ranking. */
  ranked: boolean;
  /** Per-player results. */
  participants: MatchParticipant[];
  /** Per-team results. */
  teams: MatchTeam[];
}

/**
 * A full match record.
 */
export interface Match {
  /** Identifiers for the match and its participants. */
  metadata: MatchMetadata;
  /** How the match played out. */
  info: MatchInfo;
}

/**
 * Lifecycle state of a fishing derby.
 *
 * Other values may appear as the hotel evolves, so unknown strings are allowed
 * rather than rejected.
 */
export type DerbyStatus = "ACTIVE" | "REGISTRATION" | "ENDED" | (string & {});

/**
 * Identifiers describing a fishing derby and who entered it.
 */
export interface DerbyMetadata {
  /** The unique derby id. */
  derbyId: string;
  /** The Habbo unique ids of everyone entered. */
  participantAccountIds: string[];
}

/**
 * One player's running tally within a fishing derby.
 */
export interface DerbyParticipant {
  /** The player's Habbo unique id. */
  accountId: string;
  /** How many fish the player has caught. */
  fishCaught: number;
  /** How many golden fish the player has caught. */
  goldenFishCaught: number;
  /** How many fish the player caught in private rooms. */
  privateFishCaught: number;
  /** When this tally last changed, as a Unix timestamp in milliseconds. */
  lastUpdated: number;
  /** The mode the player is competing in, for example `"standard"`. */
  derbyMode: string;
  /** Total weight of the player's catch in grams, in standard mode. */
  standardWeightGrams: number;
}

/**
 * How a fishing derby is scheduled and how its entrants are doing.
 *
 * All timestamps are Unix milliseconds.
 */
export interface DerbyInfo {
  /** The derby's lifecycle state. */
  status: DerbyStatus;
  /** When the derby was created. */
  creationTime: number;
  /** When entry opened. */
  registrationStartTime: number;
  /** When entry closed. */
  registrationEndTime: number;
  /** When fishing started. */
  startTime: number;
  /** When fishing ends. */
  endTime: number;
  /** Every entrant and their current tally. */
  participants: DerbyParticipant[];
}

/**
 * A full fishing derby record.
 */
export interface Derby {
  /** Identifiers for the derby and its entrants. */
  metadata: DerbyMetadata;
  /** Scheduling and standings. */
  info: DerbyInfo;
}

/**
 * The current state of the hotel's fishing derby.
 *
 * `derby` is absent when no derby is running.
 */
export interface DerbyStatusResponse {
  /** The overall state, mirroring `derby.info.status` when one is running. */
  status: DerbyStatus;
  /** The derby currently in progress, when there is one. */
  derby?: Derby;
}
