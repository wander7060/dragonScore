import { useState } from 'react'
import { Icon } from './components/Icon'
import { SettingsPanel } from './components/SettingsPanel'
import {
  OcrPanel,
  OcrStatusPill,
  type OcrStatus,
} from './features/ocr/OcrPanel'
import { useScoreRules } from './hooks/useScoreRules'
import './App.css'

type AppView = 'ocr' | 'settings'

function App() {
  const [activeView, setActiveView] = useState<AppView>('ocr')
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle')
  const { rules, setRules, storageWarning } = useScoreRules()

  return (
    <main className="ocr-shell">
      <section className="workspace" aria-label="OCR demo workspace">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">
              <Icon name="scan" />
            </span>
            <span>
              <span className="app-title">DragonScore</span>
            </span>
          </div>
          <OcrStatusPill status={ocrStatus} />
        </header>

        <nav className="view-tabs" aria-label="主要視圖">
          <button
            type="button"
            className={activeView === 'ocr' ? 'is-active' : ''}
            onClick={() => setActiveView('ocr')}
          >
            OCR
          </button>
          <button
            type="button"
            className={activeView === 'settings' ? 'is-active' : ''}
            onClick={() => setActiveView('settings')}
          >
            設定
          </button>
        </nav>

        <div
          className="view-panel"
          hidden={activeView !== 'ocr'}
          aria-hidden={activeView !== 'ocr'}
        >
          <OcrPanel
            isActive={activeView === 'ocr'}
            rules={rules}
            onStatusChange={setOcrStatus}
          />
        </div>

        <div
          className="view-panel"
          hidden={activeView !== 'settings'}
          aria-hidden={activeView !== 'settings'}
        >
          <SettingsPanel
            rules={rules}
            storageWarning={storageWarning}
            onRulesChange={setRules}
          />
        </div>
      </section>

      <footer className="app-subtitle">Powered by ppu-paddle-ocr/web</footer>
    </main>
  )
}

export default App
