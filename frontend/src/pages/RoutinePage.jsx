import { useState, useEffect, useRef } from 'react'
import { ChevronRight, ChevronLeft, Check, AlertTriangle, RotateCcw, X } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

import { useNavigate } from 'react-router-dom'
import { getMe } from '../api/auth'
import { getOrCreateDeviceUuid } from '../utils/deviceUuid'

// 기존 uuid 셋팅을 유틸 함수로 보냄 + 기타 처리 추가 
const deviceUuid = getOrCreateDeviceUuid();

// 주차 계산 함수 
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
  { key: 'shoulder',    label: '어깨 / 회전근개 불안정',     sub: '벤치 프레스, 숄더 프레스 우회' },
  { key: 'lower_back',  label: '허리 디스크 이력 / 요통',     sub: '스쿼트, 데드리프트 우회' },
  { key: 'wrist',       label: '손목 터널 증후군 / 통증',     sub: '바벨 컬, 푸쉬업 우회' },
  { key: 'knee',        label: '무릎 관절 시림 / 통증',       sub: '런지, 레그 익스텐션 우회' },
  { key: 'none',        label: '현재 통증 없음',              sub: '정석 고강도 5분할 추천' },
]

const DAYS = ['월', '화', '수', '목', '금', '토', '일']
const DEFAULT_WORK_DAYS = ['월', '화', '수', '목', '금']
const DEFAULT_DAY_PARTS = {
  '월': '가슴',
  '화': '등',
  '수': '하체',
  '목': '어깨',
  '금': '팔/코어',
  '토': '유산소',
  '일': '스트레칭'
}

const GOAL_OPTIONS = [
  { key: 'hypertrophy', label: '근비대',   desc: '중간 중량 · 6~8rep · 충분한 볼륨',          color: '#FF6B35' },
  { key: 'diet',        label: '다이어트', desc: '저중량 · 12~15rep · 짧은 휴식',             color: '#00D4A0' },
  { key: 'strength',    label: '스트렝스', desc: '저반복 고중량 · 3~5rep · 긴 휴식',         color: '#6C63FF' },
  { key: 'maintenance', label: '체력 유지', desc: '머신 중심 · 10~15rep · 안정성 우선',       color: '#FFD700' },
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

const GENDER_OPTIONS = [
  { key: 'male', label: '남성' },
  { key: 'female', label: '여성' },
]

const LEVEL_OPTIONS = [
  { key: 'beginner', label: '초급' },
  { key: 'intermediate', label: '중급' },
  { key: 'advanced', label: '상급' },
]

const ALL_EQUIPMENT_KEYS = ['body', 'dumbbell', 'barbell', 'machine', 'band', 'pull_up_bar', 'kettlebell']
const SURVEY_STEP_COUNT = 5

function ChoiceButton({ active, children, onClick, style = {} }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '14px 16px',
        borderRadius: 4,
        background: active ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${active ? 'rgba(255,215,0,0.38)' : 'rgba(255,255,255,0.08)'}`,
        color: active ? '#FFD700' : '#E2E2E2',
        fontSize: 13,
        fontWeight: 800,
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.2s',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

function StepProfile({ age, gender, level, onAgeChange, onGenderChange, onLevelChange }) {
  return (
    <div>
      <span style={{ fontSize: 11, letterSpacing: 4, color: '#FFD700', opacity: 0.8, display: 'block', marginBottom: 12 }}>
        STEP 1 / 5
      </span>
      <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(28px, 4vw, 42px)', color: '#E2E2E2', letterSpacing: 2, marginBottom: 8, lineHeight: 1.1 }}>
        기본 정보
      </h2>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 28, lineHeight: 1.7 }}>
        추천 강도와 난이도 기준으로 사용합니다.
      </p>
      <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>나이</label>
      <input
        type="number"
        min="14"
        max="90"
        value={age}
        onChange={e => onAgeChange(e.target.value)}
        placeholder="예: 28"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '14px 16px',
          borderRadius: 4,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#E2E2E2',
          fontSize: 15,
          outline: 'none',
          marginBottom: 20,
        }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {GENDER_OPTIONS.map(opt => (
          <ChoiceButton key={opt.key} active={gender === opt.key} onClick={() => onGenderChange(opt.key)} style={{ textAlign: 'center' }}>
            {opt.label}
          </ChoiceButton>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {LEVEL_OPTIONS.map(opt => (
          <ChoiceButton key={opt.key} active={level === opt.key} onClick={() => onLevelChange(opt.key)} style={{ textAlign: 'center' }}>
            {opt.label}
          </ChoiceButton>
        ))}
      </div>
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
        STEP 2 / 5
      </span>
      <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(28px, 4vw, 42px)', color: '#E2E2E2', letterSpacing: 2, marginBottom: 8, lineHeight: 1.1 }}>
        만성 통증 · 부상 부위
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
        비활성화된 이전 분할 단계
      </span>
      <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(28px, 4vw, 42px)', color: '#E2E2E2', letterSpacing: 2, marginBottom: 8, lineHeight: 1.1 }}>
        분할 스타일 선택
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
  const PART_OPTIONS = ['가슴', '등', '하체', '어깨', '팔/코어', '코어', '유산소', '스트레칭']

  const sortDays = (daysArray) => {
    return [...daysArray].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b))
  }

  const toggleDay = (day) => {
    if (workDays.includes(day)) {
      onChangeDays(workDays.filter(d => d !== day))
      return
    }
    const nextDays = sortDays([...workDays, day])
    const nextIndex = nextDays.indexOf(day)
    onChangeDays(nextDays)
    onChangeDayParts(prev => ({
      ...prev,
      [day]: prev[day] || GET_DEFAULT_PART(nextIndex, splitStyle),
    }))
  }

  return (
    <div>
      <span style={{ fontSize: 11, letterSpacing: 4, color: '#FFD700', opacity: 0.8, display: 'block', marginBottom: 12 }}>
        STEP 3 / 5
      </span>
      <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(28px, 4vw, 42px)', color: '#E2E2E2', letterSpacing: 2, marginBottom: 8, lineHeight: 1.1 }}>
        운동 요일 & 부위 설정
      </h2>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24, lineHeight: 1.7 }}>
        기본은 월요일부터 금요일까지의 5분할입니다. 필요한 경우 요일을 휴식일로 바꾸거나 각 요일의 운동 부위를 직접 조정하세요.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(74px, 1fr))', gap: 8, marginBottom: 20 }}>
        {DAYS.map(day => {
          const isSelected = workDays.includes(day)
          const isWeekend = day === '토' || day === '일'
          const partLabel = isSelected ? (dayParts[day] || '가슴') : '휴식'

          return (
            <div
              key={day}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '12px 8px', borderRadius: 4,
                background: isSelected ? 'rgba(255,215,0,0.06)' : 'rgba(255,255,255,0.02)',
                border: isSelected ? '1px solid rgba(255,215,0,0.35)' : '1px solid rgba(255,255,255,0.06)',
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => toggleDay(day)}
                style={{
                  width: '100%',
                  padding: '9px 0',
                  borderRadius: 3,
                  background: isSelected ? 'linear-gradient(135deg, #FFD700, #C8A200)' : 'rgba(255,255,255,0.03)',
                  border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  color: isSelected ? '#000' : isWeekend ? 'rgba(255,130,130,0.7)' : 'rgba(255,255,255,0.58)',
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                {day}
              </button>
              {isSelected ? (
                <select
                  value={partLabel}
                  onChange={event => onChangeDayParts(prev => ({ ...prev, [day]: event.target.value }))}
                  style={{
                    width: '100%',
                    height: 34,
                    borderRadius: 3,
                    background: '#111',
                    border: '1px solid rgba(255,215,0,0.22)',
                    color: '#E2E2E2',
                    fontSize: 11,
                    fontWeight: 800,
                    outline: 'none',
                    padding: '0 6px',
                  }}
                >
                  {PART_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <div style={{
                  width: '100%',
                  height: 34,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.22)',
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  {partLabel}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{
        padding: '14px 16px', borderRadius: 4,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        fontSize: 12.5, color: 'rgba(255,255,255,0.38)',
        lineHeight: 1.6,
      }}>
        선택된 요일 수: <strong style={{ color: '#FFD700' }}>{workDays.length}</strong>일
      </div>
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
        운동 목표
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
        세션당 운동 시간
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
      video_url: ex.video_url || '',
      image_url: ex.image_url || '',
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
          id: alt.id,
          name: alt.name,
          eq: alt.eq,
          detail: alt.detail,
          targetPain: alt.targetPain,
          gif: alt.gif,
          video_url: alt.video_url,
          image_url: alt.image_url,
          category: alt.category
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

const buildLocalGifPath = (exercise) => {
  if (!exercise?.category || !exercise?.id || !exercise?.name_kor) return '/workout_guide.png'
  return `/gifs/${encodeURIComponent(exercise.category)}/${exercise.id}_${encodeURIComponent(exercise.name_kor)}.gif`
}

const normalizeRepsForSave = (reps) => {
  if (typeof reps === 'number') return reps
  const match = String(reps || '').match(/\d+/)
  return match ? Number(match[0]) : 10
}

const DAY_PART_TO_TARGET = {
  '가슴': 'CHEST',
  '등': 'BACK',
  '하체': 'LEG',
  '어깨': 'SHOULDER',
  '팔': 'ARM',
  '팔/코어': 'ARM',
  '이두': 'ARM',
  '삼두': 'ARM',
  '전완근': 'ARM',
}

const normalizeDayTarget = (value) => {
  const raw = Array.isArray(value) ? value.find(Boolean) : value
  const text = String(raw || '').trim()
  return DAY_PART_TO_TARGET[text] || text.toUpperCase()
}

const mapRecommendedRoutineToWorkoutRoutine = (routineDraft, workDays, dbExercises, dayParts = {}) => {
  const exerciseMap = new Map((dbExercises || []).map(ex => [Number(ex.id), ex]))
  const exerciseNameMap = new Map((dbExercises || []).map(ex => [ex.name_kor, ex]))
  const mapped = {}
  const days = routineDraft?.days || []
  const daysByTarget = new Map()
  days.forEach(day => {
    const target = String(day?.target || '').trim().toUpperCase()
    if (!target) return
    const queue = daysByTarget.get(target) || []
    queue.push(day)
    daysByTarget.set(target, queue)
  })

  workDays.forEach((day, index) => {
    const target = normalizeDayTarget(dayParts[day])
    const targetQueue = daysByTarget.get(target) || []
    const recommendedDay = targetQueue.shift() || days.find(item => String(item?.target || '').trim().toUpperCase() === target) || days[index] || {}
    mapped[day] = (recommendedDay.exercises || []).map((ex, exIndex) => {
      const dbEx = exerciseMap.get(Number(ex.exercise_id)) || exerciseNameMap.get(ex.name)
      const exerciseId = ex.exercise_id || dbEx?.id || null
      const targetPain = getTargetPainForExercise(dbEx?.name_kor || ex.name, dbEx?.category)
      return {
        id: exerciseId,
        slot_key: `${day}-${exIndex}-${exerciseId || ex.name}`,
        name: dbEx?.name_kor || ex.name,
        sets: ex.sets || 3,
        reps: normalizeRepsForSave(ex.reps),
        recommended_sets: ex.sets || 3,
        recommended_reps: normalizeRepsForSave(ex.reps),
        rest_seconds: ex.rest_seconds,
        eq: dbEx?.equipment || ex.equipment || 'body',
        detail: dbEx?.guide || '',
        targetPain,
        gif: buildLocalGifPath(dbEx),
        video_url: dbEx?.video_url || '',
        image_url: dbEx?.image_url || '',
        category: dbEx?.category || recommendedDay.target || '',
        caution: dbEx?.caution || '',
        spine_loading: dbEx?.spine_loading || '',
        alternatives: [],
      }
    })
  })

  return mapped
}

const summarizeRoutineChanges = (beforeRoutine, afterRoutine, workDays, dayParts) => {
  if (!beforeRoutine || !afterRoutine) return []

  const changes = []
  workDays.forEach(day => {
    const before = beforeRoutine[day] || []
    const after = afterRoutine[day] || []
    const maxLen = Math.max(before.length, after.length)

    for (let index = 0; index < maxLen; index += 1) {
      const prevEx = before[index]
      const nextEx = after[index]
      const label = `${day}요일 ${dayParts[day] || ''}`.trim()

      if (prevEx && nextEx && prevEx.name !== nextEx.name) {
        changes.push({
          type: '교체',
          day: label,
          before: prevEx.name,
          after: nextEx.name,
        })
        continue
      }

      if (!prevEx && nextEx) {
        changes.push({
          type: '추가',
          day: label,
          before: '',
          after: nextEx.name,
        })
        continue
      }

      if (prevEx && !nextEx) {
        changes.push({
          type: '제거',
          day: label,
          before: prevEx.name,
          after: '',
        })
        continue
      }

      if (prevEx && nextEx && (prevEx.sets !== nextEx.sets || prevEx.reps !== nextEx.reps)) {
        changes.push({
          type: '볼륨 조정',
          day: label,
          before: `${prevEx.sets}세트 ${prevEx.reps}회`,
          after: `${nextEx.sets}세트 ${nextEx.reps}회`,
        })
      }
    }
  })

  return changes
}

export default function RoutinePage() {
  const navigate = useNavigate()
  const [authUser, setAuthUser] = useState(null) // null = 게스트 또는 로딩 전
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    getMe()
      .then((u) => setAuthUser(u))
      .catch(() => setAuthUser(null))
      .finally(() => setAuthChecked(true))
  }, [])

  const [step, setStep] = useState(0)
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [level, setLevel] = useState('')
  const [painParts, setPainParts] = useState([])
  const [workDays, setWorkDays] = useState(DEFAULT_WORK_DAYS)
  const [splitStyle, setSplitStyle] = useState('bodybuilding')
  const [goal, setGoal] = useState('')
  const [sessionMin, setSessionMin] = useState(null)
  const [showAutoWarning, setShowAutoWarning] = useState(false)
  const [dayParts, setDayParts] = useState(DEFAULT_DAY_PARTS)
  const [dbExercises, setDbExercises] = useState([])
  const [loadingExercises, setLoadingExercises] = useState(true)
  const [loadingRoutine, setLoadingRoutine] = useState(true)
  const [preloadedWorkoutRoutine, setPreloadedWorkoutRoutine] = useState(null)
  const [preloadedDailyNotes, setPreloadedDailyNotes] = useState(null)
  const [recommendationThreadId, setRecommendationThreadId] = useState('')
  const [reviewPayload, setReviewPayload] = useState(null)
  const [reviewFeedback, setReviewFeedback] = useState('')
  const [recommendationError, setRecommendationError] = useState('')
  const [isGeneratingRoutine, setIsGeneratingRoutine] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewAction, setReviewAction] = useState('')
  const [isApproved, setIsApproved] = useState(false)
  const [showApprovedNotice, setShowApprovedNotice] = useState(false)
  const [reviewNotice, setReviewNotice] = useState(null)

  const loadingDb = loadingExercises || loadingRoutine

  //아래 useEffect 처리 내용 중 루틴 처리 부분을 함수로 분리 
  //로그인 후 회원 루틴을 다시 불러오는 경우가 있어 별도 함수로 뺴서 함수만 호출하기 위해 따로 분리함 
  const loadWeeklyRoutine = () => {
    setLoadingRoutine(true)
    const { year, weekNumber } = getISOWeekAndYear(new Date())
    fetch(
      `${API_URL}/api/routines/?device_uuid=${deviceUuid}&year=${year}&week_number=${weekNumber}`,
      { credentials: 'include' },
    )
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
          setIsApproved(true)
          setShowApprovedNotice(false)
          setStep(SURVEY_STEP_COUNT)
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
      })
  }

  useEffect(() => {
    // 1. Fetch DB Exercises
    fetch(`${API_URL}/api/exercises/`)
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
  }, [])

  // 유저 인증 여부 체크, 인증 안되면 리턴 
  useEffect(() => {
    if (!authChecked) return 
    loadWeeklyRoutine()
  }, [authChecked, authUser])


  useEffect(() => {
    if (!showApprovedNotice) return undefined
    const timer = setTimeout(() => setShowApprovedNotice(false), 7000)
    return () => clearTimeout(timer)
  }, [showApprovedNotice])

  useEffect(() => {
    const hasPainHistory = painParts.some(part => part && part !== 'none')
    if (!goal && (Number(age) >= 50 || hasPainHistory)) {
      setGoal('maintenance')
    }
  }, [age, painParts, goal])

  const buildSurveyPayload = () => ({
    device_uuid: deviceUuid,
    age: Number(age),
    gender,
    level,
    place: 'gym',
    available_equipment: ALL_EQUIPMENT_KEYS,
    pain_parts: painParts,
    split_style: splitStyle,
    work_days: workDays,
    day_parts: workDays.reduce((acc, day) => {
      acc[day] = dayParts[day]
      return acc
    }, {}),
    goal,
    session_min: sessionMin,
  })

  const saveRoutineToDb = async (routine, notes = {}) => {
    const { year, weekNumber } = getISOWeekAndYear(new Date())
    const payload = {
      device_uuid: deviceUuid,
      year,
      week_number: weekNumber,
      split_style: splitStyle,
      goal,
      session_min: sessionMin,
      pain_parts: painParts,
      work_days: workDays,
      day_parts: workDays.reduce((acc, day) => {
        acc[day] = dayParts[day]
        return acc
      }, {}),
      workout_routine: routine,
      daily_notes: notes,
    }

    const res = await fetch(`${API_URL}/api/routines/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('추천 루틴 저장에 실패했습니다.')
    return res.json()
  }

  const applyRecommendationResult = (data) => {
    if (!data.ok) {
      setRecommendationError(data.message || '추천 루틴 생성에 실패했습니다.')
      return false
    }
    const mappedRoutine = mapRecommendedRoutineToWorkoutRoutine(data.routine_draft, workDays, dbExercises, dayParts)
    setRecommendationThreadId(data.thread_id || '')
    setReviewPayload(data)
    setPreloadedWorkoutRoutine(mappedRoutine)
    setPreloadedDailyNotes({})
    setStep(TOTAL)
    return true
  }

  const handleCreateRecommendation = async () => {
    if (loadingDb || isGeneratingRoutine) return
    setRecommendationError('')
    setIsGeneratingRoutine(true)
    setReviewAction('')
    setIsApproved(false)
    setShowApprovedNotice(false)
    setReviewNotice(null)
    try {
      const res = await fetch(`${API_URL}/api/routines/recommend/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(buildSurveyPayload()),
      })
      const data = await res.json()
      if (!res.ok || !applyRecommendationResult(data)) {
        setRecommendationError(data.message || '추천 루틴 생성에 실패했습니다.')
      }
    } catch (err) {
      setRecommendationError(err.message || '추천 API 호출 중 오류가 발생했습니다.')
    } finally {
      setIsGeneratingRoutine(false)
    }
  }

  const handleReview = async (decision) => {
    if (!recommendationThreadId || isReviewing) return
    setRecommendationError('')
    setReviewAction(decision)
    setIsReviewing(true)
    try {
      const res = await fetch(`${API_URL}/api/routines/recommend/review/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          device_uuid: deviceUuid,
          thread_id: recommendationThreadId,
          decision,
          feedback: decision === 'approve' ? '' : reviewFeedback,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setRecommendationError(data.message || '검토 요청 처리에 실패했습니다.')
        return
      }
      const previousRoutine = preloadedWorkoutRoutine
      const nextRoutine = mapRecommendedRoutineToWorkoutRoutine(data.routine_draft, workDays, dbExercises, dayParts)
      const routineChanges = summarizeRoutineChanges(previousRoutine, nextRoutine, workDays, dayParts)
      applyRecommendationResult(data)
      if (decision !== 'approve') {
        setReviewNotice({
          title: '수정 요청 반영 완료',
          message: '입력한 피드백을 바탕으로 추천 루틴을 다시 구성했습니다.',
          changes: routineChanges,
        })
      }
      if (data.status === 'completed') {
        setIsApproved(true)
        setShowApprovedNotice(true)
        await saveRoutineToDb(nextRoutine, {})
      }
      setReviewFeedback('')
    } catch (err) {
      setRecommendationError(err.message || '검토 API 호출 중 오류가 발생했습니다.')
    } finally {
      setIsReviewing(false)
      setReviewAction('')
    }
  }

  const canNext = [
    Number(age) > 0 && gender !== '' && level !== '',
    painParts.length > 0,
    workDays.length > 0,
    goal !== '',
    sessionMin !== null,
  ][step]

  const loadingOverlay = isGeneratingRoutine
    ? {
        title: '추천 루틴 설계 중...',
        message: '운동 후보를 검토하고 AI 루틴 구성을 진행하고 있습니다. 잠시만 기다려주세요.',
      }
    : isReviewing
      ? reviewAction === 'approve'
        ? {
            title: '최종 승인 저장 중...',
            message: '승인된 추천 루틴을 이번 주 루틴으로 저장하고 있습니다.',
          }
        : {
            title: '피드백 반영 중...',
            message: '입력한 수정 요청을 바탕으로 운동 후보를 다시 검토하고 루틴을 재구성하고 있습니다.',
          }
      : null

  const steps = [
    <StepProfile
      age={age}
      gender={gender}
      level={level}
      onAgeChange={setAge}
      onGenderChange={setGender}
      onLevelChange={setLevel}
    />,
    <Step1 value={painParts} onChange={setPainParts} />,
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
    setAge('')
    setGender('')
    setLevel('')
    setPainParts([])
    setWorkDays(DEFAULT_WORK_DAYS)
    setSplitStyle('bodybuilding')
    setGoal('')
    setSessionMin(null)
    setDayParts(DEFAULT_DAY_PARTS)
    setPreloadedWorkoutRoutine(null)
    setPreloadedDailyNotes(null)
    setRecommendationThreadId('')
    setReviewPayload(null)
    setReviewFeedback('')
    setRecommendationError('')
    setReviewAction('')
    setIsApproved(false)
    setShowApprovedNotice(false)
    setReviewNotice(null)
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
        padding: '100px 20px 60px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}>
        {!isApproved && reviewPayload?.status === 'needs_review' && (
          <HumanReviewPanel
            validation={reviewPayload.validation_result}
            feedback={reviewFeedback}
            onFeedbackChange={setReviewFeedback}
            onApprove={() => handleReview('approve')}
            onRevise={() => handleReview('revise')}
            isSubmitting={isReviewing}
            error={recommendationError}
          />
        )}
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
          authUser={authUser}
          onLoginClick={() => navigate('/login')}
          disableAutoSave={!isApproved}
        />
        {isApproved && showApprovedNotice && (
          <div style={{
            position: 'fixed',
            left: 24,
            bottom: 24,
            maxWidth: 360,
            padding: '14px 16px',
            borderRadius: 4,
            background: 'rgba(17,17,17,0.96)',
            border: '1px solid rgba(255,215,0,0.25)',
            color: '#E2E2E2',
            fontSize: 12,
            lineHeight: 1.6,
            boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
          }}>
            <button
              type="button"
              aria-label="저장 알림 닫기"
              onClick={() => setShowApprovedNotice(false)}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 24,
                height: 24,
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.65)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
            <div style={{ paddingRight: 24, fontWeight: 800, color: '#FFF' }}>
              최종 승인된 추천 루틴이 저장되었습니다.
            </div>
            <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.45)' }}>
              운동 목록과 상세 가이드는 현재 화면에서 확인할 수 있습니다.
            </div>
          </div>
        )}
        {reviewNotice && (
          <div
            onClick={() => setReviewNotice(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 4200,
              background: 'rgba(0,0,0,0.62)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 460,
                borderRadius: 4,
                background: '#111',
                border: '1px solid rgba(255,215,0,0.28)',
                boxShadow: '0 24px 70px rgba(0,0,0,0.68)',
                padding: '28px 28px 24px',
                color: '#E2E2E2',
                position: 'relative',
              }}
            >
              <button
                type="button"
                aria-label="수정 요청 완료 알림 닫기"
                onClick={() => setReviewNotice(null)}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgba(255,255,255,0.68)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={15} />
              </button>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 4,
                background: 'rgba(255,215,0,0.12)',
                border: '1px solid rgba(255,215,0,0.32)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 18,
              }}>
                <Check size={24} color="#FFD700" strokeWidth={3} />
              </div>
              <div style={{
                fontSize: 10,
                letterSpacing: 2,
                color: '#FFD700',
                fontWeight: 900,
                marginBottom: 7,
              }}>
                HUMAN FEEDBACK APPLIED
              </div>
              <h3 style={{
                margin: 0,
                color: '#FFF',
                fontSize: 22,
                lineHeight: 1.35,
                fontWeight: 900,
              }}>
                {reviewNotice.title}
              </h3>
              <p style={{
                margin: '12px 0 14px',
                color: 'rgba(255,255,255,0.58)',
                fontSize: 13,
                lineHeight: 1.75,
              }}>
                {reviewNotice.message}
              </p>
              <div style={{
                margin: '0 0 22px',
                padding: '14px 14px',
                borderRadius: 4,
                background: 'rgba(0,0,0,0.18)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <div style={{
                  fontSize: 11,
                  color: '#FFD700',
                  fontWeight: 900,
                  marginBottom: 10,
                  letterSpacing: 0.5,
                }}>
                  실제 변경사항
                </div>
                {reviewNotice.changes?.length > 0 ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {reviewNotice.changes.slice(0, 6).map((change, index) => (
                        <div
                          key={`${change.day}-${change.type}-${index}`}
                          style={{
                            paddingBottom: index === Math.min(reviewNotice.changes.length, 6) - 1 ? 0 : 9,
                            borderBottom: index === Math.min(reviewNotice.changes.length, 6) - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 5,
                            flexWrap: 'wrap',
                          }}>
                            <span style={{
                              fontSize: 9,
                              fontWeight: 900,
                              color: '#050505',
                              background: '#FFD700',
                              borderRadius: 3,
                              padding: '2px 5px',
                            }}>
                              {change.type}
                            </span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', fontWeight: 700 }}>
                              {change.day}
                            </span>
                          </div>
                          {change.before && change.after ? (
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 1.55 }}>
                              <span style={{ color: 'rgba(255,255,255,0.38)' }}>{change.before}</span>
                              <span style={{ color: '#FFD700', padding: '0 7px' }}>→</span>
                              <span style={{ color: '#FFF', fontWeight: 800 }}>{change.after}</span>
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: '#FFF', fontWeight: 800, lineHeight: 1.55 }}>
                              {change.after || change.before}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {reviewNotice.changes.length > 6 && (
                      <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.42)' }}>
                        외 {reviewNotice.changes.length - 6}건의 변경사항이 더 있습니다.
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>
                    운동명 기준의 큰 변경은 감지되지 않았습니다. 세부 조건이나 검증 결과가 조정되었는지 루틴 내용을 확인해주세요.
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setReviewNotice(null)}
                style={{
                  width: '100%',
                  padding: '13px 0',
                  borderRadius: 4,
                  background: 'linear-gradient(135deg, #FFD700, #C8A200)',
                  border: 'none',
                  color: '#000',
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                변경된 루틴 확인하기
              </button>
            </div>
          </div>
        )}
        {loadingOverlay && (
          <LoadingOverlay title={loadingOverlay.title} message={loadingOverlay.message} />
        )}
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080808',
      padding: '90px 20px 60px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: 640 }}>

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
                disabled={!canNext || isGeneratingRoutine}
                onClick={() => {
                  if (step === TOTAL - 1) {
                    handleCreateRecommendation()
                  } else {
                    setStep(s => s + 1)
                  }
                }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '13px 24px', borderRadius: 3,
                  background: canNext && !isGeneratingRoutine ? 'linear-gradient(135deg, #FFD700, #C8A200)' : 'rgba(255,255,255,0.05)',
                  border: 'none',
                  color: canNext && !isGeneratingRoutine ? '#000' : 'rgba(255,255,255,0.2)',
                  fontSize: 14, fontWeight: 700, cursor: canNext && !isGeneratingRoutine ? 'pointer' : 'default',
                  transition: 'all 0.25s',
                  boxShadow: canNext && !isGeneratingRoutine ? '0 4px 20px rgba(255,215,0,0.2)' : 'none',
                }}
              >
                {isGeneratingRoutine ? '추천 생성 중...' : step === TOTAL - 1 ? 'AI 추천 루틴 생성하기' : '다음 단계'} <ChevronRight size={15} />
              </button>
            </div>
            {recommendationError && (
              <div style={{ marginTop: 14, color: '#FF8A8A', fontSize: 12, lineHeight: 1.6 }}>
                {recommendationError}
              </div>
            )}

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
            <div style={{ fontSize: 12, letterSpacing: 2, color: '#FFD700', fontWeight: 800, marginBottom: 14 }}>NOTICE</div>
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
                setAge(age || '28')
                setGender(gender || 'male')
                setLevel('intermediate')
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
      {loadingOverlay && (
        <LoadingOverlay title={loadingOverlay.title} message={loadingOverlay.message} />
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

const GOAL_LABEL = {
  hypertrophy: '근비대 훈련',
  diet: '다이어트 훈련',
  strength: '스트렝스 훈련',
  maintenance: '체력 유지 훈련'
}

function LoadingOverlay({ title, message }) {
  if (!title) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 5000,
      background: 'rgba(0,0,0,0.68)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <style>{`
        @keyframes routine-overlay-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes routine-overlay-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
      `}</style>
      <div style={{
        width: '100%',
        maxWidth: 430,
        borderRadius: 4,
        background: '#111',
        border: '1px solid rgba(255,215,0,0.28)',
        boxShadow: '0 24px 70px rgba(0,0,0,0.7)',
        padding: '34px 30px 30px',
        textAlign: 'center',
        color: '#E2E2E2',
      }}>
        <div style={{
          width: 54,
          height: 54,
          margin: '0 auto 22px',
          borderRadius: '50%',
          border: '4px solid rgba(255,215,0,0.12)',
          borderTopColor: '#FFD700',
          animation: 'routine-overlay-spin 0.9s linear infinite',
        }} />
        <div style={{
          fontSize: 10,
          letterSpacing: 2,
          color: '#FFD700',
          fontWeight: 900,
          marginBottom: 8,
          animation: 'routine-overlay-pulse 1.5s ease-in-out infinite',
        }}>
          AI ROUTINE PROCESSING
        </div>
        <h3 style={{
          margin: 0,
          color: '#FFF',
          fontSize: 23,
          lineHeight: 1.35,
          fontWeight: 900,
        }}>
          {title}
        </h3>
        {message && (
          <p style={{
            margin: '12px 0 0',
            color: 'rgba(255,255,255,0.55)',
            fontSize: 13,
            lineHeight: 1.75,
          }}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

function HumanReviewPanel({
  validation,
  feedback,
  onFeedbackChange,
  onApprove,
  onRevise,
  isSubmitting,
  error,
}) {
  return (
    <div style={{
      width: '100%',
      maxWidth: 1200,
      marginTop: 24,
      padding: '24px 28px',
      borderRadius: 4,
      background: '#111',
      border: '1px solid rgba(255,215,0,0.18)',
      boxShadow: '0 18px 44px rgba(0,0,0,0.42)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: '#FFD700', fontWeight: 800, marginBottom: 6 }}>
            HUMAN REVIEW REQUIRED
          </div>
          <div style={{ fontSize: 18, color: '#FFF', fontWeight: 900 }}>추천 루틴 최종 검토</div>
        </div>
        {validation && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.48)', lineHeight: 1.6, textAlign: 'right' }}>
            valid={String(validation.is_valid)} · risk={validation.risk_level || 'unknown'}
            {validation.reason && <div>{validation.reason}</div>}
          </div>
        )}
      </div>
      <textarea
        value={feedback}
        onChange={e => onFeedbackChange(e.target.value)}
        placeholder="수정 요청이 있으면 입력하세요. 예: 허리에 부담이 적게 해주세요."
        style={{
          width: '100%',
          minHeight: 86,
          boxSizing: 'border-box',
          padding: '13px 14px',
          borderRadius: 4,
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#E2E2E2',
          fontSize: 13,
          lineHeight: 1.6,
          outline: 'none',
          resize: 'vertical',
          marginBottom: 14,
        }}
      />
      {error && <div style={{ color: '#FF8A8A', fontSize: 12, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={isSubmitting || !feedback.trim()}
          onClick={onRevise}
          style={{
            padding: '12px 18px',
            borderRadius: 4,
            background: feedback.trim() ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: feedback.trim() ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.25)',
            fontSize: 13,
            fontWeight: 800,
            cursor: feedback.trim() && !isSubmitting ? 'pointer' : 'default',
          }}
        >
          {isSubmitting ? '처리 중...' : '수정 요청 보내기'}
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onApprove}
          style={{
            padding: '12px 22px',
            borderRadius: 4,
            background: 'linear-gradient(135deg, #FFD700, #C8A200)',
            border: 'none',
            color: '#000',
            fontSize: 13,
            fontWeight: 900,
            cursor: isSubmitting ? 'default' : 'pointer',
          }}
        >
          {isSubmitting ? '저장 중...' : '승인하고 저장하기'}
        </button>
      </div>
    </div>
  )
}

function RoutineCheckView({
  workDays, goal, splitStyle, sessionMin, painParts, dayParts, onReset, dbExercises,
  initialWorkoutRoutine, initialDailyNotes, authUser, onLoginClick,
  disableAutoSave = false
}) {
  const [activeDay, setActiveDay] = useState(workDays[0] || '월')
  const getSlotKey = (day, ex, index) => ex.slot_key || `${day}-${index}-${ex.id || ex.name}`
  const [completedExercises, setCompletedExercises] = useState(() => {
    const initial = {}
    if (initialWorkoutRoutine) {
      Object.entries(initialWorkoutRoutine).forEach(([day, exs]) => {
        exs.forEach((ex, index) => {
          if (ex.is_completed) {
            initial[getSlotKey(day, ex, index)] = true
          }
        })
      })
    }
    return initial
  })
  const [dailyNotes, setDailyNotes] = useState(initialDailyNotes || {})
  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [isSavingChanges, setIsSavingChanges] = useState(false)
  const [changeMessage, setChangeMessage] = useState('')
  const [saveError, setSaveError] = useState('')
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
  const saveRoutineToDb = async (routine, notes, completedMap) => {
    const { year, weekNumber } = getISOWeekAndYear(new Date());
    
    const updatedRoutine = {}
    Object.keys(routine).forEach(day => {
      updatedRoutine[day] = routine[day].map((ex, index) => ({
        ...ex,
        is_completed: !!completedMap[getSlotKey(day, ex, index)]
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

    const response = await fetch(`${API_URL}/api/routines/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(payload)
    })
    if (!response.ok) {
      throw new Error('루틴 저장에 실패했습니다.')
    }
    return response.json()
  };

  // Auto-save on mount if it's a fresh routine
  useEffect(() => {
    if (!disableAutoSave && (!initialWorkoutRoutine || Object.keys(initialWorkoutRoutine).length === 0)) {
      saveRoutineToDb(workoutRoutine, dailyNotes, completedExercises)
        .catch(err => console.error('Error saving routine to DB:', err));
    }
  }, []);

  // activeDay가 workDays에 없으면 첫번째 값으로 안전장치
  const currentDay = workDays.includes(activeDay) ? activeDay : (workDays[0] || '월')
  const currentDayExercises = workoutRoutine[currentDay] || []

  // 2. State for the highlighted exercise details panel
  const [selectedSlotKey, setSelectedSlotKey] = useState(() => {
    const initialDay = workDays[0] || '월'
    const dayExs = workoutRoutine[initialDay] || []
    return dayExs[0] ? getSlotKey(initialDay, dayExs[0], 0) : null
  })
  const [isExerciseVideoPlaying, setIsExerciseVideoPlaying] = useState(true)
  const exerciseVideoRef = useRef(null)

  // Safe reference to the active exercise object
  const activeEx = currentDayExercises.find((ex, index) => getSlotKey(currentDay, ex, index) === selectedSlotKey) || currentDayExercises[0]

  useEffect(() => {
    setIsExerciseVideoPlaying(true)
  }, [currentDay, selectedSlotKey])

  useEffect(() => {
    if (!activeEx?.video_url || !exerciseVideoRef.current) return
    const video = exerciseVideoRef.current
    if (isExerciseVideoPlaying) {
      video.play().catch(() => {
        // Muted inline videos should autoplay, but blocked playback can be ignored.
      })
    } else {
      video.pause()
    }
  }, [isExerciseVideoPlaying, activeEx?.video_url])

  const handleExerciseVideoClick = () => {
    setIsExerciseVideoPlaying(prev => !prev)
  }

  // Update highlighted exercise when switching tabs
  const handleDayChange = (day) => {
    setActiveDay(day)
    const dayExs = workoutRoutine[day] || []
    if (dayExs.length > 0) {
      setSelectedSlotKey(getSlotKey(day, dayExs[0], 0))
    } else {
      setSelectedSlotKey(null)
    }
  }

  // Swap exercise with an alternative option
  const handleSwapExercise = (alternativeEx) => {
    if (!activeEx) return
    const targetSlotKey = selectedSlotKey

    setWorkoutRoutine(prev => {
      const currentDayExs = prev[currentDay] || []
      const nextDayExs = currentDayExs.map((ex, index) => {
        if (getSlotKey(currentDay, ex, index) === targetSlotKey) {
          // Prepend original exercise to alternatives so the user can easily swap back
          const originalAsAlternative = {
            id: ex.id,
            name: ex.name,
            eq: ex.eq,
            detail: ex.detail,
            targetPain: ex.targetPain,
            gif: ex.gif,
            video_url: ex.video_url,
            image_url: ex.image_url,
            category: ex.category,
            alternatives: ex.alternatives
          }
          const updatedAlts = [
            originalAsAlternative,
            ...(alternativeEx.alternatives || []).filter(alt => alt.name !== ex.name)
          ]

          return {
            ...ex,
            id: alternativeEx.id || ex.id,
            slot_key: ex.slot_key || targetSlotKey,
            name: alternativeEx.name,
            eq: alternativeEx.eq,
            detail: alternativeEx.detail,
            targetPain: alternativeEx.targetPain,
            gif: alternativeEx.gif,
            video_url: alternativeEx.video_url || '',
            image_url: alternativeEx.image_url || '',
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
      [targetSlotKey]: false
    }))
    setChangeMessage(`${alternativeEx.name} 운동으로 교체했습니다.`)
    setSaveError('')
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
  const completedCount = workDays.reduce((acc, day) => {
    const exs = workoutRoutine[day] || []
    return acc + exs.filter((ex, index) => completedExercises[getSlotKey(day, ex, index)]).length
  }, 0)
  const progressPercent = totalExercises > 0 ? Math.round((completedCount / totalExercises) * 100) : 0

  const handleNoteChange = (text) => {
    setDailyNotes(prev => ({
      ...prev,
      [currentDay]: text
    }))
    setChangeMessage(`${currentDay}요일 메모가 수정되었습니다.`)
    setSaveError('')
    setIsDirty(true)
  }

  const handleSaveSessionChanges = async () => {
    if (isSavingChanges) return
    setIsSavingChanges(true)
    setSaveError('')
    try {
      await saveRoutineToDb(workoutRoutine, dailyNotes, completedExercises)
      setIsDirty(false)
      setChangeMessage('변경사항이 저장되었습니다.')
      setIsSavedModalOpen(true)
    } catch (err) {
      setSaveError(err.message || '루틴 저장에 실패했습니다.')
    } finally {
      setIsSavingChanges(false)
    }
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
            <span>{splitStyle === 'bodybuilding' ? '보디빌딩 5분할' : splitStyle === 'lower_core' ? '하체/코어 강화' : '스트렝스 중심'}</span>
            <span style={{ width: 4, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.2)' }} />
            <span>세션당 {sessionMin}분</span>
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
        <div style={{ display: 'flex', alignItems: 'center', gap:10 }}>
          <button
            onClick={() => { if (!authUser) onLoginClick() }}
            style={{
              display: 'flex', alignItems: 'center', gap:8,
              padding: '8px 14px', borderRadius: 4,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              cursor: authUser ? 'default' : 'pointer',
            }}
          >
            <span style={{ fontSize: 13 }}>👤</span>
            <span style={{ fontSize: 13, color: 'rgba(226,226,226,0.75)', fontWeight: 500 }}>
              {authUser ? authUser.nickname : '게스트'}
            </span>
          </button>
        
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

            {currentDayExercises.map((ex, index) => {
              const slotKey = getSlotKey(currentDay, ex, index)
              const isDone = !!completedExercises[slotKey]
              const isWarned = ex.targetPain && painParts.includes(ex.targetPain)
              const isSelected = slotKey === selectedSlotKey
              const { sets, reps } = getScaledSetsReps(ex)

              return (
                <div
                  key={slotKey}
                  onClick={() => setSelectedSlotKey(slotKey)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 20,
                    padding: '20px 16px',
                    borderRadius: 4,
                    border: `1px solid ${
                      isSelected
                        ? 'rgba(255,215,0,0.45)'
                        : isDone
                          ? 'rgba(55, 210, 145, 0.28)'
                          : 'transparent'
                    }`,
                    background: isSelected
                      ? 'rgba(255,215,0,0.035)'
                      : isDone
                        ? 'rgba(55, 210, 145, 0.075)'
                        : 'transparent',
                    borderBottom: !isSelected && !isDone ? '1px solid rgba(255,255,255,0.04)' : undefined,
                    boxShadow: isDone ? 'inset 3px 0 0 rgba(55, 210, 145, 0.75)' : 'none',
                    transition: 'all 0.25s',
                    cursor: 'pointer',
                    marginBottom: 4,
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.background = isDone ? 'rgba(55, 210, 145, 0.11)' : 'rgba(255,255,255,0.01)'
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.background = isDone ? 'rgba(55, 210, 145, 0.075)' : 'transparent'
                  }}
                >
                  {/* 완료 토글 체크박스 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const nextDone = !completedExercises[slotKey]
                      setCompletedExercises(prev => ({ ...prev, [slotKey]: nextDone }))
                      setChangeMessage(nextDone ? `${ex.name} 운동을 완료 처리했습니다.` : `${ex.name} 완료 처리를 해제했습니다.`)
                      setSaveError('')
                      setIsDirty(true)
                    }}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 4,
                      cursor: 'pointer',
                      background: isDone ? '#37D291' : 'rgba(255,255,255,0.02)',
                      border: isDone ? 'none' : '1px solid rgba(255,255,255,0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                  >
                    {isDone && <Check size={16} color="#050505" strokeWidth={3.5} />}
                  </button>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', padding: '2px 8px', borderRadius: 4 }}>
                        {EQUIPMENT_LABEL[ex.eq] || '기타'}
                      </span>
                      
                      <span style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#FFF',
                      }}>
                        {ex.name}
                      </span>

                      {isDone && (
                        <span style={{
                          fontSize: 9,
                          fontWeight: 800,
                          background: 'rgba(55,210,145,0.14)',
                          border: '1px solid rgba(55,210,145,0.32)',
                          color: '#6EF0B5',
                          padding: '2px 6px',
                          borderRadius: 4,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}>
                          <Check size={8} /> 완료
                        </span>
                      )}

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
                    <div style={{ fontSize: 15, fontWeight: 700, color: isDone ? '#6EF0B5' : '#FFD700' }}>
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
                {currentDay}요일 피드백 및 데일리 이슈 (예: 통증, 피로도)
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

            {(isDirty || changeMessage || saveError) && (
              <div style={{
                marginTop: 16,
                padding: '12px 14px',
                borderRadius: 4,
                background: saveError
                  ? 'rgba(255, 100, 100, 0.08)'
                  : isDirty
                    ? 'rgba(255, 215, 0, 0.08)'
                    : 'rgba(55, 210, 145, 0.08)',
                border: `1px solid ${
                  saveError
                    ? 'rgba(255, 100, 100, 0.22)'
                    : isDirty
                      ? 'rgba(255, 215, 0, 0.22)'
                      : 'rgba(55, 210, 145, 0.22)'
                }`,
                color: saveError ? '#FF8A8A' : isDirty ? '#FFD700' : '#6EF0B5',
                fontSize: 12,
                lineHeight: 1.55,
                fontWeight: 700,
              }}>
                {saveError || changeMessage}
                {isDirty && !saveError && (
                  <div style={{ marginTop: 3, color: 'rgba(255,255,255,0.42)', fontWeight: 500 }}>
                    저장 버튼을 눌러야 이번 주 루틴에 반영됩니다.
                  </div>
                )}
              </div>
            )}

            {/* 변경사항 저장 버튼 */}
            {isDirty && (
              <div style={{ marginTop: 16, animation: 'float-up 0.2s ease' }}>
                <button
                  type="button"
                  onClick={handleSaveSessionChanges}
                  disabled={isSavingChanges}
                  style={{
                    width: '100%',
                    padding: '14px 0',
                    borderRadius: 4,
                    background: 'linear-gradient(135deg, #FFD700, #C8A200)',
                    border: 'none',
                    color: '#000',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: isSavingChanges ? 'wait' : 'pointer',
                    opacity: isSavingChanges ? 0.72 : 1,
                    boxShadow: '0 4px 16px rgba(255, 215, 0, 0.2)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  {isSavingChanges ? '저장 중...' : '변경사항 저장'}
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
            }} key={selectedSlotKey || activeEx.name}>
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
                  {EQUIPMENT_LABEL[activeEx.eq]}
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
                {activeEx.video_url ? (
                  <video
                    key={activeEx.video_url}
                    ref={exerciseVideoRef}
                    src={activeEx.video_url}
                    muted
                    loop
                    autoPlay
                    playsInline
                    preload="metadata"
                    onClick={handleExerciseVideoClick}
                    onPlay={() => setIsExerciseVideoPlaying(true)}
                    onPause={() => setIsExerciseVideoPlaying(false)}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      maxHeight: '100%',
                      cursor: 'pointer',
                      display: 'block',
                    }}
                  />
                ) : (
                  <img
                    src={activeEx.gif || activeEx.image_url || '/workout_guide.png'}
                    alt={activeEx.name}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = activeEx.image_url || '/workout_guide.png';
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      maxHeight: '100%',
                    }}
                  />
                )}
              </div>

              {/* 운동 디테일 텍스트 */}
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: '0 0 24px 0', background: 'rgba(0,0,0,0.15)', padding: '12px 14px', borderRadius: 12 }}>
                {activeEx.detail}
              </p>

              {/* 대체 운동 섹션 */}
              {activeEx.alternatives && activeEx.alternatives.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.4)', marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                    이 운동 대신 대체하기 (대체 운동 선택)
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
              왼쪽 리스트에서 운동을 눌러 자세한 가이드와 대체 운동을 확인하세요.
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
            <div style={{ fontSize: 12, letterSpacing: 2, color: '#FFD700', fontWeight: 800, marginBottom: 14 }}>NOTICE</div>
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


