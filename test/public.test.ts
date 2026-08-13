/**
 * Contract checks for the public `profiles` and `origins` resources, run
 * against a stub `fetch`.
 *
 * Run with `pnpm test`.
 */

import assert from "node:assert/strict";
import { HabboClient } from "../src/index.js";
import type { FetchLike } from "../src/http.js";

interface Call {
  url: string;
  method: string;
  body: unknown;
}

const calls: Call[] = [];
let responses: string[] = [];

const stubFetch: FetchLike = (url, init = {}) => {
  calls.push({
    url,
    method: init.method ?? "GET",
    body: init.body !== undefined ? JSON.parse(init.body) : undefined,
  });
  return Promise.resolve({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: () => Promise.resolve(responses.shift() ?? "{}"),
  });
};

function client(config: Record<string, unknown> = {}) {
  calls.length = 0;
  responses = [];
  return new HabboClient({ hotel: "sandbox", fetch: stubFetch, ...config });
}

function lastCall(): Call {
  const call = calls[calls.length - 1];
  assert.ok(call, "expected a request to have been made");
  return call;
}

async function testProfileLookupByName() {
  const habbo = client();
  await habbo.profiles.get("Cebolla1");
  assert.equal(lastCall().url, "https://sandbox.habbo.com/api/public/users?name=Cebolla1");
}

async function testHotelDomainResolution() {
  const es = new HabboClient({ hotel: "es", fetch: stubFetch });
  calls.length = 0;
  await es.profiles.ping();
  assert.equal(lastCall().url, "https://www.habbo.es/api/public/ping");
}

async function testProfileNestsTheUser() {
  const habbo = client();
  responses = [
    JSON.stringify({
      user: { uniqueId: "hhes-1", name: "Cebolla1", motto: "hi", figureString: "hr-100" },
      friends: [{ uniqueId: "hhes-2", name: "Friend" }],
      groups: [],
      rooms: [],
      badges: [],
    }),
  ];

  // The live API nests the owner under `user`, alongside the collections.
  const profile = await habbo.profiles.getProfile("hhes-1");
  assert.equal(profile.user.name, "Cebolla1");
  assert.equal(profile.friends.length, 1);
}

async function testSelectedBadgesAreObjects() {
  const habbo = client();
  responses = [
    JSON.stringify({
      uniqueId: "hhes-1",
      name: "Cebolla1",
      motto: "hi",
      figureString: "hr-100",
      selectedBadges: [{ badgeIndex: 1, code: "WP005", name: "B", description: "d" }],
    }),
  ];

  // The live API returns full badge objects here, not bare codes.
  const user = await habbo.profiles.get("Cebolla1");
  assert.equal(user.selectedBadges?.[0]?.code, "WP005");
  assert.equal(user.selectedBadges?.[0]?.badgeIndex, 1);
}

async function testGroupMembersUseHabboFigure() {
  const habbo = client();
  responses = [
    JSON.stringify([
      { uniqueId: "hhes-2", name: "Member", motto: "m", habboFigure: "hr-100", isAdmin: true },
    ]),
  ];

  const [member] = await habbo.profiles.getGroupMembers("g-hhes-1");
  assert.equal(member?.habboFigure, "hr-100");
  assert.equal(member?.isAdmin, true);
}

async function testMarketplaceStatsPostsBothItemLists() {
  const habbo = client();
  await habbo.profiles.getMarketplaceStats({
    roomItems: [{ item: "throne" }],
    wallItems: [{ item: "rare_dragonlamp" }],
  });

  const call = lastCall();
  assert.equal(call.url, "https://sandbox.habbo.com/api/public/marketplace/stats/batch");
  assert.equal(call.method, "POST");
  assert.deepEqual(call.body, {
    roomItems: [{ item: "throne" }],
    wallItems: [{ item: "rare_dragonlamp" }],
  });
}

async function testOriginsMatchIdsMapQueryNames() {
  const habbo = client();
  await habbo.origins.listMatchIds("gp-dev1-abc", {
    limit: 10,
    startTime: "2024-08-20 12:00:00.000",
  });

  const call = lastCall();
  assert.ok(call.url.startsWith("https://sandbox.habbo.com/api/public/matches/v1/gp-dev1-abc/ids?"));
  assert.ok(call.url.includes("limit=10"), call.url);
  assert.ok(call.url.includes("start_time=2024-08-20"), call.url);
  assert.ok(!call.url.includes("offset="), "unset filters must be omitted");
}

async function testDerbySendsApiKeyOnlyWhenConfigured() {
  const without = client();
  await without.origins.getDerbyStatus();
  assert.ok(!lastCall().url.includes("api_key"), "no key configured means no api_key param");

  const withKey = client({ originsApiKey: "k" });
  await withKey.origins.getDerbyStatus();
  assert.ok(lastCall().url.includes("api_key=k"), lastCall().url);

  await withKey.profiles.ping();
  assert.ok(!lastCall().url.includes("api_key"), "the key must not leak to other endpoints");
}

async function testDerbyStatusShape() {
  const habbo = client();
  // Trimmed from a real origins.habbo.com response.
  responses = [
    JSON.stringify({
      status: "ACTIVE",
      derby: {
        metadata: { derbyId: "fd-hhous-f5d5", participantAccountIds: ["hhous-066a"] },
        info: {
          status: "ACTIVE",
          creationTime: 1785864812000,
          registrationStartTime: 1785864812000,
          registrationEndTime: 1785864812000,
          startTime: 1785864812000,
          endTime: 1785864812000,
          participants: [
            {
              accountId: "hhous-066a",
              fishCaught: 112,
              goldenFishCaught: 2,
              privateFishCaught: 0,
              lastUpdated: 1785864812000,
              derbyMode: "standard",
              standardWeightGrams: 83349,
            },
          ],
        },
      },
    }),
  ];

  const { status, derby } = await habbo.origins.getDerbyStatus();
  assert.equal(status, "ACTIVE");
  assert.equal(derby?.info.participants[0]?.fishCaught, 112);
  assert.equal(derby?.metadata.participantAccountIds.length, 1);
}

async function testIterateMatchIdsStopsOnShortPage() {
  const habbo = client();
  responses = [JSON.stringify(["a", "b"]), JSON.stringify(["c"])];

  const seen: string[] = [];
  for await (const id of habbo.origins.iterateMatchIds("gp-dev1-abc", { limit: 2 })) {
    seen.push(id);
  }

  assert.deepEqual(seen, ["a", "b", "c"]);
  assert.equal(calls.length, 2, "must stop after the short page");
}

async function testIterateSkillLeaderboardWalksAllPages() {
  const habbo = client();
  responses = [
    JSON.stringify({ entries: [{ uniqueId: "a" }], totalPages: 2, currentPage: 1, pageSize: 1 }),
    JSON.stringify({ entries: [{ uniqueId: "b" }], totalPages: 2, currentPage: 2, pageSize: 1 }),
  ];

  const seen: string[] = [];
  for await (const entry of habbo.origins.iterateSkillLeaderboard("FISHING")) {
    seen.push(entry.uniqueId);
  }

  assert.deepEqual(seen, ["a", "b"]);
  assert.equal(calls.length, 2, "must stop once totalPages is reached");
}

const tests = [
  testProfileLookupByName,
  testProfileNestsTheUser,
  testSelectedBadgesAreObjects,
  testGroupMembersUseHabboFigure,
  testHotelDomainResolution,
  testMarketplaceStatsPostsBothItemLists,
  testOriginsMatchIdsMapQueryNames,
  testDerbySendsApiKeyOnlyWhenConfigured,
  testDerbyStatusShape,
  testIterateMatchIdsStopsOnShortPage,
  testIterateSkillLeaderboardWalksAllPages,
];

for (const test of tests) {
  await test();
  console.log(`ok - ${test.name}`);
}

console.log(`\n${tests.length} passed`);
