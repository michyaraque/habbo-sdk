# habbo-sdk

A TypeScript SDK that wraps two distinct Habbo contracts behind a single client:

- **`profiles`** - the public, unauthenticated [Habbo API](https://www.habbo.es/api/public/api-docs/) for reading users, profiles, friends, groups, rooms, badges, photos, and achievements.
- **`variables`** - the authenticated **Wired Variables API** for reading and writing room variables and variable profiles.

The two contracts are intentionally separate: they use different hosts and different authentication models. A single `HabboClient` exposes both.

## Installation

```bash
pnpm add habbo-sdk
```

Requires Node.js 18 or newer (for the global `fetch`). On older runtimes, pass a custom `fetch` implementation through the configuration.

## Quick start

```ts
import { HabboClient } from "habbo-sdk";

const habbo = new HabboClient({
  hotel: "es",
  writeKey: process.env.WIRED_WRITE_KEY,
});

// Public API - no authentication required.
const user = await habbo.profiles.get("Cebolla1");
const profile = await habbo.profiles.getProfile(user.uniqueId);

// Wired Variables API - authenticated with the write key.
const variables = await habbo.variables.list("796");
await habbo.variables.updateGlobal("796", "scoreboard", 10);
await habbo.variables.profiles.patchUser("796", "u_gold", "12345", { coins: 50 });
```

Passing a bare string is shorthand for `{ writeKey }`:

```ts
const habbo = new HabboClient(process.env.WIRED_WRITE_KEY!);
```

## Configuration

| Option          | Type                | Default              | Description                                                                                 |
| --------------- | ------------------- | -------------------- | ------------------------------------------------------------------------------------------- |
| `writeKey`      | `string`            | -                    | The `X-Wired-Write-Key` for the Wired Variables API. Required for any `variables` call.     |
| `hotel`         | `Hotel`             | `"es"`               | Hotel domain for both APIs (`com`, `es`, `com.br`, `de`, `fi`, `fr`, `it`, `nl`, `com.tr`, `sandbox`). |
| `wiredBaseUrl`  | `string`            | `https://www.habbo.<hotel>/server/v1` | Overrides the Wired server base URL (testing or proxies).                  |
| `publicBaseUrl` | `string`            | `https://www.habbo.<hotel>` | Overrides the public API host (testing or proxies).                                 |
| `fetch`         | `FetchLike`         | global `fetch`       | Custom fetch implementation.                                                                 |
| `timeout`       | `number`            | `15000`              | Per-request timeout in milliseconds. `0` disables it.                                        |
| `maxRetries`    | `number`            | `2`                  | Retries for transient failures (network errors, `429`, `5xx`). `0` disables retries.        |
| `userAgent`     | `string`            | `habbo-sdk/<version>`| Value of the `User-Agent` header.                                                           |

## `profiles` - public Habbo API

| Method                                | Description                                            |
| ------------------------------------- | ------------------------------------------------------ |
| `get(name)`                           | Look up a user by name.                                 |
| `getById(uniqueId)`                   | Fetch a user by unique id.                              |
| `getProfile(uniqueId)`                | Aggregated profile (friends, groups, rooms, badges).   |
| `getBadges(uniqueId)`                 | A user's badges.                                        |
| `getFriends(uniqueId)`                | A user's public friends.                               |
| `getGroups(uniqueId)`                 | The groups a user belongs to.                          |
| `getRooms(uniqueId)`                  | A user's public rooms.                                 |
| `getPhotos(uniqueId?)`                | A user's photos, or the hotel's latest photos.         |
| `getAchievements(uniqueId)`           | A user's achievements.                                  |
| `getGroup(groupId)`                   | A group by id.                                          |
| `getGroupMembers(groupId)`            | A group's members.                                      |

## `variables` - Wired Variables API

All wired methods are authenticated with the configured `X-Wired-Write-Key`.

| Method                                                                   | HTTP   | Description                                  |
| ------------------------------------------------------------------------ | ------ | -------------------------------------------- |
| `list(roomId)`                                                           | GET    | List all wired variables in a room.          |
| `get(roomId, scope, name, targetKind, entityId)`                        | GET    | Read a single user/furni variable.           |
| `set(roomId, scope, name, targetKind, entityId, value)`                 | PUT    | Set a single user/furni variable.            |
| `update(roomId, scope, name, targetKind, entityId, value)`              | PATCH  | Update a single user/furni variable.         |
| `delete(roomId, scope, name, targetKind, entityId)`                     | DELETE | Delete a single user/furni variable.         |
| `listByKind(roomId, scope, name, targetKind)`                           | GET    | List variable values for a target kind.      |
| `count(roomId, scope, name, targetKind)`                                | GET    | Count variable values for a target kind.     |
| `bulkDelete(roomId, names)`                                             | POST   | Delete multiple variables by name.           |
| `batch(roomId, scope, name)`                                            | POST   | Begin a batch (returns a fluent builder).    |
| `getGlobal(roomId, name)`                                               | GET    | Read a global room variable.                 |
| `updateGlobal(roomId, name, value)`                                     | PATCH  | Update a global room variable.               |

### Batches

`batch()` returns a fluent `BatchBuilder` instead of taking a raw array. Chain
`set`, `update`, and `delete`, then call `execute()` to send them in a single
request:

```ts
const result = await habbo.variables
  .batch("796", "user", "coins")
  .set("user", "111", 10)
  .set("user", "222", 20)
  .delete("user", "333")
  .execute();

console.log(result.applied);
```

The builder also exposes `add(...operations)` to append pre-built
`BatchOperation` values, `size` for the queued count, and `toOperations()` to
inspect the queue without sending it.

### `variables.profiles` - variable profiles

| Method                                                       | HTTP   | Description                                      |
| ------------------------------------------------------------ | ------ | ------------------------------------------------ |
| `getUserByLookup(roomId, { name } \| { uniqueId })`         | GET    | Resolve a user profile by name or unique id.     |
| `getUser(roomId, targetKind, entityId)`                     | GET    | Read a user/pet/bot variables profile.           |
| `patchUser(roomId, targetKind, entityId, patch)`            | PATCH  | Patch a user/pet/bot variables profile.          |
| `deleteUser(roomId, targetKind, entityId)`                  | DELETE | Delete a user/pet/bot variables profile.         |
| `getFurni(roomId, targetKind, entityId)`                    | GET    | Read a furni variables profile.                  |
| `patchFurni(roomId, targetKind, entityId, patch)`          | PATCH  | Patch a furni variables profile.                 |
| `getGlobal(roomId)`                                         | GET    | Read the global variables profile.               |
| `patchGlobal(roomId, patch)`                               | PATCH  | Patch the global variables profile.              |

In a profile patch, set a key to `null` to remove the corresponding variable.

## Error handling

Every failure is an instance of `HabboError`. Narrow to a subclass for specific handling:

```ts
import { HabboNotFoundError, HabboAuthError, HabboRateLimitError } from "habbo-sdk";

try {
  await habbo.profiles.get("does-not-exist");
} catch (error) {
  if (error instanceof HabboNotFoundError) {
    // 404 - no such user
  }
}
```

| Class                  | When                                                        |
| ---------------------- | ----------------------------------------------------------- |
| `HabboError`           | Base class for every SDK error.                             |
| `HabboNotFoundError`   | `404` - the resource does not exist.                        |
| `UserInvalidError`     | The supplied user name was rejected as invalid.             |
| `MaintenanceError`     | The hotel API is down for maintenance.                      |
| `HabboAuthError`       | `401`/`403` - missing or invalid write key.                 |
| `HabboRateLimitError`  | `429` - exposes `retryAfter` when provided.                 |
| `HabboNetworkError`    | Transport-level failure or timeout.                         |

Transient failures (network errors, `429`, `5xx`) are retried automatically with exponential backoff, up to `maxRetries`.

## Build

```bash
pnpm install
pnpm build      # bundles ESM, CJS, and type declarations into dist/
pnpm typecheck
```

## License

MIT
