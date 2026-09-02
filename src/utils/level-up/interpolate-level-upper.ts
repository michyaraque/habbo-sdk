/**
 * The interpolating level-up strategy.
 *
 * Configure the XP at which some known levels start, for example level `1`
 * at `0n` and level `10` at `1000n`, and every level in between is spread
 * evenly over the XP gap, mirroring how the add-on behaves for levels it has
 * no exact point for.
 *
 * XP below the first point is interpolated from an implicit level `1` at
 * `0n`; XP at or past the last point reports the final level as maxed.
 */

import { BaseLevelUpper } from "./base-level-upper.js";

export class InterpolateLevelUpper extends BaseLevelUpper {
  private readonly xpToLevel: Array<{ xp: bigint; level: bigint }>;

  /**
   * @param levelToXpMap - Known levels mapped to the XP each one starts at.
   *   Levels and XP do not need to be ordered; entries are sorted by XP.
   */
  public constructor(levelToXpMap: Readonly<Record<number, bigint>>) {
    super();
    this.xpToLevel = Object.entries(levelToXpMap)
      .map(([level, xp]) => ({ level: BigInt(level), xp }))
      .sort((left, right) => (left.xp < right.xp ? -1 : left.xp > right.xp ? 1 : 0));
  }

  /** {@inheritDoc BaseLevelUpper.currentLevel} */
  public currentLevel(xp: bigint): bigint {
    return this.findProgressInfo(xp).currentLevel;
  }

  /** {@inheritDoc BaseLevelUpper.totalXpRequired} */
  public totalXpRequired(xp: bigint): bigint {
    const info = this.findProgressInfo(xp);
    return info.nextLevelXp - info.currentLevelXp;
  }

  /** {@inheritDoc BaseLevelUpper.progress} */
  public progress(xp: bigint): bigint {
    const info = this.findProgressInfo(xp);
    return info.currentXp - info.currentLevelXp;
  }

  /** {@inheritDoc BaseLevelUpper.progressPercentage} */
  public progressPercentage(xp: bigint): bigint {
    const info = this.findProgressInfo(xp);
    const totalRequired = info.nextLevelXp - info.currentLevelXp;
    if (totalRequired === 0n) {
      return 0n;
    }
    return this.floorPercent(info.currentXp - info.currentLevelXp, totalRequired);
  }

  /** {@inheritDoc BaseLevelUpper.xpRemaining} */
  public xpRemaining(xp: bigint): bigint {
    const info = this.findProgressInfo(xp);
    return info.nextLevelXp - info.currentXp;
  }

  /** {@inheritDoc BaseLevelUpper.isMaxed} */
  public isMaxed(xp: bigint): boolean {
    return this.findProgressInfo(xp).isMaxed;
  }

  /** {@inheritDoc BaseLevelUpper.maxLevel} */
  public maxLevel(): bigint {
    return this.findProgressInfo(this.maxXp()).currentLevel;
  }

  /** {@inheritDoc BaseLevelUpper.maxXp} */
  public maxXp(): bigint {
    if (this.xpToLevel.length === 0) {
      return 0n;
    }
    return this.xpToLevel[this.xpToLevel.length - 1]!.xp;
  }

  /**
   * Resolves the level band an XP amount falls into.
   *
   * The band between two known points is divided by
   * `(nextLevelXp - currentLevelXp) / (nextLevel - currentLevel)`, and
   * fractional steps accumulate through `Math.floor`, exactly as the add-on
   * computes them. This also means band boundaries can shift by one XP
   * depending on the map's rounding.
   *
   * @param xp - The XP amount to measure, unclamped.
   * @returns The current level, the XP its band starts at, the next level's
   *   starting XP, and whether the final level was reached.
   */
  private findProgressInfo(xp: bigint): {
    currentLevel: bigint;
    currentLevelXp: bigint;
    currentXp: bigint;
    nextLevelXp: bigint;
    isMaxed: boolean;
  } {
    if (this.xpToLevel.length === 0) {
      return { currentLevel: 1n, currentLevelXp: 0n, currentXp: 0n, nextLevelXp: 0n, isMaxed: true };
    }

    const bounded = this.boundedValue(xp);
    const last = this.xpToLevel[this.xpToLevel.length - 1]!;
    if (bounded >= last.xp) {
      return {
        currentLevel: last.level,
        currentLevelXp: last.xp,
        currentXp: last.xp,
        nextLevelXp: last.xp,
        isMaxed: true,
      };
    }

    let lower = { level: 1n, xp: 0n };
    let upper = this.xpToLevel[0]!;
    for (const entry of this.xpToLevel) {
      if (entry.xp <= bounded) {
        lower = entry;
        continue;
      }
      upper = entry;
      break;
    }

    const levelDifference = upper.level - lower.level;
    const xpDifference = upper.xp - lower.xp;
    const xpPerLevel = Number(xpDifference) / Number(levelDifference);
    const stepXp = (steps: bigint): bigint =>
      lower.xp + BigInt(Math.floor(xpPerLevel * Number(steps)));
    const maxSteps = levelDifference - 1n;

    let levelSteps = BigInt(
      Math.min(
        Math.max(Math.floor(Number(bounded - lower.xp) / xpPerLevel), 0),
        Number(maxSteps),
      ),
    );
    const onLastStep = levelSteps === maxSteps;
    let nextLevelXp = onLastStep ? upper.xp : stepXp(levelSteps + 1n);

    if (!onLastStep && bounded >= nextLevelXp) {
      levelSteps += 1n;
      nextLevelXp = levelSteps === levelDifference ? upper.xp : stepXp(levelSteps + 1n);
    }

    return {
      currentLevel: lower.level + levelSteps,
      currentLevelXp: stepXp(levelSteps),
      currentXp: bounded,
      nextLevelXp,
      isMaxed: false,
    };
  }
}