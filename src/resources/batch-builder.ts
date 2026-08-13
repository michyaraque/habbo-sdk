/**
 * Fluent builder for batches of wired variable operations.
 *
 * A batch acts on a single variable, named when the builder is created, and can
 * touch up to {@link BATCH_MAX_OPERATIONS} different entities in one request.
 * Reads and writes may be mixed freely.
 *
 * Every method takes a `path` of the form `<targetKind>/<entityId>`, without a
 * leading slash, for example `users/44` or `furni/5521`.
 *
 * @example
 * ```ts
 * const { results } = await habbo.variables
 *   .batch(796, "user", "score")
 *   .get("users/44")
 *   .patch("users/45", 10)
 *   .delete("pets/12")
 *   .execute();
 * ```
 */

import {
  BATCH_MAX_OPERATIONS,
  assertVariableValue,
  type BatchOperation,
  type BatchRequest,
  type BatchResults,
  type VariableValue,
} from "../types/variables.js";

/**
 * The transport callback a {@link BatchBuilder} uses to dispatch its operations.
 * Supplied by {@link VariablesResource.batch}.
 */
export type BatchExecutor = (
  operations: BatchRequest["requests"],
) => Promise<BatchResults>;

/**
 * Options shared by every builder method.
 */
export interface BatchOperationOptions {
  /**
   * A caller-supplied identifier echoed back on the matching result, which lets
   * you correlate results with your own records. Optional: results are also
   * returned in the order the operations were queued.
   */
  opId?: string;
}

/**
 * Accumulates wired variable operations and sends them as one request.
 *
 * Instances come from {@link VariablesResource.batch}; there is no reason to
 * construct one directly.
 */
export class BatchBuilder {
  private readonly operations: BatchOperation[] = [];

  constructor(private readonly executor: BatchExecutor) {}

  /**
   * Queues a read of the variable for one entity.
   *
   * @param path - Target path, e.g. `users/44`.
   * @param options - Optional {@link BatchOperationOptions.opId}.
   * @returns This builder, for chaining.
   */
  get(path: string, options: BatchOperationOptions = {}): this {
    return this.push({ method: "GET", path, ...withOpId(options) });
  }

  /**
   * Queues a create-or-replace of the variable for one entity.
   *
   * @param path - Target path, e.g. `users/44`.
   * @param value - The whole number to store.
   * @param options - Optional {@link BatchOperationOptions.opId}.
   * @returns This builder, for chaining.
   * @throws {@link TypeError} when the value is not a whole number.
   */
  put(path: string, value: VariableValue, options: BatchOperationOptions = {}): this {
    assertVariableValue(value);
    return this.push({ method: "PUT", path, body: { value }, ...withOpId(options) });
  }

  /**
   * Queues an update of the variable for one entity.
   *
   * @param path - Target path, e.g. `users/44`.
   * @param value - The new whole number.
   * @param options - Optional {@link BatchOperationOptions.opId}.
   * @returns This builder, for chaining.
   * @throws {@link TypeError} when the value is not a whole number.
   */
  patch(path: string, value: VariableValue, options: BatchOperationOptions = {}): this {
    assertVariableValue(value);
    return this.push({ method: "PATCH", path, body: { value }, ...withOpId(options) });
  }

  /**
   * Queues a deletion of the variable's stored value for one entity.
   *
   * @param path - Target path, e.g. `users/44`.
   * @param options - Optional {@link BatchOperationOptions.opId}.
   * @returns This builder, for chaining.
   */
  delete(path: string, options: BatchOperationOptions = {}): this {
    return this.push({ method: "DELETE", path, ...withOpId(options) });
  }

  /**
   * Appends pre-built operations. An escape hatch for callers assembling
   * operations programmatically.
   *
   * @param operations - One or more operations to append.
   * @returns This builder, for chaining.
   */
  add(...operations: BatchOperation[]): this {
    for (const operation of operations) {
      this.push(operation);
    }
    return this;
  }

  /** How many operations are queued so far. */
  get size(): number {
    return this.operations.length;
  }

  /**
   * Returns a copy of the queued operations without sending them. Useful for
   * logging, inspection, and tests.
   */
  toOperations(): BatchOperation[] {
    return [...this.operations];
  }

  /**
   * Sends every queued operation as a single request.
   *
   * @returns One result per operation, in the order they were queued.
   * @throws {@link RangeError} when no operation has been queued.
   * @throws {@link HabboAuthError} when the client lacks a `readKey` or a
   *   `writeKey`, both of which a batch requires.
   */
  execute(): Promise<BatchResults> {
    if (this.operations.length === 0) {
      throw new RangeError("A batch must contain at least one operation.");
    }
    return this.executor(this.toOperations());
  }

  private push(operation: BatchOperation): this {
    if (this.operations.length >= BATCH_MAX_OPERATIONS) {
      throw new RangeError(
        `A batch accepts at most ${BATCH_MAX_OPERATIONS} operations. Split the work across several batches.`,
      );
    }
    this.operations.push(operation);
    return this;
  }
}

function withOpId(options: BatchOperationOptions): { op_id?: string } {
  return options.opId !== undefined ? { op_id: options.opId } : {};
}
