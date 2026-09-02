/**
 * Shared behaviour for the level-up strategies.
 *
 * Implements {@link LevelUpperConfig.boundedValue} once, plus the
 * {@link BaseLevelUpper.floorPercent} helper used by every percentage
 * calculation, and declares the members each strategy must provide.
 */

import type { LevelUpperConfig } from "./level-upper-config.js";

export abstract class BaseLevelUpper implements LevelUpperConfig {
  /**
   * Clamps an XP amount to the valid `0n..maxXp()` range.
   *
   * @param xp - The XP amount about to be measured.
   * @returns `0n` for negative input, `maxXp()` above the maximum, the input
   *   otherwise.
   */
  public boundedValue(xp: bigint): bigint {
    if (xp < 0n) {
      return 0n;
    }
    const maxXp = this.maxXp();
    return xp > maxXp ? maxXp : xp;
  }

  /**
   * The completed share of a level as a whole percentage from `0n` to `100n`.
   *
   * @param part - The XP accumulated inside the level.
   * @param whole - The total XP the level requires.
   * @returns `Math.floor(part / whole * 100)` as a `bigint`.
   */
  protected floorPercent(part: bigint, whole: bigint): bigint {
    return BigInt(Math.floor((Number(part) / Number(whole)) * 100));
  }

  /** {@inheritDoc LevelUpperConfig.currentLevel} */
  public abstract currentLevel(xp: bigint): bigint;
  /** {@inheritDoc LevelUpperConfig.totalXpRequired} */
  public abstract totalXpRequired(xp: bigint): bigint;
  /** {@inheritDoc LevelUpperConfig.progress} */
  public abstract progress(xp: bigint): bigint;
  /** {@inheritDoc LevelUpperConfig.progressPercentage} */
  public abstract progressPercentage(xp: bigint): bigint;
  /** {@inheritDoc LevelUpperConfig.xpRemaining} */
  public abstract xpRemaining(xp: bigint): bigint;
  /** {@inheritDoc LevelUpperConfig.isMaxed} */
  public abstract isMaxed(xp: bigint): boolean;
  /** {@inheritDoc LevelUpperConfig.maxLevel} */
  public abstract maxLevel(): bigint;
  /** {@inheritDoc LevelUpperConfig.maxXp} */
  public abstract maxXp(): bigint;
}
