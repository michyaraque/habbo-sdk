/**
 * Wired Variables API example: authenticated reads and writes.
 *
 * Replace WRITE_KEY with the X-Wired-Write-Key for your room, then run with:
 *   pnpm tsx examples/variables.ts
 *
 * The Wired server base URL is derived from the hotel as
 * https://www.habbo.<hotel>/server/v1.
 */

import { HabboClient, HabboNotFoundError } from "../src/index.js";

const WRITE_KEY = "your-x-wired-write-key";
const ROOM_ID = "796";

const habbo = new HabboClient({ hotel: "es", writeKey: WRITE_KEY });

const variables = await habbo.variables.list(ROOM_ID);
console.log(`Room ${ROOM_ID} has ${variables.length} wired variable(s).`);
for (const variable of variables.slice(0, 5)) {
  console.log(`  ${variable.scope}/${variable.name} = ${String(variable.value)}`);
}

// Global variable: read, then increment.
const scoreboardResult = await habbo.variables
  .getGlobal(ROOM_ID, "scoreboard")
  .catch((error: unknown) => {
    if (error instanceof HabboNotFoundError) {
      return undefined;
    }
    throw error;
  });
const current = typeof scoreboardResult?.value === "number" ? scoreboardResult.value : 0;
const updated = await habbo.variables.updateGlobal(ROOM_ID, "scoreboard", current + 1);
console.log(`\nscoreboard: ${current} -> ${String(updated.value)}`);

// Scoped user variable: set then read back.
await habbo.variables.set(ROOM_ID, "user", "coins", "user", "12345", 50);
const coins = await habbo.variables.get(ROOM_ID, "user", "coins", "user", "12345");
console.log(`user coins for 12345: ${String(coins.value)}`);

// Variables profile: patch several keys at once (null removes a key).
const updatedProfile = await habbo.variables.profiles.patchUser(ROOM_ID, "user", "12345", {
  variables: {
    coins: 75,
    level: 3,
    temporaryFlag: null,
  },
});
console.log("patched profile:", updatedProfile.content?.variables);

// Batch: chain operations against one variable, then execute as one request.
const result = await habbo.variables
  .batch(ROOM_ID, "user", "coins")
  .patch("user:111", "/users/111", 10)
  .patch("user:222", "/users/222", 20)
  .delete("user:333", "/users/333")
  .execute();
console.log(`batch results: ${result.content?.results.length ?? 0}`);
