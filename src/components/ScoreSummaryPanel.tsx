import type { ScoreSummary } from '../types/scoring'
import { strings } from '../i18n/strings'

interface ScoreSummaryPanelProps {
  rulesCount: number
  summary: ScoreSummary
}

function getScoreComment(summary: ScoreSummary, rulesCount: number) {
  const effectiveMatches = summary.matches.filter((match) => !match.ignored)
  const countedMatches = effectiveMatches.filter((match) => match.counted)
  const unresolvedAmbiguousCount = effectiveMatches.filter(
    (match) => match.ambiguous && !match.resolvedByUser,
  ).length
  const ambiguityComment =
    unresolvedAmbiguousCount > 0
      ? strings.score.unresolvedAmbiguitySuffix(unresolvedAmbiguousCount)
      : ''

  if (summary.recognizedLines.length === 0) {
    return strings.score.noOcrResults
  }

  if (rulesCount === 0) {
    return strings.score.noRules
  }

  if (effectiveMatches.length === 0) {
    return strings.score.noMatches
  }

  if (countedMatches.length === 0) {
    return strings.score.duplicateOrAmbiguous(ambiguityComment)
  }

  return strings.score.countedSummary(
    countedMatches.length,
    summary.totalScore,
    getScoreRangeComment(summary.totalScore),
    ambiguityComment,
  )
}

function getScoreRangeComment(totalScore: number) {
  if (totalScore < 22) {
    return strings.score.rangeComments.level0
  }
  if (totalScore >= 22 && totalScore < 24) {
    return strings.score.rangeComments.level1
  }
  if (totalScore >= 24 && totalScore < 26) {
    return strings.score.rangeComments.level2
  }
  if (totalScore >= 26 && totalScore < 28) {
    return strings.score.rangeComments.level3
  }
  if (totalScore >= 28 && totalScore < 30) {
    return strings.score.rangeComments.level4
  }
  if (totalScore >= 30) {
    return strings.score.rangeComments.level5
  }
  return ''
}

export function ScoreSummaryPanel({
  rulesCount,
  summary,
}: ScoreSummaryPanelProps) {
  return (
    <section
      className="score-panel compact-summary"
      aria-label={strings.score.summaryAria}
    >
      <div className="score-header">
        <div>
          <h3>{strings.score.summaryTitle}</h3>
          <p>{strings.score.totalScore}</p>
        </div>
        <strong>{summary.totalScore}</strong>
      </div>

      <p className="score-comment">
        <span>{strings.score.commentLabel}</span>
        {getScoreComment(summary, rulesCount)}
      </p>
    </section>
  )
}
