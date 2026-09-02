/**
 * Wired Variables API example: authenticated reads and writes.
 *
 * Set the two keys from your room's Wired settings, then run:
 *   pnpm example:variables
 *
 * Reads use X-Wired-Read-Key, writes use X-Wired-Write-Key, and a batch, which
 * may mix both, sends the two.
 */

import { HabboClient, HabboNotFoundError, isBatchOperationSuccess } from "../src/index.js";

const ROOM_ID = 796;

const habbo = new HabboClient({
  hotel: "es",
  readKey: process.env["WIRED_READ_KEY"] ?? "your-x-wired-read-key",
  writeKey: process.env["WIRED_WRITE_KEY"] ?? "your-x-wired-write-key",
});

// Which variables the room has configured, grouped by scope.
const names = await habbo.variables.list(ROOM_ID);
console.log(`Room ${ROOM_ID} variables`);
console.log(`  user:   ${names.users.join(", ") || "(none)"}`);
console.log(`  furni:  ${names.furni.join(", ") || "(none)"}`);
console.log(`  global: ${names.global.join(", ") || "(none)"}`);

// A global variable: read it, then increment it.
const jackpot = await habbo.variables.getGlobal(ROOM_ID, "jackpot").catch((error: unknown) => {
  if (error instanceof HabboNotFoundError) {
    return undefined;
  }
  throw error;
});

const current = jackpot?.value ?? 0;
const updated = await habbo.variables.updateGlobal(ROOM_ID, "jackpot", BigInt(current) + 100n);
console.log(`\njackpot: ${current} -> ${updated.value}`);

// A user-scoped variable: write it, then read it back.
await habbo.variables.set(ROOM_ID, "user", "coins", "users", 44, 50);
const coins = await habbo.variables.get(ROOM_ID, "user", "coins", "users", 44);
console.log(`coins for user 44: ${coins.value} (updated ${coins.update_time})`);

// A leaderboard: the ten highest scores, with the players who hold them.
const top = await habbo.variables.listByKind(ROOM_ID, "user", "score", "users", {
  orderBy: "value",
  orderDir: "desc",
  size: 10,
});
console.log("\nTop scores");
for (const [index, entry] of top.items.entries()) {
  console.log(`  ${index + 1}. ${entry.name ?? entry.id} — ${entry.value}`);
}

// Every variable of one user in a single request, rather than one call each.
const profile = await habbo.variables.profiles.getUser(ROOM_ID, "users", 44);
console.log(`\n${profile.user.name ?? profile.user.id} has:`);
for (const [name, variable] of Object.entries(profile.variables)) {
  console.log(`  ${name} = ${variable.value}`);
}

// Patch several variables at once. null deletes the stored value.
await habbo.variables.profiles.patchUser(ROOM_ID, "users", 44, {
  coins: 75,
  level: 3,
  temporary_flag: null,
});

// A batch: many entities, one variable, one request.
const { results } = await habbo.variables
  .batch(ROOM_ID, "user", "score")
  .patch("users/44", 10, { opId: "winner" })
  .patch("users/45", 7)
  .delete("users/46")
  .execute();

console.log(`\nbatch: ${results.length} operation(s)`);
for (const result of results) {
  if (isBatchOperationSuccess(result)) {
    console.log(`  ${result.op_id ?? "-"} ok (${result.status})`);
  } else {
    console.log(`  ${result.op_id ?? "-"} failed: ${result.error.code}`);
  }
}

// Reset the round: clears every stored value of these variables.
await habbo.variables.bulkDelete(ROOM_ID, ["score"]);
console.log("\nscores cleared");
