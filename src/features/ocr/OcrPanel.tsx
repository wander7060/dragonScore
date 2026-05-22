import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PaddleOcrService } from 'ppu-paddle-ocr/web'
import { Icon } from '../../components/Icon'
import { ScoreSummaryPanel } from '../../components/ScoreSummaryPanel'
import { calculateScore } from '../../lib/scoring'
import type {
  AmbiguousMatchResolution,
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

const statusLabel: Record<OcrStatus, string> = {
  idle: '待命',
  loading_model: '模型初始化',
  recognizing: '影像分析',
  success: '完成',
  error: '錯誤',
}

function formatScore(score: number) {
  const text = Number.isInteger(score)
    ? String(score)
    : score.toFixed(2).replace(/\.?0+$/, '')

  return score > 0 ? `+${text}` : text
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
  const [ambiguousResolutions, setAmbiguousResolutions] = useState<
    AmbiguousMatchResolution[]
  >([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const serviceRef = useRef<CachedOcrService | null>(null)
  const scoreSummary = useMemo(
    () => calculateScore(results, rules, ambiguousResolutions),
    [ambiguousResolutions, results, rules],
  )
  const scoreByResult = useMemo(
    () =>
      new Map(scoreSummary.itemScores.map(({ item, score }) => [item, score])),
    [scoreSummary],
  )
  const selectedLanguage = ocrLanguageOptions.find((option) => option.id === language)

  const processFile = useCallback((file?: File | null) => {
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setErrorMsg('請上傳有效的圖片檔案。')
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
      setErrorMsg('請先選擇圖片。')
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
        setErrorMsg('PaddleOCR 沒有從這張圖片辨識出文字。')
      }
    } catch (error) {
      console.error(error)
      const message =
        error instanceof Error ? error.message : '辨識過程中發生未知錯誤。'

      setErrorMsg(`PaddleOCR 辨識失敗：${message}`)
      setStatus('error')
    }
  }

  const copyAllText = async () => {
    const allText = results.map((result) => result.text).join('\n')

    try {
      await navigator.clipboard.writeText(allText)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1600)
    } catch {
      setErrorMsg('無法寫入剪貼簿。')
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
      <section className="panel media-panel" aria-labelledby="image-source-title">
        <div className="panel-header">
          <h2 id="image-source-title">
            <Icon name="image" />
            圖片來源
          </h2>
          {previewUrl && (
            <button
              type="button"
              className="icon-button danger"
              onClick={clearImage}
              aria-label="清除圖片"
              title="清除圖片"
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
              <span className="dropzone-title">選擇圖片</span>
              <span className="dropzone-meta">拖放圖片或貼上剪貼簿影像</span>
            </button>
          ) : (
            <div className="preview-frame">
              <div className="image-stage">
                <img src={previewUrl} alt={imageFile?.name ?? 'OCR preview'} />
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
              <dt>檔名</dt>
              <dd>{imageFile.name}</dd>
            </div>
            <div>
              <dt>尺寸</dt>
              <dd>
                {imageDimensions.width} x {imageDimensions.height}
              </dd>
            </div>
            <div>
              <dt>大小</dt>
              <dd>{(imageFile.size / 1024).toFixed(1)} KB</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="panel result-panel" aria-labelledby="ocr-result-title">
        <div className="panel-header">
          <h2 id="ocr-result-title">
            <Icon name="scan" />
            辨識結果
          </h2>
          {results.length > 0 && (
            <button type="button" className="copy-button" onClick={copyAllText}>
              <Icon name="copy" />
              {copyState === 'copied' ? '已複製' : '複製全部'}
            </button>
          )}
        </div>

        <div className="panel-body result-body">
          <label className="language-field">
            <span>辨識語言</span>
            <select
              value={language}
              onChange={(event) => changeLanguage(event.target.value as OcrLanguage)}
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

          <button
            type="button"
            className="run-button"
            onClick={runOcr}
            disabled={!canStart}
          >
            {isBusy && <span className="spinner" aria-hidden="true" />}
            {status === 'loading_model'
              ? '初始化 AI 模型中...'
              : status === 'recognizing'
                ? '影像特徵分析中...'
                : '開始文字辨識'}
          </button>

          {errorMsg && (
            <div className="message error-message" role="alert">
              <Icon name="alert" />
              <p>{errorMsg}</p>
            </div>
          )}

          <div className="results-box">
            {results.length > 0 ? (
              <ul className="result-list" aria-label="OCR results">
                {results.map((result, index) => {
                  const itemScore = scoreByResult.get(result) ?? 0

                  return (
                    <li className="result-item" key={`${result.text}-${index}`}>
                      <Icon name="check" className="result-check" />
                      <div className="result-copy">
                        <p>{result.text}</p>
                        <div className="confidence-row">
                          <span className="confidence-bar">
                            <span
                              className="confidence-fill"
                              data-level={
                                result.confidence > 0.8
                                  ? 'high'
                                  : result.confidence > 0.5
                                    ? 'medium'
                                    : 'low'
                              }
                              style={{ width: `${result.confidence * 100}%` }}
                            />
                          </span>
                          <span className="confidence-value">
                            {(result.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
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
                        aria-label={`項目分數 ${itemScore}`}
                      >
                        {formatScore(itemScore)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="empty-state">
                {isBusy ? (
                  <>
                    <span className="large-spinner" aria-hidden="true" />
                    <p>
                      {status === 'loading_model'
                        ? 'Loading OCR Weights...'
                        : 'Processing Image...'}
                    </p>
                  </>
                ) : (
                  <>
                    <Icon name="scan" />
                    <p>等待辨識</p>
                  </>
                )}
              </div>
            )}
          </div>

          <ScoreSummaryPanel
            rulesCount={rules.length}
            summary={scoreSummary}
            onAmbiguousResolutionChange={changeAmbiguousResolution}
          />
        </div>
      </section>
    </div>
  )
}
