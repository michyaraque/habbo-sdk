/**
 * Habbo Origins example: match history, skills, and the fishing derby.
 *
 * Run with:
 *   pnpm example:origins
 *
 * These endpoints live on the Habbo Origins hotel, so the client uses
 * hotel: "origins". Origins identifies players by a unique player id (gp-...),
 * which differs from the uniqueId (hh...) used by the rest of the public API.
 */

import { HabboClient } from "../src/index.js";

const PLAYER_ID = "gp-hhus-41a4d52dd4fa45da74b7c5667880fba3";

const habbo = new HabboClient({
  hotel: "origins",
  ...(process.env["ORIGINS_API_KEY"] !== undefined
    ? { originsApiKey: process.env["ORIGINS_API_KEY"] }
    : {}),
});

// Bridge an Origins player id to the public API.
const [uniqueId] = await habbo.origins.getHabboIds(PLAYER_ID);
if (uniqueId !== undefined) {
  const user = await habbo.profiles.getById(uniqueId);
  console.log(`${PLAYER_ID} is ${user.name}`);
}

// The most recent matches, and the detail of the latest one.
const matchIds = await habbo.origins.listMatchIds(PLAYER_ID, { limit: 5 });
console.log(`\n${matchIds.length} recent match(es)`);

const [latest] = matchIds;
if (latest !== undefined) {
  const match = await habbo.origins.getMatch(latest);
  console.log(`  mode ${match.info.gameMode}, ${match.info.gameDuration / 1000}s`);

  for (const player of match.info.participants) {
    console.log(`    #${player.playerPlacement} ${player.gamePlayerId} — ${player.gameScore}`);
  }
}

// Walk the whole history without managing the offset yourself.
let counted = 0;
for await (const id of habbo.origins.iterateMatchIds(PLAYER_ID, { limit: 50 })) {
  void id;
  counted += 1;
  if (counted >= 200) break;
}
console.log(`\nwalked ${counted} match id(s)`);

// Fishing skill and where the player stands.
const skill = await habbo.origins.getSkill(PLAYER_ID, "FISHING");
console.log(`\nfishing: level ${skill.level}, ${skill.experience} xp`);

const board = await habbo.origins.getSkillLeaderboard("FISHING", 1);
console.log(`leaderboard page 1 of ${board.totalPages}`);
for (const [index, entry] of board.entries.slice(0, 5).entries()) {
  console.log(`  ${index + 1}. ${entry.uniqueId} — level ${entry.level}`);
}

// The fishing derby. These endpoints accept the optional originsApiKey.
const status = await habbo.origins.getDerbyStatus();
console.log("\nderby status:", status);
