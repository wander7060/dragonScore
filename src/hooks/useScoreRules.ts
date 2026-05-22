import { useCallback, useState } from 'react'
import defaultScoreRulesData from '../data/defaultScoreRules.json'
import { strings } from '../i18n/strings'
import type { MatchMode, PublicScoreRule, ScoreRule } from '../types/scoring'

const SCORE_RULES_STORAGE_KEY = 'dragonscore.ocrScoring.rules.v1'
const LEGACY_SCORE_RULES_STORAGE_KEY = 'reactproject2.ocrScoring.rules.v1'

function createRuleId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `rule-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isMatchMode(value: unknown): value is MatchMode {
  return value === 'exact' || value === 'fuzzySentence'
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
    Number.isFinite(candidate.score) &&
    isMatchMode(candidate.matchMode)
  )
}

function validatePublicRules(value: unknown): PublicScoreRule[] {
  if (!Array.isArray(value)) {
    throw new Error(strings.scoreRules.jsonMustBeArray)
  }

  const seenTexts = new Set<string>()

  return value.map((item, index) => {
    if (!isPublicScoreRule(item)) {
      throw new Error(strings.scoreRules.invalidRule(index))
    }

    const normalizedText = item.text.trim()

    if (seenTexts.has(normalizedText)) {
      throw new Error(strings.scoreRules.duplicatedKeyword(normalizedText))
    }

    seenTexts.add(normalizedText)
    return {
      text: normalizedText,
      score: item.score,
      matchMode: item.matchMode,
    }
  })
}

function toStoredRules(publicRules: PublicScoreRule[]): ScoreRule[] {
  return publicRules.map((rule) => ({
    id: createRuleId(),
    text: rule.text,
    score: rule.score,
    matchMode: rule.matchMode,
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
    const storedValue =
      window.localStorage.getItem(SCORE_RULES_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_SCORE_RULES_STORAGE_KEY)

    if (!storedValue) {
      return { rules: createDefaultScoreRules(), warning: '' }
    }

    const parsedValue = JSON.parse(storedValue)
    const publicRules = validatePublicRules(parsedValue)

    return { rules: toStoredRules(publicRules), warning: '' }
  } catch {
    return {
      rules: createDefaultScoreRules(),
      warning: strings.scoreRules.corruptedStorageWarning,
    }
  }
}

export function parseScoreRulesJson(jsonText: string): ScoreRule[] {
  try {
    return toStoredRules(validatePublicRules(JSON.parse(jsonText)))
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(strings.scoreRules.invalidJson, { cause: error })
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
      const publicRules = nextRules.map(({ text, score, matchMode }) => ({
        text,
        score,
        matchMode,
      }))
      window.localStorage.setItem(
        SCORE_RULES_STORAGE_KEY,
        JSON.stringify(publicRules),
      )
      window.localStorage.removeItem(LEGACY_SCORE_RULES_STORAGE_KEY)
      setState({ rules: nextRules, warning: '' })
    } catch {
      setState({
        rules: nextRules,
        warning: strings.scoreRules.storageWriteWarning,
      })
    }
  }, [])

  return {
    rules: state.rules,
    setRules: replaceRules,
    storageWarning: state.warning,
  }
}
