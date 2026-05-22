import type { ScoreSummary } from '../types/scoring'

interface ScoreSummaryPanelProps {
  rulesCount: number
  summary: ScoreSummary
}

function getScoreComment(summary: ScoreSummary, rulesCount: number) {
  const countedMatches = summary.matches.filter((match) => match.counted)

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
    return '僅找到重複匹配，總分未增加。'
  }

  return `已計入 ${countedMatches.length} 個項目，總分為 ${summary.totalScore}。`
}

export function ScoreSummaryPanel({
  rulesCount,
  summary,
}: ScoreSummaryPanelProps) {
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
    </section>
  )
}
