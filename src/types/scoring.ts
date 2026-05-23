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

export type MatchMode = 'exact' | 'fuzzySentence'
export type MatchType = 'exact' | 'fuzzy'

export interface ScoreRule {
  id: string
  text: string
  score: number
  matchMode: MatchMode
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
  matchType: MatchType
  rawDistance?: number
  similarity?: number
  ambiguous?: boolean
  ambiguousOptions?: AmbiguousMatchOption[]
  resolvedByUser?: boolean
  ignored?: boolean
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
  matchMode: MatchMode
}

export interface FuzzySentenceOptions {
  minKeywordLength: number
  minSimilarity: number
  minScoreGap: number
  maxRawDistance: number
  maxDistanceRatio: number
}

export interface LineGroupingOptions {
  centerThresholdRatio: number
}

export interface MatchCandidate {
  lineId: string
  lineText: string
  ruleId: string
  keyword: string
  score: number
  matchType: MatchType
  rawDistance: number
  similarity: number
  ambiguous: boolean
}

export interface AmbiguousMatchOption {
  ruleId: string
  keyword: string
  score: number
  rawDistance: number
  similarity: number
}

export interface AmbiguousMatchResolution {
  lineId: string
  selectedRuleId: string
}
