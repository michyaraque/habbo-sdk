/**
 * Fluent builder for batches of wired variable operations.
 *
 * Each operation maps to a sub-request with an `op_id`, HTTP `method`, `path`,
 * and optional `body`. Chain calls to queue operations, then call `execute()`
 * to dispatch them in one request.
 *
 * @example
 * ```ts
 * const result = await habbo.variables
 *   .batch("796", "user", "coins")
 *   .patch("pets:119", "/pets/119", 10)
 *   .patch("pets:120", "/pets/120", 5)
 *   .execute();
 * ```
 */

import type {
  BatchOperation,
  BatchResult,
  VariableValue,
} from "../types/variables.js";

/**
 * The transport callback used by a {@link BatchBuilder} to dispatch its
 * accumulated operations. Supplied by the {@link VariablesResource}.
 */
export type BatchExecutor = (operations: BatchOperation[]) => Promise<BatchResult>;

/**
 * Accumulates wired variable operations and executes them as one batch.
 *
 * Instances are created by {@link VariablesResource.batch}; they are not meant
 * to be constructed directly.
 */
export class BatchBuilder {
  private readonly operations: BatchOperation[] = [];

  constructor(private readonly executor: BatchExecutor) {}

  /**
   * Queues a PATCH sub-request that updates a variable value.
   *
   * @param opId - Caller-supplied identifier to correlate this operation with its result.
   * @param path - Sub-request path, e.g. `/pets/119`.
   * @param value - The new value to assign.
   * @returns This builder, for chaining.
   */
  patch(opId: string, path: string, value: VariableValue): this {
    this.operations.push({ op_id: opId, method: "PATCH", path, body: { value } });
    return this;
  }

  /**
   * Queues a PUT sub-request that creates or replaces a variable value.
   *
   * @param opId - Caller-supplied identifier to correlate this operation with its result.
   * @param path - Sub-request path.
   * @param value - The value to assign.
   * @returns This builder, for chaining.
   */
  put(opId: string, path: string, value: VariableValue): this {
    this.operations.push({ op_id: opId, method: "PUT", path, body: { value } });
    return this;
  }

  /**
   * Queues a DELETE sub-request that removes a variable value.
   *
   * @param opId - Caller-supplied identifier to correlate this operation with its result.
   * @param path - Sub-request path.
   * @returns This builder, for chaining.
   */
  delete(opId: string, path: string): this {
    this.operations.push({ op_id: opId, method: "DELETE", path });
    return this;
  }

  /**
   * Queues a GET sub-request that reads a variable value.
   *
   * @param opId - Caller-supplied identifier to correlate this operation with its result.
   * @param path - Sub-request path.
   * @returns This builder, for chaining.
   */
  get(opId: string, path: string): this {
    this.operations.push({ op_id: opId, method: "GET", path });
    return this;
  }

  /**
   * Appends a pre-built operation. Escape hatch for callers assembling
   * operations programmatically.
   *
   * @param operations - One or more operations to append.
   * @returns This builder, for chaining.
   */
  add(...operations: BatchOperation[]): this {
    this.operations.push(...operations);
    return this;
  }

  /**
   * The number of operations queued so far.
   */
  get size(): number {
    return this.operations.length;
  }

  /**
   * Returns a copy of the queued operations without sending them. Useful for
   * inspection, logging, or tests.
   */
  toOperations(): BatchOperation[] {
    return [...this.operations];
  }

  /**
   * Sends the accumulated operations as a single batch request.
   *
   * @returns The {@link BatchResult} reported by the server.
   */
  execute(): Promise<BatchResult> {
    return this.executor(this.toOperations());
  }
}
