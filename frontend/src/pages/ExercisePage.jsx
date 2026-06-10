import { memo, useDeferredValue, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, ChevronRight, Clock, Flame, MapPin, Search, Target, X, RotateCcw, Filter } from 'lucide-react'
import { getFallbackExercises } from '../data/fallbackExercises'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const EXERCISE_TIMEOUT_MS = 4500

async function fetchExerciseApi(url, options = {}, timeoutMs = EXERCISE_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) {
      throw new Error('운동 데이터를 불러오지 못해 로컬 데이터로 표시합니다.')
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

// ─── constants ───────────────────────────────────────────────────────────────

const CATEGORIES = ['전체', '등', '가슴', '어깨', '하체', '코어', '이두', '삼두', '전완근', '유산소', '스트레칭']

const EQUIPMENT_LABEL = {
  '': '기타', body: '맨몸', barbell: '바벨', dumbbell: '덤벨',
  machine: '머신', band: '밴드', kettlebell: '케틀벨',
  pull_up_bar: '철봉', dips_bar: '딥스바', normal: '일반',
  foamroller: '폼롤러', massageball: '마사지볼',
}

const DIFF_LABEL = { 1: '초급', 2: '중급', 3: '고급' }
const DIFF_COLOR = { 1: '#4CAF50', 2: '#FFC107', 3: '#F44336' }

const CAT_COLOR = {
  등: '#FFD700', 가슴: '#FF6B35', 어깨: '#6C63FF', 하체: '#00D4A0',
  코어: '#FF6B6B', 이두: '#00B4D8', 삼두: '#F77F00', 전완근: '#7B2FBE',
  유산소: '#E63946', 스트레칭: '#06D6A0',
}

const PAGE_SIZE = 16

function normalizeMediaUrl(url) {
  const value = String(url || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value) || value.startsWith('/')) return value
  return `/${value.replace(/^\/+/, '')}`
}

function videoUrl(ex) {
  const fromApi = normalizeMediaUrl(ex.video_url)
  if (fromApi) return fromApi
  return `/videos/${encodeURIComponent(ex.category)}/${ex.id}_${encodeURIComponent(ex.name_kor)}.mp4`
}

function StaticExerciseThumb({ ex, color }) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `linear-gradient(135deg, ${color}22, rgba(8,8,8,0.35) 46%, rgba(8,8,8,0.94)), radial-gradient(circle at 78% 26%, ${color}30, transparent 34%)`,
    }}>
      <div style={{
        fontFamily: 'Bebas Neue',
        fontSize: 'clamp(36px, 11vw, 64px)',
        color: 'rgba(255,255,255,0.78)',
        letterSpacing: 1,
        lineHeight: 1,
        textAlign: 'center',
        padding: '0 24px',
      }}>
        {ex.name_kor}
      </div>
    </div>
  )
}

function scrollToPageTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}

const ExerciseCard = memo(function ExerciseCard({ ex, onClick }) {
  const [hovered, setHovered] = useState(false)
  const [isNearViewport, setIsNearViewport] = useState(false)
  const [videoOk, setVideoOk] = useState(true)
  const cardRef = useRef(null)
  const videoRef = useRef(null)

  const accentColor = CAT_COLOR[ex.category] || '#FFD700'
  const difficulty = Math.min(Math.max(Number(ex.difficulty) || 1, 1), 3)
  const diffColor = DIFF_COLOR[difficulty] || '#FFC107'
  const showPreview = videoOk && isNearViewport

  useEffect(() => {
    setVideoOk(true)
  }, [ex.id])

  useEffect(() => {
    if (!cardRef.current) return
    if (typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsNearViewport(entry.isIntersecting),
      { rootMargin: '220px 0px' }
    )

    observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!showPreview) {
      return
    }

    videoRef.current?.play().catch(() => {
      // Muted previews should autoplay, but blocked playback can be ignored.
    })
  }, [showPreview])

  useEffect(() => {
    return () => {
      const video = videoRef.current
      if (!video) return
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [])

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(ex)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(ex)
        }
      }}
      tabIndex={0}
      style={{
        background: '#111',
        border: hovered ? `1px solid ${accentColor}40` : '1px solid rgba(255,255,255,0.05)',
        borderRadius: 4,
        overflow: 'hidden',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered ? `0 16px 48px ${accentColor}14, 0 4px 20px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'all 0.28s cubic-bezier(.22,.68,0,1.2)',
      }}
    >
      {/* Video */}
      <div style={{ position: 'relative', height: 220, background: '#0A0A0A', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg, ${accentColor}18, rgba(10,10,10,0.22) 45%, rgba(10,10,10,0.94))`,
          zIndex: 1,
        }}>
          <div style={{
            position: 'absolute',
            left: 18,
            right: 18,
            bottom: 18,
            fontFamily: 'Bebas Neue',
            fontSize: 30,
            color: 'rgba(255,255,255,0.9)',
            letterSpacing: 1,
            lineHeight: 1,
          }}>
            {ex.name_kor}
          </div>
        </div>

        {showPreview && (
          <video
            ref={videoRef}
            src={videoUrl(ex)}
            loop
            muted
            autoPlay
            playsInline
            preload="metadata"
            onLoadedData={e => e.currentTarget.play().catch(() => {})}
            onCanPlay={e => e.currentTarget.play().catch(() => {})}
            onError={() => setVideoOk(false)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: hovered ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform 0.5s ease',
              zIndex: 2,
            }}
          />
        )}

        {/* Overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)',
          pointerEvents: 'none',
          zIndex: 3,
        }} />

        {/* Category badge */}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          background: accentColor,
          color: '#000', fontSize: 10, fontWeight: 800,
          padding: '3px 10px', borderRadius: 2,
          letterSpacing: 0.5,
          zIndex: 4,
        }}>{ex.category}</div>

        {/* Difficulty */}
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: 'rgba(0,0,0,0.65)',
          borderRadius: 50, padding: '3px 10px',
          display: 'flex', gap: 2, backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.1)',
          zIndex: 4,
        }}>
          {[1, 2, 3].map(n => (
            <span key={n} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: n <= difficulty ? diffColor : 'rgba(255,255,255,0.12)',
            }} />
          ))}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 16, color: '#FFF', letterSpacing: 0.5, lineHeight: 1.25, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {ex.name_kor}
            </div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', marginTop: 2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {ex.name_eng}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.03)', padding: '3px 8px', borderRadius: 2, border: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            <span>{EQUIPMENT_LABEL[ex.equipment] || '기타'}</span>
          </div>
        </div>
      </div>
    </div>
  )
})

// ─── DetailModal ──────────────────────────────────────────────────────────────

function DetailModal({ ex, onClose, onNavigate, exercises }) {
  const videoRef = useRef(null)
  const accentColor = CAT_COLOR[ex.category] || '#FFD700'
  const [tab, setTab] = useState('guide')

  const relatedList = useMemo(() => {
    if (!ex.related_exercises) return []
    const matches = [...ex.related_exercises.matchAll(/(\d+)\(([^)]+)\)/g)]
    return matches.map(m => ({ id: Number(m[1]), name: m[2] }))
  }, [ex.related_exercises])

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', esc)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const tabs = [
    { id: 'guide', label: '가이드' },
    { id: 'detail', label: '세부 동작' },
    { id: 'caution', label: '주의사항' },
  ]

  const tabContent = {
    guide: ex.guide,
    detail: [
      ex.starting_position && `📍 시작 자세\n${ex.starting_position}`,
      ex.movement && `🔄 동작\n${ex.movement}`,
      ex.breathing && `💨 호흡\n${ex.breathing}`,
    ].filter(Boolean).join('\n\n'),
    caution: ex.caution,
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        animation: 'float-up 0.3s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#111',
          border: `1px solid ${accentColor}25`,
          borderRadius: 4,
          width: '100%', maxWidth: 860,
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          boxShadow: `0 40px 100px rgba(0,0,0,0.7), 0 0 60px ${accentColor}10`,
        }}
      >
        {/* Left: video */}
        <div style={{ width: 340, flexShrink: 0, background: '#0A0A0A', position: 'relative' }}>
          <video
            ref={videoRef}
            src={videoUrl(ex)}
            loop
            muted
            autoPlay
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: 520, display: 'block', background: '#050505' }}
          />
          <div style={{
            position: 'absolute', top: 16, left: 16,
            background: accentColor,
            color: '#000', fontSize: 11, fontWeight: 800,
            padding: '4px 14px', borderRadius: 2,
          }}>{ex.category}</div>
        </div>

        {/* Right: info */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            padding: '24px 28px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          }}>
            <div>
              <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 32, color: '#FFF', letterSpacing: 1, marginBottom: 4 }}>
                {ex.name_kor}
              </h2>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>{ex.name_eng}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                 <span style={{
                  fontSize: 11, padding: '3px 12px', borderRadius: 2,
                  background: `${accentColor}15`, border: `1px solid ${accentColor}30`,
                  color: accentColor,
                }}>
                  {EQUIPMENT_LABEL[ex.equipment] || '기타'}
                </span>
                <span style={{
                  fontSize: 11, padding: '3px 12px', borderRadius: 2,
                  background: `${DIFF_COLOR[ex.difficulty]}15`,
                  border: `1px solid ${DIFF_COLOR[ex.difficulty]}30`,
                  color: DIFF_COLOR[ex.difficulty],
                }}>
                  {'●'.repeat(ex.difficulty)}{'○'.repeat(3 - ex.difficulty)} {DIFF_LABEL[ex.difficulty]}
                </span>
                {ex.tag && (
                  <span style={{
                    fontSize: 11, padding: '3px 12px', borderRadius: 2,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.5)',
                  }}>{ex.tag}</span>
                )}
              </div>
            </div>
            <button onClick={onClose} style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              <X size={16} color="rgba(255,255,255,0.6)" />
            </button>
          </div>

          {/* Description */}
          {ex.description && (
            <div style={{ padding: '16px 28px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, paddingBottom: 16 }}>
                {ex.description}
              </p>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '0 28px' }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background: 'none', border: 'none',
                padding: '12px 16px',
                fontSize: 12, fontWeight: 700,
                color: tab === t.id ? accentColor : 'rgba(255,255,255,0.3)',
                borderBottom: tab === t.id ? `2px solid ${accentColor}` : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
                letterSpacing: 0.5,
              }}>{t.label}</button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 24px' }}>
            <pre style={{
              fontSize: 13, color: 'rgba(255,255,255,0.55)',
              lineHeight: 1.9, whiteSpace: 'pre-wrap',
              fontFamily: 'Noto Sans KR, sans-serif',
              margin: 0,
            }}>
              {tabContent[tab] || '정보 없음'}
            </pre>

            {/* Related exercises */}
            {tab === 'guide' && relatedList.length > 0 && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, letterSpacing: 3, color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>
                  관련 운동
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {relatedList.map(({ id, name }) => {
                    const target = exercises?.find(e => e.id === id)
                    const color = target ? (CAT_COLOR[target.category] || '#FFD700') : '#FFD700'
                    return (
                      <button
                        key={id}
                        onClick={() => target && onNavigate(target)}
                        disabled={!target}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 14px', borderRadius: 2,
                          background: target ? `${color}12` : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${target ? `${color}35` : 'rgba(255,255,255,0.08)'}`,
                          color: target ? color : 'rgba(255,255,255,0.25)',
                          fontSize: 12, fontWeight: 600,
                          cursor: target ? 'pointer' : 'default',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { if (target) { e.currentTarget.style.background = `${color}22`; e.currentTarget.style.transform = 'translateY(-1px)' } }}
                        onMouseLeave={e => { if (target) { e.currentTarget.style.background = `${color}12`; e.currentTarget.style.transform = 'none' } }}
                      >
                        {name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

function formatLines(text) {
  if (!text) return []
  return String(text)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

function DetailBlock({ title, children, accentColor }) {
  if (!children) return null

  return (
    <section style={{
      background: '#111',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 4,
      padding: 24,
      boxShadow: '0 18px 48px rgba(0,0,0,0.25)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: accentColor, marginBottom: 14 }}>
        {title}
      </div>
      {children}
    </section>
  )
}

function InfoTile({ icon: Icon, label, value, accentColor }) {
  if (value === undefined || value === null || value === '') return null

  return (
    <div style={{
      minHeight: 74,
      background: 'rgba(255,255,255,0.035)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 4,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{
        width: 34,
        height: 34,
        borderRadius: 3,
        background: `${accentColor}18`,
        border: `1px solid ${accentColor}30`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={17} color={accentColor} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginBottom: 4, letterSpacing: 1 }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: '#E2E2E2', fontWeight: 700, lineHeight: 1.35 }}>
          {value}
        </div>
      </div>
    </div>
  )
}

function ExerciseDetailModal({ ex, onClose, onNavigate, exercises, detailLoading }) {
  const videoRef = useRef(null)
  const accentColor = CAT_COLOR[ex.category] || '#FFD700'
  const [detailVideoReady, setDetailVideoReady] = useState(false)
  const [detailVideoFailed, setDetailVideoFailed] = useState(false)
  const currentIndex = exercises.findIndex(item => item.id === ex.id)
  const prevEx = currentIndex > 0 ? exercises[currentIndex - 1] : null
  const nextEx = currentIndex >= 0 && currentIndex < exercises.length - 1 ? exercises[currentIndex + 1] : null
  const targetSecondary = Array.isArray(ex.target_secondary) ? ex.target_secondary : []
  const guideLines = formatLines(ex.guide)
  const startLines = formatLines(ex.starting_position)
  const cautionLines = formatLines(ex.caution)
  const relatedList = useMemo(() => {
    if (!ex.related_exercises) return []
    const matches = [...String(ex.related_exercises).matchAll(/(\d+)\(([^)]+)\)/g)]
    return matches.map(match => {
      const id = Number(match[1])
      return { id, name: match[2], target: exercises.find(item => item.id === id) }
    })
  }, [ex.related_exercises, exercises])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && prevEx) onNavigate(prevEx)
      if (event.key === 'ArrowRight' && nextEx) onNavigate(nextEx)
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [nextEx, onClose, onNavigate, prevEx])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined

    let retryId

    const playVideo = () => {
      video.muted = true
      video.playsInline = true
      video.play().catch(() => {
        retryId = window.setTimeout(() => {
          video.play().catch(() => {})
        }, 250)
      })
    }

    video.load()
    const frameId = window.requestAnimationFrame(playVideo)

    return () => {
      window.cancelAnimationFrame(frameId)
      if (retryId) window.clearTimeout(retryId)
    }
  }, [ex.id, ex.video_url])

  return (
    <div className="exercise-detail-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2200, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(14px)', overflowY: 'auto', animation: 'float-up 0.25s ease' }}>
      <div className="exercise-detail-page" onClick={event => event.stopPropagation()} style={{ minHeight: '100vh', background: '#080808', color: '#E2E2E2' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 5, background: 'rgba(8,8,8,0.94)', backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="exercise-detail-nav" style={{ maxWidth: 1440, margin: '0 auto', padding: '16px 32px', display: 'grid', gridTemplateColumns: '180px 1fr 180px', alignItems: 'center', gap: 16 }}>
            <button className="exercise-detail-nav-prev" type="button" disabled={!prevEx} onClick={() => prevEx && onNavigate(prevEx)} title={prevEx ? prevEx.name_kor : '이전 운동 없음'} style={{ height: 40, borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', background: prevEx ? '#141414' : 'rgba(255,255,255,0.03)', color: prevEx ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.18)', cursor: prevEx ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 800 }}>
              <ChevronLeft size={16} /> 이전
            </button>

            <div className="exercise-detail-title" style={{ minWidth: 0, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: accentColor, letterSpacing: 3, fontWeight: 900, marginBottom: 4 }}>
                EXERCISE DETAIL
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.32)' }}>
                {currentIndex >= 0 ? `${currentIndex + 1} / ${exercises.length}` : '운동 상세'}
              </div>
            </div>

            <div className="exercise-detail-nav-actions" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="exercise-detail-nav-next" type="button" disabled={!nextEx} onClick={() => nextEx && onNavigate(nextEx)} title={nextEx ? nextEx.name_kor : '다음 운동 없음'} style={{ height: 40, minWidth: 94, borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', background: nextEx ? '#141414' : 'rgba(255,255,255,0.03)', color: nextEx ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.18)', cursor: nextEx ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 800 }}>
                다음 <ChevronRight size={16} />
              </button>
              <button type="button" onClick={onClose} title="닫기" style={{ width: 40, height: 40, borderRadius: 3, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={18} color="rgba(255,255,255,0.68)" />
              </button>
            </div>
          </div>
        </header>

        <main className="exercise-detail-main" style={{ maxWidth: 1440, margin: '0 auto', padding: '34px 32px 56px' }}>
          <section className="exercise-detail-hero" style={{ display: 'grid', gridTemplateColumns: 'minmax(420px, 0.92fr) minmax(420px, 1.08fr)', gap: 32, alignItems: 'start', marginBottom: 28 }}>
            <div className="exercise-detail-media" style={{ position: 'sticky', top: 96, background: '#101010', border: `1px solid ${accentColor}22`, borderRadius: 4, overflow: 'hidden', boxShadow: `0 30px 90px rgba(0,0,0,0.5), 0 0 70px ${accentColor}08` }}>
              <div style={{ width: '100%', aspectRatio: '4 / 3', background: '#050505', position: 'relative' }}>
                <video
                  ref={videoRef}
                  src={videoUrl(ex)}
                  loop
                  muted
                  autoPlay
                  playsInline
                  controls
                  preload="auto"
                  onLoadedData={event => event.currentTarget.play().catch(() => {})}
                  onCanPlay={event => event.currentTarget.play().catch(() => {})}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#050505' }}
                />
                <div style={{ position: 'absolute', left: 18, top: 18, background: accentColor, color: '#000', fontSize: 12, fontWeight: 900, padding: '6px 14px', borderRadius: 2 }}>
                  {ex.category}
                </div>
              </div>
            </div>

            <div className="exercise-detail-summary">
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  {ex.tag && <span style={{ background: `${accentColor}16`, border: `1px solid ${accentColor}35`, color: accentColor, borderRadius: 2, padding: '5px 12px', fontSize: 12, fontWeight: 900 }}>{ex.tag}</span>}
                  <span style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.62)', borderRadius: 2, padding: '5px 12px', fontSize: 12, fontWeight: 800 }}>
                    {EQUIPMENT_LABEL[ex.equipment] || '기구 없음'}
                  </span>
                </div>

                <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(46px, 6vw, 86px)', color: '#FFF', letterSpacing: 1, lineHeight: 0.9, margin: '0 0 10px' }}>
                  {ex.name_kor}
                </h1>
                <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.38)', marginBottom: 20 }}>{ex.name_eng}</div>
                {ex.description && <p style={{ fontSize: 16, lineHeight: 1.85, color: 'rgba(255,255,255,0.68)', margin: 0 }}>{ex.description}</p>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 24 }}>
                <InfoTile icon={Target} label="주 타깃" value={ex.target_primary} accentColor={accentColor} />
                <InfoTile icon={Clock} label="권장 시간" value={ex.default_duration_min ? `${ex.default_duration_min}분` : ''} accentColor={accentColor} />
                <InfoTile icon={Flame} label="예상 소모" value={ex.estimated_cal_per_min ? `${ex.estimated_cal_per_min} kcal/min` : ''} accentColor={accentColor} />
                <InfoTile icon={MapPin} label="장소" value={ex.place_type === 'gym' ? '헬스장' : ex.place_type} accentColor={accentColor} />
                <InfoTile icon={AlertTriangle} label="척추 부하" value={ex.spine_loading} accentColor={accentColor} />
              </div>
            </div>
          </section>

          <section className="exercise-detail-content" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.12fr) minmax(360px, 0.88fr)', gap: 22, alignItems: 'start' }}>
            <div className="exercise-detail-blocks" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <DetailBlock title="운동 방법" accentColor={accentColor}>
                {detailLoading ? (
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.42)', fontSize: 14, lineHeight: 1.8 }}>상세 정보를 불러오는 중입니다...</p>
                ) : (
                  <ol style={{ margin: 0, paddingLeft: 22, color: 'rgba(255,255,255,0.7)', fontSize: 15, lineHeight: 1.9 }}>
                    {(guideLines.length ? guideLines : ['운동 가이드 정보가 없습니다.']).map((line, index) => (
                      <li key={index} style={{ marginBottom: 8 }}>{line.replace(/^\d+\.\s*/, '')}</li>
                    ))}
                  </ol>
                )}
              </DetailBlock>

              {startLines.length > 0 && (
                <DetailBlock title="준비 자세" accentColor={accentColor}>
                  <ol style={{ margin: 0, paddingLeft: 22, color: 'rgba(255,255,255,0.62)', fontSize: 14, lineHeight: 1.85 }}>
                    {startLines.map((line, index) => (
                      <li key={index} style={{ marginBottom: 7 }}>{line.replace(/^\d+\.\s*/, '')}</li>
                    ))}
                  </ol>
                </DetailBlock>
              )}

              {ex.breathing && (
                <DetailBlock title="호흡" accentColor={accentColor}>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.66)', fontSize: 15, lineHeight: 1.8 }}>{ex.breathing}</p>
                </DetailBlock>
              )}

              <DetailBlock title="주의 사항" accentColor={accentColor}>
                {detailLoading ? (
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.42)', fontSize: 14, lineHeight: 1.8 }}>주의사항을 불러오는 중입니다...</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 20, color: 'rgba(255,255,255,0.62)', fontSize: 14, lineHeight: 1.85 }}>
                    {(cautionLines.length ? cautionLines : ['주의사항 정보가 없습니다.']).map((line, index) => (
                      <li key={index} style={{ marginBottom: 7 }}>{line.replace(/^\d+\.\s*/, '')}</li>
                    ))}
                  </ul>
                )}
              </DetailBlock>
            </div>

            <aside className="exercise-detail-aside" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <DetailBlock title="자극 부위" accentColor={accentColor}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {ex.target_primary && (
                    <div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginBottom: 8 }}>PRIMARY</div>
                      <span style={{ display: 'inline-flex', padding: '8px 14px', background: `${accentColor}18`, border: `1px solid ${accentColor}35`, color: accentColor, borderRadius: 2, fontSize: 14, fontWeight: 900 }}>{ex.target_primary}</span>
                    </div>
                  )}
                  {targetSecondary.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginBottom: 8 }}>SECONDARY</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {targetSecondary.map(muscle => (
                          <span key={muscle} style={{ padding: '7px 11px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.62)', borderRadius: 2, fontSize: 13, fontWeight: 700 }}>
                            {muscle}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </DetailBlock>

              <DetailBlock title="관련 운동" accentColor={accentColor}>
                {relatedList.length > 0 ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {relatedList.map(({ id, name, target }) => {
                      const color = target ? (CAT_COLOR[target.category] || '#FFD700') : accentColor
                      return (
                        <button key={id} type="button" disabled={!target} onClick={() => target && onNavigate(target)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '14px 16px', borderRadius: 4, background: target ? `${color}0f` : 'rgba(255,255,255,0.03)', border: `1px solid ${target ? `${color}30` : 'rgba(255,255,255,0.06)'}`, color: target ? '#E2E2E2' : 'rgba(255,255,255,0.28)', cursor: target ? 'pointer' : 'default', textAlign: 'left' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 3 }}>{name}</div>
                            <div style={{ fontSize: 11, color: target ? color : 'rgba(255,255,255,0.24)' }}>#{id}{target ? ` · ${target.category}` : ' · 목록에 없음'}</div>
                          </div>
                          <ChevronRight size={16} color={target ? color : 'rgba(255,255,255,0.22)'} />
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.36)', fontSize: 14 }}>관련 운동 정보가 없습니다.</p>
                )}
              </DetailBlock>
            </aside>
          </section>
        </main>
      </div>
    </div>
  )
}

function PaginationControls({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null

  const pages = []
  const start = Math.max(1, page - 2)
  const end = Math.min(totalPages, page + 2)

  if (start > 1) {
    pages.push(1)
    if (start > 2) pages.push('start-ellipsis')
  }

  for (let current = start; current <= end; current += 1) {
    pages.push(current)
  }

  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('end-ellipsis')
    pages.push(totalPages)
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
      padding: '8px 0 52px',
    }}>
      <button
        type="button"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        style={{
          minWidth: 72,
          height: 36,
          padding: '0 14px',
          borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.08)',
          background: page === 1 ? 'rgba(255,255,255,0.03)' : '#161616',
          color: page === 1 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.65)',
          cursor: page === 1 ? 'default' : 'pointer',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        이전
      </button>

      {pages.map(item => (
        item === 'start-ellipsis' || item === 'end-ellipsis' ? (
          <span key={item} style={{ color: 'rgba(255,255,255,0.25)', padding: '0 4px' }}>...</span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 2,
              border: 'none',
              background: item === page ? 'linear-gradient(135deg, #FFD700, #C8A200)' : '#161616',
              color: item === page ? '#000' : 'rgba(255,255,255,0.65)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {item}
          </button>
        )
      ))}

      <button
        type="button"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        style={{
          minWidth: 72,
          height: 36,
          padding: '0 14px',
          borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.08)',
          background: page === totalPages ? 'rgba(255,255,255,0.03)' : '#161616',
          color: page === totalPages ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.65)',
          cursor: page === totalPages ? 'default' : 'pointer',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        다음
      </button>
    </div>
  )
}

export default function ExercisePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategories, setSelectedCategories] = useState([])
  const [equipment, setEquipment] = useState('전체')
  const [difficulty, setDifficulty] = useState(0)
  const [selected, setSelected] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const detailCacheRef = useRef(new Map())
  const listRef = useRef(null)
  const lastPageRef = useRef(null)
  const deferredSearch = useDeferredValue(search)
  const rawPage = Number.parseInt(searchParams.get('page') || '1', 10)

  useEffect(() => {
    fetchExerciseApi(`${API_URL}/api/exercises/`)
      .then(r => {
        if (!r.ok) throw new Error(`exercises ${r.status}`)
        return r.json()
      })
      .then(data => {
        setExercises(Array.isArray(data) && data.length > 0 ? data : getFallbackExercises())
      })
      .catch(() => {
        setExercises(getFallbackExercises())
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selected?.id) {
      setSelectedDetail(null)
      setDetailLoading(false)
      return
    }

    const cached = detailCacheRef.current.get(selected.id)
    if (cached) {
      setSelectedDetail({ ...selected, ...cached })
      setDetailLoading(false)
      return
    }

    const controller = new AbortController()
    setSelectedDetail(null)
    setDetailLoading(true)

    fetchExerciseApi(`${API_URL}/api/exercises/${selected.id}/`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`exercise detail ${response.status}`)
        return response.json()
      })
      .then(detail => {
        detailCacheRef.current.set(selected.id, detail)
        setSelectedDetail({ ...selected, ...detail })
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          setSelectedDetail(selected)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setDetailLoading(false)
        }
      })

    return () => controller.abort()
  }, [selected])

  const filtered = useMemo(() => {
    let list = exercises.filter(e => CATEGORIES.includes(e.category))
    if (selectedCategories.length > 0) {
      list = list.filter(e => selectedCategories.includes(e.category))
    }
    if (equipment !== '전체') list = list.filter(e => e.equipment === equipment)
    if (difficulty > 0) list = list.filter(e => e.difficulty === difficulty)
    if (deferredSearch.trim()) {
      const q = deferredSearch.trim().toLowerCase()
      list = list.filter(e =>
        e.name_kor.toLowerCase().includes(q) ||
        (e.name_eng && e.name_eng.toLowerCase().includes(q))
      )
    }

    const categoryOrder = CATEGORIES.slice(1)

    return [...list].sort((a, b) => {
      const indexA = categoryOrder.indexOf(a.category)
      const indexB = categoryOrder.indexOf(b.category)
      if (indexA !== indexB) {
        return indexA - indexB
      }
      return a.difficulty - b.difficulty
    })
  }, [exercises, deferredSearch, selectedCategories, equipment, difficulty])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page = Number.isFinite(rawPage) ? Math.min(Math.max(rawPage, 1), totalPages) : 1
  const pageStart = (page - 1) * PAGE_SIZE
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filtered.length)
  const displayed = filtered.slice(pageStart, pageEnd)
  const hasMore = false

  const setPageParam = useCallback((nextPage, options = {}) => {
    const target = Math.min(Math.max(nextPage, 1), totalPages)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('page', String(target))
      return next
    }, options)
  }, [setSearchParams, totalPages])

  useEffect(() => {
    const normalized = Number.isFinite(rawPage) ? Math.min(Math.max(rawPage, 1), totalPages) : 1
    if (searchParams.get('page') !== String(normalized)) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.set('page', String(normalized))
        return next
      }, { replace: true })
    }
  }, [rawPage, searchParams, setSearchParams, totalPages])

  useEffect(() => {
    if (lastPageRef.current === null) {
      lastPageRef.current = page
      return
    }
    if (lastPageRef.current === page) return
    lastPageRef.current = page
    scrollToPageTop()
  }, [page])

  const goToPage = useCallback((nextPage) => {
    const target = Math.min(Math.max(nextPage, 1), totalPages)
    setPageParam(target)
  }, [setPageParam, totalPages])

  const handleCategoryChange = useCallback((cat) => {
    setSelectedCategories(prev => {
      if (cat === '전체') {
        return []
      }
      const next = prev.includes(cat)
        ? prev.filter(c => c !== cat)
        : [...prev, cat]
      return next
    })
    setPageParam(1, { replace: true })
    scrollToPageTop()
  }, [setPageParam])

  const resetFilters = useCallback(() => {
    setSearch('')
    setSelectedCategories([])
    setEquipment('전체')
    setDifficulty(0)
    setPageParam(1, { replace: true })
  }, [setPageParam])

  const equipmentOptions = useMemo(() => {
    let list = exercises
    if (selectedCategories.length > 0) {
      list = list.filter(e => selectedCategories.includes(e.category))
    }
    const set = new Set(list.map(e => e.equipment))
    const customOrder = [
      'body', 'barbell', 'dumbbell', 'machine', 'band', 'kettlebell',
      'pull_up_bar', 'dips_bar', 'normal', 'foamroller', 'massageball', ''
    ]
    const array = Array.from(set).sort((a, b) => {
      let idxA = customOrder.indexOf(a)
      let idxB = customOrder.indexOf(b)
      if (idxA === -1) idxA = 999
      if (idxB === -1) idxB = 999
      return idxA - idxB
    })
    return ['전체', ...array]
  }, [exercises, selectedCategories])

  useEffect(() => {
    if (equipment === '전체') return
    let list = exercises
    if (selectedCategories.length > 0) {
      list = list.filter(e => selectedCategories.includes(e.category))
    }
    const available = new Set(list.map(e => e.equipment))
    if (!available.has(equipment)) {
      setEquipment('전체')
    }
  }, [selectedCategories, exercises, equipment])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        <p style={{ fontSize: 14 }}>운동 데이터 불러오는 중...</p>
      </div>
    </div>
  )

  return (
    <div className="exercise-page" style={{ minHeight: '100vh', background: '#080808', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ── */}
      <div className="exercise-page-header" style={{
        background: 'linear-gradient(to bottom, #0D0D0D, #0A0A0A)',
        borderBottom: '1px solid rgba(255,215,0,0.08)',
        padding: '100px 48px 36px',
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          {/* Title */}
          <div style={{ marginBottom: 28 }}>
            <span className="section-label">EXERCISE LIBRARY</span>
            <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(36px, 4.5vw, 48px)', color: '#FFF', lineHeight: 0.9, letterSpacing: '-0.05em' }}>
              운동 <span className="gold-text">라이브러리</span>
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', marginTop: 10 }}>
              총 <strong style={{ color: '#FFD700' }}>{exercises.length.toLocaleString()}가지</strong> 운동 영상 · 가이드 · 상세 정보 제공
            </p>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', maxWidth: 600, marginBottom: 24 }}>
            <Search size={18} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPageParam(1, { replace: true }) }}
              placeholder="운동 이름으로 검색... (한국어, 영어)"
              style={{
                width: '100%', padding: '14px 48px 14px 50px',
                background: '#161616',
                border: 'none',
                borderRadius: 4,
                color: '#FFF', fontSize: 14,
                outline: 'none',
                transition: 'box-shadow 0.2s',
              }}
              onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(255,215,0,0.4)'}
              onBlur={e => e.target.style.boxShadow = 'none'}
            />
            {search && (
              <button className="exercise-search-clear" onClick={() => { setSearch(''); setPageParam(1, { replace: true }) }} style={{
                position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 2,
                width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}>
                <X size={13} color="rgba(255,255,255,0.6)" />
              </button>
            )}
          </div>

          {/* Category tabs */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {CATEGORIES.map(cat => {
              const active = cat === '전체'
                ? selectedCategories.length === 0
                : selectedCategories.includes(cat)
              const color = CAT_COLOR[cat] || '#FFD700'
              return (
                <button
                  key={cat}
                  className="exercise-filter-chip"
                  onClick={() => handleCategoryChange(cat)}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 2,
                    background: active ? color : '#161616',
                    border: 'none',
                    color: active ? '#000' : 'rgba(255,255,255,0.6)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.22s',
                    letterSpacing: 0.3,
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.background = '#1F1F1F'
                      e.currentTarget.style.color = '#FFF'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.background = '#161616'
                      e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
                    }
                  }}
                >{cat}</button>
              )
            })}

            {/* Filter toggle */}
            <button
              className="exercise-filter-chip"
              onClick={() => setShowFilters(v => !v)}
              style={{
                padding: '8px 18px', borderRadius: 2,
                background: showFilters ? 'rgba(255,215,0,0.15)' : '#161616',
                border: 'none',
                color: showFilters ? '#FFD700' : 'rgba(255,255,255,0.6)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.22s',
              }}
              onMouseEnter={e => {
                if (!showFilters) {
                  e.currentTarget.style.background = '#1F1F1F'
                  e.currentTarget.style.color = '#FFF'
                }
              }}
              onMouseLeave={e => {
                if (!showFilters) {
                  e.currentTarget.style.background = '#161616'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
                }
              }}
            >
              <Filter size={13} /> 필터
              {(equipment !== '전체' || difficulty > 0) && (
                <span style={{
                  width: 18, height: 18, borderRadius: 2,
                  background: '#FFD700', color: '#000',
                  fontSize: 10, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{(equipment !== '전체' ? 1 : 0) + (difficulty > 0 ? 1 : 0)}</span>
              )}
            </button>
          </div>

          {/* Extended filters */}
          {showFilters && (
            <div style={{
              background: '#121212',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 4,
              padding: '20px 24px',
              marginBottom: 16,
              animation: 'float-up 0.25s ease',
            }}>
              <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
                {/* Equipment */}
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 'bold', color: 'rgba(255,255,255,0.4)', letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' }}>
                    기구
                  </h4>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {equipmentOptions.map(eq => {
                      const active = equipment === eq
                      return (
                        <button
                          key={eq}
                          className="exercise-filter-chip"
                          onClick={() => { setEquipment(eq); setPageParam(1, { replace: true }) }}
                          style={{
                            padding: '5px 14px',
                            borderRadius: 2,
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: active ? '#FFD700' : '#1A1A1A',
                            border: 'none',
                            color: active ? '#000' : 'rgba(255,255,255,0.6)',
                            transition: 'all 0.18s',
                          }}
                          onMouseEnter={e => {
                            if (!active) {
                              e.currentTarget.style.background = '#222'
                              e.currentTarget.style.color = '#FFF'
                            }
                          }}
                          onMouseLeave={e => {
                            if (!active) {
                              e.currentTarget.style.background = '#1A1A1A'
                              e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
                            }
                          }}
                        >
                          {eq === '전체' ? '전체' : EQUIPMENT_LABEL[eq] || eq}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Difficulty */}
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 'bold', color: 'rgba(255,255,255,0.4)', letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' }}>
                    난이도
                  </h4>
                  <div style={{ display: 'flex', gap: 7 }}>
                    {[0, 1, 2, 3].map(d => {
                      const active = difficulty === d
                      const label = d === 0 ? '전체' : DIFF_LABEL[d]
                      const color = d === 0 ? '#FFD700' : DIFF_COLOR[d]
                      return (
                        <button
                          key={d}
                          className="exercise-filter-chip"
                          onClick={() => { setDifficulty(d); setPageParam(1, { replace: true }) }}
                          style={{
                            padding: '5px 14px',
                            borderRadius: 2,
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: active ? color : '#1A1A1A',
                            border: 'none',
                            color: active ? (d === 0 ? '#000' : '#FFF') : 'rgba(255,255,255,0.6)',
                            transition: 'all 0.18s',
                          }}
                          onMouseEnter={e => {
                            if (!active) {
                              e.currentTarget.style.background = '#222'
                              e.currentTarget.style.color = '#FFF'
                            }
                          }}
                          onMouseLeave={e => {
                            if (!active) {
                              e.currentTarget.style.background = '#1A1A1A'
                              e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
                            }
                          }}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            fontSize: 13,
            color: 'rgba(255,255,255,0.35)',
            marginBottom: 10,
          }}>
            <span>전체 {filtered.length.toLocaleString()}개</span>
            <span style={{ color: 'rgba(255,255,255,0.18)' }}>/</span>
            <span><strong style={{ color: '#FFD700' }}>{page}</strong> / {totalPages} 페이지</span>
            {filtered.length > 0 && (
              <span style={{ color: 'rgba(255,255,255,0.25)' }}>
                {pageStart + 1}-{pageEnd}번째 운동
              </span>
            )}
          </div>

          {/* Result count + reset */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
              <span style={{ color: '#FFD700', fontWeight: 700 }}>{filtered.length.toLocaleString()}</span>개 운동
              {search && <span> · "{search}" 검색 결과</span>}
            </span>
            {(selectedCategories.length > 0 || equipment !== '전체' || difficulty > 0 || search) && (
              <button className="exercise-reset-filter" onClick={resetFilters} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 12, color: 'rgba(255,255,255,0.35)',
                background: 'none', border: 'none', cursor: 'pointer',
                transition: 'color 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.color = '#FFD700'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
              >
                <RotateCcw size={12} /> 필터 초기화
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="exercise-page-list" ref={listRef} style={{ flex: 1, padding: '36px 48px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          {filtered.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '100px 0',
              color: 'rgba(255,255,255,0.25)',
            }}>
              <Search size={48} color="rgba(255,255,255,0.1)" style={{ margin: '0 auto 16px' }} />
              <p style={{ fontSize: 16 }}>검색 결과가 없습니다</p>
              <button className="exercise-reset-filter" onClick={resetFilters} style={{
                marginTop: 20, background: 'rgba(255,215,0,0.1)',
                border: '1px solid rgba(255,215,0,0.2)',
                color: '#FFD700', fontSize: 13, padding: '10px 24px',
                borderRadius: 2, cursor: 'pointer',
              }}>필터 초기화</button>
            </div>
          ) : (
            <>
              <div className="exercise-page-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(285px, 1fr))',
                gap: 18,
                marginBottom: 36,
              }} key={`exercise-grid-page-${page}`}>
                {displayed.map(ex => (
                  <ExerciseCard key={ex.id} ex={ex} onClick={setSelected} />
                ))}
              </div>

              <PaginationControls
                page={page}
                totalPages={totalPages}
                onChange={goToPage}
              />

              {hasMore && (
                <div ref={loaderRef} style={{ textAlign: 'center', padding: '24px 0 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5 }}>
                    더 많은 운동 불러오는 중... ({(filtered.length - displayed.length).toLocaleString()}개 남음)
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modal ── */}
      {selected && (
        <ExerciseDetailModal
          key={selected.id}
          ex={selectedDetail || selected}
          exercises={exercises}
          detailLoading={detailLoading}
          onClose={() => setSelected(null)}
          onNavigate={setSelected}
        />
      )}
    </div>
  )
}
