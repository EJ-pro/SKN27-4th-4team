# HELBOTIN

> AI 기반 운동 상담, 운동 백과, 주간 루틴 설계를 한 번에 제공하는 개인 맞춤형 피트니스 웹 서비스

HELBOTIN은 사용자의 운동 목표, 통증 부위, 운동 가능 요일, 운동 시간 등을 바탕으로 운동 정보를 탐색하고 루틴을 설계할 수 있도록 돕는 서비스입니다.  
React 기반 프론트엔드와 Django REST 백엔드, PostgreSQL/pgvector, Neo4j, LangGraph 기반 LLM 파이프라인으로 구성되어 있습니다.

## 주요 기능

### AI 운동 상담

- 채팅 세션 생성, 조회, 이름 변경, 삭제
- SSE(Server-Sent Events) 기반 실시간 답변 스트리밍
- 비회원 사용자를 위한 `device_uuid` 기반 상담 기록 유지
- 로그인 사용자의 상담 세션 연동
- 운동 목표, 통증, 운동 방식에 대한 자연어 상담

### 운동 백과

- 운동 목록 조회 및 상세 정보 확인
- 카테고리, 장비, 난이도 기반 필터링
- 운동명 검색
- 운동별 가이드, 자세, 호흡, 주의사항, 관련 운동 제공
- 운동 미리보기 영상 및 상세 모달 제공

### 주간 루틴 설계

- 사용자 프로필, 통증 부위, 분할 방식, 운동 요일, 목표, 운동 시간 입력
- AI 기반 주간 운동 루틴 추천
- 추천 루틴 검토 및 피드백 반영
- 요일별 운동 목록, 세트/횟수, 완료 여부, 데일리 메모 저장
- 기존 루틴 조회 및 수정

### 인증

- 회원가입, 로그인, 로그아웃
- 현재 로그인 사용자 조회
- 이메일/닉네임 중복 확인
- 게스트 사용자와 로그인 사용자를 모두 지원하는 actor 처리

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | React 18, Vite, React Router, lucide-react, react-markdown |
| Backend | Python 3.12, Django 4.2, Django REST Framework |
| Database | PostgreSQL 16, pgvector |
| Graph DB | Neo4j, APOC, Graph Data Science |
| AI / LLM | LangGraph, LangChain, OpenAI, Groq, Ollama 지원 |
| Infra | Docker, Docker Compose |

## 프로젝트 구조

```text
.
├── backend/
│   ├── api/
│   │   ├── auth_views.py
│   │   ├── models.py
│   │   ├── views.py
│   │   └── services/
│   │       ├── chatbot/
│   │       ├── llm/
│   │       ├── RAG/
│   │       └── routine_recommender.py
│   ├── config/
│   ├── data/
│   ├── db/
│   ├── Dockerfile
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   └── utils/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .env.sample
└── README.md
```

## 시작하기

### 1. 환경 변수 설정

```bash
cp .env.sample .env
```

`.env`에서 아래 값을 프로젝트 환경에 맞게 설정합니다.

```env
DB_NAME=postgresdb
DB_USER=postgres
DB_PASSWORD=password

SECRET_KEY=django-insecure-change-me
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-nano

LLM_PROVIDER=openai
EMBEDDING_PROVIDER=openai

NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=test1234
NEO4J_AUTH=neo4j/test1234
```

### 2. Docker Compose 실행

```bash
docker compose up --build
```

실행 후 아래 주소로 접속합니다.

| 서비스 | 주소 |
| --- | --- |
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Neo4j Browser | http://localhost:7474 |
| PostgreSQL | localhost:5432 |

백엔드 컨테이너는 시작 시 다음 작업을 순서대로 수행합니다.

- 운동 데이터 적재
- 근육 데이터 적재
- Django migration 실행
- pgvector 기반 RAG 데이터 준비
- Django 개발 서버 실행

## 로컬 개발 실행

Docker 없이 프론트엔드와 백엔드를 따로 실행할 수도 있습니다.  
단, PostgreSQL과 Neo4j는 별도로 실행되어 있어야 합니다.

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Windows PowerShell에서는 가상환경 활성화 명령을 아래처럼 사용합니다.

```powershell
.\.venv\Scripts\Activate.ps1
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

프론트엔드 API 주소는 기본값으로 `http://localhost:8000`을 사용합니다.  
필요하면 `VITE_API_URL` 환경 변수로 변경할 수 있습니다.

## 주요 API

| Method | Endpoint | 설명 |
| --- | --- | --- |
| `GET` | `/api/exercises/` | 운동 목록 조회 |
| `GET` | `/api/exercises/?full=1` | 운동 전체 정보 조회 |
| `GET` | `/api/exercises/featured/` | 추천 운동 목록 조회 |
| `GET` | `/api/exercises/<exercise_id>/` | 운동 상세 조회 |
| `GET` | `/api/sessions/` | 상담 세션 목록 조회 |
| `POST` | `/api/sessions/` | 상담 세션 생성 |
| `PATCH` | `/api/sessions/<session_id>/` | 상담 세션 이름 변경 |
| `DELETE` | `/api/sessions/<session_id>/` | 상담 세션 삭제 |
| `GET` | `/api/sessions/<session_id>/messages/` | 상담 메시지 조회 |
| `POST` | `/api/sessions/<session_id>/messages/` | 상담 메시지 전송 및 SSE 응답 수신 |
| `POST` | `/api/auth/register/` | 회원가입 |
| `POST` | `/api/auth/login/` | 로그인 |
| `POST` | `/api/auth/logout/` | 로그아웃 |
| `GET` | `/api/auth/me/` | 현재 사용자 조회 |
| `GET` | `/api/auth/check-nickname/` | 닉네임 중복 확인 |
| `GET` | `/api/auth/check-email/` | 이메일 중복 확인 |
| `GET` | `/api/routines/` | 주간 루틴 조회 |
| `POST` | `/api/routines/` | 주간 루틴 저장 |
| `POST` | `/api/routines/recommend/` | AI 루틴 추천 시작 |
| `POST` | `/api/routines/recommend/review/` | 추천 루틴 검토/수정 요청 |

## 화면 구성

| 경로 | 화면 |
| --- | --- |
| `/` | 메인 페이지 |
| `/exercise` | 운동 백과 |
| `/routine` | 주간 루틴 설계 및 관리 |
| `/consult` | AI 운동 상담 챗봇 |
| `/login` | 로그인 |
| `/register` | 회원가입 |

## 데이터베이스 구성

### PostgreSQL / pgvector

- 사용자 정보
- 운동 데이터
- 상담 세션 및 메시지
- 주간 스케줄러와 일별 루틴
- 운동 임베딩 검색용 vector 데이터

### Neo4j

- 운동과 근육 관계 그래프
- 근육 간 관계
- 루틴 추천과 운동 대체 추천에 활용 가능한 그래프 데이터

## LLM Provider

`.env`의 `LLM_PROVIDER` 값으로 LLM 실행 방식을 선택합니다.

| Provider | 설명 |
| --- | --- |
| `openai` | OpenAI API 사용 |
| `groq` | Groq API 사용 |
| `ollama` | 로컬 Ollama 모델 사용 |

게스트 사용자에게 LLM 사용을 제한하려면 아래 값을 `True`로 설정합니다.

```env
CHATBOT_REQUIRE_AUTH=True
```

## 개발 메모

- 프론트엔드는 Vite 개발 서버를 사용하며 기본 포트는 `5173`입니다.
- 백엔드는 Django 개발 서버를 사용하며 기본 포트는 `8000`입니다.
- Docker Compose 실행 시 DB 스키마는 `backend/db/schema.sql`, `backend/db/schema_muscles.sql`을 통해 초기화됩니다.
- 운동 데이터는 `backend/data/`와 `backend/db/load_*.py` 스크립트를 통해 적재됩니다.
- `.env`는 커밋하지 말고 `.env.sample`을 기준으로 로컬에서 생성해 사용합니다.

## 팀

SKN27 4th 4team
