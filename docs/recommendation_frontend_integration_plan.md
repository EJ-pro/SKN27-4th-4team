# Recommendation Frontend Integration Plan

## 1. Integration Principle

이번 연결 작업의 기준은 기존 프론트 임시 루틴 생성 로직이 아니라 `recommendation_service`의 LangGraph 추천 흐름이다.

```text
Frontend survey
-> structured user_profile
-> Django API
-> LangGraph State
-> Recommendation Param Agent
-> Neo4j GraphDB search
-> Routine Composition Agent
-> Routine Validation Agent
-> Human Supervision
-> Final Response Generator
```

따라서 프론트는 추천 서비스가 요구하는 입력 스키마와 출력 스키마에 맞춘다. 기존 화면의 전체 분위기와 레이아웃은 유지하되, 설문 항목과 API 연결 방식은 추천 엔진 기준으로 수정한다.

구현 시 절대 헷갈리면 안 되는 기준:

```text
제거할 것:
- 프론트에서 운동 DB를 직접 훑어서 루틴을 자체 생성하는 로직
- ROUTINE_TEMPLATES 기반 고정 루틴 생성
- generateDynamicTemplateForPart 기반 추천 생성
- AI 추천 실패 시 프론트 임시 루틴으로 자동 대체하는 흐름

살릴 것:
- 기존 루틴 확인 화면의 전체 UX
- 요일별 루틴 탭
- 운동 완료 체크
- 데일리 메모
- 운동 상세 패널
- 운동 영상/GIF/가이드 표시
- 기존 /api/routines/ 저장 흐름
```

즉 추천 생성 주체만 바꾼다. 추천 결과를 보여주는 프론트 경험은 최대한 재사용한다.

## 2. Non-Negotiable UI Rules

- 이모지 사용 금지.
- 필요한 시각 요소는 `lucide-react` 아이콘을 사용한다.
- 적절한 아이콘이 없으면 장식 없이 텍스트만 사용한다.
- 기존 페이지 톤, 색상, 카드형 설문 흐름은 유지한다.
- 기능 추가와 view/API 수정은 가능하다.

## 2-1. Latest Survey Direction Memo

2026-06-05 추가 결정사항.

아래 내용은 이후 설문/추천 연결 수정 시 기존 8단계 설문 설계보다 우선한다.

### 변경 원칙

- `추천 방향 선택` 단계는 설문 페이지에서 제거한다.
- 기존 `자동으로 설정하고 루틴받기` 흐름을 추천 방향 선택의 진입 루트로 사용한다.
- 사용자가 추천 방향을 별도 페이지에서 고르는 대신, 자동 설정 버튼을 통해 기본 추천값을 채운 뒤 루틴 생성으로 이어지게 한다.
- 설문 1페이지는 `기본 정보`가 되도록 재배치한다.

### 삭제 또는 고정할 설문 항목

`운동 장소 및 장비` 단계는 삭제한다.

추천 서비스 입력값의 장소는 체육관으로 고정한다.

장비는 특정 4개만 고정하지 않는다. 기존 장비 선택 UI에서 선택 가능했던 모든 장비를 사용 가능하다고 전제한다.

```json
{
  "place": "gym",
  "available_equipment": ["body", "dumbbell", "barbell", "machine", "band", "pull_up_bar", "kettlebell"]
}
```

즉 현 프로젝트 추천은 일단 체육관 기준으로 통일하되, 장비 필터는 전체 장비 허용으로 넓게 둔다.

`분할 스타일` 단계도 삭제한다.

추천 서비스 입력값은 일단 체육관 5분할 기준으로 고정한다.

```json
{
  "split_style": "bodybuilding"
}
```

### 유지할 설문 항목

아래 항목은 계속 사용자 입력으로 받는다.

- 기본 정보: 나이, 성별, 운동 수준
- 통증/부상 부위
- 운동 요일 및 요일별 부위
- 운동 목표
- 세션당 운동 시간

### 운동 목표 반영 강화

`운동 목표`는 추천 결과에 실제로 영향을 줘야 한다.

목표별로 적어도 아래 항목이 달라져야 한다.

- 세트 수
- 반복 수
- 휴식 시간
- 운동 후보 우선순위
- 필요 시 유산소/머신/복합운동 비중

예시 방향:

```text
hypertrophy:
- 중간 반복
- 근비대 중심 볼륨
- 부위별 자극 운동 우선

strength:
- 낮은 반복
- 긴 휴식
- 복합/고난이도 운동 우선

diet:
- 높은 반복
- 짧은 휴식
- 칼로리 소모와 머신/유산소 병행 고려

maintenance:
- 보수적 볼륨
- 안정성 중심
- 과도한 강도보다 지속 가능성 우선
```

구현 시 주의:

- 목표값을 프론트 문구에만 쓰지 말고 `recommendation_service`의 param/routine composition 단계에 실제 제약으로 전달해야 한다.
- 목표에 따라 LLM 프롬프트, GraphDB 후보 정렬, 세트/반복/휴식값이 달라지는지 테스트한다.

## 3. Current Structure

### Frontend

주요 파일:

```text
frontend/src/pages/RoutinePage.jsx
frontend/src/App.jsx
frontend/src/components/Navbar.jsx
```

현재 `RoutinePage.jsx`는 다음 상태를 이미 가진다.

```text
painParts
workDays
splitStyle
goal
sessionMin
dayParts
```

현재 부족한 필수 입력:

```text
age
gender
level
place
availableEquipment
```

현재 프론트는 `/api/exercises/`에서 MySQL 운동 목록을 받아 자체 템플릿 루틴을 만들고 `/api/routines/`에 저장한다. 이 프론트 자체 생성 로직은 LangGraph 추천 API 연결 시 제거한다.

루틴 생성의 단일 출처는 `recommendation_service`의 LangGraph 추천 결과여야 한다. 프론트 자체 템플릿 결과와 AI 추천 결과를 섞지 않는다.

### Backend

주요 파일:

```text
backend/api/views.py
backend/config/urls.py
backend/api/models.py
```

현재 API:

```text
GET  /api/exercises/
GET  /api/routines/
POST /api/routines/
```

추가해야 할 API:

```text
POST /api/routines/recommend/
POST /api/routines/recommend/review/
```

기존 `/api/routines/`는 추천 생성용이 아니라 저장용 API로 유지한다.

## 4. Required Survey Schema

프론트는 최종적으로 아래 구조를 Django API에 전달한다.

```json
{
  "device_uuid": "string",
  "age": 28,
  "gender": "male",
  "level": "intermediate",
  "place": "gym",
  "available_equipment": ["barbell", "dumbbell", "machine", "body"],
  "pain_parts": ["none"],
  "split_style": "bodybuilding",
  "work_days": ["월", "화", "수", "목", "금"],
  "day_parts": {
    "월": "가슴",
    "화": "등",
    "수": "하체",
    "목": "어깨",
    "금": "팔/코어"
  },
  "goal": "hypertrophy",
  "session_min": 60
}
```

필수값이 하나라도 비어 있으면 추천 API를 호출하지 않는다.

## 5. Survey Steps

현재 5단계 설문을 8단계로 확장한다.

```text
Step 1. 추천 방향 선택
Step 2. 기본 정보
Step 3. 운동 장소 및 장비
Step 4. 통증/부상 부위
Step 5. 분할 스타일
Step 6. 운동 요일 및 부위
Step 7. 운동 목표
Step 8. 세션당 운동 시간
```

### Step 1. Recommendation Preset

기존 [`backend/recommendation_service/survey_scenarios.py`](../backend/recommendation_service/survey_scenarios.py)의 테스트 시나리오를 사용자 선택용 추천 방향 프리셋으로 재사용한다.

단, 프리셋에는 부상/통증 정보를 넣지 않는다. 부상/통증은 반드시 별도 설문 단계에서 사용자가 직접 입력한다.

권장 프리셋:

```text
체육관 근비대 5분할
- source: gym_intermediate_hypertrophy_no_pain
- default: gym, intermediate, bodybuilding, hypertrophy, 60min

집 초급 건강 루틴
- source: home_beginner_female_knee_health에서 pain_parts 제거
- default: home, beginner, lower_core, health, 45min

체육관 저부하 건강 루틴
- source: gym_senior_female_lower_back_health에서 pain_parts 제거
- default: gym, beginner, lower_core, health, 30min

집 상급 스트렝스 루틴
- source: home_advanced_strength_no_pain
- default: home, advanced, strength, strength, 90min

체육관 다이어트 5분할
- source: gym_intermediate_female_wrist_diet에서 pain_parts 제거
- default: gym, intermediate, bodybuilding, fat_loss, 60min
```

역할:

```text
사용자가 추천 방향 프리셋 선택
-> 프론트 설문 기본값 자동 채움
-> 사용자가 기본 정보, 장소, 장비, 요일, 목표, 시간, 통증 여부를 수정 가능
-> 최종 제출 시 완성된 survey JSON만 추천 API로 전송
```

주의:

- 프리셋은 추천 결과를 고정하지 않는다.
- 프리셋은 설문 기본값을 채우는 용도다.
- 운동 후보와 최종 루틴은 여전히 GraphDB와 LangGraph 추천 흐름에서 생성한다.
- 프리셋 선택 후에도 사용자가 각 항목을 변경할 수 있어야 한다.
- 부상/통증 프리셋은 만들지 않는다.

### Step 2. Basic Profile

수집값:

```text
age
gender
level
```

권장 옵션:

```text
gender: male, female
level: beginner, intermediate, advanced
```

UI:

- 나이는 숫자 입력 또는 stepper.
- 성별과 수준은 segmented button 또는 option button.
- 이모지 없이 텍스트 또는 lucide icon만 사용.

### Step 3. Place And Equipment

수집값:

```text
place
available_equipment
```

권장 옵션:

```text
place: home, gym
equipment:
  body
  dumbbell
  barbell
  machine
  band
  pull_up_bar
  kettlebell
```

장소가 `home`이면 `machine`, `barbell`은 기본 선택에서 제외해도 된다. 다만 사용자가 직접 선택할 수 있게 할지는 화면 UX에 따라 결정한다.

### Step 4-8

기존 `RoutinePage.jsx`의 설문을 재배치한다.

```text
painParts -> Step 4
splitStyle -> Step 5
workDays/dayParts -> Step 6
goal -> Step 7
sessionMin -> Step 8
```

## 6. Django API Design

### 6.1 Recommend API

```text
POST /api/routines/recommend/
```

역할:

```text
프론트 설문 JSON
-> user_profile 변환
-> LangGraph 실행
-> Human Review interrupt payload 또는 final/error response 반환
```

초기 구현은 `auto_approve=false`를 기본으로 두고, Human Review payload를 프론트에 반환한다.

응답 예시:

```json
{
  "ok": true,
  "thread_id": "uuid",
  "status": "needs_review",
  "routine_draft": {
    "split_type": "5-day",
    "days": []
  },
  "validation_result": {
    "is_valid": true,
    "risk_level": "low",
    "reason": "루틴이 현재 추천 조건과 GraphDB 후보 제약을 만족합니다.",
    "safety_warnings": []
  }
}
```

후보 부족 또는 필수값 누락:

```json
{
  "ok": false,
  "status": "failed",
  "message": "현재 GraphDB 후보가 부족해 안전한 추천 루틴을 생성하지 않았습니다."
}
```

### 6.2 Review API

```text
POST /api/routines/recommend/review/
```

요청:

```json
{
  "thread_id": "uuid",
  "decision": "revise",
  "feedback": "허리에 부담이 적게 해주세요."
}
```

승인:

```json
{
  "thread_id": "uuid",
  "decision": "approve",
  "feedback": ""
}
```

응답:

```text
needs_review: 수정 반영 후 다시 검토 필요
completed: 최종 응답 생성 완료
failed: 후보 부족 또는 오류
```

## 7. LangGraph Session Handling

CLI에서는 `InMemorySaver`를 사용하고 있다. Django API에서도 초기 구현은 메모리 checkpointer로 시작할 수 있다.

주의:

- 서버 재시작 시 thread state는 사라진다.
- 미니프로젝트 시연에는 충분하다.
- 장기 운영 기준이면 DB 기반 checkpointer가 필요하다.

Django view 레벨에서 module global graph/checkpointer를 둔다.

```text
graph = build_recommendation_graph(checkpointer=InMemorySaver())
```

응답에 `thread_id`를 반환하고, review API는 같은 `thread_id`로 `Command(resume=...)`를 호출한다.

## 8. Response Mapping To Frontend

LangGraph routine format:

```json
{
  "days": [
    {
      "day": "Day 1",
      "target": "CHEST",
      "exercises": [
        {
          "exercise_id": 2009,
          "name": "체스트 프레스 머신",
          "equipment": "machine",
          "sets": 3,
          "reps": "8-12",
          "rest_seconds": 75
        }
      ]
    }
  ]
}
```

Frontend routine format:

```js
{
  월: [
    {
      id,
      name,
      sets,
      reps,
      eq,
      detail,
      category
    }
  ]
}
```

Mapping rule:

```text
routine.days[index] -> workDays[index]
exercise.exercise_id -> id
exercise.name -> name
exercise.equipment -> eq
exercise.sets -> sets
exercise.reps -> reps
exercise.rest_seconds -> rest_seconds
```

주의:

- LangGraph가 반환하는 `day` 라벨은 화면 요일 매핑의 기준으로 쓰지 않는다.
- 사용자가 선택한 `workDays` 순서를 기준으로 `routine.days[index]`를 배치한다.
- `workDays`와 `routine.days` 길이가 맞지 않으면 저장하지 않고 오류를 표시한다.

운동 상세 설명, 영상, GIF, guide는 기존 `/api/exercises/` 결과의 `id`와 매칭해 보강한다.

### 8.1 Exercise Detail And Video Enrichment

프론트 기존 구현의 강점은 운동 상세 패널이다. 이 부분은 제거하지 않는다.

역할 분리:

```text
Neo4j / recommendation_service:
- 어떤 운동을 추천할지 결정
- exercise_id, name, equipment, sets, reps, rest_seconds 반환

Postgres / /api/exercises/:
- 운동 상세 표시용 마스터 데이터 제공
- name_kor, category, guide, caution, video_url, image_url, spine_loading 제공

Frontend:
- recommendation_service 결과의 exercise_id를 /api/exercises/의 id와 매칭
- 매칭된 상세 정보를 RoutineCheckView 운동 상세 패널에 표시
```

매칭 기준:

```text
primary: Number(recommended.exercise_id) === Number(exercise.id)
fallback: recommended.name === exercise.name_kor
```

영상/이미지 표시 우선순위:

```text
1. dbExercise.video_url
2. local gif path: /gifs/{category}/{id}_{name_kor}.gif
3. dbExercise.image_url
4. /workout_guide.png
```

루틴 카드에 붙일 필드:

```js
{
  id: recommended.exercise_id,
  name: dbExercise?.name_kor || recommended.name,
  sets: recommended.sets,
  reps: recommended.reps,
  rest_seconds: recommended.rest_seconds,
  eq: dbExercise?.equipment || recommended.equipment,
  detail: dbExercise?.guide || '',
  category: dbExercise?.category || '',
  video_url: dbExercise?.video_url || '',
  image_url: dbExercise?.image_url || '',
  gif: localGifPath,
  caution: dbExercise?.caution || '',
  spine_loading: dbExercise?.spine_loading || ''
}
```

주의:

- 추천 결과의 `exercise_id`가 Postgres `exercises.exercise_id`와 맞아야 영상/가이드가 제대로 붙는다.
- 연결 테스트에서 추천 결과 운동 ID가 `/api/exercises/` 920개 안에 존재하는지 반드시 확인한다.
- 매칭 실패 시 루틴 생성 자체를 실패 처리하지는 않되, 상세 패널은 기본 이미지와 최소 정보로 표시한다.
- 추천 생성 실패와 상세정보 매칭 실패는 다른 문제로 분리한다.

## 9. Human Feedback Schema

현재 Human Feedback 정규화 스키마:

```text
spine
avoid_conditions
intensity_bias
focus_targets
volume_bias
```

예시:

```text
허리에 부담이 적게 해주세요
-> spine=low, avoid_conditions=["lower_back"]

좀 더 고강도로 해주세요
-> intensity_bias=higher

가슴에 더 집중하고 싶어요
-> focus_targets=["CHEST"], volume_bias=higher
```

프론트에는 추천 결과 검토 영역을 둔다.

```text
승인 버튼
수정 요청 textarea
수정 요청 버튼
```

이모지 없이 텍스트와 아이콘만 사용한다.

## 10. Persistence Flow

추천 생성과 저장을 분리한다.

```text
1. 추천 생성 API 호출
2. Human Review approve
3. 프론트가 최종 routine_draft를 기존 /api/routines/에 저장
```

이렇게 하면 기존 `WeeklyScheduler`, `DailyRoutine` 저장 구조를 재사용할 수 있다.

중요:

- 기존 프론트 자체 루틴 생성 로직은 제거한다.
- `/api/exercises/`는 운동 상세 보강용으로만 사용한다.
- `/api/exercises/`의 영상/가이드 데이터는 기존 RoutineCheckView 오른쪽 상세 패널에 계속 사용한다.
- AI 추천 실패 시 프론트가 임의 템플릿 루틴을 자동 생성하지 않는다.
- 실패 시에는 오류 메시지를 보여주고 사용자가 조건을 수정하게 한다.

## 11. Implementation Order

1. `RoutinePage.jsx`에 추천 방향 프리셋 step 추가
2. 프리셋 선택 시 설문 기본값을 채우는 `applyPreset` 로직 추가
3. `RoutinePage.jsx` 설문 필드 추가
4. 이모지 제거 또는 lucide icon 교체
5. 프론트 자체 루틴 생성 로직 제거
6. Django `RoutineRecommendView` 추가
7. Django URL 추가
8. 프론트 추천 API 호출 함수 추가
9. `thread_id`를 프론트 state에 저장
10. LangGraph 응답을 기존 `workoutRoutine` 구조로 매핑
11. 추천 결과 `exercise_id`를 `/api/exercises/` 결과와 매칭해 영상/가이드 필드 보강
12. 기존 RoutineCheckView 오른쪽 운동 상세 패널 유지
13. Human Review UI 추가
14. approve 후 기존 `/api/routines/` 저장 재사용
15. 단위 테스트 및 CLI 테스트
16. 프론트 `npm run build` 확인

## 12. Test Plan

### Backend

```powershell
cd backend
..\.venv\Scripts\python.exe -m unittest recommendation_service.tests -v
```

### Recommendation CLI

[`backend/recommendation_service/`](../backend/recommendation_service/)는 **`backend/` CWD** 기준 패키지다. [에픽06 Step 7](에픽06-폴더-구조-및-경로-정리.md#step-7--cli-wrapper-선택) 참고.

```powershell
cd backend
..\.venv\Scripts\python.exe -m recommendation_service.cli --scenario 0

# 또는 repo root
..\.venv\Scripts\python.exe backend/scripts/run_recommendation_cli.py --scenario 0
```

### Django API

```powershell
cd backend
..\.venv\Scripts\python.exe manage.py runserver
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

### Key Scenarios

```text
1. 일반 체육관 5분할 생성
2. 추천 방향 프리셋 선택 -> 설문 기본값 자동 채움
3. 프리셋 선택 후 통증 없음으로 추천 생성
4. 추천 결과 exercise_id -> /api/exercises/ 상세 정보 매칭
5. 오른쪽 상세 패널에서 운동 영상/GIF/가이드 표시
6. 허리 부상 피드백 -> spine low 재검색
7. 고강도 피드백 -> sets/reps/rest 변경
8. 가슴 집중 피드백 -> CHEST day 세트 증가
9. 후보 부족 조건 -> 안전 실패 메시지
```

## 13. Known Limits

- RAG는 이번 범위에서 제외한다.
- 재활/의료 처방 시스템이 아니라 사용자 피드백 기반 루틴 재추천 시스템으로 소개한다.
- GraphDB 관계가 더 촘촘해지면 현재 일부 정규화 규칙을 지식 그래프 기반으로 대체할 수 있다.
- 초기 Django API checkpointer는 메모리 기반이므로 서버 재시작 시 review thread가 유지되지 않는다.
