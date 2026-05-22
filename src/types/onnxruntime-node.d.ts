/**
 * Ambient TypeScript declarations for `onnxruntime-node` and the common ORT API.
 *
 * Put this file under `src/types/onnxruntime-node.d.ts` when TypeScript cannot
 * resolve the package declarations, or when a generated declaration file uses
 * `import("onnxruntime-node")`.
 */
declare module "onnxruntime-common" {
  export type TypedTensorData =
    | Float32Array
    | Uint8Array
    | Int8Array
    | Uint16Array
    | Int16Array
    | Int32Array
    | BigInt64Array
    | Float64Array
    | Uint32Array
    | BigUint64Array;

  export type TensorDataType =
    | "float32"
    | "uint8"
    | "int8"
    | "uint16"
    | "int16"
    | "int32"
    | "int64"
    | "string"
    | "bool"
    | "float16"
    | "float64"
    | "uint32"
    | "uint64";

  export type TensorData = TypedTensorData | readonly string[] | readonly boolean[];

  export class Tensor<T extends TensorDataType = TensorDataType> {
    constructor(type: T, data: TensorData, dims?: readonly number[]);
    readonly type: T;
    readonly data: TensorData;
    readonly dims: readonly number[];
    readonly size: number;
    get(...indices: number[]): number | bigint | string | boolean;
    set(value: number | bigint | string | boolean, ...indices: number[]): void;
  }

  export type OnnxValue = Tensor | null;

  export interface Env {
    wasm?: Record<string, unknown>;
    webgl?: Record<string, unknown>;
    webgpu?: Record<string, unknown>;
    versions?: Record<string, string>;
    logLevel?: "verbose" | "info" | "warning" | "error" | "fatal";
    debug?: boolean;
    [key: string]: unknown;
  }

  export const env: Env;

  export interface InferenceSession {
    readonly inputNames: readonly string[];
    readonly outputNames: readonly string[];
    run(
      feeds: InferenceSession.FeedsType,
      fetches?: InferenceSession.FetchesType | readonly string[] | InferenceSession.RunOptions,
      options?: InferenceSession.RunOptions,
    ): Promise<InferenceSession.ReturnType>;
    release(): Promise<void>;
    startProfiling?(): void;
    endProfiling?(): void;
  }

  export namespace InferenceSession {
    export type ExecutionProviderOption = string | { name: string; [key: string]: unknown };

    export interface SessionOptions {
      executionProviders?: readonly ExecutionProviderOption[];
      executionMode?: "sequential" | "parallel";
      graphOptimizationLevel?: "disabled" | "basic" | "extended" | "all";
      intraOpNumThreads?: number;
      interOpNumThreads?: number;
      enableCpuMemArena?: boolean;
      enableMemPattern?: boolean;
      executionOrder?: "default" | "priority-based";
      enableProfiling?: boolean;
      optimizedModelFilePath?: string;
      logId?: string;
      logSeverityLevel?: 0 | 1 | 2 | 3 | 4;
      logVerbosityLevel?: number;
      freeDimensionOverrides?: Record<string, number>;
      extra?: Record<string, unknown>;
      [key: string]: unknown;
    }

    export interface RunOptions {
      logSeverityLevel?: 0 | 1 | 2 | 3 | 4;
      logVerbosityLevel?: number;
      terminate?: boolean;
      tag?: string;
      [key: string]: unknown;
    }

    export type FeedsType = Record<string, OnnxValue>;
    export type FetchesType = Record<string, OnnxValue | null>;
    export type ReturnType = Record<string, OnnxValue>;

    export function create(
      uri: string,
      options?: SessionOptions,
    ): Promise<InferenceSession>;
    export function create(
      buffer: ArrayBuffer | Uint8Array,
      options?: SessionOptions,
    ): Promise<InferenceSession>;
  }
}

declare module "onnxruntime-node" {
  export * from "onnxruntime-common";

  /** Backend descriptor returned by the Node binding. */
  export interface SupportedBackend {
    /** Backend / execution provider name, e.g. "cpu", "cuda", "dml". */
    name: string;
    /** Whether the backend is bundled with the current package build. */
    bundled: boolean;
  }

  /** Return the execution backends supported by the installed native binding. */
  export function listSupportedBackends(): SupportedBackend[];
}
