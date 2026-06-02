-- ============================================================
-- Fitness Chatbot - Muscle Knowledge Graph Extension
-- 기존 exercises 테이블과 독립적으로 추가
-- [실행 순서] schema.sql 이후 적용 필요 (exercises 테이블 참조)
-- ============================================================

-- 1) 근육 마스터 테이블
CREATE TABLE IF NOT EXISTS muscles (
    muscle_id    SERIAL       PRIMARY KEY,
    name_kor     VARCHAR(60)  NOT NULL UNIQUE,
    name_eng     VARCHAR(100) NOT NULL,
    muscle_group VARCHAR(30)  NOT NULL,  -- 등 / 가슴 / 어깨 / 회전근개 / 하체 / 코어 / 전신
    action_text  TEXT,                   -- 위키피디아 Action 컬럼 기반 기능 설명
    origin       TEXT,                   -- 기점 (Origin)
    insertion    TEXT                    -- 착점 (Insertion)
);

-- 2) 근육 간 관계성 테이블
CREATE TABLE IF NOT EXISTS muscle_relations (
    relation_id   SERIAL PRIMARY KEY,
    source_muscle INTEGER NOT NULL REFERENCES muscles(muscle_id) ON DELETE CASCADE,
    target_muscle INTEGER NOT NULL REFERENCES muscles(muscle_id) ON DELETE CASCADE,
    relation_type VARCHAR(12) NOT NULL CHECK (relation_type IN ('synergist', 'antagonist', 'part_of')),
    CONSTRAINT uq_muscle_rel UNIQUE (source_muscle, target_muscle, relation_type)
);

-- 3) 운동-근육 브릿지 테이블
-- [설계 의도] PRIMARY KEY (exercise_id, muscle_id): 같은 운동에서 동일 근육은 하나의 역할만 가짐
-- ON CONFLICT DO UPDATE로 재실행 시 role 최신화 보장 (load_muscles.py 참고)
CREATE TABLE IF NOT EXISTS exercise_muscles (
    exercise_id INTEGER NOT NULL REFERENCES exercises(exercise_id) ON DELETE CASCADE,
    muscle_id   INTEGER NOT NULL REFERENCES muscles(muscle_id)    ON DELETE CASCADE,
    role        VARCHAR(10) NOT NULL CHECK (role IN ('primary', 'secondary')),
    PRIMARY KEY (exercise_id, muscle_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_muscle_relations_source ON muscle_relations(source_muscle);
CREATE INDEX IF NOT EXISTS idx_muscle_relations_target ON muscle_relations(target_muscle);
CREATE INDEX IF NOT EXISTS idx_muscle_relations_type   ON muscle_relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_exercise_muscles_mid    ON exercise_muscles(muscle_id);
CREATE INDEX IF NOT EXISTS idx_exercise_muscles_role   ON exercise_muscles(role);