/**
 * The contract every level-up calculator implements.
 *
 * All amounts are `bigint`, matching the signed 64-bit whole numbers the Wired
 * Variables API stores, so an XP value read straight from a variable can be
 * fed into these methods. Every implementation clamps its input through
 * {@link LevelUpperConfig.boundedValue} before calculating: negative XP counts
 * as `0n` and XP past the maximum counts as the maximum.
 */
export interface LevelUpperConfig {
  /** The level reached at the given XP, starting at level `1`. */
  currentLevel(xp: bigint): bigint;
  /** The total XP the current level needs to advance to the next one; `0n` when maxed out. */
  totalXpRequired(xp: bigint): bigint;
  /** The XP already accumulated inside the current level. */
  progress(xp: bigint): bigint;
  /** The share of the current level completed, from `0n` to `100n`. */
  progressPercentage(xp: bigint): bigint;
  /** The XP still needed to reach the next level. */
  xpRemaining(xp: bigint): bigint;
  /** Whether the maximum level has been reached. */
  isMaxed(xp: bigint): boolean;
  /** The maximum achievable level. */
  maxLevel(): bigint;
  /** The XP at which the maximum level is reached. */
  maxXp(): bigint;
  /** Clamps an XP amount to the valid `0n..maxXp()` range. */
  boundedValue(xp: bigint): bigint;
}
