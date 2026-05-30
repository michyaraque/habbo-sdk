/**
 * Public Habbo API example: read-only, no authentication required.
 *
 * Run with:
 *   pnpm tsx examples/profiles.ts
 */

import { HabboClient } from "../src/index.js";

const habbo = new HabboClient({ hotel: "es" });

const user = await habbo.profiles.get("Cebolla1");
console.log(`User:   ${user.name} (${user.uniqueId})`);
console.log(`Motto:  ${user.motto}`);
console.log(`Online: ${user.online ?? "unknown"}`);
console.log(`Figure: ${user.figureString}`);

const profile = await habbo.profiles.getProfile(user.uniqueId);
console.log("\nProfile summary:");
console.log(`  Friends: ${profile.friends.length}`);
console.log(`  Groups:  ${profile.groups.length}`);
console.log(`  Rooms:   ${profile.rooms.length}`);
console.log(`  Badges:  ${profile.badges.length}`);

const photos = await habbo.profiles.getPhotos(user.uniqueId);
console.log(`  Photos:  ${photos.length}`);

const [firstGroup] = profile.groups;
if (firstGroup) {
  console.log(`\nFirst group: ${firstGroup.name} [${firstGroup.type}]`);
  const members = await habbo.profiles.getGroupMembers(firstGroup.id);
  console.log(`  Members:   ${members.length}`);
}
