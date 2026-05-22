import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Icon } from './Icon'
import {
  createDefaultScoreRules,
  parseScoreRulesJson,
} from '../hooks/useScoreRules'
import { strings } from '../i18n/strings'
import { DEFAULT_FUZZY_SENTENCE_OPTIONS } from '../lib/scoring'
import type { MatchMode, ScoreRule } from '../types/scoring'

interface SettingsPanelProps {
  rules: ScoreRule[]
  storageWarning: string
  onRulesChange: (rules: ScoreRule[]) => void
}

interface RuleDraft {
  text: string
  scoreText: string
  matchMode: MatchMode
}

function createRuleId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `rule-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

type RuleInputValidation =
  | { error: string; rule?: never }
  | { error?: never; rule: { text: string; score: number; matchMode: MatchMode } }

type DropPlacement = 'before' | 'after'
type SelectionDragMode = 'select' | 'deselect'

interface RuleSelectionDragState {
  pointerId: number
  mode: SelectionDragMode
  anchorRuleId: string
  baseSelectedRuleIds: Set<string>
}

interface RulePointerDragState {
  pointerId: number
  ids: string[]
  left: number
  top: number
  width: number
  offsetX: number
  offsetY: number
}

interface RuleLayoutRect {
  left: number
  top: number
  width: number
  height: number
}

function moveRulesToTarget(
  rules: ScoreRule[],
  movingIds: string[],
  targetId: string,
  placement: DropPlacement,
) {
  const movingIdSet = new Set(movingIds)
  const movingRules = rules.filter((rule) => movingIdSet.has(rule.id))

  if (movingRules.length === 0 || movingIdSet.has(targetId)) {
    return rules
  }

  const remainingRules = rules.filter((rule) => !movingIdSet.has(rule.id))
  const targetIndex = remainingRules.findIndex((rule) => rule.id === targetId)

  if (targetIndex < 0) {
    return rules
  }

  const insertIndex = placement === 'after' ? targetIndex + 1 : targetIndex
  return [
    ...remainingRules.slice(0, insertIndex),
    ...movingRules,
    ...remainingRules.slice(insertIndex),
  ]
}

function areRulesInSameOrder(firstRules: ScoreRule[], secondRules: ScoreRule[]) {
  return (
    firstRules.length === secondRules.length &&
    firstRules.every((rule, index) => rule.id === secondRules[index]?.id)
  )
}

function getRuleLayoutRect(element: HTMLElement): RuleLayoutRect {
  return {
    left: element.offsetLeft,
    top: element.offsetTop,
    width: element.offsetWidth,
    height: element.offsetHeight,
  }
}

function validateRuleInput(
  text: string,
  scoreText: string,
  matchMode: MatchMode,
  rules: ScoreRule[],
  editingId?: string,
): RuleInputValidation {
  const normalizedText = text.trim()
  const score = scoreText.trim() ? Number(scoreText) : 0

  if (!normalizedText) {
    return { error: strings.settings.validation.keywordRequired }
  }

  if (!Number.isFinite(score)) {
    return { error: strings.settings.validation.scoreFinite }
  }

  const duplicatedRule = rules.find(
    (rule) => rule.text.trim() === normalizedText && rule.id !== editingId,
  )

  if (duplicatedRule) {
    return { error: strings.settings.validation.duplicatedKeyword(normalizedText) }
  }

  return { rule: { text: normalizedText, score, matchMode } }
}

export function SettingsPanel({
  rules,
  storageWarning,
  onRulesChange,
}: SettingsPanelProps) {
  const [drafts, setDrafts] = useState<Record<string, RuleDraft>>({})
  const [newText, setNewText] = useState('')
  const [newScoreText, setNewScoreText] = useState('')
  const [newMatchMode, setNewMatchMode] = useState<MatchMode>('exact')
  const [importText, setImportText] = useState('')
  const [message, setMessage] = useState('')
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [draggedIds, setDraggedIds] = useState<string[]>([])
  const [dragPreviewRules, setDragPreviewRules] = useState<ScoreRule[] | null>(
    null,
  )
  const [ruleDragState, setRuleDragState] =
    useState<RulePointerDragState | null>(null)
  const [isSelectionDragging, setIsSelectionDragging] = useState(false)
  const [isJsonDialogOpen, setIsJsonDialogOpen] = useState(false)
  const ruleItemRefs = useRef(new Map<string, HTMLLIElement>())
  const previousRuleRectsRef = useRef(new Map<string, RuleLayoutRect>())
  const dragPreviewRulesRef = useRef<ScoreRule[] | null>(null)
  const ruleDragRef = useRef<RulePointerDragState | null>(null)
  const cleanupRuleDragListenersRef = useRef<(() => void) | null>(null)
  const selectionDragRef = useRef<RuleSelectionDragState | null>(null)

  const draggedIdSet = useMemo(() => new Set(draggedIds), [draggedIds])
  const renderedRules = dragPreviewRules ?? rules
  const floatingDraggedRules = useMemo(() => {
    if (!ruleDragState) {
      return []
    }

    const floatingDraggedIdSet = new Set(ruleDragState.ids)
    return rules.filter((rule) => floatingDraggedIdSet.has(rule.id))
  }, [ruleDragState, rules])

  const exportText = useMemo(
    () =>
      JSON.stringify(
        rules.map(({ text: ruleText, score, matchMode }) => ({
          text: ruleText,
          score,
          matchMode,
        })),
        null,
        2,
      ),
    [rules],
  )

  useLayoutEffect(() => {
    const nextRuleRects = new Map<string, RuleLayoutRect>()
    const shouldReduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    for (const rule of renderedRules) {
      const element = ruleItemRefs.current.get(rule.id)

      if (!element) {
        continue
      }

      element.getAnimations().forEach((animation) => animation.cancel())
      const nextRect = getRuleLayoutRect(element)
      const previousRect = previousRuleRectsRef.current.get(rule.id)

      if (nextRect.width > 0 && nextRect.height > 0) {
        nextRuleRects.set(rule.id, nextRect)
      }

      if (
        !previousRect ||
        previousRect.width === 0 ||
        previousRect.height === 0 ||
        nextRect.width === 0 ||
        nextRect.height === 0 ||
        shouldReduceMotion
      ) {
        continue
      }

      const deltaX = previousRect.left - nextRect.left
      const deltaY = previousRect.top - nextRect.top

      if (
        (deltaX === 0 && deltaY === 0) ||
        Math.abs(deltaX) > window.innerWidth ||
        Math.abs(deltaY) > window.innerHeight
      ) {
        continue
      }

      element.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: 'translate(0, 0)' },
        ],
        {
          duration: 210,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        },
      )
    }

    previousRuleRectsRef.current = nextRuleRects
  }, [renderedRules])

  useEffect(
    () => () => {
      cleanupRuleDragListenersRef.current?.()
    },
    [],
  )

  const updateDragPreviewRules = (nextRules: ScoreRule[] | null) => {
    dragPreviewRulesRef.current = nextRules
    setDragPreviewRules(nextRules)
  }

  const getRuleDraft = (rule: ScoreRule) =>
    drafts[rule.id] ?? {
      text: rule.text,
      scoreText: String(rule.score),
      matchMode: rule.matchMode,
    }

  const updateRuleDraft = (
    ruleId: string,
    field: keyof RuleDraft,
    value: string,
  ) => {
    setDrafts((currentDrafts) => {
      const rule = rules.find((item) => item.id === ruleId)
      const currentDraft =
        currentDrafts[ruleId] ??
        (rule
          ? {
              text: rule.text,
              scoreText: String(rule.score),
              matchMode: rule.matchMode,
            }
          : { text: '', scoreText: '', matchMode: 'exact' })

      return {
        ...currentDrafts,
        [ruleId]: {
          ...currentDraft,
          [field]: value,
        },
      }
    })
  }

  const resetRuleDraft = (rule: ScoreRule) => {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [rule.id]: {
        text: rule.text,
        scoreText: String(rule.score),
        matchMode: rule.matchMode,
      },
    }))
  }

  const commitRule = (rule: ScoreRule) => {
    const draft = getRuleDraft(rule)
    const validation = validateRuleInput(
      draft.text,
      draft.scoreText,
      draft.matchMode,
      rules,
      rule.id,
    )

    if (validation.error !== undefined) {
      setMessage(validation.error)
      resetRuleDraft(rule)
      return
    }

    if (
      rule.text === validation.rule.text &&
      rule.score === validation.rule.score &&
      rule.matchMode === validation.rule.matchMode
    ) {
      return
    }

    onRulesChange(
      rules.map((item) =>
        item.id === rule.id ? { ...item, ...validation.rule } : item,
      ),
    )
    setMessage(strings.settings.messages.ruleUpdated)
  }

  const submitNewRule = () => {
    if (!newText.trim() && !newScoreText.trim()) {
      return
    }

    const validation = validateRuleInput(
      newText,
      newScoreText,
      newMatchMode,
      rules,
    )

    if (validation.error !== undefined) {
      setMessage(validation.error)
      return
    }

    onRulesChange([
      ...rules,
      {
        id: createRuleId(),
        ...validation.rule,
      },
    ])
    setNewText('')
    setNewScoreText('')
    setNewMatchMode('exact')
    setMessage(strings.settings.messages.ruleAdded)
  }

  const handleRuleKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    rule: ScoreRule,
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    }

    if (event.key === 'Escape') {
      resetRuleDraft(rule)
      event.currentTarget.blur()
    }
  }

  const handleNewRuleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      submitNewRule()
    }
  }

  const handleRuleSelectionKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    ruleId: string,
  ) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      toggleRuleSelection(ruleId)
    }
  }

  const deleteRule = (ruleId: string) => {
    onRulesChange(rules.filter((rule) => rule.id !== ruleId))
    setSelectedRuleIds((currentSelectedRuleIds) => {
      const nextSelectedRuleIds = new Set(currentSelectedRuleIds)
      nextSelectedRuleIds.delete(ruleId)
      return nextSelectedRuleIds
    })
    setMessage(strings.settings.messages.ruleDeleted)
  }

  const toggleRuleSelection = (ruleId: string) => {
    setSelectedRuleIds((currentSelectedRuleIds) => {
      const nextSelectedRuleIds = new Set(currentSelectedRuleIds)

      if (nextSelectedRuleIds.has(ruleId)) {
        nextSelectedRuleIds.delete(ruleId)
      } else {
        nextSelectedRuleIds.add(ruleId)
      }

      return nextSelectedRuleIds
    })
  }

  const getSelectionRangeIds = (anchorRuleId: string, targetRuleId: string) => {
    const anchorIndex = rules.findIndex((rule) => rule.id === anchorRuleId)
    const targetIndex = rules.findIndex((rule) => rule.id === targetRuleId)

    if (anchorIndex < 0 || targetIndex < 0) {
      return [targetRuleId]
    }

    const startIndex = Math.min(anchorIndex, targetIndex)
    const endIndex = Math.max(anchorIndex, targetIndex)

    return rules.slice(startIndex, endIndex + 1).map((rule) => rule.id)
  }

  const applyRuleSelectionRange = (
    targetRuleId: string,
    activeSelectionDrag: RuleSelectionDragState,
  ) => {
    const rangeIds = getSelectionRangeIds(
      activeSelectionDrag.anchorRuleId,
      targetRuleId,
    )
    const nextSelectedRuleIds = new Set(activeSelectionDrag.baseSelectedRuleIds)

    for (const rangeId of rangeIds) {
      if (activeSelectionDrag.mode === 'select') {
        nextSelectedRuleIds.add(rangeId)
      } else {
        nextSelectedRuleIds.delete(rangeId)
      }
    }

    setSelectedRuleIds(nextSelectedRuleIds)
  }

  const startRuleSelectionDrag = (
    event: ReactPointerEvent<HTMLElement>,
    ruleId: string,
  ) => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    const mode = selectedRuleIds.has(ruleId) ? 'deselect' : 'select'
    const nextSelectionDrag: RuleSelectionDragState = {
      pointerId: event.pointerId,
      mode,
      anchorRuleId: ruleId,
      baseSelectedRuleIds: new Set(selectedRuleIds),
    }

    selectionDragRef.current = nextSelectionDrag
    setIsSelectionDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    applyRuleSelectionRange(ruleId, nextSelectionDrag)
  }

  const updateRuleSelectionDrag = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    const activeSelectionDrag = selectionDragRef.current

    if (!activeSelectionDrag || activeSelectionDrag.pointerId !== event.pointerId) {
      return
    }

    event.preventDefault()
    const targetElement = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-rule-id]')
    const targetRuleId = targetElement?.dataset.ruleId

    if (targetRuleId) {
      applyRuleSelectionRange(targetRuleId, activeSelectionDrag)
    }
  }

  const endRuleSelectionDrag = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    const activeSelectionDrag = selectionDragRef.current

    if (!activeSelectionDrag || activeSelectionDrag.pointerId !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    selectionDragRef.current = null
    setIsSelectionDragging(false)
  }

  const resetDragState = () => {
    cleanupRuleDragListenersRef.current?.()
    cleanupRuleDragListenersRef.current = null
    setDraggedIds([])
    updateDragPreviewRules(null)
    ruleDragRef.current = null
    setRuleDragState(null)
  }

  const findRuleDropTarget = (
    clientX: number,
    clientY: number,
    activeRuleDrag: RulePointerDragState,
  ): { targetId: string; placement: DropPlacement } | null => {
    const previewBaseRules = dragPreviewRulesRef.current ?? rules
    const targetElement = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>('[data-rule-id]')
    const targetId = targetElement?.dataset.ruleId

    if (targetId && !activeRuleDrag.ids.includes(targetId)) {
      const targetRect = targetElement.getBoundingClientRect()

      return {
        targetId,
        placement:
          clientY < targetRect.top + targetRect.height / 2 ? 'before' : 'after',
      }
    }

    const visibleTargetRules = previewBaseRules.filter(
      (rule) => !activeRuleDrag.ids.includes(rule.id),
    )
    let lastVisibleTargetId = ''

    for (const rule of visibleTargetRules) {
      const itemRect = ruleItemRefs.current
        .get(rule.id)
        ?.getBoundingClientRect()

      if (!itemRect) {
        continue
      }

      lastVisibleTargetId = rule.id

      if (clientY < itemRect.top + itemRect.height / 2) {
        return {
          targetId: rule.id,
          placement: 'before',
        }
      }
    }

    return lastVisibleTargetId
      ? {
          targetId: lastVisibleTargetId,
          placement: 'after',
        }
      : null
  }

  const updateActiveRuleDrag = (
    clientX: number,
    clientY: number,
    activeRuleDrag: RulePointerDragState,
  ) => {
    const nextRuleDragState = {
      ...activeRuleDrag,
      left: clientX - activeRuleDrag.offsetX,
      top: clientY - activeRuleDrag.offsetY,
    }
    ruleDragRef.current = nextRuleDragState
    setRuleDragState(nextRuleDragState)

    const dropTarget = findRuleDropTarget(clientX, clientY, activeRuleDrag)

    if (!dropTarget) {
      return
    }

    const previewBaseRules = dragPreviewRulesRef.current ?? rules
    const nextPreviewRules = moveRulesToTarget(
      previewBaseRules,
      activeRuleDrag.ids,
      dropTarget.targetId,
      dropTarget.placement,
    )

    if (
      dragPreviewRulesRef.current &&
      areRulesInSameOrder(dragPreviewRulesRef.current, nextPreviewRules)
    ) {
      return
    }

    updateDragPreviewRules(nextPreviewRules)
  }

  const commitActiveRuleDrag = (activeRuleDrag: RulePointerDragState) => {
    const nextRules = dragPreviewRulesRef.current

    if (nextRules && !areRulesInSameOrder(rules, nextRules)) {
      onRulesChange(nextRules)
      setMessage(
        activeRuleDrag.ids.length > 1
          ? strings.settings.messages.rulesMoved(activeRuleDrag.ids.length)
          : strings.settings.messages.ruleOrderUpdated,
      )
    }

    resetDragState()
  }

  const startRuleDrag = (
    event: ReactPointerEvent<HTMLSpanElement>,
    sourceRuleId: string,
  ) => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()

    const nextDraggedIds = selectedRuleIds.has(sourceRuleId)
      ? rules
          .filter((rule) => selectedRuleIds.has(rule.id))
          .map((rule) => rule.id)
      : [sourceRuleId]

    if (!selectedRuleIds.has(sourceRuleId)) {
      setSelectedRuleIds(new Set([sourceRuleId]))
    }

    const sourceRect = event.currentTarget
      .closest<HTMLElement>('[data-rule-id]')
      ?.getBoundingClientRect()
    const sourceOffsetInFloatingGroup = nextDraggedIds
      .slice(0, nextDraggedIds.indexOf(sourceRuleId))
      .reduce((offset, ruleId) => {
        const itemRect = ruleItemRefs.current.get(ruleId)?.getBoundingClientRect()

        return offset + (itemRect?.height ?? sourceRect?.height ?? 0) + 6
      }, 0)
    const sourceOffsetX = sourceRect ? event.clientX - sourceRect.left : 18
    const sourceOffsetY = sourceRect ? event.clientY - sourceRect.top : 18
    const overlayOffsetY = sourceOffsetInFloatingGroup + sourceOffsetY
    const nextRuleDragState: RulePointerDragState = {
      pointerId: event.pointerId,
      ids: nextDraggedIds,
      left: event.clientX - sourceOffsetX,
      top: event.clientY - overlayOffsetY,
      width: sourceRect?.width ?? 320,
      offsetX: sourceOffsetX,
      offsetY: overlayOffsetY,
    }
    let activeRuleDrag = nextRuleDragState
    const pointerId = event.pointerId

    cleanupRuleDragListenersRef.current?.()

    const handleWindowPointerMove = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) {
        return
      }

      pointerEvent.preventDefault()
      activeRuleDrag = ruleDragRef.current ?? activeRuleDrag
      updateActiveRuleDrag(
        pointerEvent.clientX,
        pointerEvent.clientY,
        activeRuleDrag,
      )
    }

    const handleWindowPointerUp = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) {
        return
      }

      pointerEvent.preventDefault()
      activeRuleDrag = ruleDragRef.current ?? activeRuleDrag
      commitActiveRuleDrag(activeRuleDrag)
    }

    const handleWindowPointerCancel = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerId) {
        return
      }

      pointerEvent.preventDefault()
      resetDragState()
    }

    window.addEventListener('pointermove', handleWindowPointerMove, {
      passive: false,
    })
    window.addEventListener('pointerup', handleWindowPointerUp, {
      passive: false,
    })
    window.addEventListener('pointercancel', handleWindowPointerCancel, {
      passive: false,
    })
    cleanupRuleDragListenersRef.current = () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', handleWindowPointerUp)
      window.removeEventListener('pointercancel', handleWindowPointerCancel)
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    ruleDragRef.current = nextRuleDragState
    setDraggedIds(nextDraggedIds)
    updateDragPreviewRules(rules)
    setRuleDragState(nextRuleDragState)
  }

  const updateRuleDrag = (
    event: ReactPointerEvent<HTMLSpanElement>,
  ) => {
    const activeRuleDrag = ruleDragRef.current

    if (!activeRuleDrag || activeRuleDrag.pointerId !== event.pointerId) {
      return
    }

    event.preventDefault()
    updateActiveRuleDrag(event.clientX, event.clientY, activeRuleDrag)
  }

  const commitRuleDrag = (
    event: ReactPointerEvent<HTMLSpanElement>,
  ) => {
    event.preventDefault()
    const activeRuleDrag = ruleDragRef.current

    if (!activeRuleDrag || activeRuleDrag.pointerId !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    commitActiveRuleDrag(activeRuleDrag)
  }

  const importRules = () => {
    try {
      const nextRules = parseScoreRulesJson(importText)
      onRulesChange(nextRules)
      setImportText('')
      setMessage(strings.settings.messages.rulesImported(nextRules.length))
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : strings.settings.messages.importFailed,
      )
    }
  }

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportText)
      setMessage(strings.settings.messages.exportCopied)
    } catch {
      setMessage(strings.settings.messages.exportCopyFailed)
    }
  }

  const clearRules = () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(strings.settings.confirms.clearRules)
    ) {
      return
    }

    resetDragState()
    setDrafts({})
    setSelectedRuleIds(new Set())
    onRulesChange([])
    setMessage(strings.settings.messages.rulesCleared)
  }

  const restoreDefaultRules = () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(strings.settings.confirms.restoreDefaults)
    ) {
      return
    }

    resetDragState()
    setDrafts({})
    setSelectedRuleIds(new Set())
    onRulesChange(createDefaultScoreRules())
    setMessage(strings.settings.messages.defaultsRestored)
  }

  return (
    <div className="settings-grid">
      <section className="panel settings-form-panel" aria-labelledby="rule-form-title">
        <div className="panel-header">
          <h2 id="rule-form-title">{strings.settings.panelTitle}</h2>
          <div className="rule-header-actions">
            <button
              type="button"
              className="copy-button"
              onClick={() => setIsJsonDialogOpen(true)}
            >
              {strings.common.json}
            </button>
            <button
              type="button"
              className="copy-button"
              onClick={restoreDefaultRules}
            >
              {strings.settings.restoreDefaults}
            </button>
            <button
              type="button"
              className="copy-button danger-text-button"
              onClick={clearRules}
            >
              {strings.settings.clear}
            </button>
          </div>
        </div>
        <div className="panel-body settings-body">
          {(message || storageWarning) && (
            <div className="message neutral-message" role="status">
              <p>{message || storageWarning}</p>
            </div>
          )}

          <ul
            className={`rule-list ${isSelectionDragging ? 'is-selecting' : ''}`}
            aria-label={strings.settings.rulesAria}
          >
            {rules.length > 0 ? (
              renderedRules.map((rule) => {
                const draft = getRuleDraft(rule)
                const isSelected = selectedRuleIds.has(rule.id)
                const isDragging = draggedIdSet.has(rule.id)

                return (
                  <li
                    className={[
                      'rule-item',
                      isSelected ? 'is-selected' : '',
                      isDragging ? 'is-dragging' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    key={rule.id}
                    ref={(element) => {
                      if (element) {
                        ruleItemRefs.current.set(rule.id, element)
                      } else {
                        ruleItemRefs.current.delete(rule.id)
                      }
                    }}
                    data-rule-id={rule.id}
                  >
                    <label
                      className="rule-select"
                      onPointerCancel={endRuleSelectionDrag}
                      onPointerDown={(event) =>
                        startRuleSelectionDrag(event, rule.id)
                      }
                      onPointerMove={updateRuleSelectionDrag}
                      onPointerUp={endRuleSelectionDrag}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        onKeyDown={(event) =>
                          handleRuleSelectionKeyDown(event, rule.id)
                        }
                        aria-label={strings.settings.aria.selectRule(rule.text)}
                      />
                    </label>
                    <span
                      className="rule-drag-handle"
                      onPointerCancel={commitRuleDrag}
                      onPointerDown={(event) => startRuleDrag(event, rule.id)}
                      onPointerMove={updateRuleDrag}
                      onPointerUp={commitRuleDrag}
                      title={
                        isSelected && selectedRuleIds.size > 1
                          ? strings.settings.drag.selectedRules(selectedRuleIds.size)
                          : strings.settings.drag.singleRule
                      }
                      aria-hidden="true"
                    >
                      <span className="rule-drag-dots">::</span>
                      {isSelected && selectedRuleIds.size > 1 && (
                        <span className="rule-drag-count">
                          {selectedRuleIds.size}
                        </span>
                      )}
                    </span>
                    <input
                      className="rule-editor-input"
                      value={draft.text}
                      onBlur={() => commitRule(rule)}
                      onChange={(event) =>
                        updateRuleDraft(rule.id, 'text', event.target.value)
                      }
                      onKeyDown={(event) => handleRuleKeyDown(event, rule)}
                      aria-label={strings.settings.aria.ruleKeyword}
                    />
                    <input
                      className="rule-editor-input rule-score-input"
                      value={draft.scoreText}
                      inputMode="decimal"
                      onBlur={() => commitRule(rule)}
                      onChange={(event) =>
                        updateRuleDraft(rule.id, 'scoreText', event.target.value)
                      }
                      onKeyDown={(event) => handleRuleKeyDown(event, rule)}
                      aria-label={strings.settings.aria.ruleScore}
                    />
                    <select
                      className="rule-editor-input rule-mode-select"
                      value={draft.matchMode}
                      onBlur={() => commitRule(rule)}
                      onChange={(event) =>
                        updateRuleDraft(
                          rule.id,
                          'matchMode',
                          event.target.value as MatchMode,
                        )
                      }
                      aria-label={strings.settings.aria.ruleMatchMode}
                    >
                      <option value="exact">
                        {strings.settings.matchModeLabels.exact}
                      </option>
                      <option value="fuzzySentence">
                        {strings.settings.matchModeLabels.fuzzySentence}
                      </option>
                    </select>
                    <div className="rule-actions">
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={() => deleteRule(rule.id)}
                        aria-label={strings.settings.aria.deleteRule}
                        title={strings.settings.aria.deleteRule}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                    {draft.matchMode === 'fuzzySentence' &&
                      draft.text.trim().length <
                        DEFAULT_FUZZY_SENTENCE_OPTIONS.minKeywordLength && (
                        <p className="rule-mode-warning">
                          {strings.settings.fuzzyKeywordTooShort}
                        </p>
                      )}
                  </li>
                )
              })
            ) : (
              <li className="rule-empty">{strings.settings.emptyRules}</li>
            )}
            <li className="rule-item rule-new-row">
              <span className="rule-select-placeholder" aria-hidden="true" />
              <span className="rule-drag-handle muted" aria-hidden="true">
                +
              </span>
              <input
                className="rule-editor-input"
                value={newText}
                onChange={(event) => setNewText(event.target.value)}
                onKeyDown={handleNewRuleKeyDown}
                placeholder={strings.settings.newKeywordPlaceholder}
                aria-label={strings.settings.aria.newRuleKeyword}
              />
              <input
                className="rule-editor-input rule-score-input"
                value={newScoreText}
                inputMode="decimal"
                onChange={(event) => setNewScoreText(event.target.value)}
                onKeyDown={handleNewRuleKeyDown}
                placeholder={strings.settings.scorePlaceholder}
                aria-label={strings.settings.aria.newRuleScore}
              />
              <select
                className="rule-editor-input rule-mode-select"
                value={newMatchMode}
                onChange={(event) =>
                  setNewMatchMode(event.target.value as MatchMode)
                }
                aria-label={strings.settings.aria.newRuleMatchMode}
              >
                <option value="exact">
                  {strings.settings.matchModeLabels.exact}
                </option>
                <option value="fuzzySentence">
                  {strings.settings.matchModeLabels.fuzzySentence}
                </option>
              </select>
              <div className="rule-actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={submitNewRule}
                  aria-label={strings.settings.aria.addRule}
                  title={strings.settings.aria.addRule}
                >
                  +
                </button>
              </div>
              {newMatchMode === 'fuzzySentence' &&
                newText.trim().length <
                  DEFAULT_FUZZY_SENTENCE_OPTIONS.minKeywordLength && (
                  <p className="rule-mode-warning">
                    {strings.settings.fuzzyKeywordTooShort}
                  </p>
                )}
            </li>
          </ul>

          {ruleDragState && floatingDraggedRules.length > 0 && (
            <div
              className="rule-drag-overlay"
              style={{
                left: ruleDragState.left,
                top: ruleDragState.top,
                width: ruleDragState.width,
              }}
            >
              {floatingDraggedRules.map((rule) => {
                const draft = getRuleDraft(rule)

                return (
                  <div className="rule-drag-overlay-item" key={rule.id}>
                    <span className="rule-drag-overlay-handle">::</span>
                    <span className="rule-drag-overlay-text">{draft.text}</span>
                    <span className="rule-drag-overlay-score">
                      {draft.scoreText}
                    </span>
                    <span className="rule-drag-overlay-mode">
                      {strings.settings.matchModeCompactLabels[draft.matchMode]}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {isJsonDialogOpen && (
        <div
          className="settings-modal-backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setIsJsonDialogOpen(false)
            }
          }}
        >
          <section
            className="panel settings-io-panel settings-modal-panel"
            aria-labelledby="rule-json-title"
            aria-modal="true"
            role="dialog"
          >
            <div className="panel-header">
              <h2 id="rule-json-title">{strings.settings.jsonTitle}</h2>
              <div className="dialog-actions">
                <button type="button" className="copy-button" onClick={copyExport}>
                  {strings.settings.copyExport}
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setIsJsonDialogOpen(false)}
                  aria-label={strings.settings.closeJsonDialog}
                  title={strings.common.close}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="panel-body settings-body">
              <label className="json-field">
                <span>{strings.settings.importJsonLabel}</span>
                <textarea
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  placeholder={strings.settings.importPlaceholder}
                />
              </label>
              <button
                type="button"
                className="run-button compact"
                onClick={importRules}
                disabled={importText.trim().length === 0}
              >
                {strings.settings.validateAndReplace}
              </button>
              <label className="json-field">
                <span>{strings.settings.exportJsonLabel}</span>
                <textarea value={exportText} readOnly />
              </label>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
