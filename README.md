# Planfit 5분할 Graph DB

## 입력 파일

| 파일 | 내용 |
|------|------|
| `planfit_exercises_enriched.json` | 969개 운동 (노드 데이터) |
| `exercise_edges.json` | 3,170개 SUBSTITUTE_FOR 엣지 |

## 파일 구조

```
build_graph.py                     ← DB 구축 (최초 1회 실행)
queries.py                         ← Cypher 쿼리 클래스
.env                               ← Neo4j 접속 정보
planfit_exercises_enriched.json    ← 노드 데이터
exercise_edges.json                ← 엣지 데이터
```

## 설치 & 실행

```bash
pip install neo4j python-dotenv

# .env 생성
echo "NEO4J_URI=your-neo4j-bolt-uri" > .env
echo "NEO4J_USER=your-neo4j-user"    >> .env
echo "NEO4J_PASSWORD=your-password"  >> .env

# DB 구축
python build_graph.py
```

## 생성되는 노드 / 엣지

### 노드 (5종)

| 노드 | 수 | 설명 |
|------|----|------|
| Exercise | 667개 | 5분할 운동 |
| BodyPart | 10개 | 신체 부위 |
| Equipment | 8개 | 장비 |
| IntensityLevel | 4개 | 강도 레벨 |
| SplitDay | 5개 | 분할 |

### 엣지 (10종)

| 엣지 | 데이터 출처 | 설명 |
|------|------------|------|
| TARGETS_PRIMARY | target_primary 필드 | 주동근 |
| TARGETS_SECONDARY | target_secondary 배열 | 보조근 |
| REQUIRES_EQUIPMENT | equipment 필드 | 장비 |
| HAS_INTENSITY | estimated_cal_per_min 매핑 | 강도 |
| PART_OF_SPLIT | category → split_day | 5분할 소속 |
| SIMILAR_TO | related_exercises 파싱 | 유사 운동 |
| SUBSTITUTE_FOR | exercise_edges.json 직접 사용 | 대체 운동 |
| PROGRESSION_OF | difficulty 단계별 연결 | 점진 과부하 |
| ARM_SUPERSET | 수동 정의 4쌍 | 팔 이두↔삼두 |

> SUBSTITUTE_FOR는 `from_place`, `to_place`, `same_place` 속성 포함

## 주요 쿼리

```python
from queries import GraphQuery
import os

gq = GraphQuery(os.environ["NEO4J_URI"], os.environ["NEO4J_USER"], os.environ["NEO4J_PASSWORD"])

# 분할별 운동 (척추·장비·난이도 필터)
gq.get_exercises_by_split("LEG", spine="mid", equip=["machine"], level="beginner")

# 대체 운동 (exercise_edges 기반)
gq.get_substitutes(1001, same_place_only=False, spine="low")

# 헬스장 → 홈트 대체
gq.get_gym_to_home(4001)

# 유사 운동
gq.get_similar(2001)

# 점진 경로
gq.get_progression(1005)

# 팔 슈퍼셋
gq.get_arm_supersets(equip=["dumbbell"])

# 주간 칼로리 (75kg)
gq.get_weekly_calories(weight=75.0)

# 척추 안전 운동
gq.get_spine_safe("BACK", spine="low")

# 분할 통계
gq.get_split_stats()

gq.close()
```
## 1차 구현

### 구현 범위

추천 서비스의 1차 구현에서는 기존 Graph DB를 기반으로 LangGraph 구조의 운동 루틴 추천 시스템 골격을 구성했습니다.  
Django, React 등 화면/서버 구현은 제외하고, 추천 로직 자체에 집중했습니다.

### 주요 구현 내용

- Neo4j Graph DB 연동 확인
- LangGraph 기반 추천 워크플로우 구현
- Supervisor Agent 기반 라우팅 구조 구현
- 사용자 프로필 추출 Agent 구현
- 추천 파라미터 생성 Agent 구현
- Graph DB 운동 후보 조회 Tool 구현
- 루틴 구성 Agent 구현
- 루틴 검증 Agent 구현
- 루틴 수정 Agent 구현
- 최종 응답 생성 Agent 구현
- 마지막 Human-in-the-loop 구조 구현

### 추천 플로우

```text
사용자 설문 입력
→ 사용자 프로필 추출
→ 추천 파라미터 생성
→ Neo4j Graph DB 운동 후보 조회
→ 5분할 루틴 구성
→ 루틴 검증
→ 최종 사용자 확인
→ 승인 시 최종 추천 응답 생성
→ 수정 요청 시 루틴 수정 후 재검증
