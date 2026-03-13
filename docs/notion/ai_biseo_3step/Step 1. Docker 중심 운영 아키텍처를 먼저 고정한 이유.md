# AI_BISEO 1단계: Docker 중심 운영 아키텍처를 먼저 고정한 이유

- 권장 슬러그: `ai-biseo-step-1-docker-ops-architecture`
- SEO 설명: `AI_BISEO에서 왜 기능보다 Docker 기반 운영 구조, 환경 변수 분리, 데이터 영속성 설계를 먼저 잡았는지 정리한 1단계 글입니다.`
- 핵심 키워드: `AI_BISEO`, `AI assistant dashboard`, `Docker Node.js`, `운영 아키텍처`, `Notion automation`
- 대표 이미지 ALT: `AI_BISEO Docker 운영 구조 설계 메모`

## 들어가며

AI_BISEO는 단순한 챗봇 서버가 아니라 AI 비서, 블로그 자동화, Notion 로그가 함께 돌아가는 운영형 프로젝트였습니다. 그래서 첫 단계에서는 기능을 더하기보다 컨테이너를 다시 올려도 데이터가 남고, 환경 변수 실수 범위를 통제할 수 있는 구조를 먼저 고정했습니다.

## 이번 단계에서 집중한 문제

- SQLite, artifacts, logs를 Host 기준으로 남기는 볼륨 전략이 필요했습니다.
- `.env.example`와 실제 `.env`를 분리해 키 노출 범위를 줄여야 했습니다.
- 이후 모듈이 늘어나도 구조가 흔들리지 않게 `src/modules` 경계를 먼저 잡아야 했습니다.

## 이렇게 코드를 반영했다

### 1. Docker 볼륨으로 영속성 확보
- 파일: `docker-compose.yml`
- 왜 넣었는가: 컨테이너를 재생성해도 SQLite와 산출물이 남아야 운영 로그가 끊기지 않기 때문입니다.

```yaml
volumes:
  - ./storage/sqlite:/app/storage/sqlite
  - ./storage/artifacts:/app/storage/artifacts
  - ./logs:/app/logs
```

### 2. zod 기반 환경 변수 기본값 정리
- 파일: `src/core/env.ts`
- 왜 넣었는가: 어떤 값이 비어 있어도 서버가 바로 죽지 않게 하고, 필수 키 목록을 코드에서 분명히 보이게 하기 위함입니다.

```typescript
const envSchema = z.object({
  APP_PORT: z.coerce.number().int().positive().default(3000),
  DASHBOARD_SERVE_MODE: z.enum(["single", "separate"]).default("single"),
  NOTION_API_KEY: z.string().default(""),
});
```

## 적용 결과

- 운영 데이터와 코드 수명주기를 분리한 기본 아키텍처를 확보했습니다.
- Docker 재기동 이후에도 남아야 하는 경로를 문서와 코드로 동시에 고정했습니다.
- Step 2부터는 서버 기능 자체에 집중할 수 있는 바닥 구조를 만들었습니다.

## 티스토리 SEO 정리 포인트

- 도입부에서 `왜 기능보다 구조를 먼저 잡았는가`를 분명히 적는 편이 좋습니다.
- `Docker`, `Node.js`, `운영형 AI 비서` 같은 검색어를 소제목에 직접 노출합니다.
- 이미지는 docker-compose 구조도나 폴더 트리 캡처가 잘 맞습니다.

## 마무리

Step 1은 화려한 기능을 보여 주는 단계가 아니라, AI_BISEO를 오래 굴릴 수 있게 만드는 기반 공사였습니다.
