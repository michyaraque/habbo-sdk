/**
 * Wired Variables API example: authenticated reads and writes for one room.
 *
 * The Wired keys belong to the room, so they are bound together on a
 * RoomInstance and no call repeats the room id.
 *
 * Set the two keys from your room's Wired settings, then run:
 *   pnpm example:variables
 */

import { HabboClient, HabboNotFoundError, isBatchOperationSuccess } from "../src/index.js";

const habbo = new HabboClient({ hotel: "es" });

const room = habbo.room({
  roomId: 796,
  readKey: process.env["WIRED_READ_KEY"] ?? "your-x-wired-read-key",
  writeKey: process.env["WIRED_WRITE_KEY"] ?? "your-x-wired-write-key",
});

// Which variables the room has configured, grouped by scope.
const names = await room.variables.list();
console.log(`Room ${room.roomId} variables`);
console.log(`  user:   ${names.users.join(", ") || "(none)"}`);
console.log(`  furni:  ${names.furni.join(", ") || "(none)"}`);
console.log(`  global: ${names.global.join(", ") || "(none)"}`);

// A global variable: read it, then increment it.
const jackpot = await room.variables.getGlobal("jackpot").catch((error: unknown) => {
  if (error instanceof HabboNotFoundError) {
    return undefined;
  }
  throw error;
});

const current = jackpot?.value ?? 0;
const updated = await room.variables.updateGlobal("jackpot", BigInt(current) + 100n);
console.log(`\njackpot: ${current} -> ${updated.value}`);

// A user-scoped variable: write it, then read it back.
await room.variables.set("user", "coins", "users", 44, 50);
const coins = await room.variables.get("user", "coins", "users", 44);
console.log(`coins for user 44: ${coins.value} (updated ${coins.update_time})`);

// A leaderboard: the ten highest scores, with the players who hold them.
const top = await room.variables.listByKind("user", "score", "users", {
  orderBy: "value",
  orderDir: "desc",
  size: 10,
});
console.log("\nTop scores");
for (const [index, entry] of top.items.entries()) {
  console.log(`  ${index + 1}. ${entry.name ?? entry.id} - ${entry.value}`);
}

// Every variable of one user in a single request, rather than one call each.
const profile = await room.variables.profiles.getUser("users", 44);
console.log(`\n${profile.user.name ?? profile.user.id} has:`);
for (const [name, variable] of Object.entries(profile.variables)) {
  console.log(`  ${name} = ${variable.value}`);
}

// Patch several variables at once. null deletes the stored value.
await room.variables.profiles.patchUser("users", 44, {
  coins: 75,
  level: 3,
  temporary_flag: null,
});

// A batch: many entities, one variable, one request.
const { results } = await room.variables
  .batch("user", "score")
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
await room.variables.bulkDelete(["score"]);
console.log("\nscores cleared");