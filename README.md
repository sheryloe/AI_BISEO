# AI_BISEO

AI_BISEO는 모듈형 AI 비서 백엔드입니다. Telegram, Web Route, RAG, n8n 연동을 포함합니다.

## 실행
```bash
npm install
npm run dev
```

Docker:
```bash
docker compose up -d --build
```

## 핵심 경로
- `/health`
- `/dashboard`
- `/service`
- `/manual`
- `/api/assistant/route`
- `/api/modules/attachments`

## 환경변수 정책
- `.env`는 로컬 비공개 파일입니다.
- Git 커밋 금지: `.env`, `.env.*`
- 예시 템플릿은 `.env.example`만 추적합니다.

## Prompt Log
- 입력 프롬프트를 자동 저장합니다.
- 파일: `prompt_log/YYYY-MM-DD_prompts.jsonl`
- 소스: `/api/assistant/route`, Telegram 메시지

## 운영 점검
```bash
npm run typecheck
npm run ops:check
```

## Notion 동기화
```bash
npm run notion:push:workspace
npm run notion:push:daily
```

필수:
- `NOTION_API_KEY`
- `NOTION_PARENT_PAGE_ID`

## TLS (사내망)
- `certs/eprism.crt`를 Docker 이미지 신뢰 저장소에 반영해 Telegram HTTPS 호출을 처리합니다.

## 문서
- [프로젝트 구조](docs/PROJECT_STRUCTURE.md)
- [일일 상태 2026-03-03](docs/DAILY_STATUS_2026-03-03.md)
- [일일 상태 2026-03-04](docs/DAILY_STATUS_2026-03-04.md)
