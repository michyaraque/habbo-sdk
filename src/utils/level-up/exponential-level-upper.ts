/**
 * The exponential level-up strategy: every level costs more than the last.
 *
 * A level `n` starts at
 * `floor(initialXp * ((1 + strength/100)^(n - 1) - 1) / (strength/100))` XP,
 * with `initialXp` the cost of reaching level `2` from level `1` and
 * `strength` the per-level growth as a percentage. The inverse lookup uses a
 * floating-point estimate that is corrected against the exact thresholds,
 * the same approach the add-on takes.
 */

import { BaseLevelUpper } from "./base-level-upper.js";

export class ExponentialLevelUpper extends BaseLevelUpper {
  private readonly strengthAsDecimal: number;
  private readonly maxXpValue: bigint;

  /**
   * @param initialXp - The XP required to reach level `2` from level `1`.
   * @param strength - The exponential growth factor as a percentage.
   * @param maximumLevel - The highest achievable level.
   */
  public constructor(
    private readonly initialXp: bigint,
    strength: bigint,
    private readonly maximumLevel: bigint,
  ) {
    super();
    this.strengthAsDecimal = Number(strength) / 100;
    this.maxXpValue = this.xpForLevel(this.maximumLevel);
  }

  /** {@inheritDoc BaseLevelUpper.currentLevel} */
  public currentLevel(xp: bigint): bigint {
    const bounded = this.boundedValue(xp);
    if (bounded <= 0n) {
      return 1n;
    }

    const logBase = 1 + this.strengthAsDecimal;
    const rawEstimate =
      (Number(bounded) * this.strengthAsDecimal) / Number(this.initialXp) + 1;
    let level = BigInt(Math.floor(Math.log(rawEstimate) / Math.log(logBase)) + 1);

    if (level > this.maximumLevel) {
      return this.maximumLevel;
    }
    if (level < 1n) {
      return 1n;
    }
    if (bounded < this.xpForLevel(level)) {
      return level > 1n ? level - 1n : 1n;
    }
    if (bounded >= this.xpForLevel(level + 1n)) {
      return level + 1n > this.maximumLevel ? this.maximumLevel : level + 1n;
    }
    return level;
  }

  /** {@inheritDoc BaseLevelUpper.totalXpRequired} */
  public totalXpRequired(xp: bigint): bigint {
    if (this.isMaxed(xp)) {
      return 0n;
    }
    const currentLevel = this.currentLevel(xp);
    return this.xpForLevel(currentLevel + 1n) - this.xpForLevel(currentLevel);
  }

  /** {@inheritDoc BaseLevelUpper.progress} */
  public progress(xp: bigint): bigint {
    const bounded = this.boundedValue(xp);
    if (this.isMaxed(bounded)) {
      return 0n;
    }
    const currentLevel = this.currentLevel(bounded);
    return bounded - this.xpForLevel(currentLevel);
  }

  /** {@inheritDoc BaseLevelUpper.progressPercentage} */
  public progressPercentage(xp: bigint): bigint {
    const bounded = this.boundedValue(xp);
    if (this.isMaxed(bounded)) {
      return 0n;
    }
    const currentLevel = this.currentLevel(bounded);
    const levelXp = this.xpForLevel(currentLevel);
    const nextLevelXp = this.xpForLevel(currentLevel + 1n);
    if (levelXp === nextLevelXp) {
      return 100n;
    }
    return this.floorPercent(bounded - levelXp, nextLevelXp - levelXp);
  }

  /** {@inheritDoc BaseLevelUpper.xpRemaining} */
  public xpRemaining(xp: bigint): bigint {
    const bounded = this.boundedValue(xp);
    if (this.isMaxed(bounded)) {
      return 0n;
    }
    return this.xpForLevel(this.currentLevel(bounded) + 1n) - bounded;
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
    return this.maxXpValue;
  }

  /**
   * The exact XP at which a level starts.
   *
   * @param level - The level to measure, starting at `1`.
   * @returns The starting XP of the level, or `0n` below level `1`. Levels
   *   past the maximum report `maxXp()` so lookups above the ceiling stay
   *   bounded.
   */
  private xpForLevel(level: bigint): bigint {
    if (level < 1n) {
      return 0n;
    }
    if (level > this.maximumLevel) {
      return this.maxXpValue;
    }
    const growth =
      (Math.pow(1 + this.strengthAsDecimal, Number(level) - 1) - 1 + 1e-9) /
      this.strengthAsDecimal;
    return BigInt(Math.floor(Number(this.initialXp) * growth));
  }
}
