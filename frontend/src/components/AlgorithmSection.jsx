import { useState, useRef, useEffect } from 'react'
import { Minus, Plus, AlertTriangle, CheckCircle } from 'lucide-react'

const DAYS = [
  {
    label: '월', cat: '가슴', color: '#FFD700',
    exercises: [
      { name: '데드리프트', sets: 4 },
      { name: '바벨 로우', sets: 3 },
      { name: '랫 풀다운', sets: 3 },
    ],
  },
  {
    label: '화', cat: '등', color: '#FF6B35',
    exercises: [
      { name: '벤치 프레스', sets: 4 },
      { name: '덤벨 플라이', sets: 3 },
      { name: '딥스', sets: 3 },
      { name: '푸쉬업', sets: 3 },
    ],
  },
  {
    label: '수', cat: '하체', color: '#00D4A0',
    exercises: [
      { name: '스쿼트', sets: 4 },
      { name: '레그 프레스', sets: 3 },
      { name: '런지', sets: 3 },
      { name: '레그 컬', sets: 3 },
    ],
  },
  {
    label: '목', cat: '어깨', color: '#6C63FF',
    exercises: [
      { name: '오버헤드 프레스', sets: 4 },
      { name: '사이드 레터럴', sets: 3 },
      { name: '리어 델트 플라이', sets: 3 },
    ],
  },
  {
    label: '금', cat: '팔', color: '#F77F00',
    exercises: [
      { name: '바벨 컬', sets: 3 },
      { name: '해머 컬', sets: 3 },
      { name: '트라이셉스 딥', sets: 3 },
    ],
  },
]

const PAIN_OPTIONS = [
  { key: '없음', label: '통증 없음' },
  { key: '어깨', label: '어깨 (회전근개)' },
  { key: '허리', label: '허리 (디스크)' },
  { key: '손목', label: '손목 (터널증후군)' },
  { key: '무릎', label: '무릎 (관절통)' }
]

const isExcluded = (ex, activePain) => {
  if (activePain.includes('없음')) return false;
  if (activePain.includes('어깨') && (ex.name === '벤치 프레스' || ex.name === '오버헤드 프레스')) {
    return true;
  }
  if (activePain.includes('허리') && (ex.name === '데드리프트' || ex.name === '바벨 로우' || ex.name === '스쿼트')) {
    return true;
  }
  if (activePain.includes('무릎') && (ex.name === '스쿼트' || ex.name === '런지')) {
    return true;
  }
  if (activePain.includes('손목') && (ex.name === '바벨 컬' || ex.name === '딥스')) {
    return true;
  }
  return false;
};

const getAlternativesForDay = (dayLabel, activePain) => {
  if (activePain.includes('없음')) return [];
  const alts = [];
  if (activePain.includes('어깨')) {
    if (dayLabel === '화') alts.push({ name: '펙덱 플라이 머신 (대체)', sets: 3 });
    if (dayLabel === '목') alts.push({ name: '시티드 레터럴 레이즈 머신 (대체)', sets: 3 });
  }
  if (activePain.includes('허리')) {
    if (dayLabel === '월') alts.push({ name: '시티드 케이블 로우 (대체)', sets: 3 });
    if (dayLabel === '수') alts.push({ name: '레그 프레스 (대체)', sets: 3 });
  }
  if (activePain.includes('무릎')) {
    if (dayLabel === '수') alts.push({ name: '레그 익스텐션 (대체)', sets: 3 });
  }
  if (activePain.includes('손목')) {
    if (dayLabel === '화') alts.push({ name: '체스트 프레스 머신 (대체)', sets: 3 });
    if (dayLabel === '금') alts.push({ name: '덤벨 해머 컬 (대체)', sets: 3 });
  }
  return alts;
};

function DayTimeline({ day, time, maxTime, activePain, index, visible }) {
  const exercisesShown = time >= 40 ? day.exercises : day.exercises.slice(0, Math.max(1, day.exercises.length - 1))
  const pct = (time / maxTime) * 100
  const alternatives = getAlternativesForDay(day.label, activePain)

  return (
    <div style={{
      flex: 1,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
      transition: `all 0.55s ease ${index * 0.1}s`,
    }}>
      {/* Day label */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <span style={{
          fontFamily: 'Bebas Neue', fontSize: 22, color: day.color, lineHeight: 1,
          filter: `drop-shadow(0 0 6px ${day.color}50)`
        }}>{day.label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: day.color }}>{time}분</span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, marginBottom: 12 }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: `linear-gradient(90deg, ${day.color}88, ${day.color})`,
          borderRadius: 2, transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Exercise list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {day.exercises.map((ex, i) => {
          const excluded = isExcluded(ex, activePain)
          const isShown = exercisesShown.includes(ex)

          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 10px',
              background: excluded
                ? 'rgba(244,67,54,0.1)'
                : isShown ? 'rgba(255,255,255,0.03)' : 'transparent',
              border: excluded
                ? '1px solid rgba(244,67,54,0.3)'
                : isShown ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent',
              borderRadius: 2,
              opacity: isShown ? 1 : 0.25,
              transition: 'all 0.35s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {excluded ? (
                  <AlertTriangle size={11} color="#F44336" />
                ) : (
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: isShown ? day.color : 'rgba(255,255,255,0.2)',
                    flexShrink: 0, boxShadow: isShown ? `0 0 4px ${day.color}` : 'none'
                  }} />
                )}
                <span style={{
                  fontSize: 11,
                  color: excluded ? '#F44336' : isShown ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
                  textDecoration: excluded ? 'line-through' : 'none',
                }}>{ex.name}</span>
              </div>
              <span style={{ fontSize: 10, color: excluded ? 'rgba(244,67,54,0.6)' : 'rgba(255,255,255,0.25)' }}>
                {excluded ? 'SKIP' : `${ex.sets}세트`}
              </span>
            </div>
          )
        })}

        {/* Alternative for excluded */}
        {alternatives.map((alt, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '6px 10px',
            background: 'rgba(0,212,160,0.08)',
            border: '1px solid rgba(0,212,160,0.25)',
            borderRadius: 2,
            animation: 'float-up 0.3s ease',
          }}>
            <CheckCircle size={11} color="#00D4A0" />
            <span style={{ fontSize: 11, color: '#00D4A0' }}>{alt.name}</span>
            <span style={{ fontSize: 10, color: 'rgba(0,212,160,0.5)', marginLeft: 'auto' }}>{alt.sets}세트</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const TIME_STEPS = [30, 45, 60, 90]

const getNextTimeStep = (current, delta) => {
  let idx = TIME_STEPS.indexOf(current)
  if (idx === -1) {
    let closestIdx = 0
    let minDiff = Infinity
    TIME_STEPS.forEach((step, index) => {
      const diff = Math.abs(step - current)
      if (diff < minDiff) {
        minDiff = diff
        closestIdx = index
      }
    })
    idx = closestIdx
  }

  if (delta > 0) {
    return TIME_STEPS[Math.min(TIME_STEPS.length - 1, idx + 1)]
  } else {
    return TIME_STEPS[Math.max(0, idx - 1)]
  }
}

export default function AlgorithmSection() {
  const [times, setTimes] = useState([60, 45, 90, 45, 30])
  const [pain, setPain] = useState(['없음'])
  const [visible, setVisible] = useState(false)
  const ref = useRef()
  const maxTime = 90

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.1 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  const setTime = (i, delta) => {
    setTimes(prev => {
      const next = [...prev]
      next[i] = getNextTimeStep(next[i], delta)
      return next
    })
  }

  const painActive = pain.length > 0 && !pain.includes('없음')

  const handlePainToggle = (key) => {
    setPain(prev => {
      if (key === '없음') {
        return ['없음'];
      }
      let next = prev.filter(p => p !== '없음');
      if (next.includes(key)) {
        next = next.filter(p => p !== key);
      } else {
        next.push(key);
      }
      if (next.length === 0) {
        return ['없음'];
      }
      return next;
    });
  }

  const getActiveExercisesCount = () => {
    let count = 0
    DAYS.forEach((day, index) => {
      const time = times[index]
      const exercisesShown = time >= 40 ? day.exercises : day.exercises.slice(0, Math.max(1, day.exercises.length - 1))
      exercisesShown.forEach(ex => {
        if (!isExcluded(ex, pain)) {
          count++
        }
      })
      count += getAlternativesForDay(day.label, pain).length
    })
    return count
  }

  return (
    <section ref={ref} style={{
      position: 'relative',
      background: 'linear-gradient(160deg, #07070F 0%, #0A0A12 50%, #0D0D0A 100%)',
      padding: '100px 48px',
      overflow: 'hidden',
    }}>
      {/* 배경: 테크/데이터 분위기 */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: `url('https://images.unsplash.com/photo-1518770660439-4636190af475?w=1600&q=40')`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        opacity: 0.03, filter: 'saturate(0)',
      }} />
      {/* 도트 그리드 패턴 */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: 'radial-gradient(circle, rgba(255,215,0,0.06) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      {/* 좌측 보라 빔 */}
      <div style={{
        position: 'absolute', top: '20%', left: '-100px', zIndex: 0,
        width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(108,99,255,0.07) 0%, transparent 70%)',
      }} />
      {/* 우측 골드 빔 */}
      <div style={{
        position: 'absolute', bottom: '10%', right: '-60px', zIndex: 0,
        width: 400, height: 400,
        background: 'radial-gradient(circle, rgba(255,215,0,0.05) 0%, transparent 70%)',
      }} />
      {/* 상단 accent 라인 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 0,
        background: 'linear-gradient(90deg, transparent 0%, #6C63FF 40%, #FFD700 70%, transparent 100%)',
        opacity: 0.5,
      }} />
      <div style={{ maxWidth: 1300, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{
          textAlign: 'center', marginBottom: 64,
          opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(22px)',
          transition: 'all 0.6s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ width: 24, height: 2, background: 'linear-gradient(90deg, transparent, #FFD700)', borderRadius: 2 }} />
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 5.5, color: '#FFD700', opacity: 0.85 }}>
              WEEKLY PLANNER
            </span>
            <span style={{ width: 24, height: 2, background: 'linear-gradient(90deg, #FFD700, transparent)', borderRadius: 2 }} />
          </div>
          <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(42px, 5.5vw, 70px)', color: '#FFF', lineHeight: 1, marginBottom: 16 }}>
            내가 사람을 믿지 못하는 이유는<br />
            <span className="gold-text">“이번이 마지막”이라고 말하는 트레이너들 때문이다.</span>
          </h2>
        </div>

        {/* Timeline dashboard */}
        <div style={{
          background: 'rgba(17,17,17,0.95)',
          border: '1px solid rgba(255,215,0,0.1)',
          borderRadius: 4,
          padding: '28px 28px 24px',
          boxShadow: '0 24px 72px rgba(0,0,0,0.55)',
          backdropFilter: 'blur(8px)',
          opacity: visible ? 1 : 0, transition: 'all 0.6s ease 0.15s',
        }}>
          {/* Dashboard header (with integrated controls on the right) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24,
            paddingBottom: 20,
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            flexWrap: 'wrap',
            gap: 24,
          }}>
            {/* Left Group: Title, Info & Pain Selector */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 32,
              flexWrap: 'wrap',
            }}>
              {/* Title & Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontFamily: 'Bebas Neue', fontSize: 24, color: '#FFF', letterSpacing: 1.5 }}>
                  주간 루틴
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                  총 {times.reduce((a, b) => a + b, 0)}분 · {getActiveExercisesCount()}개 운동
                </div>
              </div>

              {/* 통증 부위 선택 */}
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, marginBottom: 8 }}>
                  통증 부위 선택
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PAIN_OPTIONS.map(p => {
                    const active = pain.includes(p.key)
                    return (
                      <button key={p.key} onClick={() => handlePainToggle(p.key)} style={{
                        padding: '5px 12px', borderRadius: 2, fontSize: 11, cursor: 'pointer',
                        background: active
                          ? (p.key === '없음' ? '#FFD700' : '#F44336')
                          : 'rgba(255,255,255,0.04)',
                        border: active
                          ? `1px solid ${p.key === '없음' ? '#FFD700' : '#F44336'}`
                          : '1px solid rgba(255,255,255,0.08)',
                        color: active ? (p.key === '없음' ? '#000' : '#fff') : 'rgba(255,255,255,0.5)',
                        fontWeight: active ? 700 : 400, transition: 'all 0.2s',
                      }}>{p.label}</button>
                    )
                  })}
                </div>
                {painActive && (
                  <div style={{
                    marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6,
                    fontSize: 10, color: '#F44336',
                    maxWidth: 600,
                    lineHeight: 1.3,
                  }}>
                    {pain.map(pKey => {
                      if (pKey === '없음') return null;
                      return (
                        <div key={pKey} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <AlertTriangle size={11} style={{ flexShrink: 0 }} />
                          <span>
                            {pKey === '어깨' && '어깨 관절에 무리가 가는 프레스 동작 대신 안전한 대체 운동이 추가됩니다.'}
                            {pKey === '허리' && '허리에 압박을 주는 데드리프트/로우/스쿼트 대신 머신 운동으로 대체됩니다.'}
                            {pKey === '손목' && '손목에 자극을 주는 프리웨이트 컬/딥스 대신 안전한 대체 운동이 추가됩니다.'}
                            {pKey === '무릎' && '무릎에 체중이 실리는 스쿼트/런지 대신 머신 운동으로 대체됩니다.'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Group: Divider, Time controls & Bypass Mode Badge (at the far right, bottom-aligned) */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 8,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 24,
              }}>
                {/* Vertical line divider */}
                <div style={{ width: 1, height: 64, background: 'rgba(255,255,255,0.08)' }} />

                {/* 요일별 가용 시간 조절 */}
                <div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {DAYS.map((day, i) => (
                      <div key={day.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        {/* Plus Button */}
                        <button onClick={() => setTime(i, 1)} style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: `${day.color}18`, border: `1px solid ${day.color}35`,
                          color: day.color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Plus size={10} />
                        </button>

                        {/* Day Label */}
                        <span style={{ fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 800, fontSize: 13, color: day.color, lineHeight: 1.1 }}>
                          {day.label}
                        </span>

                        {/* Time Label */}
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#E2E2E2', lineHeight: 1.1 }}>
                          {times[i]}분
                        </span>

                        {/* Minus Button */}
                        <button onClick={() => setTime(i, -1)} style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                          color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Minus size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Day columns */}
          <div style={{ display: 'flex', gap: 20 }}>
            {DAYS.map((day, i) => (
              <DayTimeline
                key={day.label}
                day={day}
                time={times[i]}
                maxTime={maxTime}
                activePain={pain}
                index={i}
                visible={visible}
              />
            ))}
          </div>

          {/* painActive badge moved to bottom-right of the dashboard card */}
          {painActive && (
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: 20,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.25)',
                padding: '6px 14px', borderRadius: 2,
                fontSize: 11, color: '#F44336', fontWeight: 700,
                width: 'fit-content',
                animation: 'float-up 0.3s ease',
              }}>
                <AlertTriangle size={12} />
                {PAIN_OPTIONS.filter(p => pain.includes(p.key) && p.key !== '없음').map(p => p.label).join(', ')} 통증 우회 모드 ON
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
