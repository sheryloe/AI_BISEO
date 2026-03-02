# AI_Writer_TISTORY Service Runbook

## 목표
- 비서 채팅 `call_blog`와 대시보드에서 동일하게 블로그 파이프라인을 트리거한다.
- n8n 워크플로우의 LLM/이미지 생성 호출을 AI_BISEO OpenAI 브리지로 전환한다.
- 결과 실행(run) 이력을 대시보드에서 조회한다.

## 1) 필수 환경값
- `OPENAI_API_KEY`: OpenAI 호출용 키
- `N8N_BLOG_TRIGGER_WEBHOOK_URL`: n8n 블로그 트리거 URL
  - 예: `http://host.docker.internal:5678/webhook/ai-mother-tistory`
- `N8N_BLOG_CALLBACK_SECRET` (선택)
  - 설정하면 n8n -> AI_BISEO 브리지 호출 시 동일 헤더 인증 필요
- `N8N_CALLBACK_SECRET_HEADER` (기본 `X-N8N-SECRET`)

## 2) n8n 워크플로우 패치
아래 명령을 1회 실행하면, n8n 워크플로우의 `Agent_Editor/Agent_Artist/Agent_Director/Image_Generate`
노드 URL이 AI_BISEO 브리지로 교체되고 워크플로우가 재활성화된다.

```bash
npm run n8n:patch:ai-writer-openai
```

기본 대상:
- 컨테이너: `ai_mother_n8n`
- 브리지 베이스 URL: `http://host.docker.internal:3010`
- 워크플로우 이름: `AI Mother - Tistory Prompt Pack`

필요 시 환경 변수로 커스터마이즈:
- `N8N_CONTAINER_NAME`
- `N8N_WORKFLOW_ID`
- `AI_BISEO_BRIDGE_BASE_URL`
- `N8N_CALLBACK_SECRET_HEADER`
- `N8N_BLOG_CALLBACK_SECRET`

## 3) 실행 방법

### 비서 채팅 경로
- 대시보드 Assistant Sandbox:
  - 예: `티스토리 블로그 글 작성해줘: 2026년 상반기 AI 자동화 트렌드`
- 또는 API:
  - `POST /api/assistant/route`

### 대시보드 파이프라인 경로
- `AI Writer Pipeline` 카드에서:
  - Topic 입력
  - Image Count 지정
  - Trigger 실행
- 최근 run 목록과 상세 JSON 확인

## 4) 주요 API
- `POST /api/modules/AI_Writer_TISTORY/pipelines/trigger`
  - 수동 파이프라인 실행
- `GET /api/modules/AI_Writer_TISTORY/pipelines/runs`
  - 최근 실행 요약
- `GET /api/modules/AI_Writer_TISTORY/pipelines/runs/:runId`
  - 실행 상세 이벤트
- `POST /api/modules/AI_Writer_TISTORY/pipelines/llm/generate`
  - n8n용 OpenAI 텍스트 브리지 (Ollama 호환 응답 포맷)
- `POST /api/modules/AI_Writer_TISTORY/pipelines/image/generate`
  - n8n용 OpenAI 이미지 브리지 (`image_paths`, `image_urls` 반환)

## 5) 트러블슈팅
- `OPENAI_API_KEY가 설정되지 않았습니다.`
  - 대시보드 Settings 또는 `.env`에 키 설정
- `getaddrinfo ENOTFOUND host.docker.internal`
  - 로컬(Node 직접 실행) 환경에서 발생 가능
  - Docker 환경에서 실행하거나 n8n URL을 localhost 기준으로 재설정
- `failed to connect to the docker API at npipe`
  - Rancher Desktop/Docker 데몬 비활성 상태
  - 데몬 기동 후 패치 명령 재실행
