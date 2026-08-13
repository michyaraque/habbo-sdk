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

Node.js 18 or newer, for the global `fetch`. On older runtimes, pass a `fetch` implementation through the `fetch` option.

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

Wired Variables calls need the keys of the room you are targeting:

```ts
const habbo = new HabboClient({
  hotel: "es",
  readKey: process.env.WIRED_READ_KEY,
  writeKey: process.env.WIRED_WRITE_KEY,
});

// 796 is the room id, 44 the in-room id of the user holding the value.
const score = await habbo.variables.get(796, "user", "score", "users", 44);
await habbo.variables.updateGlobal(796, "jackpot", 1500);
```

Both ESM and CommonJS are supported:

```js
const { HabboClient } = require("habbo-sdk");
```

## Authentication

Only the Wired Variables API is authenticated. It uses two per-room keys, both issued from the room's Wired settings inside the hotel:

| Option     | Header              | Used by                                                        |
| ---------- | ------------------- | -------------------------------------------------------------- |
| `readKey`  | `X-Wired-Read-Key`  | `get`, `list`, `listByKind`, `count`, and profile reads         |
| `writeKey` | `X-Wired-Write-Key` | `set`, `update`, `delete`, `bulkDelete`, and profile patches    |

Batches send both, since one batch can mix reads and writes.

Configure only what you need. A read-only integration never holds a write key:

```ts
const habbo = new HabboClient({ readKey: process.env.WIRED_READ_KEY });
```

When an operation needs a key that is not configured, the call rejects with `HabboAuthError` before any request is sent.

Passing a bare string uses it as both keys:

```ts
const habbo = new HabboClient(process.env.WIRED_KEY);
```

## Configuration

```ts
const habbo = new HabboClient({
  hotel: "es",
  timeout: 15_000,
  maxRetries: 2,
});
```

| Option          | Type        | Default                 | Description                                                       |
| --------------- | ----------- | ----------------------- | ----------------------------------------------------------------- |
| `hotel`         | `Hotel`     | `"es"`                  | `com`, `es`, `com.br`, `de`, `fi`, `fr`, `it`, `nl`, `com.tr`, `sandbox`, `origins` |
| `readKey`       | `string`    | —                       | `X-Wired-Read-Key` for Wired reads                                |
| `writeKey`      | `string`    | —                       | `X-Wired-Write-Key` for Wired writes                              |
| `originsApiKey` | `string`    | —                       | Optional `api_key` for the fishing derby endpoints                |
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
| global   | —                                                  | The room itself        |

Scope and target kind are checked at compile time, so `("user", "wall-items")` does not compile.

Every method takes the room as its first argument, written `796` in the examples below. It is the room's numeric id, the same one shown in the hotel, and it has to be the room the configured keys belong to.

> [!IMPORTANT]
> The numeric id is the only form these endpoints accept. A room's string identifier (`r-hhes-...`) returns `404`, which is easy to mistake for a missing room.

If you already use the public API, that number is the `id` field of a `Room`, not its `uniqueId`:

```ts
const rooms = await habbo.profiles.getRooms("hhes-617d5a...");
console.log(rooms[0]?.id); // 95182103, pass this as roomId
```

> [!IMPORTANT]
> Wired variable values are whole numbers. Strings, booleans, and decimals are rejected with a `TypeError` before the request is sent.

### Listing

`list` returns the configured variable names, grouped by scope:

```ts
const names = await habbo.variables.list(796);
// { users: ["coins", "score"], furni: ["uses_left"], global: ["jackpot"] }
```

### Reading and writing a single value

```ts
const coins = await habbo.variables.get(796, "user", "coins", "users", 44);
console.log(coins.value, coins.update_time);

await habbo.variables.set(796, "user", "coins", "users", 44, 100);    // PUT
await habbo.variables.update(796, "user", "coins", "users", 44, 120); // PATCH
await habbo.variables.delete(796, "user", "coins", "users", 44);
```

Deleting removes that entity's stored value. The variable stays configured in the room.

Room-wide globals have their own pair of methods:

```ts
const jackpot = await habbo.variables.getGlobal(796, "jackpot");
await habbo.variables.updateGlobal(796, "jackpot", jackpot.value + 100);
```

### Leaderboards

`listByKind` reads one variable across every entity of a kind, sorted and paginated:

```ts
const top = await habbo.variables.listByKind(796, "user", "score", "users", {
  orderBy: "value",   // "value" | "creation_time" | "update_time"
  orderDir: "desc",   // "asc" | "desc"
  page: 0,
  size: 10,
});

for (const entry of top.items) {
  console.log(entry.name, entry.value);
}
```

`count` returns how many entities hold a value:

```ts
const players = await habbo.variables.count(796, "user", "score", "users");
```

### Auto-pagination

`iterateByKind` walks every page for you:

```ts
for await (const entry of habbo.variables.iterateByKind(796, "user", "score", "users", {
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
const profile = await habbo.variables.profiles.getUser(796, "users", 44);

console.log(profile.user.name);
console.log(profile.variables.coins?.value);
console.log(profile.variables.level?.value);
```

The return type follows the target kind: `"pets"` yields `profile.pet`, `"bots"` yields `profile.bot`.

When the in-room id is unknown, look the user up by name or unique id:

```ts
const profile = await habbo.variables.profiles.findUser(796, { name: "Cebolla1" });
```

Patching writes several variables at once. `null` deletes a stored value:

```ts
await habbo.variables.profiles.patchUser(796, "users", 44, {
  coins: 75,
  level: 3,
  temporary_flag: null,
});
```

Items and the room itself have the same pair of methods:

```ts
await habbo.variables.profiles.getFurni(796, "wall-items", 5521);
await habbo.variables.profiles.patchFurni(796, "furni", 5521, { uses_left: 2 });

const { variables } = await habbo.variables.profiles.getGlobal(796);
await habbo.variables.profiles.patchGlobal(796, { jackpot: 1200, round: 4 });
```

Global variables cannot be deleted through a patch, so `patchGlobal` does not accept `null`. To clear an entity entirely, use `deleteUser`.

### Batches

A batch acts on one variable across up to 50 entities and can mix reads and writes. Paths take the form `<targetKind>/<entityId>`:

```ts
import { isBatchOperationSuccess } from "habbo-sdk";

const { results } = await habbo.variables
  .batch(796, "user", "score")
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
const { results } = await habbo.variables
  .batch(796, "user", "score")
  .patch("users/44", 10, { opId: "winner" })
  .execute();

const winner = results.find((r) => r.op_id === "winner");
```

An operation can fail without failing the batch, which is why each result carries its own status. Queuing a 51st operation throws `RangeError`.

### Clearing a room

`bulkDelete` clears every stored value of the named variables across the room, leaving the definitions in place:

```ts
await habbo.variables.bulkDelete(796, ["score", "lives"]);
```

### Method reference

| Method                                               | Key   | Description                           |
| ---------------------------------------------------- | ----- | ------------------------------------- |
| `list(roomId)`                                       | read  | Variable names, grouped by scope      |
| `get(roomId, scope, name, kind, entityId)`           | read  | Read one value                        |
| `set(roomId, scope, name, kind, entityId, value)`    | write | Create or replace one value           |
| `update(roomId, scope, name, kind, entityId, value)` | write | Update one value                      |
| `delete(roomId, scope, name, kind, entityId)`        | write | Delete one stored value               |
| `listByKind(roomId, scope, name, kind, options?)`    | read  | One page of values across a kind      |
| `iterateByKind(roomId, scope, name, kind, options?)` | read  | Async iterator over every value       |
| `count(roomId, scope, name, kind)`                   | read  | How many values are stored            |
| `bulkDelete(roomId, names)`                          | write | Clear every value of these variables  |
| `batch(roomId, scope, name)`                         | both  | Start a batch builder                 |
| `getGlobal(roomId, name)`                            | read  | Read a global variable                |
| `updateGlobal(roomId, name, value)`                  | write | Update a global variable              |

| `variables.profiles` method                     | Key   | Description                          |
| ----------------------------------------------- | ----- | ------------------------------------ |
| `findUser(roomId, { name } \| { uniqueId })`    | read  | Resolve a user profile by name or id |
| `getUser(roomId, kind, entityId)`               | read  | All variables of a user, pet, or bot |
| `patchUser(roomId, kind, entityId, variables)`  | write | Write several; `null` deletes        |
| `deleteUser(roomId, kind, entityId)`            | write | Delete the whole profile             |
| `getFurni(roomId, kind, entityId)`              | read  | All variables of an item             |
| `patchFurni(roomId, kind, entityId, variables)` | write | Write several; `null` deletes        |
| `getGlobal(roomId)`                             | read  | All global variables of the room     |
| `patchGlobal(roomId, variables)`                | write | Write several globals                |

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
  await habbo.variables.updateGlobal(796, "jackpot", 10);
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
