import { useState, useRef, useEffect, useMemo } from 'react'
import { X, Play } from 'lucide-react'

const PART_FILTERS = ['전체', '가슴', '등', '하체', '어깨', '팔']
const PLACE_FILTERS = ['헬스장', '홈']

const CAT_COLOR = {
  등: '#FFD700', 가슴: '#FF6B35', 어깨: '#6C63FF', 하체: '#00D4A0',
  코어: '#FF6B6B', 이두: '#00B4D8', 삼두: '#F77F00', 전완근: '#7B2FBE',
  유산소: '#E63946', 스트레칭: '#06D6A0',
}
const DIFF_COLOR = { 1: '#4CAF50', 2: '#8BC34A', 3: '#FFC107', 4: '#FF9800', 5: '#F44336' }

// 팔 = 이두 + 삼두 + 전완근
const PART_TO_CATS = {
  '전체': null,
  '가슴': ['가슴'],
  '등': ['등'],
  '하체': ['하체'],
  '어깨': ['어깨'],
  '팔': ['이두', '삼두', '전완근'],
}
const HOME_EQUIPMENTS = ['body', 'band', 'dumbbell', 'kettlebell', '']

function gifUrl(ex) {
  return `/gifs/${encodeURIComponent(ex.category)}/${ex.id}_${encodeURIComponent(ex.name_kor)}.gif`
}

function MiniCard({ ex, onClick }) {
  const [hovered, setHovered] = useState(false)
  const color = CAT_COLOR[ex.category] || '#FFD700'
  const diffColor = DIFF_COLOR[ex.difficulty]

  return (
    <div
      onClick={() => onClick(ex)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#0F0F0F',
        border: hovered ? `1px solid ${color}55` : '1px solid rgba(255,255,255,0.06)',
        borderRadius: 4,
        overflow: 'hidden',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered
          ? `0 16px 44px ${color}18, 0 4px 16px rgba(0,0,0,0.5)`
          : '0 2px 10px rgba(0,0,0,0.4)',
        transition: 'all 0.28s cubic-bezier(.22,.68,0,1.2)',
      }}
    >
      {/* 썸네일 */}
      <div style={{ position: 'relative', height: 168, background: '#080808', overflow: 'hidden' }}>
        <img
          src={gifUrl(ex)}
          alt={ex.name_kor}
          onError={e => { e.currentTarget.style.display = 'none' }}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            transform: hovered ? 'scale(1.07)' : 'scale(1)',
            transition: 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
        {/* 하단 그라디언트 */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)',
        }} />

        {/* 카테고리 뱃지 */}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          background: `${color}22`,
          border: `1px solid ${color}55`,
          color, fontSize: 9, fontWeight: 800,
          padding: '3px 9px', borderRadius: 2,
          letterSpacing: 0.8, backdropFilter: 'blur(6px)',
        }}>{ex.category}</div>

        {/* 난이도 — 가로 바 */}
        <div style={{
          position: 'absolute', top: 10, right: 10,
          display: 'flex', gap: 2, alignItems: 'center',
          background: 'rgba(0,0,0,0.6)', borderRadius: 2,
          padding: '4px 8px', backdropFilter: 'blur(6px)',
        }}>
          {[1, 2, 3, 4, 5].map(n => (
            <span key={n} style={{
              width: 14, height: 3, borderRadius: 2,
              background: n <= ex.difficulty
                ? diffColor
                : 'rgba(255,255,255,0.12)',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>
      </div>

      {/* 카드 바디 */}
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{
          fontFamily: 'Bebas Neue', fontSize: 16,
          color: '#FFF', letterSpacing: 0.5,
          marginBottom: 3, lineHeight: 1.1,
        }}>{ex.name_kor}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.2 }}>{ex.name_eng}</div>
      </div>
    </div>
  )
}

function DetailModal({ ex, onClose }) {
  const color = CAT_COLOR[ex.category] || '#FFD700'
  const [tab, setTab] = useState('guide')

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
          <img
            src={gifUrl(ex)}
            alt={ex.name_kor}
            style={{ width: '100%', height: '100%', objectFit: 'cover', maxHeight: 480, display: 'block' }}
          />
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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function ExerciseSection({ onNavigate }) {
  const [part, setPart] = useState('전체')
  const [place, setPlace] = useState(null)
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
    fetch(`${API_URL}/api/exercises/`)
      .then(r => r.json())
      .then(data => { setExercises(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let list = exercises
    const cats = PART_TO_CATS[part]
    if (cats) list = list.filter(e => cats.includes(e.category))
    if (place === '홈') list = list.filter(e => HOME_EQUIPMENTS.includes(e.equipment))
    return list.slice(0, 8)
  }, [part, place, exercises])

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
              전체 <span className="gold-text">운동 목록</span>
            </h2>
          </div>
          <button onClick={() => onNavigate('exercises')} style={{
            background: 'transparent',
            border: '1px solid rgba(255,215,0,0.28)',
            color: '#FFD700', fontSize: 13, fontWeight: 700,
            padding: '10px 26px', borderRadius: 3, cursor: 'pointer',
            transition: 'all 0.25s ease', letterSpacing: 0.6,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,215,0,0.09)'
              e.currentTarget.style.borderColor = 'rgba(255,215,0,0.5)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'rgba(255,215,0,0.28)'
            }}
          >전체 보기 →</button>
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex', gap: 24, alignItems: 'center',
          marginBottom: 28, flexWrap: 'wrap',
          opacity: visible ? 1 : 0, transition: 'all 0.6s ease 0.1s',
        }}>
          {/* Part filter */}
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, alignSelf: 'center' }}>부위</span>
            {PART_FILTERS.map(p => {
              const active = part === p
              const color = p === '전체' ? '#FFD700' : (CAT_COLOR[p] || CAT_COLOR['이두'])
              return (
                <button key={p} onClick={() => setPart(p)} style={{
                  padding: '6px 16px', borderRadius: 2, fontSize: 12, cursor: 'pointer',
                  background: active ? color : 'rgba(255,255,255,0.04)',
                  border: active ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.08)',
                  color: active ? '#000' : 'rgba(255,255,255,0.5)',
                  fontWeight: active ? 800 : 400, transition: 'all 0.2s',
                }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = `${color}60`; e.currentTarget.style.color = color } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' } }}
                >{p}</button>
              )
            })}
          </div>

          {/* Place divider */}
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />

          {/* Place filter */}
          <div style={{ display: 'flex', gap: 7 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, alignSelf: 'center' }}>장소</span>
            {PLACE_FILTERS.map(p => {
              const active = place === p
              return (
                <button key={p} onClick={() => setPlace(active ? null : p)} style={{
                  padding: '6px 16px', borderRadius: 2, fontSize: 12, cursor: 'pointer',
                  background: active ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid rgba(255,215,0,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  color: active ? '#FFD700' : 'rgba(255,255,255,0.5)',
                  fontWeight: active ? 700 : 400, transition: 'all 0.2s',
                }}>{p}</button>
              )
            })}
          </div>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(238px, 1fr))',
          gap: 18,
          marginBottom: 38,
          opacity: visible ? 1 : 0, transition: 'all 0.6s ease 0.2s',
        }}>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{
                background: '#0F0F0F', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 4, overflow: 'hidden', height: 220,
                animation: 'pulse 1.5s ease infinite',
              }}>
                <div style={{ height: 168, background: 'rgba(255,255,255,0.04)' }} />
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ height: 12, width: '70%', background: 'rgba(255,255,255,0.06)', borderRadius: 1, marginBottom: 6 }} />
                  <div style={{ height: 10, width: '45%', background: 'rgba(255,255,255,0.04)', borderRadius: 1 }} />
                </div>
              </div>
            ))
            : filtered.map(ex => (
              <MiniCard key={ex.id} ex={ex} onClick={setSelected} />
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
            전체 운동 1,043개 보기
          </button>
        </div>
      </div>

      {selected && <DetailModal ex={selected} onClose={() => setSelected(null)} />}
    </section>
  )
}
