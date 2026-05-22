import type { ScoreSummary } from '../types/scoring'
import { strings } from '../i18n/strings'

interface ScoreSummaryPanelProps {
  rulesCount: number
  summary: ScoreSummary
}

function getScoreComment(summary: ScoreSummary, rulesCount: number) {
  const countedMatches = summary.matches.filter((match) => match.counted)
  const unresolvedAmbiguousCount = summary.matches.filter(
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

  if (summary.matches.length === 0) {
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
  if (totalScore >= 0 && totalScore <= 10) {
    return strings.score.rangeComments.zeroToTen
  }

  if (totalScore > 10 && totalScore <= 20) {
    return strings.score.rangeComments.tenToTwenty
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
