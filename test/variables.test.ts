/**
 * Contract checks for the Wired Variables resource, run against a stub `fetch`.
 *
 * They assert what the SDK puts on the wire — URL, method, headers, body — and
 * the guards that reject invalid input before a request is made.
 *
 * Run with `pnpm test`.
 */

import assert from "node:assert/strict";
import {
  FURNI_ID_WRAP,
  HabboAuthError,
  HabboClient,
  fromApiFurniId,
  isBatchOperationSuccess,
  sanitizeFurniId,
  toApiFurniId,
} from "../src/index.js";
import type { FetchLike } from "../src/http.js";

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  rawBody: string;
}

const calls: Call[] = [];
let nextBody = "{}";

const stubFetch: FetchLike = (url, init = {}) => {
  calls.push({
    url,
    method: init.method ?? "GET",
    headers: init.headers ?? {},
    body: init.body !== undefined ? JSON.parse(init.body) : undefined,
    rawBody: init.body ?? "",
  });
  return Promise.resolve({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: () => Promise.resolve(nextBody),
  });
};

function client(keys: { readKey?: string; writeKey?: string } = {}) {
  calls.length = 0;
  nextBody = "{}";
  return new HabboClient({ hotel: "sandbox", fetch: stubFetch, ...keys });
}

function lastCall(): Call {
  const call = calls[calls.length - 1];
  assert.ok(call, "expected a request to have been made");
  return call;
}

async function testReadUsesReadKeyAndCorrectPath() {
  const habbo = client({ readKey: "r", writeKey: "w" });
  await habbo.variables.get(796, "user", "coins", "users", 44);

  const call = lastCall();
  assert.equal(
    call.url,
    "https://sandbox.habbo.com/api/public/rooms/796/variables/user/coins/users/44",
  );
  assert.equal(call.method, "GET");
  assert.equal(call.headers["X-Wired-Read-Key"], "r");
  assert.equal(call.headers["X-Wired-Write-Key"], undefined, "reads must not leak the write key");
}

async function testWriteUsesWriteKey() {
  const habbo = client({ readKey: "r", writeKey: "w" });
  await habbo.variables.set(796, "furni", "uses", "wall-items", 5521, 7);

  const call = lastCall();
  assert.equal(
    call.url,
    "https://sandbox.habbo.com/api/public/rooms/796/variables/furni/uses/wall-items/5521",
  );
  assert.equal(call.method, "PUT");
  assert.equal(call.headers["X-Wired-Write-Key"], "w");
  assert.equal(call.headers["X-Wired-Read-Key"], undefined);
  assert.deepEqual(call.body, { value: 7 });
}

async function testSanitizeFurniId() {
  assert.equal(sanitizeFurniId(5521), 5521);
  assert.equal(sanitizeFurniId(-5521), 5521);
  assert.equal(sanitizeFurniId(2147483647), 2147483647 - FURNI_ID_WRAP);
  assert.equal(sanitizeFurniId(FURNI_ID_WRAP), 0);
  assert.equal(sanitizeFurniId("-5521"), 5521);
}

async function testFurniIdIsSanitizedInProfileUrl() {
  const habbo = client({ readKey: "r" });
  await habbo.variables.profiles.getFurni(796, "furni", -5521);

  const call = lastCall();
  assert.equal(
    call.url,
    "https://sandbox.habbo.com/api/public/rooms/796/variables_profile/furni/furni/5521",
  );
}

async function testFurniIdWrapsInScopedUrl() {
  const habbo = client({ writeKey: "w" });
  await habbo.variables.set(796, "furni", "uses", "furni", 2147483647, 7);

  const call = lastCall();
  assert.equal(
    call.url,
    "https://sandbox.habbo.com/api/public/rooms/796/variables/furni/uses/furni/65535",
  );
}

async function testUserScopeDoesNotSanitizeEntityId() {
  const habbo = client({ readKey: "r" });
  await habbo.variables.get(796, "user", "coins", "users", -44);

  const call = lastCall();
  assert.equal(
    call.url,
    "https://sandbox.habbo.com/api/public/rooms/796/variables/user/coins/users/-44",
  );
}

async function testBatchSendsBothKeysAndSpecShape() {
  const habbo = client({ readKey: "r", writeKey: "w" });
  nextBody = JSON.stringify({
    results: [
      { op_id: "a", status: 200, body: { value: 7, creation_time: "t", update_time: "t" } },
      { op_id: "b", status: 400, error: { code: "wired.variables.invalid_target", message: "x" } },
    ],
  });

  const { results } = await habbo.variables
    .batch(796, "user", "score")
    .patch("users/44", 10, { opId: "a" })
    .delete("pets/12")
    .execute();

  const call = lastCall();
  assert.equal(call.url, "https://sandbox.habbo.com/api/public/rooms/796/variables/user/score/batch");
  assert.equal(call.headers["X-Wired-Read-Key"], "r");
  assert.equal(call.headers["X-Wired-Write-Key"], "w");
  assert.deepEqual(call.body, {
    requests: [
      { method: "PATCH", path: "users/44", body: { value: 10 }, op_id: "a" },
      { method: "DELETE", path: "pets/12" },
    ],
  });

  assert.equal(isBatchOperationSuccess(results[0]!), true);
  assert.equal(isBatchOperationSuccess(results[1]!), false);
}

async function testListByKindMapsQueryParams() {
  const habbo = client({ readKey: "r" });
  await habbo.variables.listByKind(796, "user", "score", "users", {
    orderBy: "value",
    orderDir: "desc",
    size: 10,
  });

  const call = lastCall();
  assert.ok(call.url.includes("order_by=value"), call.url);
  assert.ok(call.url.includes("order_dir=desc"), call.url);
  assert.ok(call.url.includes("size=10"), call.url);
  assert.ok(!call.url.includes("page="), "unset options must be omitted");
}

async function testIterateByKindStopsOnShortPage() {
  const habbo = client({ readKey: "r" });
  let page = 0;
  const paged: FetchLike = (url, init) => {
    const items = page === 0 ? [{ value: 1 }, { value: 2 }] : [{ value: 3 }];
    page += 1;
    nextBody = JSON.stringify({ items, page, size: 2 });
    return stubFetch(url, init);
  };
  const iterating = new HabboClient({ hotel: "sandbox", fetch: paged, readKey: "r" });

  const seen: unknown[] = [];
  for await (const item of iterating.variables.iterateByKind(796, "user", "s", "users", {
    size: 2,
  })) {
    seen.push(item);
  }

  assert.equal(seen.length, 3, "should drain both pages then stop on the short one");
  assert.equal(page, 2, "should not request a page after a short one");
}

async function testProfilePatchAllowsNullToDelete() {
  const habbo = client({ writeKey: "w" });
  await habbo.variables.profiles.patchUser(796, "users", 44, { coins: 50, tmp: null });

  const call = lastCall();
  assert.equal(
    call.url,
    "https://sandbox.habbo.com/api/public/rooms/796/variables_profile/user/users/44",
  );
  assert.equal(call.method, "PATCH");
  assert.deepEqual(call.body, { variables: { coins: 50, tmp: null } });
}

async function testMissingKeyFailsBeforeRequest() {
  const habbo = client({ readKey: "r" });
  await assert.rejects(
    () => habbo.variables.updateGlobal(796, "jackpot", 1),
    HabboAuthError,
    "a write without a write key must throw",
  );
  assert.equal(calls.length, 0, "no request should reach the network");
}

async function testNonIntegerValuesRejected() {
  const habbo = client({ writeKey: "w" });
  await assert.rejects(() => habbo.variables.updateGlobal(796, "j", 1.5), TypeError);
  assert.throws(
    () => habbo.variables.batch(796, "user", "s").patch("users/1", Number.NaN),
    TypeError,
  );
  assert.equal(calls.length, 0);
}

async function testBatchLimits() {
  const habbo = client({ readKey: "r", writeKey: "w" });
  const builder = habbo.variables.batch(796, "user", "s");
  assert.throws(() => builder.execute(), RangeError, "an empty batch must be rejected");

  for (let i = 0; i < 50; i += 1) {
    builder.get(`users/${i}`);
  }
  assert.throws(() => builder.get("users/51"), RangeError, "the 51st operation must be rejected");
}


async function testBigintValuesSerializeExactly() {
  const habbo = client({ writeKey: "w" });
  await habbo.variables.updateGlobal(796, "jackpot", 2n ** 63n - 1n);
  await habbo.variables.set(796, "user", "balance", "users", 44, -(2n ** 63n));

  const call = lastCall();
  assert.ok(call.rawBody.includes('"value":-9223372036854775808'), call.rawBody);
  assert.ok(!call.rawBody.includes("__HABBO"), "no placeholder may leak onto the wire");
}

async function testSmallValuesSerializeAsPlainNumbers() {
  const habbo = client({ writeKey: "w" });
  await habbo.variables.updateGlobal(796, "jackpot", 1500);
  assert.equal(lastCall().rawBody, '{"value":1500}');
}

async function testLargeResponseValuesParseAsBigint() {
  const habbo = client({ readKey: "r" });
  nextBody =
    '{"value":9007199254740993,"creation_time":"2026-09-01T19:26:09.664Z","update_time":"2026-09-01T19:26:09.664Z"}';
  const variable = await habbo.variables.getGlobal(796, "big");
  assert.equal(variable.value, 9007199254740993n);
  assert.equal(typeof variable.value, "bigint");

  nextBody = '{"value":123,"creation_time":"t","update_time":"t"}';
  const small = await habbo.variables.getGlobal(796, "small");
  assert.equal(small.value, 123);
  assert.equal(typeof small.value, "number");
}

async function testNestedBigintsAndDigitStringsSurviveParsing() {
  const habbo = client({ readKey: "r" });
  nextBody =
    '{"user":{"id":44,"name":"Cebolla1"},"variables":{"coins":{"value":9223372036854775807,"creation_time":"t","update_time":"t"},"note":{"value":1,"creation_time":"t","update_time":"t"}}}';
  const profile = await habbo.variables.profiles.getUser(796, "users", 44);
  assert.equal(profile.variables["coins"]!.value, 9223372036854775807n);
  assert.equal(profile.variables["note"]!.value, 1);

  nextBody = '{"users":["9223372036854775807","ok"],"furni":[],"global":[]}';
  const names = await habbo.variables.list(796);
  assert.equal(names.users[0], "9223372036854775807");
}

async function testBigintValidation() {
  const habbo = client({ writeKey: "w" });
  await assert.rejects(
    () => habbo.variables.updateGlobal(796, "j", 2n ** 63n),
    TypeError,
    "values past the int64 maximum must be rejected",
  );
  await assert.rejects(
    () => habbo.variables.updateGlobal(796, "j", -(2n ** 63n) - 1n),
    TypeError,
    "values past the int64 minimum must be rejected",
  );
  assert.equal(calls.length, 0, "no request may reach the network");

  await habbo.variables.updateGlobal(796, "j", 2n ** 63n - 1n);
  assert.equal(calls.length, 1);
}

async function testFurniIdConversionBothWays() {
  assert.deepEqual(toApiFurniId(5521), { kind: "furni", id: 5521 });
  assert.deepEqual(toApiFurniId(-5521), { kind: "wall-items", id: 5521 });
  assert.deepEqual(toApiFurniId(2147483647), { kind: "furni-bc", id: 65535 });
  assert.deepEqual(toApiFurniId(-2147483647), { kind: "wall-items-bc", id: 65535 });
  assert.equal(toApiFurniId(FURNI_ID_WRAP).kind, "furni-bc");
  assert.equal(toApiFurniId(FURNI_ID_WRAP).id, 0);
  assert.equal(toApiFurniId("-5521").kind, "wall-items");

  assert.equal(fromApiFurniId({ kind: "furni", id: 5521 }), 5521);
  assert.equal(fromApiFurniId({ kind: "wall-items", id: 5521 }), -5521);
  assert.equal(fromApiFurniId({ kind: "furni-bc", id: 65535 }), 2147483647);
  assert.equal(fromApiFurniId({ kind: "wall-items-bc", id: 65535 }), -2147483647);

  for (const gameId of [0, 1, 5521, -5521, FURNI_ID_WRAP, 2147483647, -2147483647, -1]) {
    assert.equal(fromApiFurniId(toApiFurniId(gameId)), gameId);
  }
}

async function testBatchAllowsBigintValues() {
  const habbo = client({ readKey: "r", writeKey: "w" });
  await habbo.variables
    .batch(796, "user", "score")
    .patch("users/44", 2n ** 62n + 1n)
    .execute();
  const call = lastCall();
  assert.ok(call.rawBody.includes('"value":4611686018427387905'), call.rawBody);
}

async function testListByKindClampsPageSize() {
  const habbo = client({ readKey: "r" });
  await habbo.variables.listByKind(796, "user", "score", "users", { size: 500 });
  assert.ok(lastCall().url.includes("size=100"), lastCall().url);

  await habbo.variables.listByKind(796, "user", "score", "users", { size: 0 });
  assert.ok(!lastCall().url.includes("size="), "an invalid size must be omitted");
}

async function testIterateByKindUsesClampedSizeForTermination() {
  const habbo = client({ readKey: "r" });
  let page = 0;
  const paged: FetchLike = (url, init) => {
    const count = page === 0 ? 100 : 5;
    const items = Array.from({ length: count }, (_, index) => ({ value: page * 100 + index }));
    page += 1;
    nextBody = JSON.stringify({ items, page, size: 100 });
    return stubFetch(url, init);
  };
  const iterating = new HabboClient({ hotel: "sandbox", fetch: paged, readKey: "r" });

  const seen: unknown[] = [];
  for await (const item of iterating.variables.iterateByKind(796, "user", "s", "users", {
    size: 999,
  })) {
    seen.push(item);
  }

  assert.equal(seen.length, 105, "a requested size above the API maximum must not truncate");
  assert.equal(page, 2, "must walk the second page once the first is full");
  assert.ok(calls[0]?.url.includes("size=100"), "the wire must carry the clamped size");
}

const tests = [
  testReadUsesReadKeyAndCorrectPath,
  testWriteUsesWriteKey,
  testSanitizeFurniId,
  testFurniIdIsSanitizedInProfileUrl,
  testFurniIdWrapsInScopedUrl,
  testUserScopeDoesNotSanitizeEntityId,
  testBatchSendsBothKeysAndSpecShape,
  testListByKindMapsQueryParams,
  testListByKindClampsPageSize,
  testIterateByKindStopsOnShortPage,
  testIterateByKindUsesClampedSizeForTermination,
  testProfilePatchAllowsNullToDelete,
  testMissingKeyFailsBeforeRequest,
  testNonIntegerValuesRejected,
  testBatchLimits,
  testBigintValuesSerializeExactly,
  testSmallValuesSerializeAsPlainNumbers,
  testLargeResponseValuesParseAsBigint,
  testNestedBigintsAndDigitStringsSurviveParsing,
  testBigintValidation,
  testFurniIdConversionBothWays,
  testBatchAllowsBigintValues,
];

for (const test of tests) {
  await test();
  console.log(`ok - ${test.name}`);
}

console.log(`\n${tests.length} passed`);
