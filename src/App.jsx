import { useState, useRef, useCallback } from 'react'
import './App.css'

const API_URL = 'http://localhost:8000'   // FastAPI default port

export default function App() {
  const [image, setImage]         = useState(null)
  const [preview, setPreview]     = useState(null)
  const [result, setResult]       = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [dragging, setDragging]   = useState(false)
  const [online, setOnline]       = useState(true)
  const fileRef = useRef()

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setImage(file)
    setPreview(URL.createObjectURL(file))
    setResult(null)
    setError(null)
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [])

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  const runAnalysis = async () => {
    if (!image) return
    setLoading(true)
    setError(null)

    const MIN_SCAN_MS = 2000
    const form = new FormData()
    form.append('file', image)

    try {
      // Run API call and 6s timer in parallel — result shows only after BOTH finish
      const [res] = await Promise.all([
        fetch(`${API_URL}/detect`, { method: 'POST', body: form }),
        new Promise(resolve => setTimeout(resolve, MIN_SCAN_MS))
      ])

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Server error: ${res.status}`)
      }

      const data = await res.json()
      setResult(data.result)
      setOnline(true)
    } catch (err) {
      setError(err.message)
      setOnline(false)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setImage(null)
    setPreview(null)
    setResult(null)
    setError(null)
  }

  // Use the exact field names returned by your model.py
  const isReal     = result?.prediction === 'REAL'
  const confidence = result?.confidence_percentage ?? 0
  const realProb   = result?.real_probability ?? 0
  const fakeProb   = result?.fake_probability ?? 0
  const facesFound = result?.faces_detected ?? 0

  return (
    <div className="app">
      {/* Scanline overlay */}
      <div className="scanlines" />

      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-left">
          <div className="nav-logo">
            <div className="logo-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="8" r="4" stroke="var(--accent)" strokeWidth="1.5"/>
                <path d="M3 18c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div className="logo-title">VERIDECT</div>
              <div className="logo-sub">DEEPFAKE ANALYSIS SYSTEM</div>
            </div>
          </div>
        </div>
        <div className={`nav-status ${online ? 'online' : 'offline'}`}>
          <span className="status-dot" />
          {online ? 'ONLINE' : 'OFFLINE'}
        </div>
      </nav>

      {/* Main content */}
      <main className="main">
        {!preview ? (
          /* Upload state */
          <div className="upload-section">
            <div className="hero-text">
              <h1>Detect</h1>
              <h1><span className="accent">Deepfakes</span> <span className="muted">instantly.</span></h1>
              <p className="hero-desc">
                Upload any face image. Our ViT-based neural network analyzes
                facial features to determine if the image is authentic or AI-generated.
              </p>
            </div>

            <div
              className={`dropzone ${dragging ? 'dragging' : ''}`}
              onClick={() => fileRef.current.click()}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}
              />
              <div className="drop-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <p className="drop-text">Drop image here or click to upload</p>
              <p className="drop-formats">JPG · PNG · WEBP · AVIF</p>
            </div>
          </div>
        ) : (
          /* Analysis state */
          <div className="analysis-section">
            {/* Image panel */}
            <div className="image-panel">
              <div className={`image-frame ${result ? (isReal ? 'frame-real' : 'frame-fake') : 'frame-neutral'}`}>
                <div className="corner tl"/><div className="corner tr"/>
                <div className="corner bl"/><div className="corner br"/>
                <img src={preview} alt="uploaded" className="preview-img" />
                {loading && (
                  <div className="scan-overlay">
                    <div className="scan-line" />
                    <div className="scan-text">ANALYZING...</div>
                  </div>
                )}
              </div>
              <div className="image-actions">
                <button
                  className={`btn-run ${loading ? 'loading' : ''}`}
                  onClick={runAnalysis}
                  disabled={loading}
                >
                  {loading ? (
                    <><span className="spinner"/>PROCESSING...</>
                  ) : (
                    <>▶ RUN ANALYSIS</>
                  )}
                </button>
                <button className="btn-close" onClick={reset}>✕</button>
              </div>
            </div>

            {/* Results panel */}
            <div className="results-panel">
              {error && (
                <div className="error-card">
                  <div className="error-title">⚠ CONNECTION ERROR</div>
                  <div className="error-msg">{error}</div>
                  <div className="error-hint">
                    Start the backend: <code>uvicorn main:app --reload --port 8000</code>
                  </div>
                </div>
              )}

              {!result && !error && (
                <div className="waiting-card">
                  <div className="waiting-label">AWAITING ANALYSIS</div>
                  <p>Click <strong>RUN ANALYSIS</strong> to begin deepfake detection using the ViT neural network.</p>
                  <div className="feature-list">
                    <div className="feature-item"><span className="feat-dot"/>Face detection & cropping</div>
                    <div className="feature-item"><span className="feat-dot"/>ViT feature extraction</div>
                    <div className="feature-item"><span className="feat-dot"/>Authenticity classification</div>
                    <div className="feature-item"><span className="feat-dot"/>Confidence scoring</div>
                  </div>
                </div>
              )}

              {result && (
                <>
                  {/* Verdict */}
                  <div className={`verdict-card ${isReal ? 'verdict-real' : 'verdict-fake'}`}>
                    <div className="verdict-label">ANALYSIS RESULT</div>
                    <div className="verdict-value">{result.prediction}</div>
                    <div className="verdict-sub">
                      {isReal ? 'Authentic image detected' : 'Deepfake detected'} ·{' '}
                      <span className="verdict-conf">{confidence}% confidence</span>
                    </div>
                  </div>

                  {/* Probability breakdown */}
                  <div className="breakdown-card">
                    <div className="card-label">PROBABILITY BREAKDOWN</div>
                    <div className="bar-row">
                      <span className="bar-name">REAL</span>
                      <div className="bar-track">
                        <div className="bar-fill bar-real" style={{ width: `${realProb}%` }} />
                      </div>
                      <span className="bar-pct real-pct">{realProb}%</span>
                    </div>
                    <div className="bar-row">
                      <span className="bar-name">FAKE</span>
                      <div className="bar-track">
                        <div className="bar-fill bar-fake" style={{ width: `${fakeProb}%` }} />
                      </div>
                      <span className="bar-pct fake-pct">{fakeProb}%</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="stats-row">
                    <div className="stat-card">
                      <div className="stat-value accent">{confidence}%</div>
                      <div className="stat-label">CONFIDENCE</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value accent">{facesFound}</div>
                      <div className="stat-label">FACES FOUND</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value accent">ViT</div>
                      <div className="stat-label">MODEL</div>
                    </div>
                  </div>

                  {/* Interpretation */}
                  <div className="interp-card">
                    <div className="card-label">INTERPRETATION</div>
                    <p className="interp-text">
                      {isReal
                        ? `The model is highly confident this is an authentic, unmanipulated image. Fake probability was ${fakeProb}%.`
                        : `The model has detected signs of AI manipulation. Real probability was ${realProb}%. Exercise caution with this image.`
                      }
                    </p>
                  </div>

                  {/* Reset */}
                  <button className="btn-another" onClick={reset}>
                    → ANALYZE ANOTHER IMAGE
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <span>VERIDECT v1.0 · ViT DEEPFAKE DETECTOR</span>
        <span>MODEL: shunda012/vit-deepfake-detector</span>
      </footer>
    </div>
  )
}