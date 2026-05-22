import type { ScoreSummary } from '../types/scoring'
import { HighlightedText } from './HighlightedText'

interface ScoreSummaryPanelProps {
  rulesCount: number
  summary: ScoreSummary
  onAmbiguousResolutionChange?: (lineId: string, ruleId: string | null) => void
}

function getScoreComment(summary: ScoreSummary, rulesCount: number) {
  const countedMatches = summary.matches.filter((match) => match.counted)
  const unresolvedAmbiguousCount = summary.matches.filter(
    (match) => match.ambiguous && !match.resolvedByUser,
  ).length
  const ambiguityComment =
    unresolvedAmbiguousCount > 0
      ? ` 尚有 ${unresolvedAmbiguousCount} 筆未作決議的歧義。`
      : ''

  if (summary.recognizedLines.length === 0) {
    return '尚無 OCR 結果。'
  }

  if (rulesCount === 0) {
    return '已有 OCR 結果，尚未設定評分規則。'
  }

  if (summary.matches.length === 0) {
    return '目前規則沒有匹配任何辨識文字。'
  }

  if (countedMatches.length === 0) {
    return `僅找到重複匹配或未決議歧義，總分未增加。${ambiguityComment}`
  }

  return `已計入 ${countedMatches.length} 個項目，總分為 ${summary.totalScore}。${ambiguityComment}`
}

function formatSimilarity(similarity?: number) {
  if (similarity === undefined) {
    return ''
  }

  return `${(similarity * 100).toFixed(1)}%`
}

function getMatchStatus(match: ScoreSummary['matches'][number]) {
  if (match.ambiguous && !match.resolvedByUser) {
    return '待選擇'
  }

  if (match.ambiguous && match.resolvedByUser) {
    return match.counted ? '已選擇並計分' : '已選擇，未計分'
  }

  return match.counted ? '已計分' : '未計分'
}

export function ScoreSummaryPanel({
  rulesCount,
  summary,
  onAmbiguousResolutionChange,
}: ScoreSummaryPanelProps) {
  const countedMatches = summary.matches.filter((match) => match.counted)

  return (
    <section className="score-panel compact-summary" aria-label="OCR score summary">
      <div className="score-header">
        <div>
          <h3>評分摘要</h3>
          <p>總分</p>
        </div>
        <strong>{summary.totalScore}</strong>
      </div>

      <p className="score-comment">
        <span>評語</span>
        {getScoreComment(summary, rulesCount)}
      </p>

      {countedMatches.length > 0 && (
        <div className="counted-match-row" aria-label="已計分關鍵字">
          {countedMatches.map((match) => (
            <span className="match-chip" key={`${match.lineId}-${match.ruleId}`}>
              <span>{match.keyword}</span>
              <b>{match.score}</b>
            </span>
          ))}
        </div>
      )}

      {summary.matches.length > 0 && (
        <ul className="score-line-list" aria-label="行級評分匹配">
          {summary.matches.map((match) => (
            <li
              className={`score-line-item ${
                match.ambiguous && !match.resolvedByUser ? 'is-ambiguous' : ''
              }`}
              key={`${match.lineId}-${match.ruleId}`}
            >
              <p>
                <HighlightedText
                  text={match.lineText}
                  keyword={match.matchType === 'exact' ? match.keyword : undefined}
                />
              </p>
              <div className="line-match-meta">
                <span className="line-match-badge">
                  {match.matchType === 'fuzzy' ? '模糊' : '精準'}
                </span>
                {match.ambiguous && (
                  <span className="line-match-badge warning">
                    {match.resolvedByUser ? '已決議歧義' : '待選擇'}
                  </span>
                )}
                <span
                  className={`line-match-badge ${
                    match.counted ? '' : 'muted'
                  }`}
                >
                  {getMatchStatus(match)}
                </span>
                {match.matchType === 'fuzzy' && (
                  <span className="line-match-badge muted">
                    相似度 {formatSimilarity(match.similarity)} / 距離{' '}
                    {match.rawDistance}
                  </span>
                )}
              </div>
              <div className="line-match-keyword">
                <span>{match.keyword}</span>
                <b>{match.score}</b>
              </div>
              {match.ambiguous && match.ambiguousOptions && (
                <label className="ambiguous-select-field">
                  <span>疑似匹配，請選擇要套用的關鍵字</span>
                  <select
                    value={match.resolvedByUser ? match.ruleId : ''}
                    onChange={(event) =>
                      onAmbiguousResolutionChange?.(
                        match.lineId,
                        event.target.value || null,
                      )
                    }
                  >
                    <option value="">不套用</option>
                    {match.ambiguousOptions.map((option) => (
                      <option
                        key={`${match.lineId}-${option.ruleId}`}
                        value={option.ruleId}
                      >
                        {option.keyword} / {option.score} / 相似度{' '}
                        {formatSimilarity(option.similarity)} / 距離{' '}
                        {option.rawDistance}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
