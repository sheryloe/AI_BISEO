# AI_BISEO Service Manual

AI_BISEO는 텔레그램 기반 멀티모듈 AI 비서 백엔드입니다.  
현재 서비스는 `Express + Socket.io + SQLite + n8n` 구조로 동작하며, 블로그 자동화 파이프라인과 비서 라우팅을 함께 제공합니다.

## 서비스 개요

- 텔레그램 입력을 수신하고 명령어 또는 자연어로 처리
- 의도 라우팅(`rag_search`, `call_blog`, `call_trading_status`, `call_ledger`, `call_coding_history`)
- RAG 저장/검색(SQLite)
- n8n 블로그 워크플로우 트리거 및 실행 추적
- 모듈 상태/히스토리 API + 웹 대시보드(`/dashboard`)
- Socket.io 실시간 이벤트 모니터링

## 핵심 아키텍처

- `src/services/telegram.service.ts`: 텔레그램 업데이트 수신, 명령어 처리
- `src/core/orchestrator/assistantController.ts`: 메인 비서 라우팅/응답
- `src/modules/interfaces/blogWorkflowClient.ts`: n8n 트리거 클라이언트
- `src/routes/n8nCallback.route.ts`: n8n 상태 콜백 수신
- `src/modules/ai_writer_tistory/openAiBridge.ts`: OpenAI 텍스트/이미지 브리지
- `src/routes/aiWriterPipeline.route.ts`: 파이프라인 트리거/조회/브리지 API

## 환경 변수

기본 파일: `.env.example` -> `.env`

필수 또는 사실상 필수 항목:

- `TELEGRAM_BOT_TOKEN`
- `N8N_BLOG_TRIGGER_WEBHOOK_URL`
- `N8N_BLOG_CALLBACK_SECRET` (권장)
- `OPENAI_API_KEY` (AI Writer 파이프라인 사용 시)

주요 운영 항목:

- `APP_PORT` (기본 `3000`)
- `TELEGRAM_MODE` (`polling` | `webhook` | `both`)
- `SOCKET_NAMESPACE` (기본 `/monitoring`)
- `N8N_BLOG_CALLBACK_BASE_PATH` + `N8N_BLOG_CALLBACK_ROUTE`

주의:

- `.env`와 실제 API 키는 절대 저장소에 커밋하지 않습니다.
- 대시보드에서 저장한 키는 런타임 적용되지만, 설정 일관성을 위해 재시작을 권장합니다.

## 로컬 실행

```bash
npm install
npm run dev
```

검증:

```bash
npm run typecheck
npm run test:smoke:phase1
```

## Docker 배포

```bash
npm run docker:up
```

또는:

```bash
docker compose up -d --build
```

영속 볼륨:

- `./storage/sqlite -> /app/storage/sqlite`
- `./storage/artifacts -> /app/storage/artifacts`
- `./logs -> /app/logs`

## 주요 엔드포인트

- `GET /health`
- `POST /api/assistant/route`
- `GET /api/assistant/history`
- `GET /api/modules`
- `GET /api/modules/:moduleId/status`
- `GET /api/modules/AI_Writer_TISTORY/pipelines/runs`
- `GET /api/modules/AI_Writer_TISTORY/pipelines/runs/:runId`
- `POST /api/modules/AI_Writer_TISTORY/pipelines/trigger`
- `POST /api/modules/AI_Writer_TISTORY/pipelines/llm/generate`
- `POST /api/modules/AI_Writer_TISTORY/pipelines/image/generate`
- `POST {N8N_BLOG_CALLBACK_BASE_PATH}{N8N_BLOG_CALLBACK_ROUTE}`

## 텔레그램 명령어

공통:

- `/help [topic]`, `/menu`
- `/ping`
- `/ask <질문>`

운영/점검:

- `/status`
- `/modules`
- `/history [개수]`

블로그 파이프라인:

- `/blog <주제>`
- `/pipeline [개수]`
- `/run <runId>`

라우팅 강제 실행:

- `/rag <질문>`
- `/trade [요청]`
- `/ledger [요청]`
- `/coding [요청]`

## 대시보드

- URL: `/dashboard`
- 기능:
- 모듈 상태 관제
- 비서 샌드박스 호출
- 파이프라인 트리거/실행 조회
- 실시간 이벤트 로그
- HTTP 에러 진단 조회

## 운영 런북

- AI Writer 전용: `docs/AI_WRITER_TISTORY_SERVICE_RUNBOOK.md`
- 도커 퀵스타트: `docs/PHASE1_DOCKER_QUICKSTART.md`

## 배포 체크리스트

- `npm run typecheck` 성공
- `npm run build` 성공
- `npm run test:smoke:phase1` 성공
- `/health` 200 확인
- 텔레그램 `/ping`, `/help`, `/status` 응답 확인
- 블로그 `/blog <주제>` 후 `/pipeline`, `/run <runId>` 확인

## 트러블슈팅

- `OPENAI_API_KEY가 설정되지 않았습니다`
- 원인: OpenAI 브리지 키 누락
- 조치: `.env` 또는 설정 API에 `OPENAI_API_KEY` 반영 후 재시작

- `n8n webhook 404`
- 원인: 워크플로우 publish/active 누락
- 조치: n8n에서 workflow publish 및 active 상태 확인

- 텔레그램 응답 없음
- 원인: `TELEGRAM_BOT_TOKEN` 누락, 허용 chat_id 제한, 모드 설정 불일치
- 조치: `.env` 점검 후 서버 로그 확인

## 유틸 스크립트

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm run test:smoke:phase1
npm run n8n:patch:ai-writer-openai
npm run notion:push:workspace
```
