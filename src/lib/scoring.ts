import type {
  AmbiguousMatchOption,
  AmbiguousMatchResolution,
  FuzzySentenceOptions,
  LineMatch,
  LineGroupingOptions,
  MatchCandidate,
  OcrResult,
  RecognizedLine,
  ScoreRule,
  ScoreSummary,
} from '../types/scoring'

export const DEFAULT_FUZZY_SENTENCE_OPTIONS: FuzzySentenceOptions = {
  minKeywordLength: 8,
  minSimilarity: 0.88,
  minScoreGap: 0.05,
  maxRawDistance: 3,
  maxDistanceRatio: 0.18,
}

export const DEFAULT_LINE_GROUPING_OPTIONS: LineGroupingOptions = {
  centerThresholdRatio: 0.55,
}

interface IndexedScoreRule {
  rule: ScoreRule
  index: number
}

interface RankedMatchCandidate extends MatchCandidate {
  ruleIndex: number
}

interface LineBucket {
  centerY: number
  averageHeight: number
  items: OcrResult[]
}

function getCenterY(result: OcrResult) {
  return result.box.y + result.box.height / 2
}

function getUnionBox(items: OcrResult[]) {
  const left = Math.min(...items.map((item) => item.box.x))
  const top = Math.min(...items.map((item) => item.box.y))
  const right = Math.max(...items.map((item) => item.box.x + item.box.width))
  const bottom = Math.max(...items.map((item) => item.box.y + item.box.height))

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}

function updateBucket(bucket: LineBucket) {
  const totalHeight = bucket.items.reduce((sum, item) => sum + item.box.height, 0)
  const totalCenter = bucket.items.reduce((sum, item) => sum + getCenterY(item), 0)

  bucket.averageHeight = totalHeight / bucket.items.length
  bucket.centerY = totalCenter / bucket.items.length
}

export function groupOcrResultsIntoLines(
  results: OcrResult[],
  options: LineGroupingOptions = DEFAULT_LINE_GROUPING_OPTIONS,
): RecognizedLine[] {
  const sortedResults = [...results].sort((first, second) => {
    const yDiff = getCenterY(first) - getCenterY(second)

    if (Math.abs(yDiff) > 0.001) {
      return yDiff
    }

    return first.box.x - second.box.x
  })

  const buckets: LineBucket[] = []

  sortedResults.forEach((result) => {
    const centerY = getCenterY(result)
    const matchingBucket = buckets.find((bucket) => {
      const threshold =
        Math.max(bucket.averageHeight, result.box.height) *
        options.centerThresholdRatio

      return Math.abs(centerY - bucket.centerY) <= threshold
    })

    if (matchingBucket) {
      matchingBucket.items.push(result)
      updateBucket(matchingBucket)
      return
    }

    buckets.push({
      centerY,
      averageHeight: result.box.height,
      items: [result],
    })
  })

  return buckets
    .sort((first, second) => first.centerY - second.centerY)
    .map((bucket, index) => {
      const items = [...bucket.items].sort(
        (first, second) => first.box.x - second.box.x,
      )

      return {
        id: `line-${index + 1}`,
        text: items.map((item) => item.text).join(''),
        items,
        box: getUnionBox(items),
      }
    })
}

export function levenshteinDistance(firstText: string, secondText: string) {
  if (firstText === secondText) {
    return 0
  }

  if (firstText.length === 0) {
    return secondText.length
  }

  if (secondText.length === 0) {
    return firstText.length
  }

  const previousRow = Array.from(
    { length: secondText.length + 1 },
    (_, index) => index,
  )
  const currentRow = new Array<number>(secondText.length + 1)

  for (let firstIndex = 1; firstIndex <= firstText.length; firstIndex += 1) {
    currentRow[0] = firstIndex

    for (let secondIndex = 1; secondIndex <= secondText.length; secondIndex += 1) {
      const substitutionCost =
        firstText[firstIndex - 1] === secondText[secondIndex - 1] ? 0 : 1

      currentRow[secondIndex] = Math.min(
        previousRow[secondIndex] + 1,
        currentRow[secondIndex - 1] + 1,
        previousRow[secondIndex - 1] + substitutionCost,
      )
    }

    for (let index = 0; index < previousRow.length; index += 1) {
      previousRow[index] = currentRow[index]
    }
  }

  return previousRow[secondText.length]
}

export function getFuzzySentenceSegments(
  lineText: string,
  keyword: string,
  options: FuzzySentenceOptions = DEFAULT_FUZZY_SENTENCE_OPTIONS,
) {
  const minLength = Math.max(1, keyword.length - options.maxRawDistance)
  const maxLength = Math.min(lineText.length, keyword.length + options.maxRawDistance)
  const segments: string[] = []

  for (let length = minLength; length <= maxLength; length += 1) {
    for (let startIndex = 0; startIndex <= lineText.length - length; startIndex += 1) {
      segments.push(lineText.slice(startIndex, startIndex + length))
    }
  }

  return segments
}

function toAmbiguousOption(candidate: RankedMatchCandidate): AmbiguousMatchOption {
  return {
    ruleId: candidate.ruleId,
    keyword: candidate.keyword,
    score: candidate.score,
    rawDistance: candidate.rawDistance,
    similarity: candidate.similarity,
  }
}

function isCandidateAboveThreshold(
  candidate: RankedMatchCandidate,
  keywordLength: number,
  options: FuzzySentenceOptions,
) {
  return (
    candidate.rawDistance <= options.maxRawDistance &&
    candidate.rawDistance <= Math.floor(keywordLength * options.maxDistanceRatio) &&
    candidate.similarity >= options.minSimilarity
  )
}

export function findBestFuzzySentenceCandidate(
  line: RecognizedLine,
  indexedRule: IndexedScoreRule,
  options: FuzzySentenceOptions = DEFAULT_FUZZY_SENTENCE_OPTIONS,
): RankedMatchCandidate | null {
  const { rule, index } = indexedRule

  if (
    rule.matchMode !== 'fuzzySentence' ||
    rule.text.length < options.minKeywordLength
  ) {
    return null
  }

  const segments = getFuzzySentenceSegments(line.text, rule.text, options)
  let bestCandidate: RankedMatchCandidate | null = null

  for (const segment of segments) {
    const rawDistance = levenshteinDistance(segment, rule.text)
    const similarity =
      1 - rawDistance / Math.max(segment.length, rule.text.length)
    const candidate: RankedMatchCandidate = {
      lineId: line.id,
      lineText: line.text,
      ruleId: rule.id,
      keyword: rule.text,
      score: rule.score,
      matchType: 'fuzzy',
      rawDistance,
      similarity,
      ambiguous: false,
      ruleIndex: index,
    }

    if (
      bestCandidate === null ||
      candidate.similarity > bestCandidate.similarity ||
      (candidate.similarity === bestCandidate.similarity &&
        candidate.rawDistance < bestCandidate.rawDistance)
    ) {
      bestCandidate = candidate
    }
  }

  if (!bestCandidate || !isCandidateAboveThreshold(bestCandidate, rule.text.length, options)) {
    return null
  }

  return bestCandidate
}

function sortFuzzyCandidates(candidates: RankedMatchCandidate[]) {
  return [...candidates].sort((first, second) => {
    if (first.similarity !== second.similarity) {
      return second.similarity - first.similarity
    }

    if (first.rawDistance !== second.rawDistance) {
      return first.rawDistance - second.rawDistance
    }

    return first.ruleIndex - second.ruleIndex
  })
}

export function detectOneCharacterConflictGroups(rules: ScoreRule[]) {
  const groups: string[][] = []

  rules.forEach((rule, firstIndex) => {
    rules.slice(firstIndex + 1).forEach((otherRule) => {
      if (
        rule.text.length !== otherRule.text.length ||
        (rule.matchMode !== 'fuzzySentence' &&
          otherRule.matchMode !== 'fuzzySentence')
      ) {
        return
      }

      let differenceCount = 0

      for (let index = 0; index < rule.text.length; index += 1) {
        if (rule.text[index] !== otherRule.text[index]) {
          differenceCount += 1
        }
      }

      if (differenceCount === 1) {
        groups.push([rule.id, otherRule.id])
      }
    })
  })

  return groups
}

function createLineMatch(
  candidate: RankedMatchCandidate,
  counted: boolean,
  options?: {
    ambiguous?: boolean
    ambiguousOptions?: AmbiguousMatchOption[]
    resolvedByUser?: boolean
  },
): LineMatch {
  return {
    lineId: candidate.lineId,
    lineText: candidate.lineText,
    ruleId: candidate.ruleId,
    keyword: candidate.keyword,
    score: candidate.score,
    counted,
    matchType: candidate.matchType,
    rawDistance:
      candidate.matchType === 'fuzzy' ? candidate.rawDistance : undefined,
    similarity:
      candidate.matchType === 'fuzzy' ? candidate.similarity : undefined,
    ambiguous: options?.ambiguous ?? false,
    ambiguousOptions: options?.ambiguousOptions,
    resolvedByUser: options?.resolvedByUser,
  }
}

function findBestLineMatch(
  line: RecognizedLine,
  indexedRules: IndexedScoreRule[],
  resolution: AmbiguousMatchResolution | undefined,
  options: FuzzySentenceOptions,
): {
  candidate: RankedMatchCandidate
  ambiguous: boolean
  ambiguousOptions?: AmbiguousMatchOption[]
  resolvedByUser?: boolean
} | null {
  const exactRule = indexedRules.find(
    ({ rule }) => rule.text.length > 0 && line.text.includes(rule.text),
  )

  if (exactRule) {
    return {
      candidate: {
        lineId: line.id,
        lineText: line.text,
        ruleId: exactRule.rule.id,
        keyword: exactRule.rule.text,
        score: exactRule.rule.score,
        matchType: 'exact',
        rawDistance: 0,
        similarity: 1,
        ambiguous: false,
        ruleIndex: exactRule.index,
      },
      ambiguous: false,
    }
  }

  const rankedCandidates = sortFuzzyCandidates(
    indexedRules
      .map((indexedRule) =>
        findBestFuzzySentenceCandidate(line, indexedRule, options),
      )
      .filter((candidate): candidate is RankedMatchCandidate => candidate !== null),
  )
  const topCandidate = rankedCandidates[0]

  if (!topCandidate) {
    return null
  }

  const secondCandidate = rankedCandidates[1]
  const isAmbiguous =
    Boolean(secondCandidate) &&
    topCandidate.similarity - secondCandidate.similarity < options.minScoreGap

  if (!isAmbiguous) {
    return {
      candidate: topCandidate,
      ambiguous: false,
    }
  }

  const ambiguousOptions = rankedCandidates
    .filter(
      (candidate) =>
        topCandidate.similarity - candidate.similarity < options.minScoreGap,
    )
    .map(toAmbiguousOption)
  const resolvedCandidate = resolution
    ? rankedCandidates.find(
        (candidate) => candidate.ruleId === resolution.selectedRuleId,
      )
    : undefined

  if (resolvedCandidate) {
    return {
      candidate: resolvedCandidate,
      ambiguous: true,
      ambiguousOptions,
      resolvedByUser: true,
    }
  }

  return {
    candidate: topCandidate,
    ambiguous: true,
    ambiguousOptions,
    resolvedByUser: false,
  }
}

export function scoreRecognizedLines(
  lines: RecognizedLine[],
  rules: ScoreRule[],
  resolutions: AmbiguousMatchResolution[] = [],
  options: FuzzySentenceOptions = DEFAULT_FUZZY_SENTENCE_OPTIONS,
): ScoreSummary {
  const countedRuleIds = new Set<string>()
  const matches: LineMatch[] = []
  const itemScoreMap = new Map<OcrResult, number>()
  let totalScore = 0
  const indexedRules = rules.map((rule, index) => ({ rule, index }))
  const resolutionMap = new Map(
    resolutions.map((resolution) => [resolution.lineId, resolution]),
  )

  detectOneCharacterConflictGroups(rules)

  lines.forEach((line) => {
    line.items.forEach((item) => itemScoreMap.set(item, 0))
  })

  lines.forEach((line) => {
    const lineMatch = findBestLineMatch(
      line,
      indexedRules,
      resolutionMap.get(line.id),
      options,
    )

    if (!lineMatch) {
      return
    }

    const counted =
      !(lineMatch.ambiguous && !lineMatch.resolvedByUser) &&
      !countedRuleIds.has(lineMatch.candidate.ruleId)

    if (counted) {
      countedRuleIds.add(lineMatch.candidate.ruleId)
      totalScore += lineMatch.candidate.score

      const scoredItem =
        line.items.find((item) => item.text.includes(lineMatch.candidate.keyword)) ??
        line.items[0]

      if (scoredItem) {
        itemScoreMap.set(
          scoredItem,
          (itemScoreMap.get(scoredItem) ?? 0) + lineMatch.candidate.score,
        )
      }
    }

    matches.push(
      createLineMatch(lineMatch.candidate, counted, {
        ambiguous: lineMatch.ambiguous,
        ambiguousOptions: lineMatch.ambiguousOptions,
        resolvedByUser: lineMatch.resolvedByUser,
      }),
    )
  })

  return {
    recognizedLines: lines,
    matches,
    itemScores: lines.flatMap((line) =>
      line.items.map((item) => ({
        item,
        score: itemScoreMap.get(item) ?? 0,
      })),
    ),
    totalScore,
  }
}

export function calculateScore(
  results: OcrResult[],
  rules: ScoreRule[],
  resolutions: AmbiguousMatchResolution[] = [],
  lineGroupingOptions: LineGroupingOptions = DEFAULT_LINE_GROUPING_OPTIONS,
): ScoreSummary {
  return scoreRecognizedLines(
    groupOcrResultsIntoLines(results, lineGroupingOptions),
    rules,
    resolutions,
  )
}
