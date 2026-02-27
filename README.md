# AI_BISEO

모듈형 AI 비서 시스템의 메인 컨트롤러입니다.  
현재 구성은 `Node.js (TypeScript) + Express + Socket.io + SQLite` 기반이며, 텔레그램 입력 처리, RAG 조회, 모듈 라우팅, n8n 콜백 수신의 코어 골격을 포함합니다.

## 핵심 기능

- 텔레그램 메시지 수신/응답 처리
- 의도 기반 라우팅(로컬 규칙 기반)
- RAG 저장/조회(SQLite)
- n8n 블로그 파이프라인 콜백 수신
- 모듈 상태/이력 조회 API
- 모니터링 Socket.io 네임스페이스 제공

## 기술 스택

- Runtime: Node.js 20+
- Language: TypeScript
- Server: Express, Socket.io
- DB: SQLite (`sqlite3`, `sqlite`)
- Integration: Telegraf, OpenAI SDK, Notion SDK
- Container: Docker Compose

## 빠른 시작

### 1) 환경 변수 준비

```bash
cp .env.example .env
```

`.env`에 최소한 아래 값들을 채워야 합니다.

- `TELEGRAM_BOT_TOKEN`
- `OPENAI_API_KEY` (사용 시)
- `NOTION_API_KEY` / `NOTION_PARENT_PAGE_ID` (사용 시)
- `N8N_BLOG_TRIGGER_WEBHOOK_URL` / `N8N_BLOG_CALLBACK_SECRET` (사용 시)

주의:
- `.env`는 커밋 대상이 아닙니다.
- 실제 키/토큰은 절대 저장소에 푸시하지 않습니다.

### 2) 로컬 실행

```bash
npm install
npm run dev
```

기본 포트: `3000`

### 3) Docker 실행

```bash
docker compose up -d
```

영속 데이터는 Host 경로로 마운트됩니다.

- `./storage/sqlite -> /app/storage/sqlite`
- `./storage/artifacts -> /app/storage/artifacts`
- `./logs -> /app/logs`

## 주요 엔드포인트

- `GET /health`: 서버 헬스 체크
- `POST /api/assistant/route`: 사용자 입력 라우팅/응답
- `GET /api/rag/*`: RAG 데이터 조회 계열
- `GET /api/modules/*`: 모듈 상태/이력 조회 계열
- `POST {N8N_BLOG_CALLBACK_BASE_PATH}{N8N_BLOG_CALLBACK_ROUTE}`: n8n 콜백 수신

## 모니터링

- Socket.io namespace: `.env`의 `SOCKET_NAMESPACE` (기본 `/monitoring`)
- 대시보드 제공 방식:
  - `DASHBOARD_SERVE_MODE=single`: 백엔드가 `/dashboard`로 정적 파일 서빙
  - `DASHBOARD_SERVE_MODE=separate`: 프론트 분리 운영

## 프로젝트 구조

```text
src/
  core/
    db/              # SQLite 연결/리포지토리
    llm/             # LLM 추상화
    orchestrator/    # Assistant 제어
    router/          # 의도 라우팅
  modules/           # 모듈 레지스트리 및 모듈별 어댑터
  routes/            # API/Webhook 라우터
  services/          # Telegram 등 외부 연동
docs/                # 설계 문서
prompt_log/          # 프롬프트/세션 기록
storage/             # DB/아티팩트 영속 저장
```

## 현재 구현 범위 (Phase 1 중심)

- 메인 비서 코어 라우팅 구조
- 텔레그램 연동 골격
- n8n 블로그 콜백 수신/추적
- SQLite 기반 대화/로그/RAG 저장소
- 외부 모듈 호출 인터페이스 스텁

## 개발 스크립트

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm run notion:push:workspace
```
