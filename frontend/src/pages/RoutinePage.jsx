import { useState, useEffect } from 'react'
import { ChevronRight, ChevronLeft, Check, AlertTriangle, RotateCcw } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const getDeviceUuid = () => {
  const key = 'fitai_device_uuid';
  if (typeof window === 'undefined') return '';
  let local = localStorage.getItem(key);
  if (!local) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      local = crypto.randomUUID();
    } else {
      local = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    localStorage.setItem(key, local);
  }
  return local;
};
const deviceUuid = getDeviceUuid();

function getISOWeekAndYear(date) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNum = 1 + Math.ceil((firstThursday - target) / 604800000);
  return {
    year: target.getFullYear(),
    weekNumber: weekNum
  };
}

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
              padding: '16px 20px', borderRadius: 4,
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
              padding: '20px 22px', borderRadius: 4, textAlign: 'left',
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
                      fontSize: 10, padding: '2px 8px', borderRadius: 2,
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
        borderRadius: 4,
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
            flex: 1, padding: '10px 0', borderRadius: 3, border: 'none',
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
            flex: 1, padding: '10px 0', borderRadius: 3, border: 'none',
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
                padding: '14px 0', borderRadius: 4,
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
            borderRadius: 4,
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
                      borderRadius: 2,
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
                  flex: 1, padding: '11px 0', borderRadius: 3,
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
                  flex: 2, padding: '11px 0', borderRadius: 3,
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
          padding: '16px 20px', borderRadius: 4,
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
              padding: '20px 18px', borderRadius: 4, textAlign: 'left',
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
              padding: '18px 22px', borderRadius: 4, textAlign: 'left',
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
                    fontSize: 10, padding: '2px 8px', borderRadius: 2,
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

const getTargetPainForExercise = (name, category) => {
  const n = name || '';
  if (category === '가슴' || category === '어깨') {
    if (n.includes('프레스') || n.includes('플라이') || n.includes('레이즈') || n.includes('푸쉬업')) {
      return 'shoulder';
    }
  }
  if (n.includes('데드리프트') || n.includes('스쿼트') || n.includes('로우') || n.includes('레그 레이즈') || n.includes('로잉')) {
    return 'lower_back';
  }
  if (n.includes('스쿼트') || n.includes('런지') || n.includes('익스텐션') || n.includes('레그 컬') || n.includes('싸이클') || n.includes('레그프레스')) {
    return 'knee';
  }
  if (n.includes('컬') || n.includes('딥스') || n.includes('푸쉬업') || n.includes('푸시업')) {
    return 'wrist';
  }
  return null;
};

const generateDynamicTemplateForPart = (part, dbExercises, painParts) => {
  if (!dbExercises || dbExercises.length === 0) {
    return getTemplateForPart(part);
  }

  // 1. Map part to categories
  const categoryMap = {
    '가슴': ['가슴'],
    '등': ['등'],
    '하체': ['하체'],
    '어깨': ['어깨'],
    '팔/코어': ['이두', '삼두', '코어', '전완근'],
    '코어': ['코어'],
    '유산소': ['유산소'],
    '스트레칭': ['스트레칭']
  };
  const targetCategories = categoryMap[part] || [part];

  // 2. Filter exercises in target categories
  let pool = dbExercises.filter(ex => targetCategories.includes(ex.category));
  if (pool.length === 0) {
    return getTemplateForPart(part);
  }

  // Map database exercises to frontend format
  const mappedPool = pool.map(ex => {
    const targetPain = getTargetPainForExercise(ex.name_kor, ex.category);
    return {
      id: ex.id,
      name: ex.name_kor,
      sets: ex.category === '유산소' || ex.category === '스트레칭' ? 1 : 4,
      reps: ex.category === '유산소' ? 30 : ex.category === '스트레칭' ? 10 : 10,
      eq: ex.equipment || 'body',
      detail: ex.guide || `${ex.name_kor} 운동 가이드입니다.`,
      targetPain: targetPain,
      gif: `/gifs/${encodeURIComponent(ex.category)}/${ex.id}_${encodeURIComponent(ex.name_kor)}.gif`,
      category: ex.category
    };
  });

  // 4. Divide pool by pain matching
  const activePainParts = painParts || [];
  const safePool = mappedPool.filter(ex => !ex.targetPain || !activePainParts.includes(ex.targetPain));
  const warnedPool = mappedPool.filter(ex => ex.targetPain && activePainParts.includes(ex.targetPain));

  // Determine number of exercises needed
  let countNeeded = 3;
  if (part === '유산소' || part === '스트레칭') {
    countNeeded = 2;
  }

  // 5. Select exercises
  let selected = [];
  
  if (part === '팔/코어') {
    // For Arms/Core, we try to select: 1 이두, 1 삼두, 1 코어 (or fallback)
    const selectFromCategories = (categoriesList, poolToUse) => {
      let result = [];
      categoriesList.forEach(cat => {
        const found = poolToUse.find(ex => ex.category === cat && !result.some(r => r.id === ex.id));
        if (found) result.push(found);
      });
      return result;
    };
    
    // Try to get from safe pool
    selected = selectFromCategories(['이두', '삼두', '코어'], safePool);
    
    // Fill remaining from general safe pool if we didn't get 3
    if (selected.length < countNeeded) {
      safePool.forEach(ex => {
        if (selected.length < countNeeded && !selected.some(s => s.id === ex.id)) {
          selected.push(ex);
        }
      });
    }
    
    // If still less than countNeeded, pick from warned pool
    if (selected.length < countNeeded) {
      const warnedSelected = selectFromCategories(['이두', '삼두', '코어'], warnedPool);
      warnedSelected.forEach(ex => {
        if (selected.length < countNeeded && !selected.some(s => s.id === ex.id)) {
          selected.push(ex);
        }
      });
      
      warnedPool.forEach(ex => {
        if (selected.length < countNeeded && !selected.some(s => s.id === ex.id)) {
          selected.push(ex);
        }
      });
    }
  } else {
    // For other parts, just pick from safe pool, then warned pool
    selected = safePool.slice(0, countNeeded);
    if (selected.length < countNeeded) {
      const remaining = countNeeded - selected.length;
      selected = [...selected, ...warnedPool.slice(0, remaining)];
    }
  }

  // 6. Build final items with alternatives
  const finalItems = selected.map(item => {
    const otherInCat = mappedPool.filter(ex => ex.category === item.category && ex.id !== item.id);
    
    // Sort alternatives: prioritize safe ones first
    const safeAlts = otherInCat.filter(ex => !ex.targetPain || !activePainParts.includes(ex.targetPain));
    const warnedAlts = otherInCat.filter(ex => ex.targetPain && activePainParts.includes(ex.targetPain));
    
    const sortedAlts = [...safeAlts, ...warnedAlts].slice(0, 5).map(alt => ({
      name: alt.name,
      eq: alt.eq,
      detail: alt.detail,
      targetPain: alt.targetPain,
      gif: alt.gif
    }));

    return {
      ...item,
      alternatives: sortedAlts
    };
  });

  return {
    part: `${part} (${part === '가슴' ? 'Chest' : part === '등' ? 'Back' : part === '하체' ? 'Legs' : part === '어깨' ? 'Shoulders' : part === '유산소' ? 'Cardio' : part === '스트레칭' ? 'Stretching & Recovery' : 'Core & Arms'}) 집중 데이`,
    items: finalItems
  };
}

const enrichPreloadedRoutine = (preloaded, dbExercises, painParts) => {
  if (!preloaded || !dbExercises || dbExercises.length === 0) {
    return preloaded;
  }

  const activePainParts = painParts || [];

  const mappedDbExercises = dbExercises.map(ex => {
    const targetPain = getTargetPainForExercise(ex.name_kor, ex.category);
    return {
      id: ex.id,
      name: ex.name_kor,
      eq: ex.equipment || 'body',
      detail: ex.guide || `${ex.name_kor} 운동 가이드입니다.`,
      targetPain: targetPain,
      gif: `/gifs/${encodeURIComponent(ex.category)}/${ex.id}_${encodeURIComponent(ex.name_kor)}.gif`,
      category: ex.category
    };
  });

  const enriched = {};
  Object.keys(preloaded).forEach(day => {
    enriched[day] = preloaded[day].map(item => {
      const dbEx = mappedDbExercises.find(ex => Number(ex.id) === Number(item.id)) || mappedDbExercises.find(ex => ex.name === item.name);
      
      const category = dbEx ? dbEx.category : (item.category || '');
      const detail = item.detail || (dbEx ? dbEx.detail : '');
      const targetPain = dbEx ? dbEx.targetPain : getTargetPainForExercise(item.name, category);
      const gif = dbEx ? dbEx.gif : `/gifs/${encodeURIComponent(category)}/${item.id}_${encodeURIComponent(item.name)}.gif`;
      
      let alternatives = item.alternatives || [];
      if (category && (!alternatives || alternatives.length === 0)) {
        const otherInCat = mappedDbExercises.filter(ex => ex.category === category && Number(ex.id) !== Number(item.id));
        const safeAlts = otherInCat.filter(ex => !ex.targetPain || !activePainParts.includes(ex.targetPain));
        const warnedAlts = otherInCat.filter(ex => ex.targetPain && activePainParts.includes(ex.targetPain));
        
        alternatives = [...safeAlts, ...warnedAlts].slice(0, 5).map(alt => ({
          name: alt.name,
          eq: alt.eq,
          detail: alt.detail,
          targetPain: alt.targetPain,
          gif: alt.gif
        }));
      }

      return {
        ...item,
        category,
        detail,
        targetPain,
        gif,
        alternatives
      };
    });
  });

  return enriched;
};

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
  const [dbExercises, setDbExercises] = useState([])
  const [loadingExercises, setLoadingExercises] = useState(true)
  const [loadingRoutine, setLoadingRoutine] = useState(true)
  const [preloadedWorkoutRoutine, setPreloadedWorkoutRoutine] = useState(null)
  const [preloadedDailyNotes, setPreloadedDailyNotes] = useState(null)

  const loadingDb = loadingExercises || loadingRoutine

  useEffect(() => {
    // 1. Fetch DB Exercises
    fetch(`${API_URL}/api/exercises/?full=1`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch exercises');
        return r.json();
      })
      .then(data => {
        setDbExercises(data)
      })
      .catch(err => {
        console.error('Error fetching exercises from DB:', err)
      })
      .finally(() => {
        setLoadingExercises(false)
      });

    // 2. Fetch routines for this week
    const { year, weekNumber } = getISOWeekAndYear(new Date());
    fetch(`${API_URL}/api/routines/?device_uuid=${deviceUuid}&year=${year}&week_number=${weekNumber}`)
      .then(r => r.json())
      .then(data => {
        if (data.found) {
          // Existing routine found for this week! Load it and jump directly to check page.
          setPainParts(data.pain_parts || [])
          setWorkDays(data.work_days || [])
          setSplitStyle(data.split_style || '')
          setGoal(data.goal || '')
          setSessionMin(data.session_min || null)
          setDayParts(data.day_parts || {})
          setPreloadedWorkoutRoutine(data.workout_routine)
          setPreloadedDailyNotes(data.daily_notes)
          setStep(5) // TOTAL = 5, jump to final view directly
        } else if (data.preferences) {
          // No current routine, but historical preferences exist! Pre-fill onboarding steps.
          const prefs = data.preferences;
          if (prefs.pain_parts) setPainParts(prefs.pain_parts);
          if (prefs.work_days) setWorkDays(prefs.work_days);
          if (prefs.split_style) setSplitStyle(prefs.split_style);
          if (prefs.goal) setGoal(prefs.goal);
          if (prefs.session_min) setSessionMin(prefs.session_min);
          if (prefs.day_parts) setDayParts(prefs.day_parts);
        }
      })
      .catch(err => {
        console.error('Error fetching weekly routine:', err)
      })
      .finally(() => {
        setLoadingRoutine(false)
      });
  }, [])

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
    setPreloadedWorkoutRoutine(null)
    setPreloadedDailyNotes(null)
  }

  if (step === TOTAL) {
    if (loadingDb) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#080808',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 20,
        }}>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <div style={{
            width: 40,
            height: 40,
            border: '4px solid rgba(255, 215, 0, 0.1)',
            borderTop: '4px solid #FFD700',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <span style={{ fontSize: 16, color: '#E2E2E2', fontWeight: 600 }}>
            데이터베이스 연결 및 운동 정보 불러오는 중...
          </span>
        </div>
      )
    }

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
          dbExercises={dbExercises}
          initialWorkoutRoutine={preloadedWorkoutRoutine}
          initialDailyNotes={preloadedDailyNotes}
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
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        }}>
          {/* 카드 상단 진행바 */}
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
            <div style={{
              height: '100%',
              width: `${((step + 1) / TOTAL) * 100}%`,
              background: 'linear-gradient(90deg, #FFD700, #C8A200)',
              borderRadius: 1,
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
                  padding: '13px 22px', borderRadius: 3,
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
                  padding: '13px 24px', borderRadius: 3,
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
            borderRadius: 4, padding: '32px 28px 26px', maxWidth: 380, width: '100%',
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
                flex: 1, padding: '11px 0', borderRadius: 3,
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
                flex: 1, padding: '11px 0', borderRadius: 3,
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
      {
        id: 101,
        name: '벤치 프레스',
        sets: 4,
        reps: 10,
        eq: 'barbell',
        detail: '가슴 전체 매스 증가를 위한 복합 운동',
        targetPain: 'shoulder',
        gif: '/gifs/가슴/2001_벤치 프레스.gif',
        alternatives: [
          { name: '덤벨 벤치 프레스', eq: 'dumbbell', detail: '덤벨을 활용한 대흉근 수축 극대화 및 밸런스 훈련', gif: '/gifs/가슴/2002_덤벨 벤치 프레스.gif', targetPain: 'shoulder' },
          { name: '체스트 프레스 머신', eq: 'machine', detail: '머신 프레스로 안정적이고 부상 위험 없는 가슴 운동', gif: '/gifs/가슴/2009_체스트 프레스 머신.gif', targetPain: 'shoulder' },
          { name: '푸쉬업', eq: 'body', detail: '맨몸 가슴 운동의 정석. 코어와 가슴을 동시에 발달', gif: '/gifs/가슴/2006_푸쉬업.gif' }
        ]
      },
      {
        id: 102,
        name: '인클라인 덤벨 프레스',
        sets: 4,
        reps: 12,
        eq: 'dumbbell',
        detail: '가슴 상부 볼륨 강화 및 입체구조 발달',
        targetPain: 'shoulder',
        gif: '/gifs/가슴/2014_인클라인 덤벨 벤치 프레스.gif',
        alternatives: [
          { name: '인클라인 벤치 프레스', eq: 'barbell', detail: '바벨로 진행하는 윗가슴 매스 업의 정석', gif: '/gifs/가슴/2013_인클라인 벤치 프레스.gif', targetPain: 'shoulder' },
          { name: '인클라인 벤치 프레스 머신', eq: 'machine', detail: '머신으로 고립도를 한 단계 높인 윗가슴 타겟팅', gif: '/gifs/가슴/2021_인클라인 벤치 프레스 머신.gif', targetPain: 'shoulder' }
        ]
      },
      {
        id: 103,
        name: '체스트 플라이',
        sets: 3,
        reps: 12,
        eq: 'machine',
        detail: '가슴 안쪽 라인 선명도 극대화',
        targetPain: 'shoulder',
        gif: '/gifs/가슴/2004_펙덱 플라이.gif',
        alternatives: [
          { name: '덤벨 플라이', eq: 'dumbbell', detail: '덤벨로 가슴 바깥쪽까지 깊숙한 신장성 수축 유도', gif: '/gifs/가슴/2005_덤벨 플라이.gif', targetPain: 'shoulder' },
          { name: '케이블 크로스오버', eq: 'machine', detail: '케이블로 지속적인 가슴 안쪽 저항선 유지', gif: '/gifs/가슴/2007_케이블 크로스오버.gif', targetPain: 'shoulder' }
        ]
      }
    ]
  },
  {
    part: '등 (Back) 집중 데이',
    items: [
      {
        id: 201,
        name: '렛 풀 다운',
        sets: 4,
        reps: 12,
        eq: 'machine',
        detail: '광배근 너비 확장을 통해 프레임 극대화',
        gif: '/gifs/등/1005_랫 풀다운.gif',
        alternatives: [
          { name: '풀 업', eq: 'body', detail: '턱걸이를 통한 광배근 넓이 확장 및 등 프레임 완성', gif: '/gifs/등/1003_풀 업.gif' },
          { name: '시티드 케이블 로우', eq: 'machine', detail: '수평으로 당겨 등 전체 두께를 늘려주는 운동', gif: '/gifs/등/1009_시티드 케이블 로우.gif', targetPain: 'lower_back' },
          { name: '맥그립 랫 풀다운', eq: 'machine', detail: '특수 인체공학 그립으로 광배근 하부와 안쪽 집중 저항', gif: '/gifs/등/1119_맥그립 랫 풀다운.gif' }
        ]
      },
      {
        id: 202,
        name: '바벨 로우',
        sets: 4,
        reps: 10,
        eq: 'barbell',
        detail: '등 중부 두께 강화와 후면 완성도 향상',
        targetPain: 'lower_back',
        gif: '/gifs/등/1002_바벨 로우.gif',
        alternatives: [
          { name: '덤벨 로우', eq: 'dumbbell', detail: '덤벨로 좌우 밸런스 및 광배근 최대 고립 수축', gif: '/gifs/등/1025_덤벨 로우.gif' },
          { name: '원 암 덤벨 로우', eq: 'dumbbell', detail: '한 발 지탱 후 넓은 가동범위로 강도 높은 광배 자극', gif: '/gifs/등/1008_원 암 덤벨 로우.gif' },
          { name: '티 바 로우', eq: 'barbell', detail: '체중을 실어 등 중앙부를 폭발적으로 강화', gif: '/gifs/등/1018_티 바 로우.gif', targetPain: 'lower_back' }
        ]
      },
      {
        id: 203,
        name: '암 풀 다운',
        sets: 3,
        reps: 15,
        eq: 'machine',
        detail: '광배근 고립 자극 및 활성화',
        gif: '/gifs/등/1023_암 풀다운.gif',
        alternatives: [
          { name: '로프 암 풀 다운', eq: 'machine', detail: '로프 그립을 벌리면서 광배근 하부 수축 끝까지 완성', gif: '/gifs/등/1070_로프 암 풀 다운.gif' },
          { name: '덤벨 풀오버', eq: 'dumbbell', detail: '가슴 상부와 광배근 전반을 늘려주는 스트레칭성 벌크업', gif: '/gifs/가슴/2003_덤벨 풀오버.gif' }
        ]
      }
    ]
  },
  {
    part: '하체 (Legs) 집중 데이',
    items: [
      {
        id: 301,
        name: '백 스쿼트',
        sets: 4,
        reps: 8,
        eq: 'barbell',
        detail: '대퇴사두근 및 둔근 강화를 위한 하체 정석 운동',
        targetPain: 'knee',
        gif: '/gifs/하체/4056_스쿼트.gif',
        alternatives: [
          { name: '레그 프레스', eq: 'machine', detail: '허리(척추) 부담 없이 대퇴사두근에 최대 중량 집중', gif: '/gifs/하체/4003_레그 프레스.gif' },
          { name: '고블릿 스쿼트', eq: 'dumbbell', detail: '덤벨을 가슴 앞에 쥐어 요추 스트레스 없이 안전한 스쿼트 가능', gif: '/gifs/하체/4028_고블릿 스쿼트.gif' },
          { name: '스미스 머신 스쿼트', eq: 'machine', detail: '스미스 머신의 일정한 궤적으로 부상 위험 최소화', gif: '/gifs/하체/4015_스미스 머신 스쿼트.gif', targetPain: 'knee' }
        ]
      },
      {
        id: 302,
        name: '레그 프레스',
        sets: 4,
        reps: 12,
        eq: 'machine',
        detail: '척추 부담 최소화 상태의 대퇴부 타겟',
        gif: '/gifs/하체/4003_레그 프레스.gif',
        alternatives: [
          { name: '덤벨 런지', eq: 'dumbbell', detail: '둔근과 허벅지 뒤편(햄스트링) 발달 및 신체 밸런스 개선', gif: '/gifs/하체/4008_덤벨 런지.gif', targetPain: 'knee' },
          { name: '덤벨 불가리안 스플릿 스쿼트', eq: 'dumbbell', detail: '한 다리로 지탱하여 둔근과 햄스트링을 깊게 타겟팅', gif: '/gifs/하체/4024_덤벨 불가리안 스플릿 스쿼트.gif', targetPain: 'knee' }
        ]
      },
      {
        id: 303,
        name: '레그 컬',
        sets: 3,
        reps: 12,
        eq: 'machine',
        detail: '허벅지 뒷면(햄스트링) 고립 및 밸런스',
        targetPain: 'knee',
        gif: '/gifs/하체/4004_레그 컬.gif',
        alternatives: [
          { name: '시티드 레그 컬', eq: 'machine', detail: '앉은 자세에서 대퇴이두근을 안정적으로 고립 수축', gif: '/gifs/하체/4087_시티드 레그 컬.gif', targetPain: 'knee' },
          { name: '바벨 스티프 레그 데드리프트', eq: 'barbell', detail: '골반을 뒤로 젖히며 후면 허벅지 근육을 크게 스트레칭', gif: '/gifs/하체/4005_바벨 스티프 레그 데드리프트.gif', targetPain: 'lower_back' }
        ]
      }
    ]
  },
  {
    part: '어깨 (Shoulders) 집중 데이',
    items: [
      {
        id: 401,
        name: '오버헤드 프레스',
        sets: 4,
        reps: 8,
        eq: 'barbell',
        detail: '어깨 전반적인 전면/측면 매스 증가',
        targetPain: 'shoulder',
        gif: '/gifs/어깨/3001_오버헤드 프레스.gif',
        alternatives: [
          { name: '덤벨 숄더 프레스', eq: 'dumbbell', detail: '덤벨로 전면 및 측면 어깨의 가동 범위를 최대로 공략', gif: '/gifs/어깨/3002_덤벨 숄더 프레스.gif', targetPain: 'shoulder' },
          { name: '숄더 프레스 머신', eq: 'machine', detail: '머신 궤적을 이용하여 회전근개 부담 없이 어깨 강타', gif: '/gifs/어깨/3004_숄더 프레스 머신.gif', targetPain: 'shoulder' }
        ]
      },
      {
        id: 402,
        name: '사이드 레터럴 레이즈',
        sets: 4,
        reps: 15,
        eq: 'dumbbell',
        detail: '측면 삼각근 고립 자극 및 어깨 넓이 확장',
        gif: '/gifs/어깨/3003_덤벨 레터럴 레이즈.gif',
        alternatives: [
          { name: '케이블 레터럴 레이즈', eq: 'machine', detail: '케이블의 일정한 텐션으로 측면 삼각근에 불타는 듯한 자극 전달', gif: '/gifs/어깨/3021_케이블 레터럴 레이즈.gif' },
          { name: '시티드 레터럴 레이즈 머신', eq: 'machine', detail: '앉은 채로 고정되어 오직 측면 삼각근에만 집중 부하 전달', gif: '/gifs/어깨/3005_시티드 레터럴 레이즈 머신.gif' }
        ]
      },
      {
        id: 403,
        name: '페이스 풀',
        sets: 3,
        reps: 15,
        eq: 'machine',
        detail: '후면 삼각근 및 상부 등 근육군 밸런스',
        gif: '/gifs/어깨/3009_페이스 풀.gif',
        alternatives: [
          { name: '리버스 펙덱 플라이', eq: 'machine', detail: '펙덱 플라이 머신에서 후면 삼각근을 정밀 타겟팅', gif: '/gifs/등/1167_리버스 펙덱 플라이.gif' },
          { name: '덤벨 벤트 오버 레터럴 레이즈', eq: 'dumbbell', detail: '상체를 숙여 덤벨을 옆으로 올리며 후면 삼각근 고립', gif: '/gifs/어깨/3015_덤벨 벤트 오버 레터럴 레이즈.gif' }
        ]
      }
    ]
  },
  {
    part: '코어 & 팔 (Core & Arms) 집중 데이',
    items: [
      {
        id: 501,
        name: '덤벨 바이셉스 컬',
        sets: 3,
        reps: 12,
        eq: 'dumbbell',
        detail: '이두근 봉우리 발달을 위한 컬 동작',
        targetPain: 'wrist',
        gif: '/gifs/이두/7006_덤벨 바이셉 컬.gif',
        alternatives: [
          { name: '바벨 바이셉 컬', eq: 'barbell', detail: '바벨로 진행하여 두꺼운 팔의 기초를 형성하는 이두 운동', gif: '/gifs/이두/7001_바벨 바이셉 컬.gif', targetPain: 'wrist' },
          { name: '덤벨 해머 컬', eq: 'dumbbell', detail: '덤벨을 세워 들어 올려 전완근และ 바깥쪽 이두근 동시 자극', gif: '/gifs/이두/7009_덤벨 해머 컬.gif', targetPain: 'wrist' }
        ]
      },
      {
        id: 502,
        name: '트라이셉스 푸쉬다운',
        sets: 3,
        reps: 12,
        eq: 'machine',
        detail: '삼두근 외측두 선명도 강화',
        gif: '/gifs/삼두/6002_케이블 트라이셉 푸쉬다운.gif',
        alternatives: [
          { name: '오버헤드 덤벨 트라이셉스 익스텐션', eq: 'dumbbell', detail: '덤벨을 머리 뒤로 넘겨 삼두근 장두의 최대 수축 유도', gif: '/gifs/삼두/6032_오버헤드 덤벨 트라이셉스 익스텐션.gif' },
          { name: '벤치 딥스', eq: 'body', detail: '손을 벤치에 디디고 엉덩이를 띄워 안정적으로 진행하는 삼두 훈련', gif: '/gifs/삼두/6007_벤치 딥스.gif', targetPain: 'wrist' }
        ]
      },
      {
        id: 503,
        name: '행잉 레그 레이즈',
        sets: 3,
        reps: 15,
        eq: 'body',
        detail: '복직근 하부 강화 및 코어 안정성',
        targetPain: 'lower_back',
        gif: '/gifs/코어/5005_행잉 레그 레이즈.gif',
        alternatives: [
          { name: '레그 레이즈', eq: 'body', detail: '누운 자세에서 척추 부담 없이 하복부를 정밀 타겟팅', gif: '/gifs/코어/5001_레그 레이즈.gif', targetPain: 'lower_back' },
          { name: '크런치', eq: 'body', detail: '날개뼈가 떨어질 정도로 상체를 들어 복부 윗라인을 자극', gif: '/gifs/코어/5002_크런치.gif' }
        ]
      }
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
        {
          id: 601,
          name: '러닝머신 (인클라인)',
          sets: 1,
          reps: 30,
          eq: 'body',
          detail: '경사도 6~8 설정 후 시속 5.5km 속도로 유지 복합 유산소',
          gif: '/gifs/유산소/9010_인클라인 트레드밀 러닝.gif',
          alternatives: [
            { name: '트레드밀 러닝', eq: 'body', detail: '평지에서 달리는 정석 심폐 유산소 트레드밀 코스', gif: '/gifs/유산소/9003_트레드밀 러닝.gif' },
            { name: '싸이클', eq: 'machine', detail: '무릎 부하를 줄이면서 강한 유산소 자극을 전달하는 고정 자전거', gif: '/gifs/유산소/9001_싸이클.gif', targetPain: 'knee' }
          ]
        },
        {
          id: 602,
          name: '천국의 계단 (스텝밀)',
          sets: 1,
          reps: 15,
          eq: 'machine',
          detail: '심폐 기능 향상 및 하부 후면 근육 활성화',
          gif: '/gifs/유산소/9011_스텝 밀.gif',
          alternatives: [
            { name: '엘립티컬 머신', eq: 'machine', detail: '전신을 부드럽게 흔들며 칼로리를 고속 연소하는 심폐 기구', gif: '/gifs/유산소/9002_엘립티컬 머신.gif' },
            { name: '로잉 머신', eq: 'machine', detail: '상하체 전신 근육을 당겨 폭발적인 에너지 소모를 일으키는 트레이닝', gif: '/gifs/유산소/9008_로잉 머신.gif', targetPain: 'lower_back' }
          ]
        }
      ]
    }
  }
  return {
    part: '스트레칭 & 리커버리',
    items: [
      {
        id: 701,
        name: '폼롤러 전신 마사지',
        sets: 1,
        reps: 10,
        eq: 'body',
        detail: '등, 허벅지 외측, 종아리 부위를 각 1-2분간 롤링하여 근막 이완',
        gif: '/gifs/스트레칭/10030_폼롤러 어퍼 백.gif',
        alternatives: [
          { name: '폼롤러 랫 (광배근)', eq: 'body', detail: '폼롤러로 옆구리와 날개뼈 외측 광배라인을 집중 롤링', gif: '/gifs/스트레칭/10029_폼롤러 랫.gif' },
          { name: '폼롤러 글루트 (둔근)', eq: 'body', detail: '엉덩이 좌골 신경 주변 근육 긴장을 풀어주는 폼롤러 스트레칭', gif: '/gifs/스트레칭/10033_폼롤러 글루트.gif' }
        ]
      },
      {
        id: 702,
        name: '동적/정적 스트레칭',
        sets: 1,
        reps: 10,
        eq: 'body',
        detail: '어깨 회전근개 및 골반 고관절 주변 스트레칭으로 관절 유연성 확보',
        gif: '/gifs/스트레칭/10050_캣 카우 스트레칭.gif',
        alternatives: [
          { name: '닐링 상체 회전 스트레칭', eq: 'body', detail: '상체를 숙여 한쪽 팔을 회전시켜 척추와 어깨 관절 가동성 확장', gif: '/gifs/스트레칭/10086_닐링 상체 회전 스트레칭.gif' },
          { name: '캣 카우 스트레칭', eq: 'body', detail: '엎드린 자세에서 척추를 말아 올려 전체적인 허리 스트레스를 케어', gif: '/gifs/스트레칭/10050_캣 카우 스트레칭.gif' }
        ]
      }
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

function RoutineCheckView({
  workDays, goal, splitStyle, sessionMin, painParts, dayParts, onReset, dbExercises,
  initialWorkoutRoutine, initialDailyNotes
}) {
  const [activeDay, setActiveDay] = useState(workDays[0] || '월')
  const [completedExercises, setCompletedExercises] = useState(() => {
    const initial = {}
    if (initialWorkoutRoutine) {
      Object.values(initialWorkoutRoutine).forEach(exs => {
        exs.forEach(ex => {
          if (ex.is_completed) {
            initial[ex.id] = true
          }
        })
      })
    }
    return initial
  })
  const [dailyNotes, setDailyNotes] = useState(initialDailyNotes || {})
  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // 1. Copy templates locally to allow exercise swapping
  const [workoutRoutine, setWorkoutRoutine] = useState(() => {
    if (initialWorkoutRoutine && Object.keys(initialWorkoutRoutine).length > 0) {
      return enrichPreloadedRoutine(initialWorkoutRoutine, dbExercises, painParts)
    }
    const initialRoutine = {}
    workDays.forEach(day => {
      const part = dayParts[day] || '가슴'
      const template = generateDynamicTemplateForPart(part, dbExercises, painParts)
      initialRoutine[day] = template ? template.items.map(item => ({ ...item })) : []
    })
    return initialRoutine
  })

  // Function to save routine to DB
  const saveRoutineToDb = (routine, notes, completedMap) => {
    const { year, weekNumber } = getISOWeekAndYear(new Date());
    
    const updatedRoutine = {}
    Object.keys(routine).forEach(day => {
      updatedRoutine[day] = routine[day].map(ex => ({
        ...ex,
        is_completed: !!completedMap[ex.id]
      }))
    })

    const payload = {
      device_uuid: deviceUuid,
      year,
      week_number: weekNumber,
      split_style: splitStyle,
      goal,
      session_min: sessionMin,
      pain_parts: painParts,
      work_days: workDays,
      day_parts: dayParts,
      workout_routine: updatedRoutine,
      daily_notes: notes
    };

    fetch(`${API_URL}/api/routines/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    .then(r => {
      if (!r.ok) throw new Error('Failed to save routine');
      return r.json();
    })
    .then(res => {
      console.log('Routine saved successfully to DB:', res);
    })
    .catch(err => {
      console.error('Error saving routine to DB:', err);
    });
  };

  // Auto-save on mount if it's a fresh routine
  useEffect(() => {
    if (!initialWorkoutRoutine || Object.keys(initialWorkoutRoutine).length === 0) {
      saveRoutineToDb(workoutRoutine, dailyNotes, completedExercises);
    }
  }, []);

  // activeDay가 workDays에 없으면 첫번째 값으로 안전장치
  const currentDay = workDays.includes(activeDay) ? activeDay : (workDays[0] || '월')
  const currentDayExercises = workoutRoutine[currentDay] || []

  // 2. State for the highlighted exercise details panel
  const [selectedExId, setSelectedExId] = useState(() => {
    const initialDay = workDays[0] || '월'
    const dayExs = workoutRoutine[initialDay] || []
    return dayExs[0]?.id || null
  })

  // Safe reference to the active exercise object
  const activeEx = currentDayExercises.find(ex => ex.id === selectedExId) || currentDayExercises[0]

  // Update highlighted exercise when switching tabs
  const handleDayChange = (day) => {
    setActiveDay(day)
    const dayExs = workoutRoutine[day] || []
    if (dayExs.length > 0) {
      setSelectedExId(dayExs[0].id)
    } else {
      setSelectedExId(null)
    }
  }

  // Swap exercise with an alternative option
  const handleSwapExercise = (alternativeEx) => {
    if (!activeEx) return
    const targetId = activeEx.id

    setWorkoutRoutine(prev => {
      const currentDayExs = prev[currentDay] || []
      const nextDayExs = currentDayExs.map(ex => {
        if (ex.id === targetId) {
          // Prepend original exercise to alternatives so the user can easily swap back
          const originalAsAlternative = {
            name: ex.name,
            eq: ex.eq,
            detail: ex.detail,
            targetPain: ex.targetPain,
            gif: ex.gif,
            alternatives: ex.alternatives
          }
          const updatedAlts = [
            originalAsAlternative,
            ...(alternativeEx.alternatives || []).filter(alt => alt.name !== ex.name)
          ]

          return {
            ...ex,
            name: alternativeEx.name,
            eq: alternativeEx.eq,
            detail: alternativeEx.detail,
            targetPain: alternativeEx.targetPain,
            gif: alternativeEx.gif,
            alternatives: updatedAlts
          }
        }
        return ex
      })
      return {
        ...prev,
        [currentDay]: nextDayExs
      }
    })

    // Reset exercise slot completion check upon swap
    setCompletedExercises(prev => ({
      ...prev,
      [targetId]: false
    }))
    setIsDirty(true)
  }

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
    const exs = workoutRoutine[d] || []
    return acc + exs.length
  }, 0)

  // 완료 개수 계산
  const completedCount = Object.values(completedExercises).filter(Boolean).length
  const progressPercent = totalExercises > 0 ? Math.round((completedCount / totalExercises) * 100) : 0

  const handleNoteChange = (text) => {
    setDailyNotes(prev => ({
      ...prev,
      [currentDay]: text
    }))
    setIsDirty(true)
  }

  const handleSaveSessionChanges = () => {
    saveRoutineToDb(workoutRoutine, dailyNotes, completedExercises)
    setIsDirty(false)
    setIsSavedModalOpen(true)
  }

  return (
    <div style={{ width: '100%', maxWidth: 1200, padding: '0 20px', boxSizing: 'border-box' }}>
      
      {/* 상단 요약 카드 */}
      <div style={{
        background: '#111',
        border: '1px solid rgba(255,215,0,0.15)',
        borderRadius: 4,
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
            <span style={{ width: 4, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.2)' }} />
            <span>⏱️ 세션당 {sessionMin}분</span>
            {painParts.length > 0 && !painParts.includes('none') && (
              <>
                <span style={{ width: 4, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.2)' }} />
                <span style={{ color: '#FF6B6B', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={12} /> {painParts.length}개 통증 우회 적용 중
                </span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowResetConfirm(true)}
          style={{
            padding: '10px 20px',
            borderRadius: 4,
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
        borderRadius: 4,
        padding: '18px 24px',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
          <span>이번 주 루틴 총 완료도</span>
          <span style={{ color: '#FFD700', fontWeight: 800 }}>{progressPercent}% 완료 ({completedCount}/{totalExercises}개)</span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
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
              onClick={() => handleDayChange(day)}
              style={{
                flex: 1,
                minWidth: 70,
                padding: '14px 0',
                borderRadius: 4,
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

      {/* 메인 대시보드 2단 레이아웃 */}
      <div style={{
        display: 'flex',
        gap: 28,
        flexWrap: 'wrap',
        alignItems: 'flex-start',
      }}>
        {/* 왼쪽 단: 운동 리스트 & 메모 */}
        <div style={{ flex: '1 1 560px', minWidth: 320 }}>
          <div style={{
            background: '#111',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 4,
            padding: '32px 32px 28px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div>
                <span style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(255,255,255,0.3)', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  DAILY ROUTINE
                </span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#FFF' }}>
                  {currentDay}요일 - {dayParts[currentDay]} 데이
                </span>
              </div>
              <span style={{ fontSize: 12, background: 'rgba(255,215,0,0.08)', color: '#FFD700', padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(255,215,0,0.15)', fontWeight: 600 }}>
                {currentDayExercises.length}가지 구성
              </span>
            </div>

            {currentDayExercises.map(ex => {
              const isDone = !!completedExercises[ex.id]
              const isWarned = ex.targetPain && painParts.includes(ex.targetPain)
              const isSelected = activeEx && activeEx.id === ex.id
              const { sets, reps } = getScaledSetsReps(ex)

              return (
                <div
                  key={ex.id}
                  onClick={() => setSelectedExId(ex.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 20,
                    padding: '20px 16px',
                    borderRadius: 4,
                    border: `1px solid ${isSelected ? 'rgba(255,215,0,0.35)' : 'transparent'}`,
                    background: isSelected ? 'rgba(255,215,0,0.02)' : 'transparent',
                    borderBottom: !isSelected ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(255,215,0,0.35)',
                    opacity: isDone ? 0.45 : 1,
                    transition: 'all 0.25s',
                    cursor: 'pointer',
                    marginBottom: 4,
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.01)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  {/* 완료 토글 체크박스 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setCompletedExercises(prev => ({ ...prev, [ex.id]: !prev[ex.id] }))
                      setIsDirty(true)
                    }}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 4,
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
                          fontSize: 9,
                          fontWeight: 700,
                          background: 'rgba(255,100,100,0.12)',
                          border: '1px solid rgba(255,100,100,0.25)',
                          color: '#FF6B6B',
                          padding: '2px 6px',
                          borderRadius: 4,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}>
                          <AlertTriangle size={8} /> 우회
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)', lineHeight: 1.5 }}>
                      {ex.detail}
                    </div>
                  </div>

                  {/* 세트 / 횟수 표시 */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: isDone ? 'rgba(255,255,255,0.2)' : '#FFD700' }}>
                      {sets} <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.3)' }}>Set</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                      {reps} <span style={{ fontSize: 9.5 }}>Reps</span>
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
                  borderRadius: 4,
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

            {/* 변경사항 저장 버튼 */}
            {isDirty && (
              <div style={{ marginTop: 16, animation: 'float-up 0.2s ease' }}>
                <button
                  type="button"
                  onClick={handleSaveSessionChanges}
                  style={{
                    width: '100%',
                    padding: '14px 0',
                    borderRadius: 4,
                    background: 'linear-gradient(135deg, #FFD700, #C8A200)',
                    border: 'none',
                    color: '#000',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(255, 215, 0, 0.2)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  💾 변경사항 저장
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽 단: 활성화된 운동 디테일 카드 (GIF & 대체 운동) */}
        <div style={{ flex: '1 1 400px', minWidth: 320, position: 'sticky', top: 90 }}>
          {activeEx ? (
            <div style={{
              background: '#111',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 4,
              padding: 24,
              boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
              animation: 'float-up 0.25s ease',
            }} key={activeEx.name}>
              {/* 타이틀 및 기구 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <span style={{ fontSize: 10, letterSpacing: 1.5, color: '#FFD700', fontWeight: 800, display: 'block', marginBottom: 4 }}>
                    EXERCISE DETAIL & GUIDE
                  </span>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: '#FFF', margin: 0 }}>
                    {activeEx.name}
                  </h3>
                </div>
                <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', padding: '4px 10px', borderRadius: 4, fontWeight: 700 }}>
                  {EQUIPMENT_ICON[activeEx.eq]} {EQUIPMENT_LABEL[activeEx.eq]}
                </span>
              </div>

              {/* 통증 우회 가이드 (활성화 시 표시) */}
              {activeEx.targetPain && painParts.includes(activeEx.targetPain) && (
                <div style={{
                  background: 'rgba(255,107,107,0.08)',
                  border: '1px solid rgba(255,107,107,0.25)',
                  borderRadius: 4,
                  padding: '12px 14px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <AlertTriangle size={18} color="#FF6B6B" />
                  <div style={{ fontSize: 11.5, color: '#FF9E9E', lineHeight: 1.4 }}>
                    <strong>통증 케어 경고</strong>: 해당 운동은 {activeEx.targetPain === 'shoulder' ? '어깨' : activeEx.targetPain === 'lower_back' ? '허리' : activeEx.targetPain === 'wrist' ? '손목' : '무릎'} 부상 우회 가이드 대상입니다. 가동 범위 조절이 필수적입니다.
                  </div>
                </div>
              )}

              {/* GIF 미디어 영역 */}
              <div style={{
                width: '100%',
                aspectRatio: '1.45',
                borderRadius: 4,
                overflow: 'hidden',
                background: '#080808',
                border: '1px solid rgba(255,255,255,0.05)',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                <img
                  src={activeEx.gif}
                  alt={activeEx.name}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/workout_guide.png';
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    maxHeight: '100%',
                  }}
                />
              </div>

              {/* 운동 디테일 텍스트 */}
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: '0 0 24px 0', background: 'rgba(0,0,0,0.15)', padding: '12px 14px', borderRadius: 12 }}>
                💡 {activeEx.detail}
              </p>

              {/* 대체 운동 섹션 */}
              {activeEx.alternatives && activeEx.alternatives.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.4)', marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                    🔄 이 운동 대신 대체하기 (대체 운동 선택)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {activeEx.alternatives.map(alt => (
                      <button
                        key={alt.name}
                        type="button"
                        onClick={() => handleSwapExercise(alt)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 14px',
                          borderRadius: 10,
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 215, 0, 0.04)'; e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.3)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
                      >
                        <span style={{ fontSize: 16 }}>🔄</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#FFD700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {alt.name}
                          </div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {alt.detail}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              background: '#111',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 24,
              padding: 40,
              textAlign: 'center',
              color: 'rgba(255,255,255,0.22)',
            }}>
              👈 왼쪽 리스트에서 운동을 눌러 자세한 가이드와 대체 운동을 확인하세요.
            </div>
          )}
        </div>
      </div>

      {/* 저장 완료 모달 */}
      {isSavedModalOpen && (
        <div onClick={() => setIsSavedModalOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 4000,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#111', border: '1px solid rgba(255,215,0,0.3)',
            borderRadius: 24, padding: '36px 32px 30px', maxWidth: 440, width: '100%',
            boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
            animation: 'float-up 0.3s ease',
            textAlign: 'center',
          }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'rgba(255,215,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              border: '2px solid #FFD700',
            }}>
              <Check size={32} color="#FFD700" strokeWidth={3} />
            </div>
            <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 28, color: '#FFF', letterSpacing: 2, marginBottom: 8 }}>
              ROUTINE SAVED SUCCESS!
            </h2>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#FFD700', marginBottom: 16 }}>
              변경된 사항이 성공적으로 저장되었습니다!
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, marginBottom: 24 }}>
              수정하신 대체 운동 목록, 운동 수행 기록(체크박스), 그리고 피드백 메모의 변경 내역이 안전하게 영구 저장되었습니다.
            </p>
            <button
              type="button"
              onClick={() => setIsSavedModalOpen(false)}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 10,
                background: 'linear-gradient(135deg, #FFD700, #C8A200)', border: 'none',
                color: '#000', fontSize: 14, fontWeight: 800, cursor: 'pointer',
              }}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 다시 설계 경고 모달 */}
      {showResetConfirm && (
        <div onClick={() => setShowResetConfirm(false)} style={{
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
              루틴을 다시 설계할까요?
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, marginBottom: 24 }}>
              다시 설계하면 <strong style={{ color: 'rgba(255,255,255,0.7)' }}>현재 기록된 운동 수행 기록과 대체 운동 설정, 데일리 메모가 모두 초기화</strong>됩니다.<br /><br />
              정말 다시 설계하시겠습니까?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowResetConfirm(false)} style={{
                flex: 1, padding: '11px 0', borderRadius: 10,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer',
              }}>취소</button>
              <button onClick={() => {
                setShowResetConfirm(false)
                onReset()
              }} style={{
                flex: 1, padding: '11px 0', borderRadius: 10,
                background: '#FF6B6B', border: 'none',
                color: '#000', fontSize: 13, fontWeight: 800, cursor: 'pointer',
              }}>다시 설계</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

