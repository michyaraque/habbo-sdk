import assert from "node:assert/strict";
import { LevelUpper } from "../src/index.js";

async function testLinearLevelUsesCorrectedMaxXp() {
  const upper = LevelUpper.linear(100n, 5n);
  assert.equal(upper.maxLevel(), 5n);
  assert.equal(upper.maxXp(), 400n, "maxXp must be (maximumLevel - 1) * stepSize");
}

async function testLinearLevelsAndProgress() {
  const upper = LevelUpper.linear(100n, 5n);
  assert.equal(upper.currentLevel(0n), 1n);
  assert.equal(upper.currentLevel(99n), 1n);
  assert.equal(upper.currentLevel(100n), 2n);
  assert.equal(upper.currentLevel(250n), 3n);
  assert.equal(upper.currentLevel(399n), 4n);
  assert.equal(upper.currentLevel(400n), 5n);
  assert.equal(upper.currentLevel(1_000_000n), 5n);

  assert.equal(upper.progress(250n), 50n);
  assert.equal(upper.progress(400n), 0n);
  assert.equal(upper.progressPercentage(250n), 50n);
  assert.equal(upper.progressPercentage(99n), 99n);
  assert.equal(upper.progressPercentage(400n), 0n);
  assert.equal(upper.xpRemaining(250n), 50n);
  assert.equal(upper.xpRemaining(399n), 1n);
  assert.equal(upper.xpRemaining(400n), 0n);
  assert.equal(upper.totalXpRequired(250n), 100n);
  assert.equal(upper.totalXpRequired(400n), 0n);

  assert.equal(upper.isMaxed(399n), false);
  assert.equal(upper.isMaxed(400n), true);
  assert.equal(upper.boundedValue(-5n), 0n);
  assert.equal(upper.boundedValue(1_000_000n), 400n);
}

async function testLinearSingleLevel() {
  const upper = LevelUpper.linear(100n, 1n);
  assert.equal(upper.maxXp(), 0n);
  assert.equal(upper.currentLevel(0n), 1n);
  assert.equal(upper.isMaxed(0n), true);
  assert.equal(upper.xpRemaining(0n), 0n);
}

async function testInterpolatedLevelsBetweenExactThresholds() {
  const upper = LevelUpper.interpolate({ 1: 0n, 3: 100n, 5: 400n });
  assert.equal(upper.maxLevel(), 5n);
  assert.equal(upper.maxXp(), 400n);

  assert.equal(upper.currentLevel(49n), 1n);
  assert.equal(upper.currentLevel(50n), 2n);
  assert.equal(upper.currentLevel(99n), 2n);
  assert.equal(upper.currentLevel(100n), 3n);
  assert.equal(upper.currentLevel(249n), 3n);
  assert.equal(upper.currentLevel(250n), 4n);
  assert.equal(upper.currentLevel(399n), 4n);
  assert.equal(upper.currentLevel(400n), 5n);
  assert.equal(upper.currentLevel(1_000_000n), 5n);

  assert.equal(upper.progress(150n), 50n);
  assert.equal(upper.progressPercentage(150n), 33n);
  assert.equal(upper.xpRemaining(150n), 100n);
  assert.equal(upper.totalXpRequired(150n), 150n);
  assert.equal(upper.xpRemaining(399n), 1n);
  assert.equal(upper.isMaxed(399n), false);
  assert.equal(upper.isMaxed(400n), true);
}

async function testInterpolatedNonUniformSpacing() {
  const upper = LevelUpper.interpolate({ 1: 0n, 3: 100n, 10: 1000n });

  assert.equal(upper.currentLevel(49n), 1n);
  assert.equal(upper.currentLevel(50n), 2n);
  assert.equal(upper.currentLevel(99n), 2n);
  assert.equal(upper.currentLevel(100n), 3n);
  assert.equal(upper.currentLevel(227n), 3n);
  assert.equal(upper.currentLevel(228n), 4n);
  assert.equal(upper.currentLevel(990n), 9n);
  assert.equal(upper.currentLevel(999n), 9n);
  assert.equal(upper.currentLevel(1000n), 10n);
  assert.equal(upper.currentLevel(1_000_000n), 10n);

  assert.equal(upper.progress(200n), 100n);
  assert.equal(upper.progressPercentage(200n), 78n);
  assert.equal(upper.xpRemaining(200n), 28n);
  assert.equal(upper.totalXpRequired(200n), 128n);
  assert.equal(upper.progress(228n), 0n);
  assert.equal(upper.totalXpRequired(228n), 129n);
  assert.equal(upper.xpRemaining(999n), 1n);
  assert.equal(upper.isMaxed(999n), false);
  assert.equal(upper.isMaxed(1000n), true);
}

async function testExponentialLevelsAndProgress() {
  const upper = LevelUpper.exponential(100n, 50n, 5n);
  assert.equal(upper.maxLevel(), 5n);
  assert.equal(upper.maxXp(), 812n);

  assert.equal(upper.currentLevel(-10n), 1n);
  assert.equal(upper.currentLevel(0n), 1n);
  assert.equal(upper.currentLevel(99n), 1n);
  assert.equal(upper.currentLevel(100n), 2n);
  assert.equal(upper.currentLevel(249n), 2n);
  assert.equal(upper.currentLevel(250n), 3n);
  assert.equal(upper.currentLevel(475n), 4n);
  assert.equal(upper.currentLevel(811n), 4n);
  assert.equal(upper.currentLevel(812n), 5n);
  assert.equal(upper.currentLevel(1_000_000n), 5n);

  assert.equal(upper.progress(249n), 149n);
  assert.equal(upper.progress(300n), 50n);
  assert.equal(upper.progressPercentage(300n), 22n);
  assert.equal(upper.xpRemaining(300n), 175n);
  assert.equal(upper.totalXpRequired(300n), 225n);
  assert.equal(upper.totalXpRequired(812n), 0n);
  assert.equal(upper.xpRemaining(811n), 1n);
  assert.equal(upper.isMaxed(811n), false);
  assert.equal(upper.isMaxed(812n), true);
}

async function testStepsProfileFollowsExactJumps() {
  const upper = LevelUpper.steps([100n, 150n, 250n]);
  assert.equal(upper.maxLevel(), 4n);
  assert.equal(upper.maxXp(), 500n);

  assert.equal(upper.currentLevel(0n), 1n);
  assert.equal(upper.currentLevel(50n), 1n);
  assert.equal(upper.currentLevel(99n), 1n);
  assert.equal(upper.currentLevel(100n), 2n);
  assert.equal(upper.currentLevel(249n), 2n);
  assert.equal(upper.currentLevel(250n), 3n);
  assert.equal(upper.currentLevel(499n), 3n);
  assert.equal(upper.currentLevel(500n), 4n);
  assert.equal(upper.currentLevel(1_000_000n), 4n);

  assert.equal(upper.progress(150n), 50n);
  assert.equal(upper.progress(500n), 0n);
  assert.equal(upper.progressPercentage(50n), 50n);
  assert.equal(upper.progressPercentage(249n), 99n);
  assert.equal(upper.progressPercentage(500n), 0n);
  assert.equal(upper.xpRemaining(50n), 50n);
  assert.equal(upper.xpRemaining(100n), 150n);
  assert.equal(upper.xpRemaining(249n), 1n);
  assert.equal(upper.xpRemaining(500n), 0n);
  assert.equal(upper.totalXpRequired(50n), 100n);
  assert.equal(upper.totalXpRequired(100n), 150n);
  assert.equal(upper.totalXpRequired(250n), 250n);
  assert.equal(upper.totalXpRequired(500n), 0n);

  assert.equal(upper.isMaxed(499n), false);
  assert.equal(upper.isMaxed(500n), true);
  assert.equal(upper.boundedValue(1_000_000n), 500n);
}

async function testStepsProfileSingleTransition() {
  const upper = LevelUpper.steps([50n]);
  assert.equal(upper.maxLevel(), 2n);
  assert.equal(upper.maxXp(), 50n);
  assert.equal(upper.currentLevel(0n), 1n);
  assert.equal(upper.currentLevel(49n), 1n);
  assert.equal(upper.currentLevel(50n), 2n);
  assert.equal(upper.isMaxed(50n), true);
  assert.equal(upper.xpRemaining(49n), 1n);
  assert.equal(upper.totalXpRequired(0n), 50n);
}

async function testStepsProfileRejectsInvalidConfigurations() {
  assert.throws(() => LevelUpper.steps([]), TypeError, "at least one step is required");
  assert.throws(() => LevelUpper.steps([0n]), TypeError, "zero steps are rejected");
  assert.throws(() => LevelUpper.steps([-5n]), TypeError, "negative steps are rejected");
  assert.throws(
    () => LevelUpper.steps([5 as unknown as bigint]),
    TypeError,
    "non-bigint steps are rejected",
  );
}

const tests = [
  testLinearLevelUsesCorrectedMaxXp,
  testLinearLevelsAndProgress,
  testLinearSingleLevel,
  testInterpolatedLevelsBetweenExactThresholds,
  testInterpolatedNonUniformSpacing,
  testExponentialLevelsAndProgress,
  testStepsProfileFollowsExactJumps,
  testStepsProfileSingleTransition,
  testStepsProfileRejectsInvalidConfigurations,
];

for (const test of tests) {
  await test();
  console.log(`ok - ${test.name}`);
}

console.log(`\n${tests.length} passed`);