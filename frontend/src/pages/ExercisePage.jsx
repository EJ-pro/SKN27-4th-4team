import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Search, X, Play, Dumbbell, RotateCcw, Filter,
  User, Wrench, Infinity, Weight, ArrowUpToLine, ArrowDownToLine,
  Disc, Circle, Clipboard, HelpCircle
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ─── constants ───────────────────────────────────────────────────────────────

const CATEGORIES = ['전체', '등', '가슴', '어깨', '하체', '코어', '이두', '삼두', '전완근', '유산소', '스트레칭']

const EQUIPMENT_LABEL = {
  '': '기타', body: '맨몸', barbell: '바벨', dumbbell: '덤벨',
  machine: '머신', band: '밴드', kettlebell: '케틀벨',
  pull_up_bar: '철봉', dips_bar: '딥스바', normal: '일반',
  foamroller: '폼롤러', massageball: '마사지볼',
}

const EQUIPMENT_ICON = {
  barbell: Dumbbell, dumbbell: Dumbbell, machine: Wrench, body: User,
  band: Infinity, kettlebell: Weight, pull_up_bar: ArrowUpToLine, dips_bar: ArrowDownToLine,
  foamroller: Disc, massageball: Circle, normal: Clipboard, '': HelpCircle,
}

const DIFF_LABEL = { 1: '초급', 2: '중급', 3: '고급' }
const DIFF_COLOR = { 1: '#4CAF50', 2: '#FFC107', 3: '#F44336' }

const CAT_COLOR = {
  등: '#FFD700', 가슴: '#FF6B35', 어깨: '#6C63FF', 하체: '#00D4A0',
  코어: '#FF6B6B', 이두: '#00B4D8', 삼두: '#F77F00', 전완근: '#7B2FBE',
  유산소: '#E63946', 스트레칭: '#06D6A0',
}

const PAGE_SIZE = 16

function gifUrl(ex) {
  return `/gifs/${encodeURIComponent(ex.category)}/${ex.id}_${encodeURIComponent(ex.name_kor)}.gif`
}

function ExerciseCard({ ex, onClick }) {
  const [hovered, setHovered] = useState(false)
  const [videoOk, setVideoOk] = useState(true)
  const [isInViewport, setIsInViewport] = useState(false)
  const cardRef = useRef(null)

  const accentColor = CAT_COLOR[ex.category] || '#FFD700'

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting)
      },
      { rootMargin: '100px' }
    )
    if (cardRef.current) {
      observer.observe(cardRef.current)
    }
    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(ex)}
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
        {isInViewport && videoOk ? (
          <img
            src={gifUrl(ex)}
            alt={ex.name_kor}
            onError={() => setVideoOk(false)}
            loading="lazy"
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              transform: hovered ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform 0.5s ease',
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 10,
            background: `linear-gradient(135deg, ${accentColor}10, transparent)`,
          }}>
            <Dumbbell size={40} color={`${accentColor}30`} />
            {!videoOk && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>영상 없음</span>}
          </div>
        )}

        {/* Overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)',
          pointerEvents: 'none',
        }} />

        {/* Category badge */}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          background: accentColor,
          color: '#000', fontSize: 10, fontWeight: 800,
          padding: '3px 10px', borderRadius: 2,
          letterSpacing: 0.5,
        }}>{ex.category}</div>

        {/* Difficulty */}
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: 'rgba(0,0,0,0.65)',
          borderRadius: 50, padding: '3px 10px',
          display: 'flex', gap: 2, backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          {[1, 2, 3].map(n => (
            <span key={n} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: n <= ex.difficulty ? DIFF_COLOR[ex.difficulty] : 'rgba(255,255,255,0.12)',
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
            {(() => {
              const Icon = EQUIPMENT_ICON[ex.equipment] || HelpCircle
              return <Icon size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
            })()}
            <span>{EQUIPMENT_LABEL[ex.equipment] || '기타'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── DetailModal ──────────────────────────────────────────────────────────────

function DetailModal({ ex, onClose, onNavigate }) {
  const videoRef = useRef(null) // img ref (gif)
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
        {/* Left: gif */}
        <div style={{ width: 340, flexShrink: 0, background: '#0A0A0A', position: 'relative' }}>
          <img
            ref={videoRef}
            src={gifUrl(ex)}
            alt={ex.name_kor}
            style={{ width: '100%', height: '100%', objectFit: 'cover', maxHeight: 520, display: 'block' }}
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
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}>
                  {(() => {
                    const Icon = EQUIPMENT_ICON[ex.equipment] || HelpCircle
                    return <Icon size={12} />
                  })()}
                  {EQUIPMENT_LABEL[ex.equipment]}
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
                    const target = exercises.find(e => e.id === id)
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
                        <Play size={11} fill={target ? color : 'transparent'} color={target ? color : 'rgba(255,255,255,0.25)'} />
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

// ─── ExercisePage (main) ──────────────────────────────────────────────────────

export default function ExercisePage() {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('전체')
  const [equipment, setEquipment] = useState('전체')
  const [difficulty, setDifficulty] = useState(0)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const listRef = useRef(null)
  const loaderRef = useRef(null)

  useEffect(() => {
    fetch(`${API_URL}/api/exercises/`)
      .then(r => r.json())
      .then(data => setExercises(data))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let list = exercises.filter(e => CATEGORIES.includes(e.category))
    if (category !== '전체') list = list.filter(e => e.category === category)
    if (equipment !== '전체') list = list.filter(e => e.equipment === equipment)
    if (difficulty > 0) list = list.filter(e => e.difficulty === difficulty)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(e =>
        e.name_kor.toLowerCase().includes(q) ||
        (e.name_eng && e.name_eng.toLowerCase().includes(q))
      )
    }

    // 카테고리 순서 정의 (등 -> 가슴 -> 어깨 -> 하체 -> 코어 -> 이두 -> 삼두 -> 전완근 -> 유산소 -> 스트레칭)
    const categoryOrder = CATEGORIES.slice(1)

    return [...list].sort((a, b) => {
      const indexA = categoryOrder.indexOf(a.category)
      const indexB = categoryOrder.indexOf(b.category)
      if (indexA !== indexB) {
        return indexA - indexB
      }
      return a.difficulty - b.difficulty
    })
  }, [exercises, search, category, equipment, difficulty])

  const displayed = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = displayed.length < filtered.length

  useEffect(() => {
    if (!hasMore) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPage(p => p + 1)
        }
      },
      { rootMargin: '200px' }
    )
    const currentLoader = loaderRef.current
    if (currentLoader) {
      observer.observe(currentLoader)
    }
    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader)
      }
    }
  }, [hasMore])


  const handleCategoryChange = useCallback((cat) => {
    setCategory(cat)
    setPage(1)
    listRef.current?.scrollTo({ top: 0 })
  }, [])

  const resetFilters = useCallback(() => {
    setSearch('')
    setCategory('전체')
    setEquipment('전체')
    setDifficulty(0)
    setPage(1)
  }, [])

  const equipmentOptions = useMemo(() => {
    let list = exercises
    if (category !== '전체') {
      list = list.filter(e => e.category === category)
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
  }, [exercises, category])

  useEffect(() => {
    if (equipment === '전체') return
    let list = exercises
    if (category !== '전체') {
      list = list.filter(e => e.category === category)
    }
    const available = new Set(list.map(e => e.equipment))
    if (!available.has(equipment)) {
      setEquipment('전체')
    }
  }, [category, exercises, equipment])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        <Dumbbell size={40} color="rgba(255,215,0,0.4)" style={{ margin: '0 auto 16px' }} />
        <p style={{ fontSize: 14 }}>운동 데이터 불러오는 중...</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(to bottom, #0D0D0D, #0A0A0A)',
        borderBottom: '1px solid rgba(255,215,0,0.08)',
        padding: '100px 48px 36px',
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          {/* Title */}
          <div style={{ marginBottom: 28 }}>
            <span className="section-label">EXERCISE LIBRARY</span>
            <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(48px, 7vw, 88px)', color: '#FFF', lineHeight: 0.9 }}>
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
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="운동 이름으로 검색... (한국어, 영어)"
              style={{
                width: '100%', padding: '14px 48px 14px 50px',
                background: '#161616',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4,
                color: '#FFF', fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(255,215,0,0.4)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
            {search && (
              <button onClick={() => { setSearch(''); setPage(1) }} style={{
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
              const active = category === cat
              const color = CAT_COLOR[cat] || '#FFD700'
              return (
                <button key={cat} onClick={() => handleCategoryChange(cat)} style={{
                  padding: '8px 20px',
                  borderRadius: 2,
                  background: active ? color : 'rgba(255,255,255,0.04)',
                  border: active ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.08)',
                  color: active ? '#000' : 'rgba(255,255,255,0.5)',
                  fontSize: 13, fontWeight: active ? 800 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.22s',
                  letterSpacing: 0.3,
                }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = `${color}60`; e.currentTarget.style.color = color } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' } }}
                >{cat}</button>
              )
            })}

            {/* Filter toggle */}
            <button onClick={() => setShowFilters(v => !v)} style={{
              padding: '8px 18px', borderRadius: 2,
              background: showFilters ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.04)',
              border: showFilters ? '1px solid rgba(255,215,0,0.35)' : '1px solid rgba(255,255,255,0.08)',
              color: showFilters ? '#FFD700' : 'rgba(255,255,255,0.4)',
              fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.22s',
            }}>
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
              background: '#222222',
              border: '2px solid #ffd90058',
              borderRadius: 2,
              padding: '20px 24px',
              marginBottom: 16,
              animation: 'float-up 0.25s ease',
            }}>
              <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
                {/* Equipment */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: '#FFD700', letterSpacing: 2, marginBottom: 10 }}>기구</div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {equipmentOptions.map(eq => (
                      <button key={eq} onClick={() => { setEquipment(eq); setPage(1) }} style={{
                        padding: '5px 14px', borderRadius: 2, fontSize: 12, cursor: 'pointer',
                        background: equipment === eq ? '#FFD700' : 'rgba(255,255,255,0.04)',
                        border: equipment === eq ? '1px solid #FFD700' : '1px solid rgba(255,255,255,0.08)',
                        color: equipment === eq ? '#000' : 'rgba(255,255,255,0.45)',
                        transition: 'all 0.18s',
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                      }}>
                        {eq === '전체' ? '전체' : (
                          <>
                            {(() => {
                              const Icon = EQUIPMENT_ICON[eq] || HelpCircle
                              return <Icon size={12} />
                            })()}
                            <span>{EQUIPMENT_LABEL[eq] || eq}</span>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: '#FFD700', letterSpacing: 2, marginBottom: 10 }}>난이도</div>
                  <div style={{ display: 'flex', gap: 7 }}>
                    <button onClick={() => { setDifficulty(0); setPage(1) }} style={{
                      padding: '5px 14px', borderRadius: 2, fontSize: 12, cursor: 'pointer',
                      background: difficulty === 0 ? '#FFD700' : 'rgba(255,255,255,0.04)',
                      border: difficulty === 0 ? '1px solid #FFD700' : '1px solid rgba(255,255,255,0.08)',
                      color: difficulty === 0 ? '#000' : 'rgba(255,255,255,0.45)',
                    }}>전체</button>
                    {[1, 2, 3].map(d => (
                      <button key={d} onClick={() => { setDifficulty(d); setPage(1) }} style={{
                        padding: '5px 14px', borderRadius: 2, fontSize: 12, cursor: 'pointer',
                        background: difficulty === d ? DIFF_COLOR[d] : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${difficulty === d ? DIFF_COLOR[d] : 'rgba(255,255,255,0.08)'}`,
                        color: difficulty === d ? '#fff' : 'rgba(255,255,255,0.45)',
                        transition: 'all 0.18s',
                      }}>{DIFF_LABEL[d]}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Result count + reset */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
              <span style={{ color: '#FFD700', fontWeight: 700 }}>{filtered.length.toLocaleString()}</span>개 운동
              {search && <span> · "{search}" 검색 결과</span>}
            </span>
            {(category !== '전체' || equipment !== '전체' || difficulty > 0 || search) && (
              <button onClick={resetFilters} style={{
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
      <div ref={listRef} style={{ flex: 1, padding: '36px 48px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          {filtered.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '100px 0',
              color: 'rgba(255,255,255,0.25)',
            }}>
              <Search size={48} color="rgba(255,255,255,0.1)" style={{ margin: '0 auto 16px' }} />
              <p style={{ fontSize: 16 }}>검색 결과가 없습니다</p>
              <button onClick={resetFilters} style={{
                marginTop: 20, background: 'rgba(255,215,0,0.1)',
                border: '1px solid rgba(255,215,0,0.2)',
                color: '#FFD700', fontSize: 13, padding: '10px 24px',
                borderRadius: 2, cursor: 'pointer',
              }}>필터 초기화</button>
            </div>
          ) : (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(285px, 1fr))',
                gap: 18,
                marginBottom: 36,
              }}>
                {displayed.map(ex => (
                  <ExerciseCard key={ex.id} ex={ex} onClick={setSelected} />
                ))}
              </div>

              {hasMore && (
                <div ref={loaderRef} style={{ textAlign: 'center', padding: '24px 0 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <style>{`
                    @keyframes spin-loader {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  `}</style>
                  <Dumbbell
                    size={24}
                    color="#FFD700"
                    style={{
                      animation: 'spin-loader 1.2s linear infinite',
                      opacity: 0.8,
                    }}
                  />
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
        <DetailModal
          key={selected.id}
          ex={selected}
          onClose={() => setSelected(null)}
          onNavigate={setSelected}
        />
      )}
    </div>
  )
}
