# AI_BISEO (초등학생도 따라하는 사용법)

AI_BISEO는 **AI 비서 + 블로그 자동화**를 한 번에 관리하는 도구예요.

- 질문하면 비서처럼 답해줘요.
- n8n과 연결해서 블로그 글 자동화도 할 수 있어요.
- 대시보드에서 상태를 눈으로 확인할 수 있어요.

---

## 1. 준비물

1. Docker 또는 Rancher Desktop
2. Node.js 20 이상
3. 이 저장소 코드

---

## 2. 제일 쉬운 실행 (Docker)

```bash
npm run docker:up
```

잘 켜졌는지 보기:

```bash
docker compose ps
```

끄기:

```bash
npm run docker:down
```

로그 보기:

```bash
npm run docker:logs
```

---

## 3. 접속 주소

현재 기본 주소(로컬 PC 기준):

- 대시보드: `http://127.0.0.1:3010/dashboard`
- 서버 상태: `http://127.0.0.1:3010/health`
- 설정 API: `http://127.0.0.1:3010/api/settings/env`

n8n 주소:

- n8n 화면: `http://127.0.0.1:5678`
- 블로그 웹훅 예시: `http://127.0.0.1:5678/webhook/ai-mother-tistory`

---

## 4. API 키 입력 방법

1. `http://127.0.0.1:3010/dashboard` 접속
2. 왼쪽 메뉴에서 `Settings` 클릭
3. 필요한 값 입력 후 `Save Settings`

주요 입력 항목:

- `OpenAI API Key`
- `Telegram Bot Token`
- `Telegram Allowed Chat IDs`
- `n8n Callback Secret`
- `Notion API Key`
- `Notion Parent Page ID`

---

## 5. 블로그 자동화 테스트

1. 대시보드에서 `Pipeline` 탭으로 이동
2. Topic 입력
3. `Trigger` 클릭
4. Run 목록과 상세 로그 확인

---

## 6. 자주 생기는 문제

### A) 포트 충돌
- 증상: 서버가 안 켜짐
- 해결: `.env`에서 `APP_PORT` 변경 (예: `3010`)

### B) OpenAI 오류
- 증상: `OPENAI_API_KEY가 설정되지 않았습니다.`
- 해결: `Settings`에서 OpenAI 키 저장

### C) n8n 401 Unauthorized
- 해결: `N8N_BLOG_CALLBACK_SECRET` 값과 헤더 값(`X-N8N-SECRET`)이 같은지 확인

### D) 텔레그램 응답 없음
- `TELEGRAM_BOT_TOKEN` 확인
- `TELEGRAM_ALLOWED_CHAT_IDS`에 내 chat_id가 있는지 확인

---

## 7. 개발 명령어

```bash
npm run dev
npm run typecheck
npm run build
npm run test:smoke:phase1
npm run docker:up
npm run docker:down
npm run docker:logs
npm run n8n:patch:ai-writer-openai
npm run notion:push:workspace
```

---

## 8. 안전하게 쓰는 규칙

1. 진짜 API 키는 Git에 올리지 않기
2. 시크릿 값은 주기적으로 바꾸기
3. 외부 공개 서버로 열 때는 인증/방화벽 설정 꼭 하기

---

## 9. 한 줄 요약

- 실행: `npm run docker:up`
- 접속: `http://127.0.0.1:3010/dashboard`
- 설정: `Settings`
- 자동화 테스트: `Pipeline` → `Trigger`

이 4단계만 기억하면 바로 쓸 수 있어요.
