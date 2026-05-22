import { useState } from 'react'
import { Icon } from './components/Icon'
import { SettingsPanel } from './components/SettingsPanel'
import {
  OcrPanel,
  OcrStatusPill,
  type OcrStatus,
} from './features/ocr/OcrPanel'
import { useScoreRules } from './hooks/useScoreRules'
import { strings } from './i18n/strings'
import './App.css'

type AppView = 'ocr' | 'settings'

function App() {
  const [activeView, setActiveView] = useState<AppView>('ocr')
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle')
  const { rules, setRules, storageWarning } = useScoreRules()

  return (
    <main className="ocr-shell">
      <section className="workspace" aria-label={strings.app.workspaceLabel}>
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">
              <Icon name="scan" />
            </span>
            <span>
              <span className="app-title">{strings.app.title}</span>
            </span>
          </div>
          <OcrStatusPill status={ocrStatus} />
        </header>

        <nav className="view-tabs" aria-label={strings.app.tabsLabel}>
          <button
            type="button"
            className={activeView === 'ocr' ? 'is-active' : ''}
            onClick={() => setActiveView('ocr')}
          >
            {strings.app.tabs.ocr}
          </button>
          <button
            type="button"
            className={activeView === 'settings' ? 'is-active' : ''}
            onClick={() => setActiveView('settings')}
          >
            {strings.app.tabs.settings}
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

      <footer className="app-bottom">{strings.app.poweredBy}</footer>
    </main>
  )
}

export default App
