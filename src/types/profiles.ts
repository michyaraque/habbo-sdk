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
  /** Badges the user has chosen to display. */
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
  /** Room description. */
  description: string;
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
 */
export interface Profile {
  /** The profile owner. */
  user: Habbo;
  /** The owner's public friends. */
  friends: Habbo[];
  /** The owner's groups. */
  groups: Group[];
  /** The owner's public rooms. */
  rooms: Room[];
  /** Badges the owner has earned. */
  badges: Badge[];
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
 * A single achievement entry, combining the achievement definition with the
 * user's progress towards it.
 */
export interface Achievement {
  /** The achievement definition. */
  achievement: {
    /** Achievement identifier. */
    id: number | string;
    /** Achievement name. */
    name: string;
    /** Achievement category. */
    category: string;
    /** Lifecycle state, when reported. */
    state?: string;
    /** ISO 8601 creation timestamp, when reported. */
    creationTime?: string;
  };
  /** The level the user has reached, when reported. */
  level?: number;
  /** The score the user has accrued, when reported. */
  score?: number;
}

/**
 * An owner of a badge, returned by the badge owners endpoint.
 *
 * @remarks
 * UNVERIFIED: this shape is inferred and may change.
 */
export interface BadgeOwner {
  /** The owner's unique identifier. */
  uniqueId: string;
  /** The owner's display name. */
  name: string;
}

/**
 * Identifies a single furni for a marketplace stats lookup.
 */
export interface MarketplaceStatsQuery {
  /** Furni class/type identifier. */
  furniType?: string;
  /** Furni class id, when used instead of `furniType`. */
  classId?: number;
}

/**
 * Marketplace statistics for a furni, returned by the batch stats endpoint.
 *
 * @remarks
 * UNVERIFIED: this shape is inferred and may change.
 */
export interface MarketplaceStats {
  /** The furni the stats describe. */
  furniType?: string;
  /** Average price over the reporting window, when reported. */
  averagePrice?: number;
  /** Total number of items sold, when reported. */
  totalSoldItems?: number;
  /** Historical data points, when reported. */
  history?: Array<{ dayOffset: number; averagePrice: number; soldItems: number }>;
}
