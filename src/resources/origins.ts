/**
 * The `origins` resource: minigame match history, the fishing derby, skill
 * progression, and player id resolution.
 *
 * These endpoints are served by the Habbo Origins hotel, so the client must be
 * configured with `hotel: "origins"`. Pointing them at a regular hotel returns
 * `404`, since only Origins exposes these routes.
 *
 * They need no authentication, though the fishing derby routes accept an
 * optional `api_key`, configured once on the client as `originsApiKey`.
 */

import type { HttpClient } from "../http.js";
import type { ResolvedConfig } from "../config.js";
import type {
  Derby,
  DerbyStatusResponse,
  HistoryQuery,
  Match,
  PlayerSkill,
  SkillLeaderboard,
  SkillType,
} from "../types/origins.js";

/**
 * Reads Habbo Origins minigame data: matches, fishing derbies, and skills.
 *
 * Access it through `habbo.origins`.
 *
 * @example
 * ```ts
 * const habbo = new HabboClient({ hotel: "origins" });
 * const skill = await habbo.origins.getSkill(playerId, "FISHING");
 * ```
 */
export class OriginsResource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ResolvedConfig,
  ) {}

  private url(path: string): string {
    return `${this.config.publicBaseUrl}${path}`;
  }

  /** Maps the shared history filters onto the query names the API expects. */
  private historyQuery(query: HistoryQuery): Record<string, string | number | undefined> {
    return {
      offset: query.offset,
      limit: query.limit,
      start_time: query.startTime,
      end_time: query.endTime,
    };
  }

  /** Adds the configured Origins API key to a query when one is set. */
  private withApiKey(
    query: Record<string, string | number | undefined> = {},
  ): Record<string, string | number | undefined> {
    return this.config.originsApiKey !== undefined
      ? { ...query, api_key: this.config.originsApiKey }
      : query;
  }

  /**
   * Resolves an Origins unique player id into the `uniqueId` values used by the
   * rest of the public API.
   *
   * Match and derby records identify players by a `gp-...` player id, while
   * {@link ProfilesResource} works with `hh...` unique ids. This bridges the two.
   *
   * @param uniquePlayerId - The Origins unique player id.
   * @returns The matching Habbo unique ids. A player may map to more than one.
   *
   * @example
   * ```ts
   * const [uniqueId] = await habbo.origins.getHabboIds("gp-hhus-41a4d5...");
   * const user = uniqueId ? await habbo.profiles.getById(uniqueId) : undefined;
   * ```
   */
  getHabboIds(uniquePlayerId: string): Promise<string[]> {
    return this.http.request<string[]>({
      url: this.url(`/api/public/users/by-playerId/${encodeURIComponent(uniquePlayerId)}`),
    });
  }

  /**
   * Lists the ids of matches a player took part in, most useful as the first
   * step before {@link OriginsResource.getMatch}.
   *
   * @param uniquePlayerId - The Origins unique player id.
   * @param query - Pagination and time filters. See {@link HistoryQuery}.
   * @returns The matching match ids.
   *
   * @example
   * ```ts
   * const ids = await habbo.origins.listMatchIds("gp-hhus-41a4d5...", {
   *   limit: 10,
   *   startTime: "2024-08-20 12:00:00.000",
   * });
   * ```
   */
  listMatchIds(uniquePlayerId: string, query: HistoryQuery = {}): Promise<string[]> {
    return this.http.request<string[]>({
      url: this.url(`/api/public/matches/v1/${encodeURIComponent(uniquePlayerId)}/ids`),
      query: this.historyQuery(query),
    });
  }

  /**
   * Reads the full record of one match: its participants, their per-player
   * statistics, and the team results.
   *
   * @param uniqueMatchId - The unique match id.
   * @returns The match record.
   *
   * @example
   * ```ts
   * const match = await habbo.origins.getMatch("gm-hhus-fc2443...");
   *
   * console.log(match.info.gameMode, match.info.gameDuration);
   * for (const player of match.info.participants) {
   *   console.log(player.gamePlayerId, player.gameScore, player.playerPlacement);
   * }
   * ```
   */
  getMatch(uniqueMatchId: string): Promise<Match> {
    return this.http.request<Match>({
      url: this.url(`/api/public/matches/v1/${encodeURIComponent(uniqueMatchId)}`),
    });
  }

  /**
   * Iterates every match id of a player, fetching one page at a time.
   *
   * Use this instead of {@link OriginsResource.listMatchIds} to walk a full
   * history without managing the offset yourself. Iteration stops as soon as a
   * page comes back short.
   *
   * @param uniquePlayerId - The Origins unique player id.
   * @param query - Time filters, plus the `limit` used as the page size and the
   *   `offset` used as the starting point.
   * @yields Each match id, in server order.
   *
   * @example
   * ```ts
   * for await (const id of habbo.origins.iterateMatchIds("gp-hhus-41a4d5...")) {
   *   const match = await habbo.origins.getMatch(id);
   *   console.log(match.info.gameMode);
   * }
   * ```
   */
  async *iterateMatchIds(
    uniquePlayerId: string,
    query: HistoryQuery = {},
  ): AsyncGenerator<string, void, undefined> {
    const limit = query.limit ?? 50;
    let offset = query.offset ?? 0;

    for (;;) {
      const ids = await this.listMatchIds(uniquePlayerId, { ...query, offset, limit });
      yield* ids;

      if (ids.length < limit) {
        return;
      }
      offset += limit;
    }
  }

  /**
   * Lists the ids of fishing derbies a player took part in.
   *
   * @param uniquePlayerId - The player to look up. In practice the hotel accepts
   *   the Habbo unique id (`hhous-...`) reported by
   *   {@link DerbyParticipant.accountId} here.
   * @param query - Pagination and time filters. See {@link HistoryQuery}.
   * @returns The matching derby ids.
   *
   * @example
   * ```ts
   * const ids = await habbo.origins.listDerbyIds("hhous-066a72...", { limit: 5 });
   * ```
   */
  listDerbyIds(uniquePlayerId: string, query: HistoryQuery = {}): Promise<string[]> {
    return this.http.request<string[]>({
      url: this.url(`/api/public/minigame/derby/v1/${encodeURIComponent(uniquePlayerId)}/ids`),
      query: this.withApiKey(this.historyQuery(query)),
    });
  }

  /**
   * Reads one fishing derby: when it ran and how every entrant scored.
   *
   * @param uniqueDerbyId - The unique derby id.
   * @returns The derby record.
   *
   * @example
   * ```ts
   * const derby = await habbo.origins.getDerby("fd-hhous-f5d562...");
   *
   * const ranking = [...derby.info.participants].sort(
   *   (a, b) => b.fishCaught - a.fishCaught,
   * );
   * console.log(ranking[0]?.accountId, ranking[0]?.fishCaught);
   * ```
   */
  getDerby(uniqueDerbyId: string): Promise<Derby> {
    return this.http.request<Derby>({
      url: this.url(`/api/public/minigame/derby/v1/${encodeURIComponent(uniqueDerbyId)}`),
      query: this.withApiKey(),
    });
  }

  /**
   * Reads the hotel's current fishing derby, including live standings when one
   * is running.
   *
   * @returns The status, with `derby` present only while one is in progress.
   *
   * @example
   * ```ts
   * const { status, derby } = await habbo.origins.getDerbyStatus();
   *
   * if (derby !== undefined) {
   *   console.log(status, derby.info.participants.length, "entrants");
   * }
   * ```
   */
  getDerbyStatus(): Promise<DerbyStatusResponse> {
    return this.http.request<DerbyStatusResponse>({
      url: this.url("/api/public/minigame/derby/v1/status"),
      query: this.withApiKey(),
    });
  }

  /**
   * Reads a player's progress in a skill.
   *
   * @param uniquePlayerId - The player to look up. In practice the hotel accepts
   *   the Habbo unique id (`hhous-...`) here.
   * @param skillType - The skill to read. Only `"FISHING"` exists today.
   * @returns The player's level and experience.
   *
   * @example
   * ```ts
   * const skill = await habbo.origins.getSkill("hhous-066a72...", "FISHING");
   * console.log(skill.level, skill.experience); // 99 32650913
   * ```
   */
  getSkill(uniquePlayerId: string, skillType: SkillType = "FISHING"): Promise<PlayerSkill> {
    return this.http.request<PlayerSkill>({
      url: this.url(`/api/public/skills/${encodeURIComponent(uniquePlayerId)}`),
      query: { skillType },
    });
  }

  /**
   * Reads one page of a skill leaderboard.
   *
   * @param skillType - The skill to rank. Only `"FISHING"` exists today.
   * @param page - The page number, starting at 1.
   * @returns One page of ranked players, with the total page count.
   *
   * @example
   * ```ts
   * const board = await habbo.origins.getSkillLeaderboard("FISHING", 1);
   *
   * for (const entry of board.entries) {
   *   console.log(entry.uniqueId, entry.level);
   * }
   * ```
   */
  getSkillLeaderboard(skillType: SkillType = "FISHING", page = 1): Promise<SkillLeaderboard> {
    return this.http.request<SkillLeaderboard>({
      url: this.url("/api/public/skills/leaderboard"),
      query: { skillType, page },
    });
  }

  /**
   * Iterates every entry of a skill leaderboard, fetching one page at a time.
   *
   * @param skillType - The skill to rank.
   * @yields Each leaderboard entry, from the top down.
   *
   * @example
   * ```ts
   * for await (const entry of habbo.origins.iterateSkillLeaderboard("FISHING")) {
   *   console.log(entry.uniqueId, entry.experience);
   * }
   * ```
   */
  async *iterateSkillLeaderboard(
    skillType: SkillType = "FISHING",
  ): AsyncGenerator<SkillLeaderboard["entries"][number], void, undefined> {
    let page = 1;
    let totalPages = 1;

    do {
      const board = await this.getSkillLeaderboard(skillType, page);
      yield* board.entries;
      totalPages = board.totalPages;
      page += 1;
    } while (page <= totalPages);
  }
}
