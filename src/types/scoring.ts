export interface OcrBox {
  x: number
  y: number
  width: number
  height: number
}

export interface OcrResult {
  text: string
  confidence: number
  box: OcrBox
}

export interface ScoreRule {
  id: string
  text: string
  score: number
}

export interface RecognizedLine {
  id: string
  text: string
  items: OcrResult[]
  box: OcrBox
}

export interface LineMatch {
  lineId: string
  lineText: string
  ruleId: string
  keyword: string
  score: number
  counted: boolean
}

export interface ScoredOcrItem {
  item: OcrResult
  score: number
}

export interface ScoreSummary {
  recognizedLines: RecognizedLine[]
  matches: LineMatch[]
  itemScores: ScoredOcrItem[]
  totalScore: number
}

export interface PublicScoreRule {
  text: string
  score: number
}
