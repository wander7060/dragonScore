// ppu-paddle-ocr.d.ts
// Standalone TypeScript declaration for the public ppu-paddle-ocr API.
// Targets ppu-paddle-ocr v5.1.x public entrypoints: "ppu-paddle-ocr" and "ppu-paddle-ocr/web".
declare module "ppu-paddle-ocr" {
    /** Image processing engine used during OCR preprocessing. */
    export type ProcessingEngine = "opencv" | "canvas-native";

    /** Rectangle in pixel coordinates. */
    export interface Box {
        /** X-coordinate of the top-left corner. */
        x: number;
        /** Y-coordinate of the top-left corner. */
        y: number;
        /** Width of the box in pixels. */
        width: number;
        /** Height of the box in pixels. */
        height: number;
    }

    /** OCR model and dictionary path/buffer options. */
    export interface ModelPathOptions {
        /** ONNX file buffer, local path, or URL for the text detection model. */
        detection?: ArrayBuffer | string;
        /** ONNX file buffer, local path, or URL for the text recognition model. */
        recognition?: ArrayBuffer | string;
        /** Character dictionary buffer, local path, URL, or dictionary text. */
        charactersDictionary?: ArrayBuffer | string;
    }

    /** Debug logging and intermediate-image output options. */
    export interface DebuggingOptions {
        /** Enable detailed logging. */
        verbose?: boolean;
        /** Save intermediate images for inspection. */
        debug?: boolean;
        /** Folder for debug output. */
        debugFolder?: string;
    }

    /** Text detection preprocessing/filtering options. */
    export interface DetectionOptions {
        /** Per-channel mean values, usually RGB. */
        mean?: [number, number, number];
        /** Per-channel standard deviation values, usually RGB. */
        stdDeviation?: [number, number, number];
        /** Maximum image side length before detection preprocessing. */
        maxSideLength?: number;
        /** Vertical padding added to detected boxes as a fraction of height. */
        paddingVertical?: number;
        /** Horizontal padding added to detected boxes as a fraction of width. */
        paddingHorizontal?: number;
        /** Remove boxes with area below this pixel threshold. */
        minimumAreaThreshold?: number;
    }

    /** Text recognition preprocessing/decoding options. */
    export interface RecognitionOptions {
        /** Fixed model input image height. */
        imageHeight?: number;
        /** Loaded character dictionary used for recognition decoding. */
        charactersDictionary: string[];
    }

    /** Per-call options for recognize(). */
    export interface RecognizeOptions {
        /** Return flat OCR results instead of line-grouped results. */
        flatten?: boolean;
        /** Custom dictionary for this OCR call. Disables cache for the call. */
        dictionary?: string | ArrayBuffer;
        /** Disable caching for this OCR call. */
        noCache?: boolean;
    }

    /** Image processing backend options. */
    export interface ProcessingOptions {
        /** Processing engine. Node defaults to opencv; web uses canvas-native. */
        engine?: ProcessingEngine;
    }

    /** ONNX Runtime session options accepted by the service. */
    export interface SessionOptions {
        /** Execution providers, for example cpu/cuda depending on runtime support. */
        executionProviders?: string[];
        /** ONNX graph optimization level. */
        graphOptimizationLevel?: "disabled" | "basic" | "extended" | "layout" | "all";
        /** Enable CPU memory arena. */
        enableCpuMemArena?: boolean;
        /** Enable memory pattern optimization. */
        enableMemPattern?: boolean;
        /** ONNX Runtime execution mode. */
        executionMode?: "sequential" | "parallel";
        /** Number of inter-op threads. */
        interOpNumThreads?: number;
        /** Number of intra-op threads. */
        intraOpNumThreads?: number;
    }

    /** Full PaddleOCR service configuration. */
    export interface PaddleOptions {
        /** OCR model/dictionary inputs. */
        model?: ModelPathOptions;
        /** Detection-stage options. */
        detection?: DetectionOptions;
        /** Recognition-stage options. */
        recognition?: RecognitionOptions;
        /** Debug/logging options. */
        debugging?: DebuggingOptions;
        /** ONNX Runtime session options. */
        session?: SessionOptions;
        /** Image processing backend options. */
        processing?: ProcessingOptions;
    }

    /** Output from detection preprocessing. */
    export interface PreprocessDetectionResult {
        /** Normalized float tensor in CHW layout. */
        tensor: Float32Array;
        /** Tensor/canvas width after resize/padding. */
        width: number;
        /** Tensor/canvas height after resize/padding. */
        height: number;
        /** Resize ratio applied to the original image. */
        resizeRatio: number;
        /** Original image width. */
        originalWidth: number;
        /** Original image height. */
        originalHeight: number;
    }

    /** One recognized text item. */
    export interface RecognitionResult {
        /** Recognized text. */
        text: string;
        /** Text region bounding box in original image coordinates. */
        box: Box;
        /** Confidence score from 0 to 1. */
        confidence: number;
    }

    /** OCR result grouped by detected text lines. */
    export interface PaddleOcrResult {
        /** Full extracted text with lines separated by newlines. */
        text: string;
        /** Recognition results grouped by line, in reading order. */
        lines: RecognitionResult[][];
        /** Average confidence from 0 to 1. */
        confidence: number;
    }

    /** OCR result as a flat item list. */
    export interface FlattenedPaddleOcrResult {
        /** Full extracted text as one string. */
        text: string;
        /** All recognized items in reading order. */
        results: RecognitionResult[];
        /** Average confidence from 0 to 1. */
        confidence: number;
    }

    /** Default debugging options. */
    export const DEFAULT_DEBUGGING_OPTIONS: DebuggingOptions;
    /** Default text detection options. */
    export const DEFAULT_DETECTION_OPTIONS: DetectionOptions;
    /** Default text recognition options. */
    export const DEFAULT_RECOGNITION_OPTIONS: RecognitionOptions;
    /** Default image processing engine. */
    export const DEFAULT_PROCESSING_ENGINE: ProcessingEngine;
    /** Default image processing options. */
    export const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions;
    /** Default combined PaddleOCR options. */
    export const DEFAULT_PADDLE_OPTIONS: PaddleOptions;

    /** Node/Bun/Deno text detection service. */
    export class DetectionService {
        constructor(
            session: import("onnxruntime-node").InferenceSession,
            options?: Partial<DetectionOptions>,
            debugging?: Partial<DebuggingOptions>,
            engine?: ProcessingEngine,
        );

        run(image: ArrayBuffer | import("ppu-ocv").Canvas): Promise<Box[]>;
    }

    /** Node/Bun/Deno text recognition service. */
    export class RecognitionService {
        constructor(
            session: import("onnxruntime-node").InferenceSession,
            options?: Partial<RecognitionOptions>,
            debugging?: Partial<DebuggingOptions>,
            engine?: ProcessingEngine,
        );

        run(
            image: ArrayBuffer | import("ppu-ocv").Canvas,
            detection: Box[],
            charactersDictionary?: string[],
        ): Promise<RecognitionResult[]>;
    }

    /** Main Node/Bun/Deno PaddleOCR service. */
    export class PaddleOcrService {
        constructor(options?: PaddleOptions);

        /** Load models, dictionary, ONNX sessions, and processing runtime. */
        initialize(): Promise<void>;

        /** Whether initialize() has completed successfully. */
        isInitialized(): boolean;

        /** Replace the detection model for this instance. */
        changeDetectionModel(model: ArrayBuffer | string): Promise<void>;

        /** Replace the recognition model for this instance. */
        changeRecognitionModel(model: ArrayBuffer | string): Promise<void>;

        /** Replace the text dictionary for this instance. */
        changeTextDictionary(dictionary: ArrayBuffer | string): Promise<void>;

        /** Recognize text and return flattened OCR results. */
        recognize(
            image: ArrayBuffer | import("ppu-ocv").Canvas,
            options: RecognizeOptions & { flatten: true },
        ): Promise<FlattenedPaddleOcrResult>;

        /** Recognize text and return line-grouped OCR results. */
        recognize(
            image: ArrayBuffer | import("ppu-ocv").Canvas,
            options?: RecognizeOptions & { flatten?: false },
        ): Promise<PaddleOcrResult>;

        /** Delete locally cached ONNX model files. */
        clearModelCache(): void;

        /** Release ONNX sessions and other resources. */
        destroy(): Promise<void>;
    }

    export default PaddleOcrService;
}

declare module "ppu-paddle-ocr/web" {
    export type {
        Box,
        DebuggingOptions,
        DetectionOptions,
        FlattenedPaddleOcrResult,
        ModelPathOptions,
        PaddleOcrResult,
        PaddleOptions,
        PreprocessDetectionResult,
        ProcessingEngine,
        ProcessingOptions,
        RecognitionOptions,
        RecognitionResult,
        RecognizeOptions,
        SessionOptions,
    } from "ppu-paddle-ocr";

    export {
        DEFAULT_DEBUGGING_OPTIONS,
        DEFAULT_DETECTION_OPTIONS,
        DEFAULT_PADDLE_OPTIONS,
        DEFAULT_PROCESSING_ENGINE,
        DEFAULT_PROCESSING_OPTIONS,
        DEFAULT_RECOGNITION_OPTIONS,
    } from "ppu-paddle-ocr";

    import type {
        Box,
        DebuggingOptions,
        DetectionOptions,
        FlattenedPaddleOcrResult,
        PaddleOcrResult,
        PaddleOptions,
        RecognitionOptions,
        RecognitionResult,
        RecognizeOptions,
    } from "ppu-paddle-ocr";

    /** Browser/Web text detection service. */
    export class DetectionService {
        constructor(
            session: import("onnxruntime-web").InferenceSession,
            options?: Partial<DetectionOptions>,
            debugging?: Partial<DebuggingOptions>,
        );

        run(image: ArrayBuffer | import("ppu-ocv/web").CanvasLike): Promise<Box[]>;
    }

    /** Browser/Web text recognition service. */
    export class RecognitionService {
        constructor(
            session: import("onnxruntime-web").InferenceSession,
            options?: Partial<RecognitionOptions>,
            debugging?: Partial<DebuggingOptions>,
        );

        run(
            image: ArrayBuffer | import("ppu-ocv/web").CanvasLike,
            detection: Box[],
            charactersDictionary?: string[],
        ): Promise<RecognitionResult[]>;
    }

    /** Main browser/web PaddleOCR service. */
    export class PaddleOcrService {
        constructor(options?: PaddleOptions);

        /** Load models, dictionary, ONNX sessions, and processing runtime. */
        initialize(): Promise<void>;

        /** Whether initialize() has completed successfully. */
        isInitialized(): boolean;

        /** Replace the detection model for this instance. */
        changeDetectionModel(model: ArrayBuffer | string): Promise<void>;

        /** Replace the recognition model for this instance. */
        changeRecognitionModel(model: ArrayBuffer | string): Promise<void>;

        /** Replace the text dictionary for this instance. */
        changeTextDictionary(dictionary: ArrayBuffer | string): Promise<void>;

        /** Recognize text and return flattened OCR results. */
        recognize(
            image: ArrayBuffer | import("ppu-ocv/web").CanvasLike,
            options: RecognizeOptions & { flatten: true },
        ): Promise<FlattenedPaddleOcrResult>;

        /** Recognize text and return line-grouped OCR results. */
        recognize(
            image: ArrayBuffer | import("ppu-ocv/web").CanvasLike,
            options?: RecognizeOptions & { flatten?: false },
        ): Promise<PaddleOcrResult>;

        /** Release ONNX sessions and other resources. */
        destroy(): Promise<void>;
    }

    export default PaddleOcrService;
}
