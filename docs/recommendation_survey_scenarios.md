# Recommendation Survey Scenarios

이 문서는 프론트 설문 값을 LangGraph `user_profile`로 넘길 때 사용할 예시입니다.
테스트 fixture 원본은 `recommendation_service/survey_scenarios.py`에 있습니다.

## 확정 입력 후보

| 항목 | 예시 값 | 추천 서비스 활용 |
|---|---|---|
| 나이 | `28` | 고령/부상 위험 보정 |
| 성별 | `male`, `female` | 초기 강도 보정 참고값 |
| 운동 수준 | `beginner`, `intermediate`, `advanced` | GraphDB `difficulty_label` 필터 |
| 통증/부상 부위 | `shoulder`, `lower_back`, `wrist`, `knee`, `none` | GraphDB `spine_loading` 및 검증 |
| 운동 장소 | `home`, `gym` | `home_only` 변환 |
| 사용 가능 장비 | `body`, `dumbbell`, `barbell`, `machine`, `band`, `pull_up_bar`, `kettlebell` | GraphDB `equipment` 필터 |
| 분할 스타일 | `bodybuilding`, `lower_core`, `strength` | 루틴 구성 방향 |
| 운동 요일/부위 | `{"월":"가슴","화":"등"}` | GraphDB `split_day` 후보 |
| 운동 목표 | `hypertrophy`, `diet`, `strength`, `maintenance` | 세트/반복/휴식 방향 |
| 세션 시간 | `30`, `45`, `60`, `90` | 운동 개수와 볼륨 조절 |

성별은 `intensity_bias`로만 반영합니다. `female`이면 초기값을
`slightly_conservative`로 두되, 실제 강도 판단은 통증/나이/운동 수준/최종 사용자 확인을 우선합니다.

## 상황별 예시

1. 체육관, 중급, 통증 없음, 근비대 5분할
2. 집, 여성 초급, 무릎 통증, 체력 유지
3. 체육관, 고령 여성, 허리 통증, 저부하 건강 루틴
4. 집, 상급, 통증 없음, 스트렝스
5. 체육관, 여성 중급, 손목 통증, 다이어트

## 테스트

```powershell
.\.venv\Scripts\python.exe -m unittest tests.test_survey_scenarios
```
