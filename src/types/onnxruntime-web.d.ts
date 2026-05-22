// TypeScript declarations for onnxruntime-web ambient module shim.
// Intended for projects where the package's bundled declarations are not picked up
// or for handwritten declaration setups alongside onnxruntime-common.

/// <reference lib="dom" />
/// <reference lib="webworker" />

declare module "onnxruntime-web" {
  export * from "onnxruntime-common";

  import type {
    Env as CommonEnv,
    InferenceSession as CommonInferenceSession,
    Tensor as CommonTensor,
    TypedTensor as CommonTypedTensor,
    OnnxValue as CommonOnnxValue,
    TrainingSession as CommonTrainingSession,
  } from "onnxruntime-common";

  export type ExecutionProviderName =
    | "wasm"
    | "webgl"
    | "webgpu"
    | "webnn"
    | "cpu"
    | "xnnpack"
    | string;

  export type WasmPaths =
    | string
    | Partial<Record<WasmArtifactName | string, string>>;

  export type WasmArtifactName =
    | "ort-wasm.wasm"
    | "ort-wasm-simd.wasm"
    | "ort-wasm-threaded.wasm"
    | "ort-wasm-simd-threaded.wasm"
    | "ort-training-wasm-simd.wasm"
    | "ort-training-wasm-simd-threaded.wasm"
    | "ort-wasm.js"
    | "ort-wasm-simd.js"
    | "ort-wasm-threaded.js"
    | "ort-wasm-simd-threaded.js"
    | "ort-wasm.worker.js"
    | "ort-wasm-threaded.worker.js"
    | "ort-wasm-simd-threaded.worker.js"
    | "ort.jsep.wasm"
    | "ort.jsep.mjs";

  export interface WasmEnv {
    /** Override the location of ORT Web WASM / worker artifacts. */
    wasmPaths?: WasmPaths;
    /** Number of WASM workers. Set to 1 to disable multithreading. */
    numThreads?: number;
    /** Enable or disable SIMD explicitly. */
    simd?: boolean;
    /** Proxy inference execution to a worker when supported. */
    proxy?: boolean;
    /** Use JSEP build where available. */
    jsep?: boolean;
    /** Initialize WASM backend with an existing WebAssembly.Module. */
    wasmBinary?: ArrayBuffer | Uint8Array | WebAssembly.Module;
    /** Power preference hint used by supported backends. */
    powerPreference?: "default" | "high-performance" | "low-power";
    /** Optional init timeout in milliseconds. */
    initTimeout?: number;
  }

  export interface WebGLEnv {
    /** Optional WebGL context id. */
    contextId?: "webgl" | "webgl2";
    /** Enable WebGL context reuse. */
    context?: WebGLRenderingContext | WebGL2RenderingContext;
    /** Enable/disable WebGL packed texture optimization. */
    pack?: boolean;
    /** Optional texture cache mode. */
    textureCacheMode?: "initializerOnly" | "full" | string;
  }

  export interface WebGPUEnv {
    /** Optional externally created GPU device. */
    device?: GPUDevice;
    /** Optional adapter selected by the application. */
    adapter?: GPUAdapter;
    /** Preferred GPU power profile. */
    powerPreference?: GPUPowerPreference;
    /** Optional profiling / validation flags used by ORT Web builds. */
    profiling?: boolean;
  }

  export interface WebNNEnv {
    /** WebNN device type preference. */
    deviceType?: "cpu" | "gpu" | "npu" | string;
    /** WebNN power preference. */
    powerPreference?: "default" | "high-performance" | "low-power";
    /** Optional WebNN context. Kept loose because WebNN typings vary by TS/lib version. */
    context?: unknown;
  }

  export interface WebEnv extends CommonEnv {
    wasm: WasmEnv;
    webgl?: WebGLEnv;
    webgpu?: WebGPUEnv;
    webnn?: WebNNEnv;
  }

  export const env: WebEnv;

  export namespace Tensor {
    export type Type = CommonTensor.Type;
    export type DataType = CommonTensor.DataType;
    export type ElementType = CommonTensor.ElementType;
    export type DataLocation = CommonTensor.DataLocation;
  }

  export namespace InferenceSession {
    export type FeedsType = CommonInferenceSession.FeedsType;
    export type FetchesType = CommonInferenceSession.FetchesType;
    export type ReturnType = CommonInferenceSession.ReturnType;
    export type RunOptions = CommonInferenceSession.RunOptions;

    export type ExecutionProviderConfig =
      | ExecutionProviderName
      | {
          name: ExecutionProviderName;
          deviceType?: "cpu" | "gpu" | "npu" | string;
          powerPreference?: "default" | "high-performance" | "low-power";
          forceFallback?: boolean;
          [key: string]: unknown;
        };

    export interface SessionOptions
      extends Omit<CommonInferenceSession.SessionOptions, "executionProviders"> {
      executionProviders?: ExecutionProviderConfig[];
      preferredOutputLocation?: Record<string, Tensor.DataLocation>;
      freeDimensionOverrides?: Record<string, number>;
      logId?: string;
      logSeverityLevel?: 0 | 1 | 2 | 3 | 4;
      logVerbosityLevel?: number;
      enableCpuMemArena?: boolean;
      enableMemPattern?: boolean;
      enableProfiling?: boolean;
      executionMode?: "sequential" | "parallel";
      graphOptimizationLevel?: "disabled" | "basic" | "extended" | "all";
      intraOpNumThreads?: number;
      interOpNumThreads?: number;
      extra?: Record<string, unknown>;
    }
  }

  export type OnnxValue = CommonOnnxValue;
  export type Tensor = CommonTensor;
  export type TypedTensor<T extends Tensor.Type = Tensor.Type> = CommonTypedTensor<T>;

  export interface InferenceSession extends CommonInferenceSession {}

  export const InferenceSession: {
    create(
      uri: string,
      options?: InferenceSession.SessionOptions
    ): Promise<InferenceSession>;
    create(
      buffer: ArrayBufferLike | Uint8Array,
      options?: InferenceSession.SessionOptions
    ): Promise<InferenceSession>;
    create(
      model: ArrayBufferLike | Uint8Array | string,
      options?: InferenceSession.SessionOptions
    ): Promise<InferenceSession>;
  };

  export const Tensor: typeof CommonTensor;

  export interface TrainingSession extends CommonTrainingSession {}
  export const TrainingSession: typeof CommonTrainingSession;
}

declare module "onnxruntime-web/webgpu" {
  export * from "onnxruntime-web";
}

declare module "onnxruntime-web/experimental" {
  export * from "onnxruntime-web";
}

declare module "onnxruntime-web/all" {
  export * from "onnxruntime-web";
}
