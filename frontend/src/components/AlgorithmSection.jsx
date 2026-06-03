import { useState, useRef, useEffect } from 'react'
import { Minus, Plus, AlertTriangle, CheckCircle } from 'lucide-react'

const DAYS = [
  {
    label: '월', cat: '등', color: '#FFD700',
    exercises: [
      { name: '데드리프트', sets: 4 },
      { name: '바벨 로우', sets: 3 },
      { name: '랫 풀다운', sets: 3 },
    ],
  },
  {
    label: '화', cat: '가슴', color: '#FF6B35',
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
  if (activePain === '없음') return false;
  if (activePain === '어깨') {
    return ex.name === '벤치 프레스' || ex.name === '오버헤드 프레스';
  }
  if (activePain === '허리') {
    return ex.name === '데드리프트' || ex.name === '바벨 로우' || ex.name === '스쿼트';
  }
  if (activePain === '무릎') {
    return ex.name === '스쿼트' || ex.name === '런지';
  }
  if (activePain === '손목') {
    return ex.name === '바벨 컬' || ex.name === '딥스';
  }
  return false;
};

const getAlternativeForDay = (dayLabel, activePain) => {
  if (activePain === '어깨') {
    if (dayLabel === '화') return { name: '펙덱 플라이 머신 (대체)', sets: 3 };
    if (dayLabel === '목') return { name: '시티드 레터럴 레이즈 머신 (대체)', sets: 3 };
  }
  if (activePain === '허리') {
    if (dayLabel === '월') return { name: '시티드 케이블 로우 (대체)', sets: 3 };
    if (dayLabel === '수') return { name: '레그 프레스 (대체)', sets: 3 };
  }
  if (activePain === '무릎') {
    if (dayLabel === '수') return { name: '레그 익스텐션 (대체)', sets: 3 };
  }
  if (activePain === '손목') {
    if (dayLabel === '화') return { name: '체스트 프레스 머신 (대체)', sets: 3 };
    if (dayLabel === '금') return { name: '덤벨 해머 컬 (대체)', sets: 3 };
  }
  return null;
};

function DayTimeline({ day, time, maxTime, activePain, index, visible }) {
  const exercisesShown = time >= 40 ? day.exercises : day.exercises.slice(0, Math.max(1, day.exercises.length - 1))
  const pct = (time / maxTime) * 100
  const alternative = getAlternativeForDay(day.label, activePain)

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
              borderRadius: 7,
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
        {alternative && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '6px 10px',
            background: 'rgba(0,212,160,0.08)',
            border: '1px solid rgba(0,212,160,0.25)',
            borderRadius: 7,
            animation: 'float-up 0.3s ease',
          }}>
            <CheckCircle size={11} color="#00D4A0" />
            <span style={{ fontSize: 11, color: '#00D4A0' }}>{alternative.name}</span>
            <span style={{ fontSize: 10, color: 'rgba(0,212,160,0.5)', marginLeft: 'auto' }}>{alternative.sets}세트</span>
          </div>
        )}
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
  const [pain, setPain] = useState('없음')
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

  const painActive = pain !== '없음'

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
      if (getAlternativeForDay(day.label, pain)) {
        count++
      }
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
            <span style={{ width: 24, height: 2, background: 'linear-gradient(90deg, transparent, #7C72FF)', borderRadius: 2 }} />
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 5.5, color: '#7C72FF', opacity: 0.85 }}>
              WEEKLY PLANNER
            </span>
            <span style={{ width: 24, height: 2, background: 'linear-gradient(90deg, #FFD700, transparent)', borderRadius: 2 }} />
          </div>
          <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(42px, 5.5vw, 70px)', color: '#FFF', lineHeight: 1, marginBottom: 16 }}>
            과학적으로 설계된<br />
            <span className="gold-text">일주일 루틴 플래너</span>
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.38)', lineHeight: 1.9 }}>
            가용 시간과 컨디션을 입력하면 내 일정에 맞는 루틴이 자동 완성됩니다.
          </p>
          <div className="divider-gold" />
        </div>

        {/* Controls */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 32,
          marginBottom: 28, flexWrap: 'wrap',
          opacity: visible ? 1 : 0, transition: 'all 0.6s ease 0.15s',
        }}>
          {/* Time controls */}
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 3, marginBottom: 10 }}>요일별 가용 시간 조절</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {DAYS.map((day, i) => (
                <div key={day.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  {/* Plus Button */}
                  <button onClick={() => setTime(i, 1)} style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: `${day.color}18`, border: `1px solid ${day.color}35`,
                    color: day.color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Plus size={13} />
                  </button>

                  {/* Day Label (e.g. 월, 화) */}
                  <span style={{ fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 800, fontSize: 16, color: day.color }}>
                    {day.label}
                  </span>

                  {/* Time Label (e.g. 30분, 45분) */}
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#E2E2E2' }}>
                    {times[i]}분
                  </span>

                  {/* Minus Button */}
                  <button onClick={() => setTime(i, -1)} style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Minus size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 80, background: 'rgba(255,255,255,0.08)' }} />

          {/* Pain area selector */}
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 3, marginBottom: 10 }}>
              통증 부위 선택
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PAIN_OPTIONS.map(p => {
                const active = pain === p.key
                return (
                  <button key={p.key} onClick={() => setPain(p.key)} style={{
                    padding: '6px 14px', borderRadius: 50, fontSize: 12, cursor: 'pointer',
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
            {pain !== '없음' && (
              <div style={{
                marginTop: 10, display: 'flex', alignItems: 'center', gap: 7,
                fontSize: 11, color: '#F44336',
                animation: 'float-up 0.3s ease',
              }}>
                <AlertTriangle size={12} />
                {pain === '어깨' && '어깨 관절에 무리가 가는 프레스 동작이 제외되고 안전한 머신/레이즈 대체 운동이 추가됩니다.'}
                {pain === '허리' && '허리 척추에 압박을 주는 데드리프트/로우/스쿼트가 제외되고 척추 부담이 적은 머신 운동으로 대체됩니다.'}
                {pain === '손목' && '손목에 꺾임 자극을 주는 프리웨이트 컬/딥스가 제외되고 안전한 중립 그립 대체 운동이 추가됩니다.'}
                {pain === '무릎' && '무릎 관절에 체중이 실리는 스쿼트/런지가 제외되고 관절 충격이 적은 익스텐션/레그프레스로 대체됩니다.'}
              </div>
            )}
          </div>
        </div>

        {/* Timeline dashboard */}
        <div style={{
          background: 'rgba(17,17,17,0.95)',
          border: '1px solid rgba(255,215,0,0.1)',
          borderRadius: 18,
          padding: '28px 28px 24px',
          boxShadow: '0 24px 72px rgba(0,0,0,0.55)',
          backdropFilter: 'blur(8px)',
          opacity: visible ? 1 : 0, transition: 'all 0.6s ease 0.25s',
        }}>
          {/* Dashboard header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 24, paddingBottom: 16,
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: 20, color: '#FFF', letterSpacing: 1 }}>
                주간 루틴
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                총 {times.reduce((a, b) => a + b, 0)}분 · {getActiveExercisesCount()}개 운동
              </div>
            </div>
            {painActive && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.25)',
                padding: '6px 14px', borderRadius: 50,
                fontSize: 11, color: '#F44336', fontWeight: 700,
                animation: 'float-up 0.3s ease',
              }}>
                <AlertTriangle size={12} />
                {PAIN_OPTIONS.find(p => p.key === pain)?.label || pain} 통증 우회 모드 ON
              </div>
            )}
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
        </div>
      </div>
    </section>
  )
}
