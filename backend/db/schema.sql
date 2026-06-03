-- ================================================================
-- RoutineGraph DDL v3
-- 변경 이력:
--   v1 → v2: user_pain_logs 추가, difficulty 컬럼 추가,
--             day_of_week GENERATED 컬럼, hnsw 인덱스 추가
--   v2 → v3: exercises.difficulty VARCHAR → fitness_level_enum 적용
--             [API 계약 주석] 드래그 앤 드롭 요일 변경 가이드라인 추가
-- ================================================================

-- ────────────────────────────────────────────
-- 확장
-- ────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ────────────────────────────────────────────
-- ENUM 타입 정의
-- ────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE fitness_level_enum AS ENUM ('초급', '중급', '고급');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE sender_enum AS ENUM ('user', 'bot');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE day_of_week_enum AS ENUM ('월', '화', '수', '목', '금', '토', '일');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ────────────────────────────────────────────
-- 1. users
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    user_id       SERIAL PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nickname      VARCHAR(50)  NOT NULL,
    fitness_level fitness_level_enum NOT NULL DEFAULT '초급',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────
-- 2. user_pain_logs
-- 통증 이력을 세션과 분리하여 영속 저장
-- → LLM 1이 다음 세션에서도 재활용 가능
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_pain_logs (
    pain_id     SERIAL PRIMARY KEY,
    user_id     INT REFERENCES users(user_id) ON DELETE CASCADE,
    device_uuid UUID,
    body_part   VARCHAR(50) NOT NULL,
    severity    SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 3),
    logged_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────
-- 3. exercises
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercises (
    exercise_id          INT PRIMARY KEY,
    name_kor             VARCHAR(100) NOT NULL,
    name_eng             VARCHAR(100),
    category             VARCHAR(50)  NOT NULL,
    -- 5분할 메인 타겟: '가슴' | '등' | '하체' | '어깨' | '팔'
    target_primary       VARCHAR(100),
    target_secondary     JSONB,
    -- 보조자극 및 서브 카테고리 배열
    -- 예: ["전면삼각근", "측면삼각근"]
    equipment            VARCHAR(50),
    difficulty           fitness_level_enum NOT NULL DEFAULT '초급',
    -- v3: VARCHAR → fitness_level_enum 통일 (도감 카드 필터 쿼리 가속화)
    default_duration_min INT         NOT NULL DEFAULT 10,
    video_url            VARCHAR(500),
    guide                TEXT,
    caution              TEXT,
    embedding            vector(1536)
);

-- ────────────────────────────────────────────
-- 4. chat_sessions
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
    session_id           SERIAL PRIMARY KEY,
    user_id              INT REFERENCES users(user_id) ON DELETE CASCADE,
    device_uuid          UUID,
    title                VARCHAR(100) NOT NULL DEFAULT '새 상담',
    extracted_conditions JSONB,
    is_converted         BOOLEAN DEFAULT FALSE,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_device_uuid ON chat_sessions(device_uuid);

-- ────────────────────────────────────────────
-- 5. chat_messages
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
    message_id SERIAL PRIMARY KEY,
    session_id INT REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
    sender     sender_enum NOT NULL,
    content    TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────
-- 6. weekly_schedulers
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_schedulers (
    scheduler_id  SERIAL PRIMARY KEY,
    user_id       INT REFERENCES users(user_id) ON DELETE CASCADE,
    device_uuid   UUID,
    session_id    INT REFERENCES chat_sessions(session_id) ON DELETE SET NULL,
    year          INT NOT NULL,
    week_number   INT NOT NULL,
    split_style   VARCHAR(50),
    -- 'bodybuilding' | 'lower_core' | 'strength'
    goal          VARCHAR(50),
    -- 'hypertrophy' | 'diet' | 'strength' | 'maintenance'
    session_min   SMALLINT,
    -- 30 | 45 | 60 | 90 (분)
    pain_parts    JSONB,
    -- 온보딩 1단계 통증 부위 스냅샷: ["shoulder","lower_back"]
    work_days     JSONB,
    -- 온보딩 2단계 운동 요일: ["월","화","목","금","토"]
    weekly_review TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────
-- 7. daily_routines
--
-- ⚠️ [API 계약 - 드래그 앤 드롭 요일 변경]
--
-- day_of_week는 scheduled_date로부터 자동 계산되는 GENERATED 컬럼입니다.
-- 프론트엔드와 백엔드 API 담당자는 반드시 아래 규칙을 따르세요.
--
--   ❌ 잘못된 방식: { day_of_week: "목" }  ← 직접 수정 불가, 에러 발생
--   ✅ 올바른 방식: { scheduled_date: "2026-06-04" }  ← 목요일의 실제 날짜
--
-- 백엔드 로직 순서:
--   1. weekly_schedulers에서 year + week_number 확인
--   2. 타겟 요일(예: 목 = ISO DOW 4) → 해당 주의 실제 날짜 계산
--   3. UPDATE daily_routines SET scheduled_date = '2026-06-04' WHERE ...
--   4. day_of_week는 DB가 GENERATED STORED로 자동 갱신
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_routines (
    daily_routine_id SERIAL PRIMARY KEY,
    scheduler_id     INT  REFERENCES weekly_schedulers(scheduler_id) ON DELETE CASCADE,
    exercise_id      INT  REFERENCES exercises(exercise_id),
    scheduled_date   DATE NOT NULL,
    day_of_week      VARCHAR(3) GENERATED ALWAYS AS (
                         CASE EXTRACT(DOW FROM scheduled_date)::int
                             WHEN 1 THEN '월'
                             WHEN 2 THEN '화'
                             WHEN 3 THEN '수'
                             WHEN 4 THEN '목'
                             WHEN 5 THEN '금'
                             WHEN 6 THEN '토'
                             ELSE        '일'
                         END
                     ) STORED,
    routine_order    FLOAT NOT NULL,
    -- 드래그 앤 드롭 순서 보존용 (중간값 허용: 1.5, 2.3 …)
    -- 주기적 정규화 권장 (값이 수렴하면 1.000000001 식으로 누적됨)
    recommended_sets INT DEFAULT 4,   -- AI 최초 추천 원본
    recommended_reps INT DEFAULT 10,  -- AI 최초 추천 원본
    target_sets      INT DEFAULT 4,   -- 유저 최종 수정본
    target_reps      INT DEFAULT 10,  -- 유저 최종 수정본
    is_custom_added  BOOLEAN DEFAULT FALSE,
    is_completed     BOOLEAN DEFAULT FALSE,
    daily_issue      TEXT,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────
-- 인덱스
-- ────────────────────────────────────────────

-- 기존
CREATE INDEX IF NOT EXISTS idx_chat_messages_session    ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_daily_routines_scheduler ON daily_routines(scheduler_id);
CREATE INDEX IF NOT EXISTS idx_daily_routines_date      ON daily_routines(scheduled_date);

CREATE INDEX IF NOT EXISTS idx_pain_logs_user      ON user_pain_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_exercises_category  ON exercises(category);
CREATE INDEX IF NOT EXISTS idx_exercises_difficulty ON exercises(difficulty);

CREATE INDEX IF NOT EXISTS idx_exercises_embedding
    ON exercises USING hnsw (embedding vector_cosine_ops);