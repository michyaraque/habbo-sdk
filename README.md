# habbo-sdk

[![npm version](https://img.shields.io/npm/v/habbo-sdk.svg)](https://www.npmjs.com/package/habbo-sdk)
[![npm downloads](https://img.shields.io/npm/dm/habbo-sdk.svg)](https://www.npmjs.com/package/habbo-sdk)
[![license](https://img.shields.io/npm/l/habbo-sdk.svg)](./LICENSE)

TypeScript client for the public Habbo API, including the Wired Variables API that lets a server read and write the wired variables of a room.

The client exposes three resources:

| Resource    | Covers                                                            | Auth              |
| ----------- | ----------------------------------------------------------------- | ----------------- |
| `profiles`  | Users, profiles, friends, groups, rooms, badges, photos, marketplace | None              |
| `variables` | Wired variables and variable profiles of a room                   | Per-room keys     |
| `origins`   | Habbo Origins matches, fishing derby, skills                      | None              |

## Requirements

Node.js 22 or newer, for the global `fetch`. On older runtimes, pass a `fetch` implementation through the `fetch` option.

## Installation

```sh
pnpm add habbo-sdk
```

## Usage

```ts
import { HabboClient } from "habbo-sdk";

const habbo = new HabboClient({ hotel: "es" });

const user = await habbo.profiles.get("Cebolla1");
console.log(user.uniqueId, user.motto);
```

The Wired Variables API is authenticated per room: its keys are issued from the room's
Wired settings, so they are bound together on a `RoomInstance` and no call repeats
the room id:

```ts
import { HabboClient, RoomInstance } from "habbo-sdk";

import { HabboClient } from "habbo-sdk";

const habbo = new HabboClient({ hotel: "es" }); // hotel & transport: once

const room = habbo.room({
  roomId: 796,
  readKey: process.env.WIRED_READ_KEY,
  writeKey: process.env.WIRED_WRITE_KEY,
});

// 44 is the in-room id of the user holding the value.
const score = await room.variables.get("user", "score", "users", 44);
await room.variables.updateGlobal("jackpot", 1500);
```

A `RoomInstance` is a room bound to its Wired keys; it shares the
`HabboClient`'s hotel and transport, so the hotel is configured exactly
once. One instance per room: several rooms with different keys are several
instances of the same client.

Both ESM and CommonJS are supported:

```js
const { HabboClient } = require("habbo-sdk");
```

## Authentication

Only the Wired Variables API is authenticated, with two keys issued from the
room's Wired settings. They belong to the room, so they live on the
`RoomInstance` that binds them to its `roomId`:

| Option     | Header              | Used by                                                        |
| ---------- | ------------------- | -------------------------------------------------------------- |
| `readKey`  | `X-Wired-Read-Key`  | `get`, `list`, `listByKind`, `count`, and profile reads         |
| `writeKey` | `X-Wired-Write-Key` | `set`, `update`, `delete`, `bulkDelete`, and profile patches    |

Batches send both, since one batch can mix reads and writes.

Configure only what you need. A read-only integration never holds a write key:

```ts
const habbo = new HabboClient({ hotel: "es" });
const room = habbo.room({ roomId: 796, readKey: process.env.WIRED_READ_KEY });
```

When an operation needs a key the instance does not have, the call rejects with
`HabboAuthError` before any request is sent.

## Configuration

`HabboClient` (public API) and `RoomInstance` (one wired room) share the same
transport options; `RoomInstance` adds the room id and its keys.

```ts
const habbo = new HabboClient({ hotel: "es", timeout: 15_000, maxRetries: 2 });

const room = habbo.room({
  roomId: 796,
  readKey: process.env.WIRED_READ_KEY,
  writeKey: process.env.WIRED_WRITE_KEY,
});
```

| Option          | Type        | Default                 | Description                                                       |
| --------------- | ----------- | ----------------------- | ----------------------------------------------------------------- |
| `hotel`         | `Hotel`     | `"es"`                  | `com`, `es`, `com.br`, `de`, `fi`, `fr`, `it`, `nl`, `com.tr`, `sandbox`, `origins` |
| `roomId`        | `number` \| `string` | required (`habbo.room`) | The room whose wired variables the instance manages        |
| `readKey`       | `string`    | -                       | `X-Wired-Read-Key` for Wired reads                                |
| `writeKey`      | `string`    | -                       | `X-Wired-Write-Key` for Wired writes                              |
| `originsApiKey` | `string`    | -                       | Optional `api_key` for the fishing derby endpoints (HabboClient only) |
| `publicBaseUrl` | `string`    | derived from `hotel`    | Overrides the API host                                            |
| `wiredBaseUrl`  | `string`    | same as `publicBaseUrl` | Overrides the host serving the Wired endpoints                    |
| `fetch`         | `FetchLike` | global `fetch`          | Custom fetch implementation                                       |
| `timeout`       | `number`    | `15000`                 | Per-request timeout in ms. `0` disables it                        |
| `maxRetries`    | `number`    | `2`                     | Retries on network errors, `429`, and `5xx`. `0` disables retries |
| `userAgent`     | `string`    | `habbo-sdk/<version>`   | Value of the `User-Agent` header                                  |

## Wired Variables

A wired variable is a counter attached to something in a room. Its scope says what kind of thing owns it, and its target kind says exactly which:

| Scope    | Target kinds                                       | Owner                  |
| -------- | -------------------------------------------------- | ---------------------- |
| `user`   | `users`, `pets`, `bots`                            | A person, pet, or bot  |
| `furni`  | `furni`, `furni-bc`, `wall-items`, `wall-items-bc` | An item in the room    |
| global   | -                                                  | The room itself        |

Scope and target kind are checked at compile time, so `("user", "wall-items")` does not compile.

The examples below use the room bound on the `RoomInstance`, written as
`room`. Its `roomId` is the numeric room id shown in the hotel, the same
room the configured keys belong to.

> [!IMPORTANT]
> The numeric id is the only form these endpoints accept. A room's string identifier (`r-hhes-...`) returns `404`, which is easy to mistake for a missing room.

If you already use the public API, that number is the `id` field of a `Room`, not its `uniqueId`:

```ts
const rooms = await habbo.profiles.getRooms("hhes-617d5a...");
const room = habbo.room({ roomId: rooms[0]!.id, readKey, writeKey });
```

> [!IMPORTANT]
> Wired variable values are whole numbers. Strings, booleans, and decimals are rejected with a `TypeError` before the request is sent.

### Listing

`list` returns the configured variable names, grouped by scope:

```ts
const names = await room.variables.list();
// { users: ["coins", "score"], furni: ["uses_left"], global: ["jackpot"] }
```

### Reading and writing a single value

```ts
const coins = await room.variables.get("user", "coins", "users", 44);
console.log(coins.value, coins.update_time);

await room.variables.set("user", "coins", "users", 44, 100);    // PUT
await room.variables.update("user", "coins", "users", 44, 120); // PATCH
await room.variables.delete("user", "coins", "users", 44);
```

Deleting removes that entity's stored value. The variable stays configured in the room.

Room-wide globals have their own pair of methods:

```ts
const jackpot = await room.variables.getGlobal("jackpot");
await room.variables.updateGlobal("jackpot", jackpot.value + 100);
```

### Leaderboards

`listByKind` reads one variable across every entity of a kind, sorted and paginated:

```ts
const top = await room.variables.listByKind("user", "score", "users", {
  orderBy: "value",   // "value" | "creation_time" | "update_time"
  orderDir: "desc",   // "asc" | "desc"
  page: 1,          // pages start at 1
  size: 10,
});

for (const entry of top.items) {
  console.log(entry.name, entry.value);
}
```

`count` returns how many entities hold a value:

```ts
const players = await room.variables.count("user", "score", "users");
```

### Auto-pagination

`iterateByKind` walks every page for you:

```ts
for await (const entry of room.variables.iterateByKind("user", "score", "users", {
  orderBy: "value",
  orderDir: "desc",
})) {
  console.log(entry.name, entry.value);
}
```

`origins.iterateMatchIds` and `origins.iterateSkillLeaderboard` work the same way.

### Variable profiles

A profile is every variable of one entity, fetched in a single request. Prefer it over several single reads:

```ts
const profile = await room.variables.profiles.getUser("users", 44);

console.log(profile.user.name);
console.log(profile.variables.coins?.value);
console.log(profile.variables.level?.value);
```

The return type follows the target kind: `"pets"` yields `profile.pet`, `"bots"` yields `profile.bot`.

When the in-room id is unknown, look the user up by name or unique id:

```ts
const profile = await room.variables.profiles.findUser({ name: "Cebolla1" });
```

Patching writes several variables at once. `null` deletes a stored value:

```ts
await room.variables.profiles.patchUser("users", 44, {
  coins: 75,
  level: 3,
  temporary_flag: null,
});
```

Items and the room itself have the same pair of methods:

```ts
await room.variables.profiles.getFurni("wall-items", 5521);
await room.variables.profiles.patchFurni("furni", 5521, { uses_left: 2 });

const { variables } = await room.variables.profiles.getGlobal(796);
await room.variables.profiles.patchGlobal({ jackpot: 1200, round: 4 });
```

Global variables cannot be deleted through a patch, so `patchGlobal` does not accept `null`. To clear an entity entirely, use `deleteUser`.

### Batches

A batch acts on one variable across up to 50 entities and can mix reads and writes. Paths take the form `<targetKind>/<entityId>`:

```ts
import { isBatchOperationSuccess } from "habbo-sdk";

const { results } = await room.variables
  .batch("user", "score")
  .patch("users/44", 10)
  .patch("users/45", 7)
  .delete("users/46")
  .get("users/47")
  .execute();

for (const result of results) {
  if (isBatchOperationSuccess(result)) {
    console.log(result.status); // 200 with a body, or 204
  } else {
    console.error(result.error.code);
  }
}
```

Results come back in the order the operations were queued. Pass an `opId` to correlate them with your own records instead:

```ts
const { results } = await room.variables
  .batch("user", "score")
  .patch("users/44", 10, { opId: "winner" })
  .execute();

const winner = results.find((r) => r.op_id === "winner");
```

An operation can fail without failing the batch, which is why each result carries its own status. Queuing a 51st operation throws `RangeError`.

### Clearing a room

`bulkDelete` clears every stored value of the named variables across the room, leaving the definitions in place:

```ts
await room.variables.bulkDelete(["score", "lives"]);
```

### Rate limits

All Wired Variables limits are **per room**, measured over a 10-second burst
window and a 60-second sustained window:

| Call class                                              | Per minute | Burst (10 s) |
| ------------------------------------------------------- | ---------- | ------------ |
| Simple reads: `get`, `getGlobal`                     | 300        | 60           |
| List endpoints: `list`, `listByKind`, `count`         | 120        | 20           |
| Profile reads: `profiles.findUser`, `profiles.get*`    | 120        | 20           |
| Writes: `set`, `update`, `delete`, `profiles.patch*`, `profiles.deleteUser` | 120 | 30 |
| Bulk deletes: `bulkDelete`                            | 10         | 5            |
| Batch requests: `batch(...).execute()`                | 30         | -            |

A batch holds at most 50 operations, and batched writes draw from an
additional budget of 500 write operations per minute. The SDK clamps every
page `size` to the API maximum of 100 and pages iterators at that size, so a
`size` above 100 never wastes a request.

Paginated lists default to page 1 with 50 entries, and the `/count` endpoint
answers from a server-side cache that grows with the count (about 20 seconds
below 1,000 stored values, up to about 10 minutes at 100,000 or more). Treat
counts as approximate and poll them sparingly.

When a request does hit a limit, the server answers `429`; the SDK retries up
to `maxRetries` times honouring `Retry-After`, then throws
`HabboRateLimitError`. Staying inside the limits is the caller's job: batch
operations on the same variable, prefer whole-profile reads over per-variable
reads, and cache leaderboards and counts for frequently accessed rooms.

### Method reference

| Method                                               | Key   | Description                           |
| ---------------------------------------------------- | ----- | ------------------------------------- |
| `list()`                                       | read  | Variable names, grouped by scope      |
| `get(scope, name, kind, entityId)`           | read  | Read one value                        |
| `set(scope, name, kind, entityId, value)`    | write | Create or replace one value           |
| `update(scope, name, kind, entityId, value)` | write | Update one value                      |
| `delete(scope, name, kind, entityId)`        | write | Delete one stored value               |
| `listByKind(scope, name, kind, options?)`    | read  | One page of values across a kind      |
| `iterateByKind(scope, name, kind, options?)` | read  | Async iterator over every value       |
| `count(scope, name, kind)`                   | read  | How many values are stored            |
| `bulkDelete(names)`                          | write | Clear every value of these variables  |
| `batch(scope, name)`                         | both  | Start a batch builder                 |
| `getGlobal(name)`                            | read  | Read a global variable                |
| `updateGlobal(name, value)`                  | write | Update a global variable              |

| `variables.profiles` method                     | Key   | Description                          |
| ----------------------------------------------- | ----- | ------------------------------------ |
| `findUser({ name } \| { uniqueId })`    | read  | Resolve a user profile by name or id |
| `getUser(kind, entityId)`               | read  | All variables of a user, pet, or bot |
| `patchUser(kind, entityId, variables)`  | write | Write several; `null` deletes        |
| `deleteUser(kind, entityId)`            | write | Delete the whole profile             |
| `getFurni(kind, entityId)`              | read  | All variables of an item             |
| `patchFurni(kind, entityId, variables)` | write | Write several; `null` deletes        |
| `getGlobal()`                             | read  | All global variables of the room     |
| `patchGlobal(variables)`                | write | Write several globals                |

## Public API

```ts
const user = await habbo.profiles.get("Cebolla1");
const profile = await habbo.profiles.getProfile(user.uniqueId);

console.log(profile.user.name, profile.friends.length, profile.rooms.length);
```

| Method                       | Description                                        |
| ---------------------------- | -------------------------------------------------- |
| `get(name)`                  | Look up a user by name                             |
| `getById(uniqueId)`          | Fetch a user by unique id                          |
| `getProfile(uniqueId)`       | User, friends, groups, rooms, and badges in one call |
| `getBadges(uniqueId)`        | A user's badges                                    |
| `getFriends(uniqueId)`       | A user's public friends                            |
| `getGroups(uniqueId)`        | The groups a user belongs to                       |
| `getRooms(uniqueId)`         | A user's public rooms                              |
| `getPhotos(uniqueId?)`       | A user's photos, or the hotel's latest             |
| `getAchievements(uniqueId)`  | A user's achievements and progress                 |
| `getAllAchievements()`       | Every achievement the hotel defines                |
| `getBadgeOwners(badgeCode)`  | How many users own a badge                         |
| `getRoom(roomId)`            | A room by id                                       |
| `getGroup(groupId)`          | A group by id                                      |
| `getGroupMembers(groupId)`   | A group's members                                  |
| `getMarketplaceStats(query)` | Marketplace stats for floor and wall items         |
| `getHotLooks()`              | Popular avatar looks, as a raw XML string          |
| `ping()`                     | Hotel health check                                 |

`getProfile` nests the user under `user`, alongside the collections. Group members carry their avatar in `habboFigure` rather than `figureString`.

Marketplace stats take floor and wall items separately:

```ts
const stats = await habbo.profiles.getMarketplaceStats({
  roomItems: [{ item: "throne" }],
  wallItems: [{ item: "rare_dragonlamp" }],
});

console.log(stats.roomItemData[0]?.currentPrice);
```

> [!NOTE]
> `getPhotos` calls `/extradata`, which is not part of the documented API. Its response may change without notice.

## Habbo Origins

> [!IMPORTANT]
> These endpoints are served by the Habbo Origins hotel. The client needs `hotel: "origins"`; other hotels return `404`.

```ts
const habbo = new HabboClient({ hotel: "origins" });

const skill = await habbo.origins.getSkill("hhous-066a72...", "FISHING");
console.log(skill.level, skill.experience);

const { status, derby } = await habbo.origins.getDerbyStatus();
if (derby) {
  const ranking = [...derby.info.participants].sort((a, b) => b.fishCaught - a.fishCaught);
  console.log(status, ranking[0]?.accountId, ranking[0]?.fishCaught);
}
```

| Method                                    | Description                                |
| ----------------------------------------- | ------------------------------------------ |
| `getHabboIds(uniquePlayerId)`             | Player id to Habbo unique ids              |
| `listMatchIds(uniquePlayerId, query?)`    | One page of match ids                      |
| `iterateMatchIds(uniquePlayerId, query?)` | Async iterator over every match id         |
| `getMatch(uniqueMatchId)`                 | Full match record with per-player stats    |
| `listDerbyIds(uniquePlayerId, query?)`    | One page of fishing derby ids              |
| `getDerby(uniqueDerbyId)`                 | One fishing derby and its standings        |
| `getDerbyStatus()`                        | The derby currently running, if any        |
| `getSkill(uniquePlayerId, skillType?)`    | A player's level and experience in a skill |
| `getSkillLeaderboard(skillType?, page?)`  | One page of a skill leaderboard            |
| `iterateSkillLeaderboard(skillType?)`     | Async iterator over the whole leaderboard  |

The derby endpoints accept an optional API key, configured once as `originsApiKey`.

## Utilities

`LevelUpper` turns an XP amount into a level and its progress, mirroring the
math of the room's level-up add-on. It works with `bigint` throughout, so it
is safe to feed it values read straight from wired variables. Three profiles
are available:

| Factory | Shape |
| --- | --- |
| `LevelUpper.linear(stepSize, maxLevel)` | Every level costs the same XP |
| `LevelUpper.interpolate({ level: xp })` | Give the XP at which some known levels start; the rest are spread evenly between them |
| `LevelUpper.exponential(initialXp, strength, maxLevel)` | Each level costs more than the last; `strength` is a percentage |
| `LevelUpper.steps([100n, 150n, 250n])` | Define the exact XP each level transition requires, one entry per jump |

The add-on stacks on any variable (per user, per furni, or global), so read
the value from whichever variable stores the XP. Per player it is usually a
user-scoped variable on the player's `RoomInstance` (`room` below):

```ts
import { LevelUpper } from "habbo-sdk";

const levels = LevelUpper.linear(100n, 50n); // 100 XP per level, capped at level 50

// XP earned by the player with in-room id 44.
const { value: xp } = await room.variables.get("user", "player_xp", "users", 44);

console.log(
  levels.currentLevel(xp),       // the level as a bigint
  levels.progressPercentage(xp), // 0..100
  levels.xpRemaining(xp),        // XP left until the next level
  levels.isMaxed(xp),
);
```

Every instance implements `LevelUpperConfig`: `currentLevel`, `totalXpRequired`,
`progress`, `progressPercentage`, `xpRemaining`, `isMaxed`, `maxLevel`, `maxXp`,
and `boundedValue` (which clamps negative or over-max XP before any calculation).

## Handling errors

Every failure is a `HabboError`. Narrow to a subclass to react to a specific case:

```ts
import { HabboNotFoundError, HabboRateLimitError } from "habbo-sdk";

try {
  await habbo.profiles.get("does-not-exist");
} catch (error) {
  if (error instanceof HabboNotFoundError) {
    // no such user
  } else if (error instanceof HabboRateLimitError) {
    console.log(`retry in ${error.retryAfter}s`);
  } else {
    throw error;
  }
}
```

| Class                 | Raised when                                                   |
| --------------------- | ------------------------------------------------------------- |
| `HabboError`          | Base class. Carries `status` and the raw `body`               |
| `HabboNotFoundError`  | `404`, the room, user, or variable does not exist             |
| `UserInvalidError`    | The user name was rejected as invalid                         |
| `MaintenanceError`    | The hotel is under maintenance                                |
| `HabboAuthError`      | `401`/`403`, or a Wired call missing the key it needs         |
| `HabboRateLimitError` | `429`. Exposes `retryAfter` in seconds when the server sends it |
| `HabboNetworkError`   | Transport failure or timeout                                  |

`TypeError` means a wired value was not a whole number. `RangeError` means a batch was empty or over the 50-operation limit. Both are raised before any request is sent.

The Wired Variables API returns a machine-readable code in the response body. Several distinct failures share HTTP `403`, so read the code to tell them apart:

```ts
import { HabboAuthError, type WiredErrorBody } from "habbo-sdk";

try {
  await room.variables.updateGlobal("jackpot", 10);
} catch (error) {
  if (error instanceof HabboAuthError) {
    const code = (error.body as WiredErrorBody | undefined)?.error;
    if (code === "wired.variables.api_disabled") {
      // the room owner has to switch the API on
    }
  }
}
```

See `WiredErrorCode` for the full list of codes and their meanings.

### Retries

Network errors, `429`, and `5xx` responses are retried with exponential backoff, honouring `Retry-After` when the server sends it. Configure with `maxRetries`, or set it to `0` to disable:

```ts
const habbo = new HabboClient({ maxRetries: 0 });
```

## Development

```sh
pnpm install
pnpm build      # ESM, CJS, and .d.ts into dist/
pnpm typecheck
pnpm test
pnpm docs       # API reference into docs/
```

Runnable examples live in [`examples/`](./examples):

```sh
pnpm example:profiles
pnpm example:variables
pnpm example:origins
```

## License

[MIT](./LICENSE)