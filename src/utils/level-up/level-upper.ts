/**
 * The level-up system calculator, mirroring the math of the room's
 * level-up add-on.
 *
 * Pick a profile with one of the static factories; every one returns a
 * {@link LevelUpperConfig} whose methods take and return `bigint`, so XP values read from
 * wired variables can be fed in directly.
 *
 * @example
 * ```ts
 * const levels = LevelUpper.linear(100n, 50n);
 * const level = levels.currentLevel(xp);
 * ```
 */

import { BaseLevelUpper } from "./base-level-upper.js";
import { ExponentialLevelUpper } from "./exponential-level-upper.js";
import { InterpolateLevelUpper } from "./interpolate-level-upper.js";
import { LinearLevelUpper } from "./linear-level-upper.js";
import { StepsLevelUpper } from "./steps-level-upper.js";
import type { LevelUpperConfig } from "./level-upper-config.js";

export abstract class LevelUpper extends BaseLevelUpper {
  /**
   * Creates a linear profile, where every level costs the same XP.
   *
   * @param stepSize - The XP every level requires.
   * @param maxLevel - The highest achievable level.
   * @returns A {@link LevelUpperConfig} with evenly spaced levels.
   */
  public static linear(stepSize: bigint, maxLevel: bigint): LevelUpperConfig {
    return new LinearLevelUpper(stepSize, maxLevel);
  }

  /**
   * Creates an interpolating profile from a handful of known levels.
   *
   * @param levelToXpMap - Known levels mapped to the XP each one starts at.
   * @returns A {@link LevelUpperConfig} that spreads the levels between the
   *   known points evenly.
   */
  public static interpolate(levelToXpMap: Readonly<Record<number, bigint>>): LevelUpperConfig {
    return new InterpolateLevelUpper(levelToXpMap);
  }

  /**
   * Creates a stepwise profile from the exact XP each level transition
   * requires.
   *
   * Nothing is interpolated or invented: entry `i` of the array is the XP
   * needed to advance from level `i + 1` to level `i + 2`, so arbitrary
   * curves are expressed directly. The maximum level is one past the last
   * configured step.
   *
   * @param xpPerLevel - The XP required by each level transition, in order.
   * @returns A {@link LevelUpperConfig} following the configured jumps
   *   exactly.
   * @throws {@link TypeError} when no step is given or a step is not a
   *   positive whole number.
   *
   * @example
   * ```ts
   * const levels = LevelUpper.steps([100n, 150n, 150n, 400n]);
   * ```
   */
  public static steps(xpPerLevel: readonly bigint[]): LevelUpperConfig {
    return new StepsLevelUpper(xpPerLevel);
  }

  /**
   * Creates an exponential profile, where every level costs more than the
   * last.
   *
   * @param initialXp - The XP required to reach level `2` from level `1`.
   * @param strength - The per-level growth as a percentage.
   * @param maxLevel - The highest achievable level.
   * @returns A {@link LevelUpperConfig} with growing level costs.
   */
  public static exponential(
    initialXp: bigint,
    strength: bigint,
    maxLevel: bigint,
  ): LevelUpperConfig {
    return new ExponentialLevelUpper(initialXp, strength, maxLevel);
  }
}
