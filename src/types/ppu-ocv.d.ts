/**
 * Ambient TypeScript declarations for `ppu-ocv`.
 *
 * Put this file under `src/types/ppu-ocv.d.ts` when TypeScript cannot resolve
 * the package declarations, or when another generated declaration file uses
 * `import("ppu-ocv")` / `import type { Canvas } from "ppu-ocv"`.
 */

declare module "ppu-ocv" {
  /** A 2D point in canvas pixel coordinates. */
  export interface Coordinate {
    x: number;
    y: number;
  }

  /** Rectangle corner points. */
  export interface Points {
    topLeft: Coordinate;
    topRight: Coordinate;
    bottomLeft: Coordinate;
    bottomRight: Coordinate;
  }

  /** Axis-aligned bounding box; x1/y1 are exclusive. */
  export interface BoundingBox {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }

  /** Structural canvas type accepted by ppu-ocv across Node/Bun/browser runtimes. */
  export interface CanvasLike {
    width: number;
    height: number;
    getContext(contextId: "2d"): Context2DLike | null;
    toBuffer?: (...args: any[]) => Uint8Array;
    toDataURL?: (...args: any[]) => string;
  }

  /** Minimal cross-runtime CanvasRenderingContext2D subset used by ppu-ocv. */
  export interface Context2DLike {
    canvas: CanvasLike | any;
    drawImage(...args: any[]): void;
    getImageData(
      sx: number,
      sy: number,
      sw: number,
      sh: number,
    ): { data: Uint8ClampedArray; width: number; height: number };
    putImageData(imageData: any, dx: number, dy: number): void;
    createImageData(width: number, height: number): any;
    beginPath(): void;
    closePath(): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    stroke(): void;
    strokeRect(x: number, y: number, w: number, h: number): void;
    fillRect(x: number, y: number, w: number, h: number): void;
    save(): void;
    restore(): void;
    translate(x: number, y: number): void;
    rotate(angle: number): void;
    strokeStyle: any;
    fillStyle: any;
    lineWidth: number;
  }

  /** Node/Bun Canvas export shape from `@napi-rs/canvas`. */
  export class Canvas implements CanvasLike {
    constructor(width: number, height: number);
    width: number;
    height: number;
    getContext(contextId: "2d"): Context2DLike;
    toBuffer(...args: any[]): Buffer;
    toDataURL(...args: any[]): string;
  }

  export class ImageData {
    constructor(data: Uint8ClampedArray, width: number, height?: number);
    readonly data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;
  }

  export function createCanvas(width: number, height: number): Canvas;
  export function loadImage(source: string | ArrayBuffer | Uint8Array): Promise<any>;

  /** OpenCV.js namespace. Kept structurally typed to avoid requiring OpenCV typings. */
  export namespace cv {
    class Mat {
      rows: number;
      cols: number;
      delete(): void;
      clone(): Mat;
      roi(rect: Rect): Mat;
      data?: Uint8Array | Uint8ClampedArray;
      data8S?: Int8Array;
      data16U?: Uint16Array;
      data16S?: Int16Array;
      data32S?: Int32Array;
      data32F?: Float32Array;
      data64F?: Float64Array;
    }
    class Size {
      constructor(width: number, height: number);
      width: number;
      height: number;
    }
    class Point {
      constructor(x: number, y: number);
      x: number;
      y: number;
    }
    class Rect {
      constructor(x: number, y: number, width: number, height: number);
      x: number;
      y: number;
      width: number;
      height: number;
    }
    class Scalar {
      constructor(v0?: number, v1?: number, v2?: number, v3?: number);
    }
  }

  export interface CanvasPlatform {
    createCanvas(width: number, height: number): CanvasLike;
    loadImage(source: ArrayBuffer | string): Promise<CanvasLike>;
    isCanvas(value: unknown): value is CanvasLike;
  }

  export function setPlatform(platform: CanvasPlatform): void;
  export function getPlatform(): CanvasPlatform;

  export type ContourLike = any;

  export interface DetectedRegion {
    bbox: BoundingBox;
    area: number;
  }

  export interface GrayscaleOptions {}
  export interface BlurOptions {
    ksize?: [number, number] | { width: number; height: number };
    sigmaX?: number;
    sigmaY?: number;
  }
  export interface ThresholdOptions {
    thresh?: number;
    maxValue?: number;
    type?: number;
  }
  export interface AdaptiveThresholdOptions {
    maxValue?: number;
    adaptiveMethod?: number;
    thresholdType?: number;
    blockSize?: number;
    C?: number;
  }
  export interface InvertOptions {}
  export interface CannyOptions {
    threshold1?: number;
    threshold2?: number;
    apertureSize?: number;
    L2gradient?: boolean;
  }
  export interface DilateOptions {
    kernelSize?: number | [number, number];
    iterations?: number;
  }
  export interface ErodeOptions {
    kernelSize?: number | [number, number];
    iterations?: number;
  }
  export interface BorderOptions {
    size?: number;
    color?: string | number[];
  }
  export interface ResizeOptions {
    width: number;
    height: number;
  }
  export interface RotateOptions {
    angle: number;
    cx?: number;
    cy?: number;
  }
  export interface WarpOptions {
    sourcePoints?: Coordinate[];
    destinationPoints?: Coordinate[];
    width?: number;
    height?: number;
    points?: Points | Coordinate[];
  }
  export interface ConvertOptions {
    rtype?: number;
    alpha?: number;
    beta?: number;
  }
  export interface MorphologicalGradientOptions {
    kernelSize?: number | [number, number];
  }

  export interface OperationResult {
    img: cv.Mat;
    width: number;
    height: number;
  }

  export interface RequiredOptions {
    readonly __requiredOptionsBrand?: never;
  }

  export interface PartialOptions {
    readonly __partialOptionsBrand?: never;
  }

  export type OperationFunction<T> = (img: cv.Mat, options: T) => OperationResult;

  export interface RegisteredOperations {
    adaptiveThreshold: AdaptiveThresholdOptions;
    blur: BlurOptions;
    border: BorderOptions;
    canny: CannyOptions;
    convert: ConvertOptions;
    dilate: DilateOptions;
    erode: ErodeOptions;
    grayscale: GrayscaleOptions;
    invert: InvertOptions;
    morphologicalGradient: MorphologicalGradientOptions;
    resize: ResizeOptions;
    rotate: RotateOptions;
    threshold: ThresholdOptions;
    warp: WarpOptions;
  }

  export type OperationName = keyof RegisteredOperations;
  export type OperationOptions<N extends OperationName> = RegisteredOperations[N];
  export type OperationResultMap = { [N in OperationName]: OperationResult };

  export function executeOperation<N extends OperationName>(
    name: N,
    img: cv.Mat,
    options: OperationOptions<N>,
  ): OperationResult;

  export class OperationRegistry {
    register<N extends OperationName>(name: N, operation: OperationFunction<OperationOptions<N>>): void;
    get<N extends OperationName>(name: N): OperationFunction<OperationOptions<N>> | undefined;
    has(name: string): boolean;
  }

  export const registry: OperationRegistry;

  export class CanvasToolkitBase {
    constructor(canvas: CanvasLike);
    readonly canvas: CanvasLike;
    readonly ctx: Context2DLike;
    readonly width: number;
    readonly height: number;
    toCanvas(): CanvasLike;
  }

  export class CanvasToolkit extends CanvasToolkitBase {
    static from(source: CanvasLike | ArrayBuffer | string): Promise<CanvasToolkit>;
    clone(): CanvasToolkit;
  }

  export class CanvasProcessor {
    constructor(source: CanvasLike);
    readonly width: number;
    readonly height: number;
    resize(options: ResizeOptions): this;
    grayscale(): this;
    convert(options?: { alpha?: number; beta?: number }): this;
    invert(): this;
    threshold(options?: { thresh?: number; maxValue?: number }): this;
    border(options?: { size?: number; color?: string }): this;
    rotate(options: RotateOptions): this;
    findRegions(options?: {
      foreground?: "light" | "dark";
      thresh?: number;
      minArea?: number;
      maxArea?: number;
      padding?: { vertical?: number; horizontal?: number };
      scale?: number;
    }): DetectedRegion[];
    toCanvas(): CanvasLike;
    static prepareCanvas(file: ArrayBuffer | CanvasLike): Promise<CanvasLike>;
    static prepareBuffer(canvas: CanvasLike | ArrayBuffer): Promise<ArrayBuffer>;
  }

  export class ImageProcessor {
    img: cv.Mat;
    width: number;
    height: number;
    constructor(source: CanvasLike | cv.Mat);
    static initRuntime(): Promise<void>;
    execute<N extends OperationName>(operationName: N, options?: Partial<OperationOptions<N>>): this;
    grayscale(options?: Partial<GrayscaleOptions>): this;
    blur(options?: Partial<BlurOptions>): this;
    threshold(options?: Partial<ThresholdOptions>): this;
    adaptiveThreshold(options?: Partial<AdaptiveThresholdOptions>): this;
    invert(options?: Partial<InvertOptions>): this;
    canny(options?: Partial<CannyOptions>): this;
    dilate(options?: Partial<DilateOptions>): this;
    erode(options?: Partial<ErodeOptions>): this;
    border(options?: Partial<BorderOptions>): this;
    resize(options: ResizeOptions): this;
    rotate(options: RotateOptions): this;
    warp(options: WarpOptions): this;
    convert(options: ConvertOptions): this;
    morphologicalGradient(options?: Partial<MorphologicalGradientOptions>): this;
    toMat(): cv.Mat;
    toCanvas(): CanvasLike;
    destroy(): void;
  }

  export class Contours {
    constructor(source: cv.Mat | CanvasLike);
    findContours(...args: any[]): any;
    extractBoxesFromContours(...args: any[]): BoundingBox[];
    destroy(): void;
  }

  export interface CalculateMeanLightnessOptions {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }

  export function calculateMeanGrayscaleValue(
    canvas: CanvasLike,
    options?: CalculateMeanLightnessOptions,
  ): number;

  export function calculateMeanNormalizedLabLightness(
    canvas: CanvasLike,
    options?: CalculateMeanLightnessOptions,
  ): number;

  export interface DeskewOptions {
    maxAngle?: number;
    angleStep?: number;
    threshold?: number;
  }

  export class DeskewService {
    constructor(options?: DeskewOptions);
    deskew(canvas: CanvasLike): Promise<CanvasLike> | CanvasLike;
  }
}

/** Browser OpenCV entry point. */
declare module "ppu-ocv/web" {
  export * from "ppu-ocv";
}

/** Canvas-only Node/Bun entry point. */
declare module "ppu-ocv/canvas" {
  export * from "ppu-ocv";
}

/** Canvas-only browser entry point. */
declare module "ppu-ocv/canvas-web" {
  export * from "ppu-ocv";
}
