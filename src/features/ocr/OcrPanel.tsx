import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PaddleOcrService } from 'ppu-paddle-ocr/web'
import { HighlightedText } from '../../components/HighlightedText'
import { Icon } from '../../components/Icon'
import { ScoreSummaryPanel } from '../../components/ScoreSummaryPanel'
import { strings } from '../../i18n/strings'
import {
  DEFAULT_LINE_GROUPING_OPTIONS,
  calculateScore,
} from '../../lib/scoring'
import type {
  AmbiguousMatchResolution,
  LineMatch,
  OcrResult,
  ScoreRule,
} from '../../types/scoring'
import {
  createPaddleService,
  ocrLanguageOptions,
  recognizeImageFile,
  type OcrLanguage,
} from './ocrService'

export type OcrStatus =
  | 'idle'
  | 'loading_model'
  | 'recognizing'
  | 'success'
  | 'error'

interface OcrPanelProps {
  isActive: boolean
  rules: ScoreRule[]
  onStatusChange?: (status: OcrStatus) => void
}

interface CachedOcrService {
  language: OcrLanguage
  service: PaddleOcrService
}

type ScoreExclusionMode = 'none' | 'transcendence' | 'intense' | 'both'

const statusLabel: Record<OcrStatus, string> = {
  idle: strings.ocr.statusLabels.idle,
  loading_model: strings.ocr.statusLabels.loading_model,
  recognizing: strings.ocr.statusLabels.recognizing,
  success: strings.ocr.statusLabels.success,
  error: strings.ocr.statusLabels.error,
}

const MIN_LINE_MERGE_DISTANCE_RATIO = 0.1
const MAX_LINE_MERGE_DISTANCE_RATIO = 2
const LINE_MERGE_DISTANCE_STEP = 0.05
const scoreExclusionOptions: Array<{
  id: ScoreExclusionMode
  keywords: string[]
}> = [
  { id: 'none', keywords: [] },
  { id: 'transcendence', keywords: ['超越'] },
  { id: 'intense', keywords: ['強烈'] },
  { id: 'both', keywords: ['超越', '強烈'] },
]

function formatScore(score: number, showPositiveZero = false) {
  const text = Number.isInteger(score)
    ? String(score)
    : score.toFixed(2).replace(/\.?0+$/, '')

  return score > 0 || (showPositiveZero && score === 0) ? `+${text}` : text
}

function formatLineMergeDistance(ratio: number) {
  return `${ratio.toFixed(2)}x`
}

function formatSimilarity(similarity?: number) {
  if (similarity === undefined) {
    return ''
  }

  return `${(similarity * 100).toFixed(1)}%`
}

function getMatchStatus(match: LineMatch) {
  if (match.ambiguous && !match.resolvedByUser) {
    return strings.score.status.pending
  }

  if (match.ambiguous && match.resolvedByUser) {
    return match.counted
      ? strings.score.status.selectedCounted
      : strings.score.status.selectedNotCounted
  }

  return match.counted
    ? strings.score.status.counted
    : strings.score.status.notCounted
}

function getVisibleLineScore(lineMatch: LineMatch | undefined, itemScore: number) {
  return formatScore(itemScore, Boolean(lineMatch?.ignored))
}

function getLineConfidence(items: OcrResult[]) {
  if (items.length === 0) {
    return 0
  }

  return items.reduce((sum, item) => sum + item.confidence, 0) / items.length
}

function clampLineMergeDistanceRatio(value: number) {
  return Math.min(
    MAX_LINE_MERGE_DISTANCE_RATIO,
    Math.max(MIN_LINE_MERGE_DISTANCE_RATIO, value),
  )
}

export function OcrStatusPill({ status }: { status: OcrStatus }) {
  return (
    <div className="status-pill" data-status={status}>
      <span className="status-dot" />
      {statusLabel[status]}
    </div>
  )
}

export function OcrPanel({ isActive, rules, onStatusChange }: OcrPanelProps) {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<OcrStatus>('idle')
  const [results, setResults] = useState<OcrResult[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const [language, setLanguage] = useState<OcrLanguage>('chinese')
  const [scoreExclusionMode, setScoreExclusionMode] =
    useState<ScoreExclusionMode>('none')
  const [hideUnmatchedLines, setHideUnmatchedLines] = useState(true)
  const [lineMergeDistanceRatio, setLineMergeDistanceRatio] = useState(
    DEFAULT_LINE_GROUPING_OPTIONS.centerThresholdRatio,
  )
  const [ambiguousResolutions, setAmbiguousResolutions] = useState<
    AmbiguousMatchResolution[]
  >([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const serviceRef = useRef<CachedOcrService | null>(null)
  const scoreIgnoredKeywords = useMemo(
    () =>
      scoreExclusionOptions.find((option) => option.id === scoreExclusionMode)
        ?.keywords ?? [],
    [scoreExclusionMode],
  )
  const scoreSummary = useMemo(
    () =>
      calculateScore(
        results,
        rules,
        ambiguousResolutions,
        {
          centerThresholdRatio: lineMergeDistanceRatio,
        },
        scoreIgnoredKeywords,
      ),
    [
      ambiguousResolutions,
      lineMergeDistanceRatio,
      results,
      rules,
      scoreIgnoredKeywords,
    ],
  )
  const scoreByResult = useMemo(
    () =>
      new Map(scoreSummary.itemScores.map(({ item, score }) => [item, score])),
    [scoreSummary],
  )
  const matchByLine = useMemo(
    () => new Map(scoreSummary.matches.map((match) => [match.lineId, match])),
    [scoreSummary],
  )
  const visibleRecognizedLines = useMemo(
    () =>
      hideUnmatchedLines
        ? scoreSummary.recognizedLines.filter((line) =>
            matchByLine.has(line.id),
          )
        : scoreSummary.recognizedLines,
    [hideUnmatchedLines, matchByLine, scoreSummary.recognizedLines],
  )
  const selectedLanguage = ocrLanguageOptions.find((option) => option.id === language)

  const updateLineMergeDistanceRatio = (value: string) => {
    const nextValue = Number(value)

    if (!Number.isFinite(nextValue)) {
      return
    }

    const nextRatio = clampLineMergeDistanceRatio(nextValue)

    if (nextRatio === lineMergeDistanceRatio) {
      return
    }

    setAmbiguousResolutions([])
    setLineMergeDistanceRatio(nextRatio)
  }

  const processFile = useCallback((file?: File | null) => {
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setErrorMsg(strings.ocr.errors.invalidImage)
      setStatus('error')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const nextPreviewUrl = String(event.target?.result ?? '')
      const image = new Image()

      image.onload = () => {
        setImageDimensions({
          width: image.naturalWidth,
          height: image.naturalHeight,
        })
      }

      image.src = nextPreviewUrl
      setPreviewUrl(nextPreviewUrl)
    }
    reader.readAsDataURL(file)

    setImageFile(file)
    setResults([])
    setAmbiguousResolutions([])
    setErrorMsg('')
    setCopyState('idle')
    setStatus('idle')
  }, [])

  useEffect(() => {
    onStatusChange?.(status)
  }, [onStatusChange, status])

  useEffect(() => {
    if (!isActive) {
      return undefined
    }

    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items

      if (!items) {
        return
      }

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index]

        if (item.type.startsWith('image/')) {
          processFile(item.getAsFile())
          break
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [isActive, processFile])

  useEffect(() => {
    return () => {
      void serviceRef.current?.service.destroy()
      serviceRef.current = null
    }
  }, [])

  const disposeCachedService = async () => {
    const cachedService = serviceRef.current
    serviceRef.current = null
    await cachedService?.service.destroy()
  }

  const runOcr = async () => {
    if (!imageFile || !previewUrl) {
      setErrorMsg(strings.ocr.errors.chooseImageFirst)
      setStatus('error')
      return
    }

    try {
      setErrorMsg('')
      setResults([])
      setAmbiguousResolutions([])

      setStatus('loading_model')

      if (serviceRef.current?.language !== language) {
        await disposeCachedService()
      }

      if (!serviceRef.current) {
        serviceRef.current = {
          language,
          service: await createPaddleService(language),
        }
      }

      if (!serviceRef.current.service.isInitialized()) {
        await serviceRef.current.service.initialize()
      }

      setStatus('recognizing')
      const nextResults = await recognizeImageFile(serviceRef.current.service, imageFile)

      setResults(nextResults)
      setStatus('success')

      if (nextResults.length === 0) {
        setErrorMsg(strings.ocr.errors.noTextDetected)
      }
    } catch (error) {
      console.error(error)
      const message =
        error instanceof Error ? error.message : strings.ocr.errors.unknownRecognition

      setErrorMsg(strings.ocr.errors.recognitionFailed(message))
      setStatus('error')
    }
  }

  const copyAllText = async () => {
    const allText = scoreSummary.recognizedLines
      .map((line) => line.text)
      .join('\n')

    try {
      await navigator.clipboard.writeText(allText)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1600)
    } catch {
      setErrorMsg(strings.ocr.errors.clipboardWrite)
      setStatus('error')
    }
  }

  const clearImage = () => {
    setImageFile(null)
    setPreviewUrl(null)
    setImageDimensions({ width: 0, height: 0 })
    setResults([])
    setAmbiguousResolutions([])
    setErrorMsg('')
    setCopyState('idle')
    setStatus('idle')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const changeLanguage = (nextLanguage: OcrLanguage) => {
    setLanguage(nextLanguage)
    setResults([])
    setAmbiguousResolutions([])
    setErrorMsg('')
    setCopyState('idle')
    setStatus('idle')
  }

  const changeScoreExclusionMode = (nextMode: ScoreExclusionMode) => {
    setScoreExclusionMode(nextMode)
    setAmbiguousResolutions([])
  }

  const isBusy = status === 'loading_model' || status === 'recognizing'
  const canStart = Boolean(previewUrl) && !isBusy

  const changeAmbiguousResolution = (lineId: string, ruleId: string | null) => {
    setAmbiguousResolutions((currentResolutions) => {
      const remainingResolutions = currentResolutions.filter(
        (resolution) => resolution.lineId !== lineId,
      )

      if (!ruleId) {
        return remainingResolutions
      }

      return [...remainingResolutions, { lineId, selectedRuleId: ruleId }]
    })
  }

  return (
    <div className="ocr-grid">
      <div className="ocr-source-column">
        <section className="panel media-panel" aria-labelledby="image-source-title">
          <div className="panel-header">
            <h2 id="image-source-title">
              <Icon name="image" />
              {strings.ocr.imageSourceTitle}
            </h2>
            {previewUrl && (
              <button
                type="button"
                className="icon-button danger"
                onClick={clearImage}
                aria-label={strings.ocr.clearImage}
                title={strings.ocr.clearImage}
              >
                <Icon name="trash" />
              </button>
            )}
          </div>

          <div className="panel-body">
            {!previewUrl ? (
              <button
                type="button"
                className={`dropzone ${isDragging ? 'is-dragging' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragLeave={(event) => {
                  event.preventDefault()
                  setIsDragging(false)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  setIsDragging(true)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  setIsDragging(false)
                  processFile(event.dataTransfer.files.item(0))
                }}
              >
                <Icon name="upload" className="dropzone-icon" />
                <span className="dropzone-title">{strings.ocr.uploadTitle}</span>
                <span className="dropzone-meta">{strings.ocr.uploadMeta}</span>
              </button>
            ) : (
              <div className="preview-frame">
                <div className="image-stage">
                  <img
                    src={previewUrl}
                    alt={imageFile?.name ?? strings.ocr.previewAlt}
                  />
                  {imageDimensions.width > 0 &&
                    imageDimensions.height > 0 &&
                    results.map((result, index) => (
                      <span
                        className="bbox"
                        key={`${result.text}-${index}`}
                        style={{
                          left: `${(result.box.x / imageDimensions.width) * 100}%`,
                          top: `${(result.box.y / imageDimensions.height) * 100}%`,
                          width: `${(result.box.width / imageDimensions.width) * 100}%`,
                          height: `${(result.box.height / imageDimensions.height) * 100}%`,
                        }}
                      >
                        <span className="bbox-tooltip">
                          {result.text} {(result.confidence * 100).toFixed(0)}%
                        </span>
                      </span>
                    ))}
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="visually-hidden"
              onChange={(event) => processFile(event.target.files?.item(0))}
            />
          </div>

          {imageFile && (
            <dl className="file-meta">
              <div>
                <dt>{strings.ocr.fileName}</dt>
                <dd>{imageFile.name}</dd>
              </div>
              <div>
                <dt>{strings.ocr.dimensions}</dt>
                <dd>
                  {imageDimensions.width} x {imageDimensions.height}
                </dd>
              </div>
              <div>
                <dt>{strings.ocr.fileSize}</dt>
                <dd>{(imageFile.size / 1024).toFixed(1)} KB</dd>
              </div>
            </dl>
          )}
        </section>

        <section
          className="panel recognition-settings-panel"
          aria-labelledby="recognition-settings-title"
        >
          <div className="panel-header">
            <h2 id="recognition-settings-title">
              <Icon name="scan" />
              {strings.ocr.recognitionSettingsTitle}
            </h2>
          </div>
          <div className="panel-body recognition-settings-body">
            <label className="language-field">
              <span>{strings.ocr.languageLabel}</span>
              <select
                value={language}
                onChange={(event) =>
                  changeLanguage(event.target.value as OcrLanguage)
                }
                disabled={isBusy}
              >
                {ocrLanguageOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {selectedLanguage && (
              <p className="language-meta">{selectedLanguage.description}</p>
            )}

            <label className="language-field">
              <span>{strings.ocr.scoreExclusionLabel}</span>
              <select
                value={scoreExclusionMode}
                onChange={(event) =>
                  changeScoreExclusionMode(
                    event.target.value as ScoreExclusionMode,
                  )
                }
                disabled={isBusy}
              >
                {scoreExclusionOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {strings.ocr.scoreExclusionOptions[option.id]}
                  </option>
                ))}
              </select>
            </label>

            <label className="line-merge-field">
              <span>{strings.ocr.lineMergeLabel}</span>
              <strong>{formatLineMergeDistance(lineMergeDistanceRatio)}</strong>
              <input
                type="range"
                min={MIN_LINE_MERGE_DISTANCE_RATIO}
                max={MAX_LINE_MERGE_DISTANCE_RATIO}
                step={LINE_MERGE_DISTANCE_STEP}
                value={lineMergeDistanceRatio}
                onChange={(event) =>
                  updateLineMergeDistanceRatio(event.target.value)
                }
                disabled={isBusy}
              />
              <small>
                {strings.ocr.lineMergeHint(
                  formatLineMergeDistance(lineMergeDistanceRatio),
                )}
              </small>
            </label>
          </div>
        </section>
      </div>

      <section className="panel result-panel" aria-labelledby="ocr-result-title">
        <div className="panel-header">
          <h2 id="ocr-result-title">
            <Icon name="scan" />
            {strings.ocr.resultTitle}
          </h2>
          {results.length > 0 && (
            <div className="result-header-actions">
              <button
                type="button"
                className={`copy-button ${
                  hideUnmatchedLines ? 'is-active' : ''
                }`}
                onClick={() =>
                  setHideUnmatchedLines((currentValue) => !currentValue)
                }
                aria-pressed={hideUnmatchedLines}
              >
                {strings.ocr.hideUnmatched}
              </button>
              <button type="button" className="copy-button" onClick={copyAllText}>
                <Icon name="copy" />
                {copyState === 'copied'
                  ? strings.ocr.copyCopied
                  : strings.ocr.copyAll}
              </button>
            </div>
          )}
        </div>

        <div className="panel-body result-body">
          <button
            type="button"
            className="run-button"
            onClick={runOcr}
            disabled={!canStart}
          >
            {isBusy && <span className="spinner" aria-hidden="true" />}
            {status === 'loading_model'
              ? strings.ocr.runLoadingModel
              : status === 'recognizing'
                ? strings.ocr.runRecognizing
                : strings.ocr.runIdle}
          </button>

          {errorMsg && (
            <div className="message error-message" role="alert">
              <Icon name="alert" />
              <p>{errorMsg}</p>
            </div>
          )}

          <div className="results-box">
            {results.length > 0 ? (
              visibleRecognizedLines.length > 0 ? (
                <ul className="result-list" aria-label={strings.ocr.resultsAria}>
                  {visibleRecognizedLines.map((line) => {
                    const itemScore = line.items.reduce(
                      (sum, item) => sum + (scoreByResult.get(item) ?? 0),
                      0,
                    )
                    const confidence = getLineConfidence(line.items)
                    const lineMatch = matchByLine.get(line.id)
                    const isPendingAmbiguous = Boolean(
                      lineMatch?.ambiguous && !lineMatch.resolvedByUser,
                    )

                    return (
                      <li
                        className={`result-item ${
                          isPendingAmbiguous ? 'is-ambiguous' : ''
                        }`}
                        key={line.id}
                      >
                        <Icon name="check" className="result-check" />
                        <div className="result-copy">
                          <p>
                            {lineMatch ? (
                              <HighlightedText
                                text={line.text}
                                keyword={
                                  lineMatch.matchType === 'exact'
                                    ? lineMatch.keyword
                                    : undefined
                                }
                              />
                            ) : (
                              line.text
                            )}
                          </p>
                          <div className="confidence-row">
                            <span className="confidence-bar">
                              <span
                                className="confidence-fill"
                                data-level={
                                  confidence > 0.8
                                    ? 'high'
                                    : confidence > 0.5
                                      ? 'medium'
                                      : 'low'
                                }
                                style={{ width: `${confidence * 100}%` }}
                              />
                            </span>
                            <span className="confidence-value">
                              {(confidence * 100).toFixed(0)}%
                            </span>
                          </div>

                          {lineMatch && (
                            <div className="result-match-details">
                              <div className="line-match-meta">
                                {lineMatch.ignored ? (
                                  <span className="line-match-badge muted">
                                    {strings.score.status.ignored}
                                  </span>
                                ) : (
                                  <span className="line-match-badge">
                                    {strings.score.matchTypes[lineMatch.matchType]}
                                  </span>
                                )}
                                {!lineMatch.ignored && lineMatch.ambiguous && (
                                  <span className="line-match-badge warning">
                                    {lineMatch.resolvedByUser
                                      ? strings.score.status.ambiguityResolved
                                      : strings.score.status.pending}
                                  </span>
                                )}
                                {!lineMatch.ignored && !isPendingAmbiguous && (
                                  <span
                                    className={`line-match-badge ${
                                      lineMatch.counted ? '' : 'muted'
                                    }`}
                                  >
                                    {getMatchStatus(lineMatch)}
                                  </span>
                                )}
                                {lineMatch.matchType === 'fuzzy' && (
                                  <span className="line-match-badge muted">
                                    {strings.score.similarityDistance(
                                      formatSimilarity(lineMatch.similarity),
                                      lineMatch.rawDistance ?? 0,
                                    )}
                                  </span>
                                )}
                              </div>
                              {!isPendingAmbiguous && (
                                <div className="line-match-keyword">
                                  <span>{lineMatch.keyword}</span>
                                  <b>
                                    {formatScore(
                                      lineMatch.score,
                                      lineMatch.ignored,
                                    )}
                                  </b>
                                </div>
                              )}
                              {!lineMatch.ignored &&
                                lineMatch.ambiguous &&
                                lineMatch.ambiguousOptions && (
                                  <label className="ambiguous-select-field">
                                    <span>{strings.score.ambiguousPrompt}</span>
                                    <select
                                      value={
                                        lineMatch.resolvedByUser
                                          ? lineMatch.ruleId
                                          : ''
                                      }
                                      onChange={(event) =>
                                        changeAmbiguousResolution(
                                          lineMatch.lineId,
                                          event.target.value || null,
                                        )
                                      }
                                    >
                                      <option value="">
                                        {strings.score.noApply}
                                      </option>
                                      {lineMatch.ambiguousOptions.map(
                                        (option) => (
                                          <option
                                            key={`${lineMatch.lineId}-${option.ruleId}`}
                                            value={option.ruleId}
                                          >
                                            {strings.score.ambiguousOption(
                                              option.keyword,
                                              option.score,
                                              formatSimilarity(option.similarity),
                                              option.rawDistance,
                                            )}
                                          </option>
                                        ),
                                      )}
                                    </select>
                                  </label>
                                )}
                            </div>
                          )}
                        </div>
                        <span
                          className="result-score"
                          data-score={
                            itemScore > 0
                              ? 'positive'
                              : itemScore < 0
                                ? 'negative'
                                : 'zero'
                          }
                          aria-label={strings.ocr.itemScoreAria(itemScore)}
                        >
                          {getVisibleLineScore(lineMatch, itemScore)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <div className="empty-state">
                  <Icon name="scan" />
                  <p>{strings.ocr.hiddenUnmatchedEmpty}</p>
                </div>
              )
            ) : (
              <div className="empty-state">
                {isBusy ? (
                  <>
                    <span className="large-spinner" aria-hidden="true" />
                    <p>
                      {status === 'loading_model'
                        ? strings.ocr.loadingWeights
                        : strings.ocr.processingImage}
                    </p>
                  </>
                ) : (
                  <>
                    <Icon name="scan" />
                    <p>{strings.ocr.waitingRecognition}</p>
                  </>
                )}
              </div>
            )}
          </div>

          <ScoreSummaryPanel
            rulesCount={rules.length}
            summary={scoreSummary}
          />
        </div>
      </section>
    </div>
  )
}
