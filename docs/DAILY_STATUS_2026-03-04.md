# Daily Status - 2026-03-04

## Scope
- 프롬프트 로그 자동 저장 강제 적용 (Web Route + Telegram)
- 운영 규칙 점검 스크립트(`npm run ops:check`) 추가
- Notion Daily 업로드 스크립트 개선(오늘 파일 없으면 최신 Daily 파일 자동 선택)
- Docker 사내 인증서(eprism) 신뢰 처리 반영
- 텔레그램 설정 복구 및 컨테이너 재기동 검증

## Security / Env Policy
- `.env`는 로컬 비공개 파일로만 관리
- Git 추적 제외 유지: `.env`, `.env.*` (예외: `.env.example`)
- Prompt JSONL 로그는 운영 산출물로 간주하여 Git 추적 제외(`prompt_log/*.jsonl`)

## Prompt Log
- 저장 경로: `prompt_log/YYYY-MM-DD_prompts.jsonl`
- 기록 소스:
  - `POST/GET /api/assistant/route`
  - Telegram 텍스트 메시지 입력

## Docker / TLS
- `certs/eprism.crt`를 컨테이너 CA store에 등록
- `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt` 적용
- 컨테이너 내부 `https://api.telegram.org/bot.../getMe` 호출 200 확인

## Runtime Verification
- `npm run typecheck` 통과
- `npm run ops:check` 통과
- `npm run notion:push:daily` 성공
- `docker compose up -d --build` 후 엔드포인트 정상:
  - `GET /health` 200
  - `GET /dashboard/` 200
  - `GET /service/` 200
  - `GET /manual/` 200
  - `GET /api/modules/attachments` 200

## Notes
- Telegram은 현재 `polling` 모드로 설정
- Webhook은 `TELEGRAM_WEBHOOK_URL` 미설정 상태에서는 비활성
