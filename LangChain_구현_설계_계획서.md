# LangChain 운동 루틴 추천 시스템 구현 설계 계획서

## 1. 문서 목적

본 문서는 GraphDB 기반 운동 루틴 추천 시스템을 실제로 구현하기 위한 LangChain/LangGraph 설계 계획서이다.

현재 프로젝트 범위는 **추천 시스템 단독**이다.

| 항목 | 상태 |
|---|---|
| GraphDB 기반 5분할 루틴 추천 | 구현 대상 |
| RDB 사용자 프로필 연동 | 구현 대상 |
| Human-in-the-loop | 구현 대상 |
| RAG 챗봇 | 구현 제외 |
| Vector DB 문서 검색 | 구현 제외 |

---

## 2. 공통 구현 규칙

- 모든 Agent는 반드시 LLM에 연결한다.
- 기본 LLM Provider는 Groq을 사용할 수 있도록 `.env` 기반으로 설정한다.
- RDB, GraphDB, Fine-tuned Model은 interface를 통해 교체 가능하게 만든다.
- 실제 DB 연동 전까지 Mock Tool로 전체 flow를 먼저 구현한다.
- 하드코딩은 지양한다.
- 부득이하게 하드코딩한 값에는 반드시 `TODO` 또는 `NOTE` 주석으로 추후 교체 예정임을 명시한다.
- RDB, GraphDB 사정에 따라 바뀔 수 있는 부분은 코드 주석과 문서에 변경 가능 지점으로 표시한다.
- Supervisor 루프는 retry count와 max retry 조건으로 보호한다.
- Groq 계열 모델의 JSON 출력 불안정성을 고려해 JSON parser, extractor, retry 로직을 구현한다.
- 운동명, GraphDB 노드, 영상 metadata는 `exercise_id` 정규화 레이어를 통해 연결한다.
- 초기 구현은 v2 단순 구조를 우선 구현하고, v1 상세 구조는 고도화 단계에서 리팩토링한다.

---

## 3. `.env` 설정

```env
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-70b-versatile

OPENAI_API_KEY=
OPENAI_MODEL=

FINE_TUNED_MODEL_BASE_URL=
FINE_TUNED_MODEL_NAME=

RDB_API_BASE_URL=
GRAPHDB_API_BASE_URL=

MAX_VALIDATION_RETRY=3
MAX_COMPOSITION_RETRY=3
MAX_SUPERVISOR_STEPS=15
```

파인튜닝 모델은 추후 별도 컴퓨터에서 서버 형태로 제공될 예정이므로, 초기 구현에서는 Groq Provider를 기본값으로 사용한다.

---

## 4. 추천 구현 폴더 구조

```text
langchain_app/
  config/
    settings.py
    llm_provider.py
  schemas/
    routine_state.py
    actions.py
    model_outputs.py
  agents/
    routine_supervisor_agent.py
    profile_clarification_agent.py
    recommendation_param_agent.py
    routine_composition_agent.py
    routine_validation_agent.py
    routine_revision_agent.py
  tools/
    user_profile_tool.py
    graph_exercise_search_tool.py
    exercise_name_normalizer.py
    exercise_detail_lookup_tool.py
    routine_save_tool.py
  graphs/
    routine_graph.py
  prompts/
    supervisor_prompt.py
    clarification_prompt.py
    param_prompt.py
    composition_prompt.py
    validation_prompt.py
    revision_prompt.py
    final_response_prompt.py
  mocks/
    mock_rdb.py
    mock_graphdb.py
    mock_exercise_map.py
  tests/
    test_supervisor_actions.py
    test_routine_v2_flow.py
    test_loop_guard.py
    test_json_parser.py
```

---

## 5. LLM Provider 설계

모든 Agent는 직접 Groq SDK나 특정 API를 호출하지 않고 공통 LLM Provider를 통해 모델을 사용한다.

```python
class BaseLLMProvider:
    def invoke(self, messages: list[dict], **kwargs) -> str:
        raise NotImplementedError

    def invoke_json(self, messages: list[dict], schema: type, **kwargs) -> dict:
        raise NotImplementedError
```

Provider 후보:

| Provider | 용도 |
|---|---|
| `GroqLLMProvider` | 초기 기본 구현 |
| `OpenAILLMProvider` | OpenAI API 비교 실험 |
| `FineTunedModelProvider` | 추후 팀 파인튜닝 모델 서버 연동 |
| `LocalModelProvider` | Gemma, Qwen 등 로컬/서버 모델 연동 |

## 5.1 Groq JSON 안정화

Groq 기반 Llama 계열 모델은 JSON 앞뒤에 불필요한 설명이나 Markdown code fence를 붙일 수 있다.

`invoke_json()`은 다음 흐름으로 구현한다.

```text
LLM 응답 수신
→ Markdown code fence 제거
→ JSON object 추출
→ Pydantic schema 검증
→ 실패 시 repair prompt 재시도
→ max retry 초과 시 Error State 반환
```

예상 helper:

```python
def extract_json_text(raw: str) -> str:
    cleaned = raw.strip()
    cleaned = cleaned.replace("```json", "").replace("```", "")

    start = cleaned.find("{")
    end = cleaned.rfind("}")

    if start == -1 or end == -1:
        raise ValueError("JSON object not found")

    return cleaned[start:end + 1]
```

---

## 6. RoutineState 설계

```python
from typing import TypedDict

class RoutineState(TypedDict, total=False):
    user_id: int
    user_request: str

    user_profile: dict
    missing_required_fields: list[str]
    human_required_info: dict

    recommendation_params: dict
    graph_candidates: list[dict]
    routine_draft: dict
    validation_result: dict

    human_review_result: dict
    revision_request: dict

    final_response: str
    next_action: str
    action_reason: str

    validation_retry_count: int
    composition_retry_count: int
    supervisor_step_count: int
    max_validation_retry: int
    max_composition_retry: int
    max_supervisor_steps: int

    errors: list[dict]
    metadata: dict
```

주요 필드:

| 필드 | 설명 |
|---|---|
| `user_profile` | RDB 또는 Mock RDB에서 조회한 사용자 정보 |
| `recommendation_params` | GraphDB 조회용 구조화 파라미터 |
| `graph_candidates` | GraphDB에서 조회한 운동 후보 |
| `routine_draft` | 생성된 루틴 초안 |
| `validation_result` | 루틴 검증 결과 |
| `human_review_result` | 사용자 최종 검토 결과 |
| `next_action` | Supervisor Agent가 선택한 다음 action |
| `validation_retry_count` | 검증 실패 후 재생성 반복 횟수 |
| `supervisor_step_count` | Supervisor action loop 총 실행 횟수 |

---

## 7. NextAction 설계

```python
from enum import Enum

class NextAction(str, Enum):
    CALL_USER_PROFILE_TOOL = "CALL_USER_PROFILE_TOOL"
    REQUEST_REQUIRED_INFO = "REQUEST_REQUIRED_INFO"
    CALL_RECOMMENDATION_PARAM_AGENT = "CALL_RECOMMENDATION_PARAM_AGENT"
    CALL_GRAPH_SEARCH_TOOL = "CALL_GRAPH_SEARCH_TOOL"
    CALL_COMPOSITION_AGENT = "CALL_COMPOSITION_AGENT"
    CALL_VALIDATION_AGENT = "CALL_VALIDATION_AGENT"
    REQUEST_FINAL_HUMAN_REVIEW = "REQUEST_FINAL_HUMAN_REVIEW"
    CALL_REVISION_AGENT = "CALL_REVISION_AGENT"
    CALL_FINAL_RESPONSE_GENERATOR = "CALL_FINAL_RESPONSE_GENERATOR"
    END = "END"
```

v2 구현에서는 `CALL_REVISION_AGENT`를 사용하지 않고, 수정 피드백을 `CALL_COMPOSITION_AGENT`로 되돌릴 수 있다.

Supervisor 출력 스키마:

```json
{
  "next_action": "CALL_VALIDATION_AGENT",
  "reason": "루틴 초안이 생성되었으므로 안전성 검증이 필요합니다."
}
```

---

## 8. Agent 설계

| Agent | 역할 | LLM 연결 |
|---|---|---|
| `RoutineSupervisorAgent` | 전체 State를 보고 다음 action 선택 | 필수 |
| `ProfileClarificationAgent` | 필수 정보 누락 판단, 추가 질문 생성, 사용자 답변 구조화 | 필수 |
| `RecommendationParamAgent` | GraphDB 조회 조건 생성 | 필수 |
| `RoutineCompositionAgent` | 운동 후보를 5분할 루틴으로 구성 | 필수 |
| `RoutineValidationAgent` | 강도, 부상 위험, 장비 조건, 부위 균형 검증 | 필수 |
| `RoutineRevisionAgent` | v1 고도화용. 사용자 피드백 반영 | 필수 |

## 8.1 `RoutineSupervisorAgent`

역할:

- 전체 State 확인
- 다음 action 선택
- Agent/Tool/Human Interrupt 호출 흐름 제어
- 종료 가능 여부 판단

주의:

```text
Supervisor는 자유 텍스트가 아니라 정해진 NextAction 중 하나만 출력한다.
```

## 8.2 `RecommendationParamAgent`

출력 예시:

```json
{
  "goal": "muscle_gain",
  "split_type": "5_day_split",
  "level": "beginner",
  "target_parts": ["chest", "back", "legs", "shoulders", "arms"],
  "available_equipment": ["machine", "dumbbell"],
  "exclude_conditions": ["knee_high_load", "deadlift"]
}
```

## 8.3 `RoutineValidationAgent`

출력 예시:

```json
{
  "is_valid": false,
  "risk_level": "high",
  "issues": [
    "무릎 통증 이력이 있는데 고중량 스쿼트가 포함되었습니다."
  ],
  "needs_human_review": true,
  "needs_revision": true
}
```

---

## 9. Tool 설계

## 9.1 `UserProfileTool`

역할:

- RDB에서 사용자 프로필 조회

Mock 출력 예시:

```json
{
  "user_id": 1,
  "age": 70,
  "gender": "male",
  "goal": "muscle_gain",
  "level": "beginner",
  "available_days": 5,
  "available_equipment": ["machine", "dumbbell"],
  "injuries": ["knee_pain"],
  "preferences": {
    "avoid_exercises": ["deadlift"]
  }
}
```

## 9.2 `GraphExerciseSearchTool`

역할:

- GraphDB에서 조건에 맞는 운동 후보 조회

주의:

```text
LLM이 Cypher Query를 직접 생성하지 않는다.
LangChain은 조회 파라미터만 만들고,
백엔드가 Cypher Query Template으로 GraphDB를 조회한다.
```

## 9.3 `ExerciseNameNormalizer`

역할:

- 운동 자연어 이름을 표준 `exercise_id`로 변환

초기 구현:

```python
# TODO: GraphDB Exercise 노드 ID 체계 확정 후 DB 기반 정규화로 교체 예정
EXERCISE_ID_MAP = {
    "스쿼트": "barbell_squat",
    "바벨 스쿼트": "barbell_squat",
    "레그 프레스": "leg_press",
}
```

## 9.4 `ExerciseDetailLookupTool`

역할:

- `exercise_id` 기준으로 운동 상세 설명, 주의사항, 영상 URL 조회
- 추천 루틴 결과에 영상/주의사항을 붙이기 위한 보조 Tool

RAG 챗봇 Agent를 호출하지 않는다.

---

## 10. Human-in-the-loop 설계

## 10.1 추천 전 필수 정보 입력

발동 조건:

```text
나이, 운동 수준, 목표, 장비, 운동 가능일, 부상/통증 여부 중 필수 항목 누락
```

동작:

```text
그래프 실행 중단
→ 사용자 입력 요청
→ State 업데이트
→ Supervisor Agent로 복귀
```

## 10.2 Human Supervision - 루틴 검토

발동 위치:

```text
루틴 생성 및 검증 이후
```

사용자 선택:

```text
확정
강도 조절
운동 대체
재추천
```

v2:

```text
수정 요청 시 루틴 생성 단계로 복귀
```

v1:

```text
수정 요청 시 RoutineRevisionAgent 호출
```

---

## 11. Loop Guard 설계

Supervisor 구조는 반복 루프를 가지므로 반드시 안전장치를 둔다.

권장 기본값:

```text
max_validation_retry = 3
max_composition_retry = 3
max_supervisor_steps = 15
```

예시:

```python
def route_after_validation(state: RoutineState) -> str:
    if state["validation_retry_count"] >= state["max_validation_retry"]:
        return "REQUEST_FINAL_HUMAN_REVIEW"

    if state["validation_result"]["needs_revision"]:
        return "CALL_COMPOSITION_AGENT"

    return "REQUEST_FINAL_HUMAN_REVIEW"
```

Loop Guard는 LLM 판단이 아니라 코드 레벨 조건부 분기로 처리한다.

---

## 12. Mock 구현 범위

현재 바로 구현 가능한 범위:

| 구성 | 구현 방식 |
|---|---|
| `RoutineState` | 실제 구현 가능 |
| `NextAction` enum | 실제 구현 가능 |
| `GroqLLMProvider` | `.env` 기반 구현 가능 |
| `UserProfileTool` | Mock 구현 |
| `GraphExerciseSearchTool` | Mock 구현 |
| `ExerciseNameNormalizer` | Mock mapping 구현 |
| `RecommendationParamAgent` | Groq 기반 구현 가능 |
| `RoutineCompositionAgent` | Groq 기반 구현 가능 |
| `RoutineValidationAgent` | Rule + Groq 기반 구현 가능 |
| `Human Interrupt` | 콘솔 또는 임시 입력으로 Mock 구현 |
| `FinalResponseGenerator` | Groq 기반 구현 가능 |

아직 대기 또는 Mock 처리할 부분:

| 구성 | 이유 |
|---|---|
| 실제 RDB 연동 | RDB 필드 미확정 |
| 실제 GraphDB 연동 | GraphDB 노드/관계/응답 형식 미확정 |
| Fine-tuned Model 연동 | 모델 서버 endpoint 미확정 |
| 실제 UI Human Interrupt | 프론트 화면 설계 미확정 |

---

## 13. 구현 순서

초기 구현은 v2 구조를 우선한다.

1. `.env` 및 `settings.py` 구성
2. `GroqLLMProvider` 구현
3. `invoke_json()` JSON extractor, Pydantic 검증, retry 로직 구현
4. `RoutineState` 정의
5. retry count 및 Loop Guard 필드 추가
6. `NextAction` enum 정의
7. `ExerciseNameNormalizer` mock mapping 구현
8. Mock `UserProfileTool` 구현
9. Mock `GraphExerciseSearchTool` 구현
10. `RecommendationParamAgent` 구현
11. `RoutineCompositionAgent` 구현
12. `RoutineValidationAgent` 구현
13. Mock Human Interrupt 구현
14. `FinalResponseGenerator` 구현
15. v2 LangGraph `routine_graph.py` 구성
16. Conditional Edge 기반 Loop Guard 구현
17. v2 시나리오 테스트 작성
18. `RoutineSupervisorAgent` action loop 구현
19. v1 상세 구조 고도화 여부 검토
20. RDB/GraphDB/파인튜닝 모델 스펙 확정 후 Provider/Tool 내부 교체

---

## 14. 구현 전 필수 보완 사항

| 보완 항목 | 반영 방식 | 이유 |
|---|---|---|
| Loop Guard | `RoutineState`에 retry count 추가, Conditional Edge에서 강제 분기 | 무한 루프와 토큰 낭비 방지 |
| Groq JSON 안정화 | `invoke_json()`에 Pydantic parser, JSON extractor, retry 구현 | Groq 출력 파싱 오류 방지 |
| exercise_id 정규화 | `ExerciseNameNormalizer` 추가 | GraphDB, 영상 데이터 매칭 오류 방지 |
| v2 우선 구현 | 수정 피드백을 루틴 생성 단계에 재입력 | 초기 구현 난이도 감소 |
| JSON Schema 검증 | Supervisor action과 Agent 출력 schema 검증 | Agent 출력 안정화 |
| Trace logging | Agent/Tool 호출 순서 기록 | 디버깅 및 평가 용이 |
| Error state 정의 | DB 실패, 모델 실패, 검색 실패 대응 | 예외 상황 처리 |

---

## 15. 핵심 결론

현재 구현 범위는 GraphDB 기반 운동 루틴 추천 시스템이다.

RAG 챗봇과 Vector DB 문서 검색은 제외한다.

외부 RDB, GraphDB, Fine-tuned Model이 완성되기 전에도 다음 범위는 먼저 구현할 수 있다.

```text
Groq 기반 LLM Provider
RoutineState
NextAction
Mock RDB
Mock GraphDB
ExerciseNameNormalizer
Routine 생성/검증 flow
Human Interrupt mock
Final Response Generator
Loop Guard
```
