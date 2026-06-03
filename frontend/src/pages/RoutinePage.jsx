import { useState } from 'react'
import { ChevronRight, ChevronLeft, Check, AlertTriangle, RotateCcw } from 'lucide-react'

const PAIN_OPTIONS = [
  { key: 'shoulder',    label: '어깨 / 회전근개 불안정',     sub: '벤치 프레스, 숄더 프레스 우회', emoji: '🦾' },
  { key: 'lower_back',  label: '허리 디스크 이력 / 요통',     sub: '스쿼트, 데드리프트 우회',       emoji: '🦴' },
  { key: 'wrist',       label: '손목 터널 증후군 / 통증',     sub: '바벨 컬, 푸쉬업 우회',          emoji: '🤚' },
  { key: 'knee',        label: '무릎 관절 시림 / 통증',       sub: '런지, 레그 익스텐션 우회',       emoji: '🦵' },
  { key: 'none',        label: '현재 통증 없음',              sub: '정석 고강도 5분할 추천',         emoji: '💪' },
]

const DAYS = ['월', '화', '수', '목', '금', '토', '일']

const GOAL_OPTIONS = [
  { key: 'hypertrophy', label: '근비대',   desc: '볼륨 극대화 · 8~12rep · 짧은 휴식',       emoji: '💪', color: '#FF6B35' },
  { key: 'diet',        label: '다이어트', desc: '고반복 서킷 · 15~20rep · 유산소 병행',     emoji: '🔥', color: '#00D4A0' },
  { key: 'strength',    label: '스트렝스', desc: '저반복 고중량 · 3~5rep · 긴 휴식',         emoji: '🏆', color: '#6C63FF' },
  { key: 'maintenance', label: '체력 유지', desc: '균형 유지 · 10~15rep · 부상 방지 중심',   emoji: '⚖️', color: '#FFD700' },
]

const TIME_OPTIONS = [
  { value: 30,  label: '30분', desc: '압축 세션 · 핵심 복합 운동 위주' },
  { value: 45,  label: '45분', desc: '표준 세션 · 주요 운동 + 보조 운동' },
  { value: 60,  label: '60분', desc: '완성형 세션 · 충분한 볼륨 확보', tag: '추천' },
  { value: 90,  label: '90분', desc: '고볼륨 세션 · 풀 루틴 + 유산소' },
]

const SPLIT_OPTIONS = [
  {
    key: 'bodybuilding',
    title: '정석 보디빌딩 5분할',
    desc: '가슴 → 등 → 하체 → 어깨 → 팔',
    detail: '근비대 극대화를 위한 클래식 분할. 각 근육군 충분한 회복 보장.',
    tag: '추천',
  },
  {
    key: 'lower_core',
    title: '하체/코어 강화 5분할',
    desc: '하체와 코어 빈도↑ · 상체 컴팩트',
    detail: '하체·코어를 주 2회 자극해 기초체력과 체형을 동시에 잡는 세팅.',
    tag: '',
  },
  {
    key: 'strength',
    title: '스트렝스 중심 5분할',
    desc: '복합 다관절 위주 · 고중량 세팅',
    detail: '관절 무리를 최소화하며 벤치·스쿼트·데드리프트 중심으로 무게를 올리는 세팅.',
    tag: '',
  },
]

function StepDots({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 40 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 24 : 8,
          height: 8, borderRadius: 4,
          background: i === current ? '#FFD700' : i < current ? 'rgba(255,215,0,0.35)' : 'rgba(255,255,255,0.12)',
          transition: 'all 0.3s ease',
        }} />
      ))}
    </div>
  )
}

// ─── Step 1: 통증 ─────────────────────────────────────────────────────────────

const GET_DEFAULT_PART = (index, splitStyle) => {
  const bodybuildingOrder = ['가슴', '등', '하체', '어깨', '팔/코어', '유산소', '스트레칭']
  const lowerCoreOrder = ['하체', '코어', '하체', '어깨', '가슴', '유산소', '스트레칭']
  const strengthOrder = ['하체', '가슴', '등', '어깨', '하체', '유산소', '스트레칭']
  
  const order = splitStyle === 'lower_core' ? lowerCoreOrder : splitStyle === 'strength' ? strengthOrder : bodybuildingOrder
  return order[index % order.length]
}

// ─── Step 1: 통증 ─────────────────────────────────────────────────────────────

function Step1({ value, onChange }) {
  const toggle = (key) => {
    if (key === 'none') { onChange(['none']); return }
    const next = value.filter(v => v !== 'none')
    onChange(next.includes(key) ? next.filter(k => k !== key) : [...next, key])
  }

  return (
    <div>
      <span style={{ fontSize: 11, letterSpacing: 4, color: '#FFD700', opacity: 0.8, display: 'block', marginBottom: 12 }}>
        STEP 1 / 5
      </span>
      <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(28px, 4vw, 42px)', color: '#E2E2E2', letterSpacing: 2, marginBottom: 8, lineHeight: 1.1 }}>
        💥 만성 통증 · 부상 부위
      </h2>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 32, lineHeight: 1.7 }}>
        AI가 루틴 설계 내내 해당 근육군을 자동으로 우회합니다.<br />복수 선택 가능합니다.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {PAIN_OPTIONS.map(opt => {
          const active = value.includes(opt.key)
          const isNone = opt.key === 'none'
          return (
            <button key={opt.key} onClick={() => toggle(opt.key)} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 20px', borderRadius: 14,
              background: active ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${active ? 'rgba(255,215,0,0.35)' : 'rgba(255,255,255,0.08)'}`,
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
              gridColumn: isNone ? 'span 2' : 'auto',
            }}>
              <span style={{ fontSize: 26, flexShrink: 0 }}>{opt.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#FFD700' : '#E2E2E2', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.sub}</div>
              </div>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: active ? '#FFD700' : 'rgba(255,255,255,0.08)',
                border: `1px solid ${active ? '#FFD700' : 'rgba(255,255,255,0.15)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}>
                {active && <Check size={12} color="#000" strokeWidth={3} />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 2: 분할 스타일 (기존 Step 3) ─────────────────────────────────────────────

function StepSplitStyle({ value, onChange }) {
  return (
    <div>
      <span style={{ fontSize: 11, letterSpacing: 4, color: '#FFD700', opacity: 0.8, display: 'block', marginBottom: 12 }}>
        STEP 2 / 5
      </span>
      <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(28px, 4vw, 42px)', color: '#E2E2E2', letterSpacing: 2, marginBottom: 8, lineHeight: 1.1 }}>
        🏋️ 분할 스타일 선택
      </h2>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 32, lineHeight: 1.7 }}>
        이번 주에 집중할 루틴 방향성을 골라주세요.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {SPLIT_OPTIONS.map(opt => {
          const active = value === opt.key
          return (
            <button key={opt.key} onClick={() => onChange(opt.key)} style={{
              display: 'flex', alignItems: 'flex-start', gap: 16,
              padding: '20px 22px', borderRadius: 16, textAlign: 'left',
              background: active ? 'rgba(255,215,0,0.07)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${active ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
              cursor: 'pointer', transition: 'all 0.2s',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                background: active ? '#FFD700' : 'rgba(255,255,255,0.08)',
                border: `2px solid ${active ? '#FFD700' : 'rgba(255,255,255,0.15)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}>
                {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#000' }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: active ? '#FFD700' : '#E2E2E2' }}>
                    {opt.title}
                  </span>
                  {opt.tag && (
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 50,
                      background: 'rgba(255,215,0,0.15)', color: '#FFD700',
                      border: '1px solid rgba(255,215,0,0.25)', fontWeight: 700, letterSpacing: 0.5,
                    }}>{opt.tag}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: active ? 'rgba(255,215,0,0.7)' : 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                  {opt.desc}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
                  {opt.detail}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 3: 요일 및 부위 선택 (기존 Step 2 변경) ───────────────────────────────────

function StepDaysAndParts({ workDays, onChangeDays, dayParts, onChangeDayParts, splitStyle }) {
  const [isDetailMode, setIsDetailMode] = useState(false)
  const [activeEditingDay, setActiveEditingDay] = useState(null)
  const [selectedPartForEditingDay, setSelectedPartForEditingDay] = useState('')

  const PART_OPTIONS = ['가슴', '등', '하체', '어깨', '팔/코어', '코어', '유산소', '스트레칭']

  // Sort helper
  const sortDays = (daysArray) => {
    return [...daysArray].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b))
  }

  // Recalculate automatic parts for active days
  const recalculateAutoParts = (nextDays) => {
    const sorted = sortDays(nextDays)
    const newDayParts = { ...dayParts }
    
    // Clear days not in nextDays
    DAYS.forEach(d => {
      if (!nextDays.includes(d)) {
        delete newDayParts[d]
      }
    })

    // Assign default parts chronologically for active days
    sorted.forEach((day, index) => {
      newDayParts[day] = GET_DEFAULT_PART(index, splitStyle)
    })
    
    onChangeDayParts(newDayParts)
  }

  // Toggle day in Auto mode
  const handleDayToggleAuto = (day) => {
    const nextDays = workDays.includes(day)
      ? workDays.filter(d => d !== day)
      : [...workDays, day]
    
    const sortedNextDays = sortDays(nextDays)
    onChangeDays(sortedNextDays)
    recalculateAutoParts(sortedNextDays)
  }

  // Click day in Detail mode
  const handleDayClickDetail = (day) => {
    // If clicking the already editing day, close it
    if (activeEditingDay === day) {
      setActiveEditingDay(null)
      return
    }
    setActiveEditingDay(day)
    const existingPart = dayParts[day] || GET_DEFAULT_PART(workDays.indexOf(day) >= 0 ? workDays.indexOf(day) : 0, splitStyle)
    setSelectedPartForEditingDay(existingPart)
  }

  // Save detail part selection
  const handleSaveDetail = () => {
    if (!activeEditingDay) return

    // 1. Add to workDays if not already present, and sort chronologically
    if (!workDays.includes(activeEditingDay)) {
      onChangeDays(sortDays([...workDays, activeEditingDay]))
    }
    
    // 2. Save target part
    onChangeDayParts(prev => ({
      ...prev,
      [activeEditingDay]: selectedPartForEditingDay
    }))

    setActiveEditingDay(null)
  }

  // Set day as rest day
  const handleSetRestDay = () => {
    if (!activeEditingDay) return
    onChangeDays(workDays.filter(d => d !== activeEditingDay))
    onChangeDayParts(prev => {
      const next = { ...prev }
      delete next[activeEditingDay]
      return next
    })
    setActiveEditingDay(null)
  }

  return (
    <div>
      <span style={{ fontSize: 11, letterSpacing: 4, color: '#FFD700', opacity: 0.8, display: 'block', marginBottom: 12 }}>
        STEP 3 / 5
      </span>
      <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(28px, 4vw, 42px)', color: '#E2E2E2', letterSpacing: 2, marginBottom: 8, lineHeight: 1.1 }}>
        🗓️ 운동 요일 & 부위 설정
      </h2>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24, lineHeight: 1.7 }}>
        자동 배정으로 요일만 선택하거나, 요일별 상세 설정을 통해 원하는 부위를 직접 구성하세요.
      </p>

      {/* 모드 선택 탭 */}
      <div style={{
        display: 'flex',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: 4,
        marginBottom: 28,
      }}>
        <button
          type="button"
          onClick={() => {
            setIsDetailMode(false)
            setActiveEditingDay(null)
            recalculateAutoParts(workDays)
          }}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 9, border: 'none',
            background: !isDetailMode ? 'linear-gradient(135deg, #FFD700, #C8A200)' : 'transparent',
            color: !isDetailMode ? '#000' : 'rgba(255,255,255,0.4)',
            fontSize: 13, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          자동
        </button>
        <button
          type="button"
          onClick={() => {
            setIsDetailMode(true)
            setActiveEditingDay(null)
          }}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 9, border: 'none',
            background: isDetailMode ? 'linear-gradient(135deg, #FFD700, #C8A200)' : 'transparent',
            color: isDetailMode ? '#000' : 'rgba(255,255,255,0.4)',
            fontSize: 13, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          상세
        </button>
      </div>

      {/* 요일 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 28 }}>
        {DAYS.map(day => {
          const isSelected = workDays.includes(day)
          const isEditing = activeEditingDay === day
          const isWeekend = day === '토' || day === '일'
          
          // 표시할 라벨
          const partLabel = isSelected ? (dayParts[day] || '가슴') : '휴식'

          return (
            <button
              key={day}
              type="button"
              onClick={() => {
                if (isDetailMode) {
                  handleDayClickDetail(day)
                } else {
                  handleDayToggleAuto(day)
                }
              }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '14px 0', borderRadius: 12,
                background: isEditing
                  ? 'rgba(255,215,0,0.15)'
                  : isSelected
                    ? 'rgba(255,215,0,0.06)'
                    : 'rgba(255,255,255,0.02)',
                border: isEditing
                  ? '1px solid #FFD700'
                  : isSelected
                    ? '1px solid rgba(255,215,0,0.35)'
                    : '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer', transition: 'all 0.2s',
                gap: 6,
              }}
            >
              <span style={{
                fontSize: 14, fontWeight: 800,
                color: isSelected || isEditing ? '#FFD700' : isWeekend ? 'rgba(255,100,100,0.6)' : 'rgba(255,255,255,0.5)',
              }}>{day}</span>
              
              <span style={{
                fontSize: 10,
                color: isSelected ? '#FFD700' : 'rgba(255,255,255,0.22)',
                fontWeight: isSelected ? 700 : 400,
              }}>
                {partLabel}
              </span>
            </button>
          )
        })}
      </div>

      {/* [상세 설정 모드] 활성화된 요일 토글 박스 */}
      {isDetailMode && activeEditingDay && (
        <div style={{ position: 'relative', marginTop: 8, marginBottom: 20 }}>
          {/* Pointing arrow indicator */}
          <div style={{
            position: 'absolute',
            top: -8,
            left: `calc((100% / 7) * ${DAYS.indexOf(activeEditingDay)} + (100% / 7) / 2)`,
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderBottom: '8px solid rgba(255, 215, 0, 0.25)',
            zIndex: 2,
          }} />
          <div style={{
            position: 'absolute',
            top: -7,
            left: `calc((100% / 7) * ${DAYS.indexOf(activeEditingDay)} + (100% / 7) / 2)`,
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderBottom: '8px solid #1A1A1A',
            zIndex: 3,
          }} />

          <div style={{
            background: '#1A1A1A',
            border: '1px solid rgba(255,215,0,0.25)',
            borderRadius: 18,
            padding: '24px 28px',
            animation: 'float-up 0.25s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#FFF' }}>
                📅 {activeEditingDay}요일 운동 부위 설정
              </span>
              {workDays.includes(activeEditingDay) && (
                <button
                  type="button"
                  onClick={handleSetRestDay}
                  style={{
                    background: 'none', border: 'none', color: '#FF6B6B', fontSize: 12,
                    cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3
                  }}
                >
                  이 요일 운동 취소 (휴식일로 지정)
                </button>
              )}
            </div>

            {/* 운동 부위 토글 버튼 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
              {PART_OPTIONS.map(opt => {
                const active = selectedPartForEditingDay === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSelectedPartForEditingDay(opt)}
                    style={{
                      padding: '12px 0',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      background: active ? 'linear-gradient(135deg, #FFD700, #C8A200)' : 'rgba(255,255,255,0.03)',
                      border: active ? 'none' : '1px solid rgba(255,255,255,0.08)',
                      color: active ? '#000' : 'rgba(255,255,255,0.5)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'rgba(255,215,0,0.3)' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setActiveEditingDay(null)}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 8,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer'
                }}
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleSaveDetail}
                style={{
                  flex: 2, padding: '11px 0', borderRadius: 8,
                  background: 'linear-gradient(135deg, #FFD700, #C8A200)', border: 'none',
                  color: '#000', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(255,215,0,0.2)'
                }}
              >
                선택 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 안내 문구 */}
      {!activeEditingDay && (
        <div style={{
          padding: '16px 20px', borderRadius: 12,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          fontSize: 12.5, color: 'rgba(255,255,255,0.35)',
          lineHeight: 1.6,
        }}>
          {isDetailMode ? (
            <span>💡 <strong>상세 설정 가이드</strong>: 요일 버튼을 클릭한 뒤, 아래 패널에서 원하는 부위를 토글하고 [선택 완료]를 누르면 저장됩니다.</span>
          ) : (
            <span>💡 <strong>자동 배정 가이드</strong>: 요일을 누르면 활성화되며, 2단계에서 고른 <strong>{splitStyle === 'bodybuilding' ? '보디빌딩 5분할' : splitStyle === 'lower_core' ? '하체/코어 강화' : '스트렝스 중심'}</strong> 규칙에 따라 타겟 부위가 자동 매핑됩니다.</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Step 4: 운동 목표 ────────────────────────────────────────────────────────

function Step4({ value, onChange }) {
  return (
    <div>
      <span style={{ fontSize: 11, letterSpacing: 4, color: '#FFD700', opacity: 0.8, display: 'block', marginBottom: 12 }}>
        STEP 4 / 5
      </span>
      <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(28px, 4vw, 42px)', color: '#E2E2E2', letterSpacing: 2, marginBottom: 8, lineHeight: 1.1 }}>
        🎯 운동 목표
      </h2>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 32, lineHeight: 1.7 }}>
        목표에 따라 세트수 · rep 범위 · 운동 종류가 달라집니다.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {GOAL_OPTIONS.map(opt => {
          const active = value === opt.key
          return (
            <button key={opt.key} onClick={() => onChange(opt.key)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              padding: '20px 18px', borderRadius: 16, textAlign: 'left',
              background: active ? `${opt.color}12` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${active ? `${opt.color}50` : 'rgba(255,255,255,0.08)'}`,
              cursor: 'pointer', transition: 'all 0.2s', gap: 10,
            }}>
              <span style={{ fontSize: 30 }}>{opt.emoji}</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: active ? opt.color : '#E2E2E2', marginBottom: 5 }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
                  {opt.desc}
                </div>
              </div>
              {active && (
                <div style={{
                  alignSelf: 'flex-end', marginTop: 'auto',
                  width: 20, height: 20, borderRadius: '50%',
                  background: opt.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={12} color="#000" strokeWidth={3} />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 5: 세션 시간 ────────────────────────────────────────────────────────

function Step5({ value, onChange }) {
  return (
    <div>
      <span style={{ fontSize: 11, letterSpacing: 4, color: '#FFD700', opacity: 0.8, display: 'block', marginBottom: 12 }}>
        STEP 5 / 5
      </span>
      <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(28px, 4vw, 42px)', color: '#E2E2E2', letterSpacing: 2, marginBottom: 8, lineHeight: 1.1 }}>
        ⏱️ 세션당 운동 시간
      </h2>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 32, lineHeight: 1.7 }}>
        시간에 맞게 운동 개수와 볼륨을 최적화합니다.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {TIME_OPTIONS.map(opt => {
          const active = value === opt.value
          return (
            <button key={opt.value} onClick={() => onChange(opt.value)} style={{
              display: 'flex', alignItems: 'center', gap: 18,
              padding: '18px 22px', borderRadius: 14, textAlign: 'left',
              background: active ? 'rgba(255,215,0,0.07)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${active ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
              cursor: 'pointer', transition: 'all 0.2s',
            }}>
              <div style={{
                fontFamily: 'Bebas Neue', fontSize: 28, letterSpacing: 1,
                color: active ? '#FFD700' : 'rgba(255,255,255,0.4)',
                minWidth: 52, transition: 'color 0.2s',
              }}>
                {opt.label}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: active ? '#E2E2E2' : 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
                  {opt.desc}
                </div>
                {opt.tag && (
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 50,
                    background: 'rgba(255,215,0,0.12)', color: '#FFD700',
                    border: '1px solid rgba(255,215,0,0.2)', fontWeight: 700,
                  }}>{opt.tag}</span>
                )}
              </div>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: active ? '#FFD700' : 'rgba(255,255,255,0.08)',
                border: `2px solid ${active ? '#FFD700' : 'rgba(255,255,255,0.15)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}>
                {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#000' }} />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── RoutinePage ──────────────────────────────────────────────────────────────

const AUTO_DEFAULTS = {
  painParts: ['none'],
  workDays: ['월', '화', '목', '금', '토'],
  splitStyle: 'bodybuilding',
  goal: 'hypertrophy',
  sessionMin: 60,
}

export default function RoutinePage() {
  const [step, setStep] = useState(0)
  const [painParts, setPainParts] = useState([])
  const [workDays, setWorkDays] = useState([])
  const [splitStyle, setSplitStyle] = useState('')
  const [goal, setGoal] = useState('')
  const [sessionMin, setSessionMin] = useState(null)
  const [showAutoWarning, setShowAutoWarning] = useState(false)
  const [dayParts, setDayParts] = useState({
    '월': '가슴',
    '화': '등',
    '수': '하체',
    '목': '어깨',
    '금': '팔/코어',
    '토': '유산소',
    '일': '스트레칭'
  })

  const canNext = [
    painParts.length > 0,
    splitStyle !== '',
    workDays.length > 0,
    goal !== '',
    sessionMin !== null,
  ][step]

  const steps = [
    <Step1 value={painParts} onChange={setPainParts} />,
    <StepSplitStyle value={splitStyle} onChange={setSplitStyle} />,
    <StepDaysAndParts
      workDays={workDays}
      onChangeDays={setWorkDays}
      dayParts={dayParts}
      onChangeDayParts={setDayParts}
      splitStyle={splitStyle}
    />,
    <Step4 value={goal} onChange={setGoal} />,
    <Step5 value={sessionMin} onChange={setSessionMin} />,
  ]

  const TOTAL = steps.length

  const handleReset = () => {
    setStep(0)
    setPainParts([])
    setWorkDays([])
    setSplitStyle('')
    setGoal('')
    setSessionMin(null)
    setDayParts({
      '월': '가슴',
      '화': '등',
      '수': '하체',
      '목': '어깨',
      '금': '팔/코어',
      '토': '유산소',
      '일': '스트레칭'
    })
  }

  if (step === TOTAL) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#080808',
        paddingTop: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingBottom: 60,
      }}>
        <RoutineCheckView
          workDays={workDays}
          goal={goal}
          splitStyle={splitStyle}
          sessionMin={sessionMin}
          painParts={painParts}
          dayParts={dayParts}
          onReset={handleReset}
        />
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080808',
      paddingTop: 70,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: 640, padding: 'clamp(32px, 5vw, 56px) 20px 60px' }}>

        {/* 카드 */}
        <div style={{
          background: '#111',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        }}>
          {/* 카드 상단 진행바 */}
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
            <div style={{
              height: '100%',
              width: `${((step + 1) / TOTAL) * 100}%`,
              background: 'linear-gradient(90deg, #FFD700, #C8A200)',
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }} />
          </div>

          {/* 카드 헤더 */}
          <div style={{
            padding: '20px 32px 0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <StepDots current={step} total={TOTAL} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
              {step + 1} / {TOTAL}
            </span>
          </div>

          {/* 카드 본문 */}
          <div style={{ padding: '8px 32px 32px', animation: 'float-up 0.3s ease' }} key={step}>
            {steps[step]}
          </div>

          {/* 카드 하단 버튼 */}
          <div style={{
            padding: '20px 32px 28px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', gap: 12 }}>
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '13px 22px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                >
                  <ChevronLeft size={15} /> 이전
                </button>
              )}
              <button
                disabled={!canNext}
                onClick={() => setStep(s => s + 1)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '13px 24px', borderRadius: 10,
                  background: canNext ? 'linear-gradient(135deg, #FFD700, #C8A200)' : 'rgba(255,255,255,0.05)',
                  border: 'none',
                  color: canNext ? '#000' : 'rgba(255,255,255,0.2)',
                  fontSize: 14, fontWeight: 700, cursor: canNext ? 'pointer' : 'default',
                  transition: 'all 0.25s',
                  boxShadow: canNext ? '0 4px 20px rgba(255,215,0,0.2)' : 'none',
                }}
              >
                {step === TOTAL - 1 ? '루틴 생성하기' : '다음 단계'} <ChevronRight size={15} />
              </button>
            </div>

            {/* 자동 설정 */}
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                onClick={() => setShowAutoWarning(true)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: 'rgba(255,255,255,0.22)',
                  textDecoration: 'underline', textUnderlineOffset: 3,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.22)'}
              >
                자동으로 설정하고 루틴받기
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* 경고 모달 */}
      {showAutoWarning && (
        <div onClick={() => setShowAutoWarning(false)} style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 18, padding: '32px 28px 26px', maxWidth: 380, width: '100%',
            boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
            animation: 'float-up 0.2s ease',
          }}>
            <div style={{ fontSize: 28, marginBottom: 14 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#E2E2E2', marginBottom: 12 }}>
              자동 설정을 사용할까요?
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, marginBottom: 24 }}>
              자동 설정을 사용하면 <strong style={{ color: 'rgba(255,255,255,0.7)' }}>개인 신체 조건과 생활 패턴이 반영되지 않아</strong> 최적화된 루틴이 제공되지 않을 수 있습니다.<br /><br />
              그래도 계속 진행하시겠습니까?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowAutoWarning(false)} style={{
                flex: 1, padding: '11px 0', borderRadius: 10,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer',
              }}>직접 입력할게요</button>
              <button onClick={() => {
                setPainParts(AUTO_DEFAULTS.painParts)
                setWorkDays(AUTO_DEFAULTS.workDays)
                setSplitStyle(AUTO_DEFAULTS.splitStyle)
                setGoal(AUTO_DEFAULTS.goal)
                setSessionMin(AUTO_DEFAULTS.sessionMin)
                setStep(TOTAL - 1)
                setShowAutoWarning(false)
              }} style={{
                flex: 1, padding: '11px 0', borderRadius: 10,
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>자동으로 설정</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── RoutineCheckView Component ──────────────────────────────────────────────────

const ROUTINE_TEMPLATES = [
  {
    part: '가슴 (Chest) 집중 데이',
    items: [
      { id: 101, name: '벤치 프레스', sets: 4, reps: 10, eq: 'barbell', detail: '가슴 전체 매스 증가를 위한 복합 운동', targetPain: 'shoulder' },
      { id: 102, name: '인클라인 덤벨 프레스', sets: 4, reps: 12, eq: 'dumbbell', detail: '가슴 상부 볼륨 강화 및 입체구조 발달', targetPain: 'shoulder' },
      { id: 103, name: '체스트 플라이', sets: 3, reps: 12, eq: 'machine', detail: '가슴 안쪽 라인 선명도 극대화', targetPain: 'shoulder' }
    ]
  },
  {
    part: '등 (Back) 집중 데이',
    items: [
      { id: 201, name: '렛 풀 다운', sets: 4, reps: 12, eq: 'machine', detail: '광배근 너비 확장을 통해 프레임 극대화' },
      { id: 202, name: '바벨 로우', sets: 4, reps: 10, eq: 'barbell', detail: '등 중부 두께 강화와 후면 완성도 향상', targetPain: 'lower_back' },
      { id: 203, name: '암 풀 다운', sets: 3, reps: 15, eq: 'machine', detail: '광배근 고립 자극 및 활성화' }
    ]
  },
  {
    part: '하체 (Legs) 집중 데이',
    items: [
      { id: 301, name: '백 스쿼트', sets: 4, reps: 8, eq: 'barbell', detail: '대퇴사두근 및 둔근 강화를 위한 하체 정석 운동', targetPain: 'knee' },
      { id: 302, name: '레그 프레스', sets: 4, reps: 12, eq: 'machine', detail: '척추 부담 최소화 상태의 대퇴부 타겟' },
      { id: 303, name: '레그 컬', sets: 3, reps: 12, eq: 'machine', detail: '허벅지 뒷면(햄스트링) 고립 및 밸런스', targetPain: 'knee' }
    ]
  },
  {
    part: '어깨 (Shoulders) 집중 데이',
    items: [
      { id: 401, name: '오버헤드 프레스', sets: 4, reps: 8, eq: 'barbell', detail: '어깨 전반적인 전면/측면 매스 증가', targetPain: 'shoulder' },
      { id: 402, name: '사이드 레터럴 레이즈', sets: 4, reps: 15, eq: 'dumbbell', detail: '측면 삼각근 고립 자극 및 어깨 넓이 확장' },
      { id: 403, name: '페이스 풀', sets: 3, reps: 15, eq: 'machine', detail: '후면 삼각근 및 상부 등 근육군 밸런스' }
    ]
  },
  {
    part: '코어 & 팔 (Core & Arms) 집중 데이',
    items: [
      { id: 501, name: '덤벨 바이셉스 컬', sets: 3, reps: 12, eq: 'dumbbell', detail: '이두근 봉우리 발달을 위한 컬 동작', targetPain: 'wrist' },
      { id: 502, name: '트라이셉스 푸쉬다운', sets: 3, reps: 12, eq: 'machine', detail: '삼두근 외측두 선명도 강화' },
      { id: 503, name: '행잉 레그 레이즈', sets: 3, reps: 15, eq: 'body', detail: '복직근 하부 강화 및 코어 안정성', targetPain: 'lower_back' }
    ]
  }
]

const getTemplateForPart = (part) => {
  if (part === '가슴') return ROUTINE_TEMPLATES[0]
  if (part === '등') return ROUTINE_TEMPLATES[1]
  if (part === '하체') return ROUTINE_TEMPLATES[2]
  if (part === '어깨') return ROUTINE_TEMPLATES[3]
  if (part === '팔/코어' || part === '코어') return ROUTINE_TEMPLATES[4]
  if (part === '유산소') {
    return {
      part: '유산소 (Cardio) 집중 코스',
      items: [
        { id: 601, name: '러닝머신 (인클라인)', sets: 1, reps: 30, eq: 'body', detail: '경사도 6~8 설정 후 시속 5.5km 속도로 유지 복합 유산소' },
        { id: 602, name: '천국의 계단 (스텝밀)', sets: 1, reps: 15, eq: 'machine', detail: '심폐 기능 향상 및 하부 후면 근육 활성화' },
      ]
    }
  }
  return {
    part: '스트레칭 & 리커버리',
    items: [
      { id: 701, name: '폼롤러 전신 마사지', sets: 1, reps: 10, eq: 'body', detail: '등, 허벅지 외측, 종아리 부위를 각 1-2분간 롤링하여 근막 이완' },
      { id: 702, name: '동적/정적 스트레칭', sets: 1, reps: 10, eq: 'body', detail: '어깨 회전근개 및 골반 고관절 주변 스트레칭으로 관절 유연성 확보' },
    ]
  }
}

const EQUIPMENT_LABEL = {
  body: '맨몸', barbell: '바벨', dumbbell: '덤벨', machine: '머신'
}

const EQUIPMENT_ICON = {
  barbell: '🏋️', dumbbell: '💪', machine: '⚙️', body: '🤸'
}

const GOAL_LABEL = {
  hypertrophy: '근비대 훈련',
  diet: '다이어트 훈련',
  strength: '스트렝스 훈련',
  maintenance: '체력 유지 훈련'
}

function RoutineCheckView({ workDays, goal, splitStyle, sessionMin, painParts, dayParts, onReset }) {
  const [activeDay, setActiveDay] = useState(workDays[0] || '월')
  const [completedExercises, setCompletedExercises] = useState({}) // { id: boolean }
  const [dailyNotes, setDailyNotes] = useState({}) // { [day]: string }

  // activeDay가 workDays에 없으면 첫번째 값으로 안전장치
  const currentDay = workDays.includes(activeDay) ? activeDay : (workDays[0] || '월')

  const selectedPart = dayParts[currentDay] || '가슴'
  const template = getTemplateForPart(selectedPart)

  // 운동별 세트수/횟수를 goal 및 sessionMin에 따라 보정하는 헬퍼
  const getScaledSetsReps = (ex) => {
    let sets = ex.sets
    let reps = ex.reps

    // 운동시간 보정
    if (sessionMin <= 30) {
      sets = Math.max(2, sets - 1)
    } else if (sessionMin >= 90) {
      sets = sets + 1
    }

    // 운동 목표 보정
    if (goal === 'strength') {
      reps = 5
      sets = Math.max(4, sets)
    } else if (goal === 'diet') {
      reps = 15
    }

    return { sets, reps }
  }

  // 총 운동수 계산
  const totalExercises = workDays.reduce((acc, d) => {
    const part = dayParts[d] || '가슴'
    const t = getTemplateForPart(part)
    return acc + (t ? t.items.length : 0)
  }, 0)

  // 완료 개수 계산
  const completedCount = Object.values(completedExercises).filter(Boolean).length
  const progressPercent = totalExercises > 0 ? Math.round((completedCount / totalExercises) * 100) : 0

  const handleNoteChange = (text) => {
    setDailyNotes(prev => ({
      ...prev,
      [currentDay]: text
    }))
  }

  return (
    <div style={{ width: '100%', maxWidth: 760, padding: '0 20px', boxSizing: 'border-box' }}>
      
      {/* 상단 요약 카드 */}
      <div style={{
        background: '#111',
        border: '1px solid rgba(255,215,0,0.15)',
        borderRadius: 20,
        padding: '28px 32px',
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
        flexWrap: 'wrap',
        gap: 20,
      }}>
        <div>
          <span style={{ fontSize: 10, letterSpacing: 2, color: '#FFD700', fontWeight: 800, display: 'block', marginBottom: 6 }}>
            WEEKLY ROUTINE OVERVIEW
          </span>
          <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 28, color: '#FFF', letterSpacing: 1.5, margin: 0 }}>
            이번 주 맞춤형 <span className="gold-text">{GOAL_LABEL[goal] || '개인화'}</span> 루틴
          </h2>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            <span>⚡ {splitStyle === 'bodybuilding' ? '보디빌딩 5분할' : splitStyle === 'lower_core' ? '하체/코어 강화' : '스트렝스 중심'}</span>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
            <span>⏱️ 세션당 {sessionMin}분</span>
            {painParts.length > 0 && !painParts.includes('none') && (
              <>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                <span style={{ color: '#FF6B6B', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={12} /> {painParts.length}개 통증 우회 적용 중
                </span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={onReset}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
        >
          <RotateCcw size={13} />
          루틴 다시 설계하기
        </button>
      </div>

      {/* 완료 프로그레스 바 */}
      <div style={{
        background: '#111',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: '18px 24px',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
          <span>이번 주 루틴 총 완료도</span>
          <span style={{ color: '#FFD700', fontWeight: 800 }}>{progressPercent}% 완료 ({completedCount}/{totalExercises}개)</span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #FFD700, #C8A200)', transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* 요일 선택 탭바 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {workDays.map(day => {
          const isActive = day === currentDay
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              style={{
                flex: 1,
                minWidth: 70,
                padding: '14px 0',
                borderRadius: 12,
                background: isActive ? 'linear-gradient(135deg, #FFD700, #C8A200)' : 'rgba(255,255,255,0.02)',
                border: isActive ? 'none' : '1px solid rgba(255,255,255,0.06)',
                color: isActive ? '#000' : 'rgba(255,255,255,0.5)',
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = 'rgba(255,215,0,0.3)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
            >
              {day}요일
            </button>
          )
        })}
      </div>

      {/* 액티브 데이의 운동 카드 리스트 */}
      <div style={{
        background: '#111',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 24,
        padding: '32px 32px 28px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div>
            <span style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(255,255,255,0.3)', fontWeight: 700, display: 'block', marginBottom: 4 }}>
              DAILY ROUTINE
            </span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#FFF' }}>
              {currentDay}요일 - {template ? template.part : '운동 계획 없음'}
            </span>
          </div>
          <span style={{ fontSize: 12, background: 'rgba(255,215,0,0.08)', color: '#FFD700', padding: '4px 10px', borderRadius: 50, border: '1px solid rgba(255,215,0,0.15)', fontWeight: 600 }}>
            추천 {template ? template.items.length : 0}가지
          </span>
        </div>

        {template && template.items.map(ex => {
          const isDone = !!completedExercises[ex.id]
          const isWarned = ex.targetPain && painParts.includes(ex.targetPain)
          const { sets, reps } = getScaledSetsReps(ex)

          return (
            <div
              key={ex.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                padding: '20px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                opacity: isDone ? 0.45 : 1,
                transition: 'opacity 0.25s',
              }}
            >
              {/* 완료 토글 체크박스 */}
              <button
                onClick={() => setCompletedExercises(prev => ({ ...prev, [ex.id]: !prev[ex.id] }))}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: isDone ? '#FFD700' : 'rgba(255,255,255,0.02)',
                  border: isDone ? 'none' : '1px solid rgba(255,255,255,0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                {isDone && <Check size={16} color="#000" strokeWidth={3.5} />}
              </button>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', padding: '2px 8px', borderRadius: 4 }}>
                    {EQUIPMENT_ICON[ex.eq] || '❔'} {EQUIPMENT_LABEL[ex.eq] || '기타'}
                  </span>
                  
                  <span style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: isDone ? 'rgba(255,255,255,0.3)' : '#FFF',
                    textDecoration: isDone ? 'line-through' : 'none'
                  }}>
                    {ex.name}
                  </span>

                  {isWarned && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      background: 'rgba(255,100,100,0.12)',
                      border: '1px solid rgba(255,100,100,0.25)',
                      color: '#FF6B6B',
                      padding: '2px 8px',
                      borderRadius: 50,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <AlertTriangle size={9} />
                      {ex.targetPain === 'shoulder' ? '어깨 불안정 우회 가이드 적용' : ex.targetPain === 'lower_back' ? '허리 디스크 요통 우회 가이드 적용' : ex.targetPain === 'wrist' ? '손목 관절 우회 가이드 적용' : '무릎 관절 보호 우회 가이드 적용'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.32)', lineHeight: 1.5 }}>
                  {isWarned ? (
                    <span style={{ color: '#FF9E66' }}>💡 [통증케어 우회] 관절 가동범위 제한 및 안전 무게 적용 권장</span>
                  ) : (
                    ex.detail
                  )}
                </div>
              </div>

              {/* 세트 / 횟수 표시 */}
              <div style={{
                textAlign: 'right',
                flexShrink: 0,
              }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: isDone ? 'rgba(255,255,255,0.2)' : '#FFD700' }}>
                  {sets} <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.3)' }}>Set</span>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                  {reps} <span style={{ fontSize: 10 }}>Reps</span>
                </div>
              </div>
            </div>
          )
        })}

        {/* 데일리 메모 */}
        <div style={{ marginTop: 28, paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 600 }}>
            ✍️ {currentDay}요일 피드백 및 데일리 이슈 (예: 통증, 피로도)
          </div>
          <textarea
            value={dailyNotes[currentDay] || ''}
            onChange={(e) => handleNoteChange(e.target.value)}
            placeholder={`${currentDay}요일 운동 진행 시 느꼈던 신체 컨디션이나 통증 부위 등을 자유롭게 메모해 두세요...`}
            style={{
              width: '100%',
              minHeight: 80,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(0,0,0,0.18)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#E2E2E2',
              fontSize: 13,
              outline: 'none',
              resize: 'none',
              fontFamily: 'Noto Sans KR, sans-serif',
              lineHeight: 1.6,
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(255,215,0,0.3)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}
          />
        </div>
      </div>
    </div>
  )
}

