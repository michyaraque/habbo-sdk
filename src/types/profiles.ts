/**
 * Type definitions for the public Habbo API (`profiles` resource).
 *
 * Field names and shapes mirror the JSON returned by the public endpoints under
 * `https://www.habbo.<hotel>/api/public`. Timestamps are exposed as raw ISO 8601
 * strings exactly as returned by the API; callers may convert them to `Date`
 * instances as needed.
 */

/**
 * A badge displayed on a Habbo profile.
 */
export interface Badge {
  /** Zero-based position of the badge within the user's selection, when applicable. */
  badgeIndex?: number;
  /** The badge's unique code, used to build its image URL. */
  code: string;
  /** Human-readable badge name. */
  name: string;
  /** Human-readable badge description. */
  description: string;
}

/**
 * A Habbo user, as returned by the user and friend list endpoints.
 *
 * Many fields are only present on the full user endpoint and are therefore
 * optional; friend list entries expose a reduced subset.
 */
export interface Habbo {
  /** Stable unique identifier, prefixed with the hotel code, e.g. `"hhes-..."`. */
  uniqueId: string;
  /** The user's display name. */
  name: string;
  /** The user's motto. */
  motto: string;
  /** The figure (avatar) string used to render the user. */
  figureString: string;
  /** ISO 8601 timestamp of when the account was created, when available. */
  memberSince?: string;
  /** ISO 8601 timestamp of the user's last login, when available. */
  lastAccessTime?: string;
  /** Whether the user is currently online, when reported. */
  online?: boolean;
  /** Whether the user's profile (home) is publicly visible. */
  profileVisible?: boolean;
  /**
   * Badges the user has chosen to display, each carrying its `badgeIndex`
   * position within the selection.
   */
  selectedBadges?: Badge[];
  /** The user's current level, when reported. */
  currentLevel?: number;
  /** Percentage progress towards the next level, when reported. */
  currentLevelCompletePercent?: number;
  /** Total accumulated experience, when reported. */
  totalExperience?: number;
  /** StarGem balance, when reported. */
  starGemCount?: number;
}

/**
 * A Habbo group as it appears in a user's profile.
 */
export interface Group {
  /** Unique group identifier, e.g. `"g-hhes-..."`. */
  id: string;
  /** Group name. */
  name: string;
  /** Group description. */
  description: string;
  /** Group type, e.g. `"NORMAL"`. */
  type: string;
  /** Code used to render the group's badge, when available. */
  badgeCode?: string;
  /** Identifier of the group's room, when available. */
  roomId?: string;
  /** Primary badge colour as a hex string without the leading `#`. */
  primaryColour?: string;
  /** Secondary badge colour as a hex string without the leading `#`. */
  secondaryColour?: string;
  /** Whether the requesting context is an administrator of the group. */
  isAdmin?: boolean;
  /** Whether the group's room is currently online, when reported. */
  online?: boolean;
}

/**
 * A room owned by a user, as returned by the profile and room endpoints.
 */
export interface Room {
  /** Legacy numeric room identifier. */
  id: number;
  /** Stable unique room identifier. */
  uniqueId: string;
  /** Room name. */
  name: string;
  /** Room description. `null` when the owner left it blank. */
  description: string | null;
  /** Maximum number of simultaneous visitors. */
  maximumVisitors: number;
  /** Free-form tags assigned to the room. */
  tags: string[];
  /** Whether the owner's name is shown publicly. */
  showOwnerName: boolean;
  /** Display name of the room owner. */
  ownerName: string;
  /** Unique identifier of the room owner. */
  ownerUniqueId: string;
  /** Category identifiers the room belongs to. */
  categories: string[];
  /** URL of the room's thumbnail image. */
  thumbnailUrl: string;
  /** URL of the room's full image. */
  imageUrl: string;
  /** Aggregate room rating. */
  rating: number;
  /** ISO 8601 timestamp of room creation, when available. */
  creationTime?: string;
  /** Associated group identifier, when the room belongs to a group. */
  habboGroupId?: string;
}

/**
 * The aggregated public profile returned by the `/profile` endpoint.
 *
 * The user sits under {@link Profile.user}, with their friends, groups, rooms,
 * and badges alongside it.
 */
export interface Profile {
  /** The profile owner. */
  user: Habbo;
  /** The user's public friends. */
  friends: Habbo[];
  /** The groups the user belongs to. */
  groups: Group[];
  /** The user's public rooms. */
  rooms: Room[];
  /** Badges the user has earned. */
  badges: Badge[];
}

/**
 * A member of a group, as returned by the group members endpoint.
 *
 * This endpoint names the avatar field `habboFigure` rather than
 * `figureString`, and adds `gender` and `isAdmin`.
 */
export interface GroupMember {
  /** The member's unique identifier. */
  uniqueId: string;
  /** The member's display name. */
  name: string;
  /** The member's motto. */
  motto: string;
  /** The figure (avatar) string used to render the member. */
  habboFigure: string;
  /** The member's gender, e.g. `"M"` or `"F"`. */
  gender?: string;
  /** ISO 8601 timestamp of when the member joined the group. */
  memberSince?: string;
  /** Whether the member is currently online. */
  online?: boolean;
  /** Whether the member administrates the group. */
  isAdmin?: boolean;
}

/**
 * A public photo taken by a user.
 *
 * The `time` field is a Unix timestamp in milliseconds, as delivered by the
 * `extradata` photo endpoints.
 */
export interface Photo {
  /** Unique photo identifier. */
  id: string;
  /** URL of the photo preview image. */
  previewUrl: string;
  /** URL of the full photo image. */
  url: string;
  /** Photo type discriminator reported by the API. */
  type: string;
  /** Free-form tags applied to the photo. */
  tags: string[];
  /** Capture time as a Unix timestamp in milliseconds. */
  time: number;
  /** Unique identifier of the creator. */
  creator_uniqueId: string;
  /** Display name of the creator. */
  creator_name: string;
  /** Legacy numeric identifier of the creator. */
  creator_id: number;
  /** Identifier of the room the photo was taken in. */
  room_id: number;
  /** Identifiers of users who liked the photo. */
  likes: string[];
}

/**
 * The definition of an achievement.
 */
export interface AchievementDefinition {
  /** Achievement identifier. */
  id: number;
  /** Achievement name. */
  name: string;
  /** Achievement category, e.g. `"identity"`. */
  category: string;
  /** Lifecycle state, e.g. `"ENABLED"`. */
  state?: string;
  /** Creation date, formatted `YYYY-MM-DD`. */
  creationTime?: string;
}

/**
 * The score needed to reach one level of an achievement.
 */
export interface AchievementLevelRequirement {
  /** The level being described. */
  level: number;
  /** The score required to reach it. */
  requiredScore: number;
}

/**
 * An achievement together with its level thresholds, and, when read for a
 * specific user, that user's progress.
 */
export interface Achievement {
  /** The achievement definition. */
  achievement: AchievementDefinition;
  /** The score required at each level, when reported. */
  levelRequirements?: AchievementLevelRequirement[];
  /** The level the user has reached, when reported. */
  level?: number;
  /** The score the user has accrued, when reported. */
  score?: number;
}

/**
 * Summary information about a badge and how many users hold it.
 */
export interface BadgeOwners {
  /** How many users own the badge. */
  ownerCount: number;
  /** The badge name. */
  name: string;
  /** The badge description. */
  description: string;
}

/**
 * The furni to look up in a marketplace stats request.
 *
 * Provide floor items under `roomItems` and wall items under `wallItems`; each
 * entry names one furni.
 */
export interface MarketplaceStatsQuery {
  /** Floor items to look up. */
  roomItems?: Array<{ item: string }>;
  /** Wall items to look up. */
  wallItems?: Array<{ item: string }>;
}

/**
 * One historical data point of a furni's marketplace activity.
 *
 * The API returns these fields as strings, including the numeric ones.
 */
export interface MarketplaceHistoryPoint {
  /** Days before `statsDate` this point describes, e.g. `"-1"`. */
  dayOffset: string;
  /** Average price on that day. */
  averagePrice: string;
  /** How many items sold on that day. */
  totalSoldItems: string;
  /** Total credits exchanged on that day. */
  totalCreditSum: string;
  /** How many offers were open on that day. */
  totalOpenOffers: string;
}

/**
 * Marketplace statistics for a single furni.
 */
export interface MarketplaceItemStats {
  /** The furni these stats describe. */
  item: string;
  /** The date the stats were computed, formatted `YYYY-MM-DD`. */
  statsDate: string;
  /** Day-by-day history leading up to `statsDate`. */
  history: MarketplaceHistoryPoint[];
  /** How many were sold over the reporting window. */
  soldItemCount: number;
  /** Total credits exchanged over the window. */
  creditSum: number;
  /** Average price over the window. */
  averagePrice: number;
  /** Total offers opened over the window. */
  totalOpenOffers: number;
  /** How many offers are open right now. */
  currentOpenOffers: number;
  /** The lowest price among the currently open offers. */
  currentPrice: number;
  /** How many days of history the API retains. */
  historyLimitInDays: number;
}

/**
 * The response of the batch marketplace stats endpoint.
 */
export interface MarketplaceStats {
  /** Request status, e.g. `"OK"`. */
  status: string;
  /** Stats for the requested floor items. */
  roomItemData: MarketplaceItemStats[];
  /** Stats for the requested wall items. */
  wallItemData: MarketplaceItemStats[];
}
