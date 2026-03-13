# AI_BISEO 3단계: 모듈 공통 관리 레이어와 블로그 자동화 파이프라인 확장

- 권장 슬러그: `ai-biseo-step-3-module-layer-and-pipeline`
- SEO 설명: `AI_BISEO를 기능 모음에서 운영 플랫폼으로 바꾼 Step 3 기록입니다. 모듈 공통 API와 AI Writer 파이프라인 추적 구조를 함께 설명합니다.`
- 핵심 키워드: `module registry`, `AI_BISEO step 3`, `blog automation pipeline`, `Node.js platform`, `Notion ops`
- 대표 이미지 ALT: `AI_BISEO 모듈 관리 API와 파이프라인 추적 구조`

## 들어가며

Step 3부터는 이 프로젝트가 여러 기능이 모인 서버인지, 아니면 운영 가능한 플랫폼인지가 갈렸습니다. 저는 후자를 선택했고, 그래서 상태·설정·이력을 모듈 공통 인터페이스로 올리는 데 집중했습니다.

## 이번 단계에서 집중한 문제

- 모듈 수가 늘어나도 운영 방식이 바뀌지 않는 공통 API가 필요했습니다.
- n8n 콜백을 단순 로그로 버리지 않고 실행 이력으로 남겨야 했습니다.
- AI Writer 파이프라인을 `runId` 기준으로 추적할 수 있어야 실제 운영 문서와 연결이 됩니다.

## 이렇게 코드를 반영했다

### 1. 모듈 상태 API를 한 경로로 묶은 부분
- 파일: `src/index.ts`
- 왜 넣었는가: 대시보드와 운영 스크립트가 같은 계약으로 상태를 읽어야 플랫폼처럼 다룰 수 있기 때문입니다.

```typescript
const moduleRouter = createModuleRouter({ registry: moduleRegistry });
app.use("/api/modules", moduleRouter);
```

### 2. AI Writer 파이프라인 전용 라우터를 분리한 부분
- 파일: `src/routes/aiWriterPipeline.route.ts`
- 왜 넣었는가: 블로그 자동화는 `지금 어느 단계까지 왔는가`를 실행 단위로 읽을 수 있어야 운영성이 생깁니다.

```typescript
app.use("/api/modules/AI_Writer_TISTORY/pipelines", aiWriterPipelineRouter);
tracker.appendEvent({ runId, agentKey, status });
```

## 적용 결과

- AI_BISEO는 개별 기능 서버가 아니라 운영 허브에 가까운 형태로 바뀌었습니다.
- 블로그 자동화 실행 상태를 Step 단위가 아니라 run 단위로 읽을 수 있게 됐습니다.
- 마지막 글에서 Repository와 Live Page를 자연스럽게 연결할 수 있는 스토리라인이 생겼습니다.

## 티스토리 SEO 정리 포인트

- 마지막 글에는 `플랫폼으로 확장됐다`는 메시지를 전면에 두는 편이 좋습니다.
- Step 3는 결과와 다음 액션을 함께 적어야 시리즈 마무리가 자연스럽습니다.
- 하단 CTA에는 Repository와 Live Page를 모두 노출합니다.

## 마지막 페이지에 붙일 링크

- Repository: https://github.com/sheryloe/AI_BISEO
- Live Page: https://sheryloe.github.io/AI_BISEO/
- 추천 문장: `AI_BISEO의 실제 코드와 소개 페이지는 아래 링크에서 바로 확인할 수 있습니다.`

## 마무리

AI_BISEO의 Step 3은 기술적으로는 모듈 API 확장이지만, 글의 흐름으로 보면 프로젝트가 운영 플랫폼으로 성숙해지는 전환점이었습니다.
