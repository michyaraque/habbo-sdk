/**
 * The stepwise level-up strategy: the XP each level transition requires is
 * defined explicitly, one value per jump.
 *
 * Unlike the interpolating strategy, nothing is invented: a level only
 * starts where the configured steps say it does, so arbitrary curves —
 * expensive early levels, a cheap middle stretch, a brutal final one — are
 * expressed directly. Level `1` starts at `0n` and each configured step
 * unlocks the next level.
 */

import { BaseLevelUpper } from "./base-level-upper.js";

export class StepsLevelUpper extends BaseLevelUpper {
  private readonly thresholds: bigint[];
  private readonly xpPerLevel: readonly bigint[];

  /**
   * @param xpPerLevel - The XP required to advance from level `i + 1` to
   *   level `i + 2`, one entry per transition. Must not be empty, and every
   *   step must be positive.
   * @throws {@link TypeError} when no step is given or a step is not a
   *   positive whole number.
   */
  public constructor(xpPerLevel: readonly bigint[]) {
    super();
    if (xpPerLevel.length === 0) {
      throw new TypeError("LevelUpper.steps needs at least one XP step.");
    }
    const thresholds: bigint[] = [];
    let total = 0n;
    for (const step of xpPerLevel) {
      if (typeof step !== "bigint" || step <= 0n) {
        throw new TypeError(`Each XP step must be a positive bigint. Received: ${String(step)}`);
      }
      total += step;
      thresholds.push(total);
    }
    this.thresholds = thresholds;
    this.xpPerLevel = xpPerLevel;
  }

  /** {@inheritDoc BaseLevelUpper.currentLevel} */
  public currentLevel(xp: bigint): bigint {
    const bounded = this.boundedValue(xp);
    let lastPassed = -1;
    let low = 0;
    let high = this.thresholds.length - 1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (this.thresholds[middle]! <= bounded) {
        lastPassed = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return BigInt(lastPassed + 2);
  }

  /** {@inheritDoc BaseLevelUpper.totalXpRequired} */
  public totalXpRequired(xp: bigint): bigint {
    if (this.isMaxed(xp)) {
      return 0n;
    }
    const level = this.currentLevel(xp);
    return this.xpPerLevel[Number(level) - 1]!;
  }

  /** {@inheritDoc BaseLevelUpper.progress} */
  public progress(xp: bigint): bigint {
    const bounded = this.boundedValue(xp);
    if (this.isMaxed(bounded)) {
      return 0n;
    }
    const level = this.currentLevel(bounded);
    return bounded - this.startOf(level);
  }

  /** {@inheritDoc BaseLevelUpper.progressPercentage} */
  public progressPercentage(xp: bigint): bigint {
    const bounded = this.boundedValue(xp);
    if (this.isMaxed(bounded)) {
      return 0n;
    }
    const level = this.currentLevel(bounded);
    return this.floorPercent(this.progress(bounded), this.xpPerLevel[Number(level) - 1]!);
  }

  /** {@inheritDoc BaseLevelUpper.xpRemaining} */
  public xpRemaining(xp: bigint): bigint {
    const bounded = this.boundedValue(xp);
    if (this.isMaxed(bounded)) {
      return 0n;
    }
    const level = this.currentLevel(bounded);
    return this.startOf(level + 1n) - bounded;
  }

  /** {@inheritDoc BaseLevelUpper.isMaxed} */
  public isMaxed(xp: bigint): boolean {
    return this.currentLevel(xp) >= this.maxLevel();
  }

  /** {@inheritDoc BaseLevelUpper.maxLevel} */
  public maxLevel(): bigint {
    return BigInt(this.thresholds.length + 1);
  }

  /** {@inheritDoc BaseLevelUpper.maxXp} */
  public maxXp(): bigint {
    return this.thresholds[this.thresholds.length - 1]!;
  }

  private startOf(level: bigint): bigint {
    return level <= 1n ? 0n : this.thresholds[Number(level) - 2]!;
  }
}