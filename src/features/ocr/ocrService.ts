import type {
  PaddleOcrService,
  PaddleOptions,
  RecognitionResult,
} from 'ppu-paddle-ocr/web'
import type { OcrResult } from '../../types/scoring'

export type OcrLanguage = 'chinese' | 'english'

interface OcrLanguageOption {
  id: OcrLanguage
  label: string
  description: string
}

const MODEL_BASE_URL =
  'https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/main'
const DICT_BASE_URL =
  'https://raw.githubusercontent.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/main'

export const ocrLanguageOptions: OcrLanguageOption[] = [
  {
    id: 'chinese',
    label: '中文',
    description: 'PP-OCRv5 通用中日英辨識模型',
  },
  {
    id: 'english',
    label: 'English',
    description: 'PP-OCRv5 英文辨識模型',
  },
]

function createBaseOptions(): PaddleOptions {
  return {
    debugging: {
      verbose: false,
      debug: false,
    },
    session: {
      graphOptimizationLevel: 'all',
    },
  }
}

function createPaddleOptions(language: OcrLanguage): PaddleOptions {
  const baseOptions = createBaseOptions()

  if (language === 'english') {
    return baseOptions
  }

  return {
    ...baseOptions,
    model: {
      recognition: `${MODEL_BASE_URL}/recognition/PP-OCRv5_mobile_rec_infer.onnx`,
      charactersDictionary: `${DICT_BASE_URL}/recognition/ppocrv5_dict.txt`,
    },
  }
}

function toOcrResult(result: RecognitionResult): OcrResult {
  return {
    text: result.text,
    confidence: result.confidence,
    box: {
      x: result.box.x,
      y: result.box.y,
      width: result.box.width,
      height: result.box.height,
    },
  }
}

async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = objectUrl
    await image.decode()

    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight

    const context = canvas.getContext('2d', { willReadFrequently: true })

    if (!context) {
      throw new Error('瀏覽器無法建立 Canvas 2D 環境。')
    }

    context.drawImage(image, 0, 0)
    return canvas
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function createPaddleService(language: OcrLanguage) {
  const { PaddleOcrService } = await import('ppu-paddle-ocr/web')

  return new PaddleOcrService(createPaddleOptions(language))
}

export async function recognizeImageFile(
  service: PaddleOcrService,
  file: File,
): Promise<OcrResult[]> {
  const canvas = await fileToCanvas(file)
  const result = await service.recognize(canvas, {
    flatten: true,
    noCache: true,
  })

  return result.results
    .filter((item) => item.text.trim().length > 0)
    .map(toOcrResult)
}
