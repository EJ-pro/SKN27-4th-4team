import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { X } from 'lucide-react'

const CAT_COLOR = {
  등: '#FFD700', 가슴: '#FF6B35', 어깨: '#6C63FF', 하체: '#00D4A0',
  코어: '#FF6B6B', 이두: '#00B4D8', 삼두: '#F77F00', 전완근: '#7B2FBE',
  유산소: '#E63946', 스트레칭: '#06D6A0',
}
const DIFF_COLOR = { 1: '#4CAF50', 2: '#8BC34A', 3: '#FFC107', 4: '#FF9800', 5: '#F44336' }

const EQUIPMENT_LABEL = {
  '': '기타', body: '맨몸', barbell: '바벨', dumbbell: '덤벨',
  machine: '머신', band: '밴드', kettlebell: '케틀벨',
  pull_up_bar: '철봉', dips_bar: '딥스바', normal: '일반',
  foamroller: '폼롤러', massageball: '마사지볼',
}
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

function StaticExerciseThumb({ ex, hovered, color }) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: 18,
      background: `linear-gradient(135deg, ${color}26, rgba(8,8,8,0.2) 45%, rgba(8,8,8,0.92)), radial-gradient(circle at 78% 24%, ${color}33, transparent 34%)`,
      transform: hovered ? 'scale(1.03)' : 'scale(1)',
      transition: 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
    }}>
      <div style={{ fontFamily: 'Bebas Neue', fontSize: 28, color: 'rgba(255,255,255,0.9)', letterSpacing: 1, lineHeight: 1 }}>
        {ex.name_kor}
      </div>
    </div>
  )
}

function MiniCard({ ex, onClick }) {
  const [hovered, setHovered] = useState(false)
  const [videoOk, setVideoOk] = useState(true)
  const color = CAT_COLOR[ex.category] || '#FFD700'
  const difficulty = Math.min(Math.max(Number(ex.difficulty) || 1, 1), 5)
  const diffColor = DIFF_COLOR[difficulty]

  return (
    <div
      onClick={() => onClick(ex)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#111',
        border: hovered ? `1px solid ${color}40` : '1px solid rgba(255,255,255,0.05)',
        borderRadius: 4,
        overflow: 'hidden',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered ? `0 16px 48px ${color}14, 0 4px 20px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'all 0.28s cubic-bezier(.22,.68,0,1.2)',
      }}
    >
      {/* 썸네일 */}
      <div style={{ position: 'relative', height: 220, background: '#0A0A0A', overflow: 'hidden' }}>
        {videoOk ? (
          <video
            src={videoUrl(ex)}
            muted
            loop
            autoPlay
            playsInline
            preload="auto"
            onLoadedData={e => e.currentTarget.play().catch(() => {})}
            onCanPlay={e => e.currentTarget.play().catch(() => {})}
            onError={() => setVideoOk(false)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              transform: hovered ? 'scale(1.03)' : 'scale(1)',
              transition: 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        ) : (
          <StaticExerciseThumb ex={ex} hovered={hovered} color={color} />
        )}
        {/* 하단 그라디언트 */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)',
          pointerEvents: 'none',
          zIndex: 3,
        }} />

        {/* 카테고리 뱃지 */}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          background: color,
          color: '#000', fontSize: 10, fontWeight: 800,
          padding: '3px 10px', borderRadius: 2,
          letterSpacing: 0.5,
          zIndex: 4,
        }}>{ex.category}</div>

        {/* 난이도 */}
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
              background: n <= Math.min(difficulty, 3) ? diffColor : 'rgba(255,255,255,0.12)',
            }} />
          ))}
        </div>
      </div>

      {/* 카드 바디 */}
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
}

function DetailModal({ ex, onClose }) {
  const color = CAT_COLOR[ex.category] || '#FFD700'
  const [tab, setTab] = useState('guide')
  const [videoOk, setVideoOk] = useState(true)

  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = '' }
  }, [onClose])

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
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      animation: 'float-up 0.3s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#111', border: `1px solid ${color}25`, borderRadius: 4,
        width: '100%', maxWidth: 860, maxHeight: '88vh', overflow: 'hidden',
        display: 'flex', boxShadow: `0 40px 100px rgba(0,0,0,0.7)`,
      }}>
        <div style={{ width: 320, flexShrink: 0, background: '#0A0A0A', position: 'relative' }}>
          {videoOk ? (
            <video
              src={videoUrl(ex)}
              loop
              muted
              autoPlay
              playsInline
              controls
              onError={() => setVideoOk(false)}
              style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: 480, display: 'block', background: '#050505' }}
            />
          ) : (
            <StaticExerciseThumb ex={ex} hovered={false} color={color} />
          )}
          <div style={{
            position: 'absolute', top: 14, left: 14, background: color, color: '#000',
            fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 2
          }}>{ex.category}</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            padding: '22px 26px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
          }}>
            <div>
              <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 30, color: '#FFF', letterSpacing: 1, marginBottom: 3 }}>{ex.name_kor}</h2>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>{ex.name_eng}</div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {ex.tag && <span style={{
                  fontSize: 10, padding: '3px 10px', borderRadius: 2,
                  background: `${color}15`, border: `1px solid ${color}30`, color
                }}>{ex.tag}</span>}
                <span style={{
                  fontSize: 10, padding: '3px 10px', borderRadius: 2,
                  background: `${DIFF_COLOR[ex.difficulty]}15`, border: `1px solid ${DIFF_COLOR[ex.difficulty]}30`,
                  color: DIFF_COLOR[ex.difficulty]
                }}>{'●'.repeat(ex.difficulty)}{'○'.repeat(5 - ex.difficulty)}</span>
              </div>
            </div>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
            }}>
              <X size={15} color="rgba(255,255,255,0.6)" />
            </button>
          </div>
          {ex.description && (
            <div style={{ padding: '12px 26px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, paddingBottom: 12 }}>{ex.description}</p>
            </div>
          )}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '0 26px' }}>
            {[{ id: 'guide', label: '가이드' }, { id: 'detail', label: '세부 동작' }, { id: 'caution', label: '주의사항' }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background: 'none', border: 'none', padding: '11px 14px', fontSize: 12, fontWeight: 700,
                color: tab === t.id ? color : 'rgba(255,255,255,0.3)',
                borderBottom: tab === t.id ? `2px solid ${color}` : '2px solid transparent',
                cursor: 'pointer', transition: 'all 0.2s',
              }}>{t.label}</button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 26px 22px' }}>
            <pre style={{
              fontSize: 12.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.9,
              whiteSpace: 'pre-wrap', fontFamily: 'Noto Sans KR, sans-serif', margin: 0
            }}>
              {tabContent[tab] || '정보 없음'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export default function ExerciseSection({ onNavigate }) {
  const [selected, setSelected] = useState(null)
  const [visible, setVisible] = useState(false)
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const ref = useRef()

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.1 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  // 백엔드 API에서 운동 데이터 불러오기
  useEffect(() => {
    setLoading(true)
    fetch(`${API_URL}/api/exercises/featured/?limit=8`)
      .then(r => r.json())
      .then(data => { setExercises(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const selectExercise = useCallback((ex) => {
    setSelected(ex)
    fetch(`${API_URL}/api/exercises/${ex.id}/`)
      .then(r => r.ok ? r.json() : null)
      .then(detail => {
        if (!detail) return
        setSelected(prev => prev?.id === ex.id ? { ...prev, ...detail } : prev)
      })
      .catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    return exercises.slice(0, 8)
  }, [exercises])

  return (
    <section ref={ref} style={{
      position: 'relative',
      background: '#0C0C0C',
      padding: '100px 48px',
      overflow: 'hidden',
    }}>
      {/* 배경: 희미한 헬스장 내부 */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: `url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1600&q=50')`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        opacity: 0.04, filter: 'saturate(0)',
      }} />
      {/* 좌→우 gold 그라디언트 빔 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: 3, bottom: 0,
        background: 'linear-gradient(to bottom, transparent, #FFD700, transparent)',
        opacity: 0.3, zIndex: 0,
      }} />
      {/* 상단 accent 라인 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 0,
        background: 'linear-gradient(90deg, transparent 0%, #FFD700 30%, #FF6B35 70%, transparent 100%)',
        opacity: 0.5,
      }} />
      <div style={{ maxWidth: 1300, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          marginBottom: 44,
          opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(22px)',
          transition: 'all 0.6s ease',
        }}>
          <div>
            {/* section-label 왼쪽 포인트 라인 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ width: 24, height: 2, background: '#FFD700', borderRadius: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 5.5, color: '#FFD700', opacity: 0.85 }}>
                WORKOUT LIBRARY
              </span>
            </div>
            <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(42px, 5.5vw, 70px)', color: '#FFF', lineHeight: 1 }}>
              <span className="gold-text">운동 목록</span>
            </h2>
          </div>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(285px, 1fr))',
          gap: 18,
          marginBottom: 38,
          opacity: visible ? 1 : 0, transition: 'all 0.6s ease 0.1s',
        }}>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{
                background: '#0F0F0F', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 4, overflow: 'hidden', height: 286,
                animation: 'pulse 1.5s ease infinite',
              }}>
                <div style={{ height: 220, background: 'rgba(255,255,255,0.04)' }} />
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ height: 12, width: '70%', background: 'rgba(255,255,255,0.06)', borderRadius: 1, marginBottom: 6 }} />
                  <div style={{ height: 10, width: '45%', background: 'rgba(255,255,255,0.04)', borderRadius: 1 }} />
                </div>
              </div>
            ))
            : filtered.map(ex => (
              <MiniCard key={ex.id} ex={ex} onClick={selectExercise} />
            ))
          }
        </div>

        {/* CTA */}
        <div style={{
          textAlign: 'center',
          opacity: visible ? 1 : 0, transition: 'all 0.6s ease 0.3s',
        }}>
          <button onClick={() => onNavigate('exercises')} style={{
            background: 'rgba(255,215,0,0.08)',
            border: '1px solid rgba(255,215,0,0.25)',
            color: '#FFD700', fontSize: 13, fontWeight: 700,
            padding: '13px 36px', borderRadius: 3, cursor: 'pointer',
            transition: 'all 0.25s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,215,0,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,215,0,0.08)'}
          >
            전체 운동 900개+ 보기
          </button>
        </div>
      </div>

      {selected && <DetailModal ex={selected} onClose={() => setSelected(null)} />}
    </section>
  )
}
