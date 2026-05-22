import type {
  OcrResult,
  RecognizedLine,
  ScoreRule,
  ScoreSummary,
} from '../types/scoring'

const LINE_CENTER_THRESHOLD_RATIO = 0.55

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

export function groupOcrResultsIntoLines(results: OcrResult[]): RecognizedLine[] {
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
        LINE_CENTER_THRESHOLD_RATIO

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

export function scoreRecognizedLines(
  lines: RecognizedLine[],
  rules: ScoreRule[],
): ScoreSummary {
  const countedRuleIds = new Set<string>()
  const matches: ScoreSummary['matches'] = []
  const itemScoreMap = new Map<OcrResult, number>()
  let totalScore = 0

  lines.forEach((line) => {
    line.items.forEach((item) => itemScoreMap.set(item, 0))
  })

  lines.forEach((line) => {
    const matchedRule = rules.find(
      (rule) => rule.text.length > 0 && line.text.includes(rule.text),
    )

    if (!matchedRule) {
      return
    }

    const counted = !countedRuleIds.has(matchedRule.id)

    if (counted) {
      countedRuleIds.add(matchedRule.id)
      totalScore += matchedRule.score

      const scoredItem =
        line.items.find((item) => item.text.includes(matchedRule.text)) ??
        line.items[0]

      if (scoredItem) {
        itemScoreMap.set(
          scoredItem,
          (itemScoreMap.get(scoredItem) ?? 0) + matchedRule.score,
        )
      }
    }

    matches.push({
      lineId: line.id,
      lineText: line.text,
      ruleId: matchedRule.id,
      keyword: matchedRule.text,
      score: matchedRule.score,
      counted,
    })
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
): ScoreSummary {
  return scoreRecognizedLines(groupOcrResultsIntoLines(results), rules)
}
