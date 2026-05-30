/**
 * The `profiles` resource: a read-only wrapper over the public Habbo API.
 *
 * None of these endpoints require authentication. Every method targets
 * `https://www.habbo.<hotel>/api/public` (or the configured `publicBaseUrl`).
 */

import type { HttpClient } from "../http.js";
import type { ResolvedConfig } from "../config.js";
import type {
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
} from "../types/profiles.js";

/**
 * Provides access to public Habbo user data: users, profiles, friends, groups,
 * rooms, badges, photos, and achievements.
 */
export class ProfilesResource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ResolvedConfig,
  ) {}

  private base(path: string): string {
    return `${this.config.publicBaseUrl}${path}`;
  }

  /**
   * Looks up a user by name.
   *
   * @param name - The exact, case-insensitive Habbo name to resolve.
   * @returns The matching {@link Habbo}.
   * @throws {@link UserInvalidError} when the name is rejected as invalid.
   * @throws {@link HabboNotFoundError} when no user matches the name.
   *
   * @example
   * ```ts
   * const user = await habbo.profiles.get("Cebolla1");
   * console.log(user.uniqueId);
   * ```
   */
  get(name: string): Promise<Habbo> {
    return this.http.request<Habbo>({
      url: this.base("/api/public/users"),
      query: { name },
    });
  }

  /**
   * Fetches a user by their stable unique identifier.
   *
   * @param uniqueId - The user's unique identifier (e.g. `"hhes-..."`).
   * @returns The matching {@link Habbo}.
   */
  getById(uniqueId: string): Promise<Habbo> {
    return this.http.request<Habbo>({
      url: this.base(`/api/public/users/${encodeURIComponent(uniqueId)}`),
    });
  }

  /**
   * Fetches a user's aggregated public profile, including their friends,
   * groups, rooms, and badges.
   *
   * @param uniqueId - The user's unique identifier.
   * @returns The aggregated {@link Profile}.
   */
  getProfile(uniqueId: string): Promise<Profile> {
    return this.http.request<Profile>({
      url: this.base(`/api/public/users/${encodeURIComponent(uniqueId)}/profile`),
    });
  }

  /**
   * Fetches a user's badges.
   *
   * @param uniqueId - The user's unique identifier.
   */
  getBadges(uniqueId: string): Promise<Badge[]> {
    return this.http.request<Badge[]>({
      url: this.base(`/api/public/users/${encodeURIComponent(uniqueId)}/badges`),
    });
  }

  /**
   * Fetches a user's public friends.
   *
   * @param uniqueId - The user's unique identifier.
   */
  getFriends(uniqueId: string): Promise<Habbo[]> {
    return this.http.request<Habbo[]>({
      url: this.base(`/api/public/users/${encodeURIComponent(uniqueId)}/friends`),
    });
  }

  /**
   * Fetches the groups a user belongs to.
   *
   * @param uniqueId - The user's unique identifier.
   */
  getGroups(uniqueId: string): Promise<Group[]> {
    return this.http.request<Group[]>({
      url: this.base(`/api/public/users/${encodeURIComponent(uniqueId)}/groups`),
    });
  }

  /**
   * Fetches a user's public rooms.
   *
   * @param uniqueId - The user's unique identifier.
   */
  getRooms(uniqueId: string): Promise<Room[]> {
    return this.http.request<Room[]>({
      url: this.base(`/api/public/users/${encodeURIComponent(uniqueId)}/rooms`),
    });
  }

  /**
   * Fetches a user's public photos, or the hotel's latest photos when no
   * identifier is supplied.
   *
   * @param uniqueId - The user's unique identifier. Omit to retrieve the
   *   hotel-wide latest photos.
   */
  getPhotos(uniqueId?: string): Promise<Photo[]> {
    const path =
      uniqueId !== undefined
        ? `/extradata/public/users/${encodeURIComponent(uniqueId)}/photos`
        : "/extradata/public/photos";
    return this.http.request<Photo[]>({ url: this.base(path) });
  }

  /**
   * Fetches a user's achievements.
   *
   * @param uniqueId - The user's unique identifier.
   */
  getAchievements(uniqueId: string): Promise<Achievement[]> {
    return this.http.request<Achievement[]>({
      url: this.base(`/api/public/achievements/${encodeURIComponent(uniqueId)}`),
    });
  }

  /**
   * Fetches the full catalogue of achievements defined by the hotel.
   */
  getAllAchievements(): Promise<Achievement[]> {
    return this.http.request<Achievement[]>({
      url: this.base("/api/public/achievements"),
    });
  }

  /**
   * Fetches the owners of a badge.
   *
   * @param badgeCode - The badge code to resolve owners for.
   *
   * @remarks
   * UNVERIFIED: the response shape is inferred and may change.
   */
  getBadgeOwners(badgeCode: string): Promise<BadgeOwner[]> {
    return this.http.request<BadgeOwner[]>({
      url: this.base(`/api/public/badge/owners/${encodeURIComponent(badgeCode)}`),
    });
  }

  /**
   * Fetches a room by its identifier.
   *
   * @param roomId - The numeric room identifier (the `id` field of a
   *   {@link Room}, not its `uniqueId`).
   */
  getRoom(roomId: string | number): Promise<Room> {
    return this.http.request<Room>({
      url: this.base(`/api/public/rooms/${encodeURIComponent(String(roomId))}`),
    });
  }

  /**
   * Fetches the current list of hot looks (popular avatar figures).
   *
   * This endpoint returns XML rather than JSON; the raw XML document is returned
   * as a string for the caller to parse.
   */
  getHotLooks(): Promise<string> {
    return this.http.request<string>({
      url: this.base("/api/public/lists/hotlooks"),
      raw: true,
    });
  }

  /**
   * Fetches marketplace statistics for several furni in a single request.
   *
   * @param queries - The furni to look up stats for.
   *
   * @remarks
   * UNVERIFIED: the request and response shapes are inferred and may change.
   */
  getMarketplaceStats(queries: MarketplaceStatsQuery[]): Promise<MarketplaceStats[]> {
    return this.http.request<MarketplaceStats[]>({
      method: "POST",
      url: this.base("/api/public/marketplace/stats/batch"),
      body: queries,
    });
  }

  /**
   * Pings the public API to check availability.
   *
   * @returns Resolves when the endpoint responds successfully.
   */
  ping(): Promise<void> {
    return this.http.request<void>({ url: this.base("/api/public/ping") });
  }

  /**
   * Fetches a group by its identifier.
   *
   * @param groupId - The unique group identifier.
   */
  getGroup(groupId: string): Promise<Group> {
    return this.http.request<Group>({
      url: this.base(`/api/public/groups/${encodeURIComponent(groupId)}`),
    });
  }

  /**
   * Fetches the members of a group.
   *
   * @param groupId - The unique group identifier.
   */
  getGroupMembers(groupId: string): Promise<Habbo[]> {
    return this.http.request<Habbo[]>({
      url: this.base(`/api/public/groups/${encodeURIComponent(groupId)}/members`),
    });
  }
}
