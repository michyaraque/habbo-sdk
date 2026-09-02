/**
 * The linear level-up strategy: every level costs the same fixed XP.
 *
 * A level `n` starts at `(n - 1) * stepSize` XP, so the maximum level is
 * reached at `(maximumLevel - 1) * stepSize` XP, which is what
 * {@link LinearLevelUpper.maxXp} reports.
 */

import { BaseLevelUpper } from "./base-level-upper.js";

export class LinearLevelUpper extends BaseLevelUpper {
  /**
   * @param stepSize - The XP every level requires.
   * @param maximumLevel - The highest achievable level.
   */
  public constructor(
    private readonly stepSize: bigint,
    private readonly maximumLevel: bigint,
  ) {
    super();
  }

  /** {@inheritDoc BaseLevelUpper.currentLevel} */
  public currentLevel(xp: bigint): bigint {
    const bounded = this.boundedValue(xp);
    const candidate = 1n + bounded / this.stepSize;
    return candidate > this.maximumLevel ? this.maximumLevel : candidate;
  }

  /** {@inheritDoc BaseLevelUpper.totalXpRequired} */
  public totalXpRequired(xp: bigint): bigint {
    return this.isMaxed(xp) ? 0n : this.stepSize;
  }

  /** {@inheritDoc BaseLevelUpper.progress} */
  public progress(xp: bigint): bigint {
    const bounded = this.boundedValue(xp);
    return this.isMaxed(bounded) ? 0n : bounded % this.stepSize;
  }

  /** {@inheritDoc BaseLevelUpper.progressPercentage} */
  public progressPercentage(xp: bigint): bigint {
    if (this.isMaxed(xp)) {
      return 0n;
    }
    return this.floorPercent(this.progress(xp), this.stepSize);
  }

  /** {@inheritDoc BaseLevelUpper.xpRemaining} */
  public xpRemaining(xp: bigint): bigint {
    const bounded = this.boundedValue(xp);
    return this.isMaxed(bounded) ? 0n : this.stepSize - (bounded % this.stepSize);
  }

  /** {@inheritDoc BaseLevelUpper.isMaxed} */
  public isMaxed(xp: bigint): boolean {
    return this.currentLevel(xp) >= this.maximumLevel;
  }

  /** {@inheritDoc BaseLevelUpper.maxLevel} */
  public maxLevel(): bigint {
    return this.maximumLevel;
  }

  /** {@inheritDoc BaseLevelUpper.maxXp} */
  public maxXp(): bigint {
    return (this.maximumLevel - 1n) * this.stepSize;
  }
}
