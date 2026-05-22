import { useCallback, useState } from 'react'
import defaultScoreRulesData from '../data/defaultScoreRules.json'
import type { PublicScoreRule, ScoreRule } from '../types/scoring'

const SCORE_RULES_STORAGE_KEY = 'reactproject2.ocrScoring.rules.v1'

function createRuleId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `rule-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isPublicScoreRule(value: unknown): value is PublicScoreRule {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.text === 'string' &&
    candidate.text.trim().length > 0 &&
    typeof candidate.score === 'number' &&
    Number.isFinite(candidate.score)
  )
}

function validatePublicRules(value: unknown): PublicScoreRule[] {
  if (!Array.isArray(value)) {
    throw new Error('JSON 必須是規則陣列。')
  }

  const seenTexts = new Set<string>()

  return value.map((item, index) => {
    if (!isPublicScoreRule(item)) {
      throw new Error(`第 ${index + 1} 筆規則必須包含非空文字與有限數字分數。`)
    }

    const normalizedText = item.text.trim()

    if (seenTexts.has(normalizedText)) {
      throw new Error(`關鍵字「${normalizedText}」重複。`)
    }

    seenTexts.add(normalizedText)
    return {
      text: normalizedText,
      score: item.score,
    }
  })
}

function toStoredRules(publicRules: PublicScoreRule[]): ScoreRule[] {
  return publicRules.map((rule) => ({
    id: createRuleId(),
    text: rule.text,
    score: rule.score,
  }))
}

export function createDefaultScoreRules(): ScoreRule[] {
  return toStoredRules(validatePublicRules(defaultScoreRulesData))
}

function readStoredRules(): { rules: ScoreRule[]; warning: string } {
  if (typeof window === 'undefined') {
    return { rules: createDefaultScoreRules(), warning: '' }
  }

  try {
    const storedValue = window.localStorage.getItem(SCORE_RULES_STORAGE_KEY)

    if (!storedValue) {
      return { rules: createDefaultScoreRules(), warning: '' }
    }

    const parsedValue = JSON.parse(storedValue)
    const publicRules = validatePublicRules(parsedValue)

    return { rules: toStoredRules(publicRules), warning: '' }
  } catch {
    return {
      rules: createDefaultScoreRules(),
      warning: '已忽略毀損的評分規則儲存資料，並套用預設規則。',
    }
  }
}

export function parseScoreRulesJson(jsonText: string): ScoreRule[] {
  try {
    return toStoredRules(validatePublicRules(JSON.parse(jsonText)))
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('JSON 格式無效。', { cause: error })
    }

    throw error
  }
}

export function useScoreRules() {
  const [state, setState] = useState(readStoredRules)

  const replaceRules = useCallback((nextRules: ScoreRule[]) => {
    if (typeof window === 'undefined') {
      setState({ rules: nextRules, warning: '' })
      return
    }

    try {
      const publicRules = nextRules.map(({ text, score }) => ({ text, score }))
      window.localStorage.setItem(
        SCORE_RULES_STORAGE_KEY,
        JSON.stringify(publicRules),
      )
      setState({ rules: nextRules, warning: '' })
    } catch {
      setState({
        rules: nextRules,
        warning: '無法寫入 localStorage，規則可能不會在重新整理後保留。',
      })
    }
  }, [])

  return {
    rules: state.rules,
    setRules: replaceRules,
    storageWarning: state.warning,
  }
}
