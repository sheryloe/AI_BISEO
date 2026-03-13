# AI_BISEO 2단계: Express와 Ops Console로 운영 루프를 만든 과정

- 권장 슬러그: `ai-biseo-step-2-express-ops-console`
- SEO 설명: `AI_BISEO에서 Express 메인 서버, Socket.io 모니터링, Ops Console 화면을 어떻게 연결했는지 정리한 2단계 글입니다.`
- 핵심 키워드: `Express dashboard`, `Socket.io monitoring`, `Ops Console`, `AI_BISEO`, `Node.js backend`
- 대표 이미지 ALT: `AI_BISEO Ops Console 화면과 Express 서버 흐름`

## 들어가며

기반 구조를 고정한 다음에는 실제 운영 루프를 만드는 작업으로 넘어갔습니다. 여기서 중요한 것은 기능 수보다 입력과 상태가 한 화면으로 모이는 흐름이었습니다. Telegram, n8n, 내부 모듈 상태를 한 서버 경계로 묶어야 대시보드가 의미를 갖기 때문입니다.

## 이번 단계에서 집중한 문제

- HTTP 요청, webhook, 상태 브로드캐스트를 한 서버 안에서 분리해야 했습니다.
- 대시보드는 멋진 SPA보다 운영용 정적 화면으로 빠르게 열리는 쪽이 더 중요했습니다.
- `health`, `diagnostics`, `settings` 같은 운영 경로가 먼저 있어야 디버깅 비용이 줄어듭니다.

## 이렇게 코드를 반영했다

### 1. Express 서버에 대시보드와 API를 함께 붙인 구조
- 파일: `src/index.ts`
- 왜 넣었는가: 운영자는 여러 주소를 오가지 않고 한 서버 경계 안에서 상태와 설정을 같이 봐야 했기 때문입니다.

```typescript
app.use("/api/modules", moduleRouter);
app.use("/api/settings", configRouter);
app.use("/dashboard", express.static(dashboardDir));
```

### 2. 대시보드에서 상태를 소켓과 API로 함께 읽는 흐름
- 파일: `dashboard/public/app.js`
- 왜 넣었는가: 실시간 이벤트와 수동 새로고침이 함께 있어야 운영 중 끊김이 생겨도 복구가 쉽습니다.

```javascript
const socket = io("/monitoring");
fetch("/api/modules");
socket.on("http:request", (payload) => appendEvent(payload));
```

## 적용 결과

- Ops Console 메인 화면, Assistant, Pipeline, Settings 계열 화면이 하나의 흐름으로 묶였습니다.
- 운영자가 실제로 보는 정보 단위를 API와 UI 양쪽에서 비슷하게 맞췄습니다.
- Step 3에서 모듈 공통 계층을 올리기 좋은 허브 형태가 만들어졌습니다.

## 티스토리 SEO 정리 포인트

- 서버와 화면을 어떻게 연결했는지 흐름도로 보여 주면 구현 글 설득력이 올라갑니다.
- 대시보드 캡처에는 프로젝트명과 화면 용도를 함께 alt에 쓰는 편이 좋습니다.
- `운영 루프`, `모니터링 콘솔` 같은 표현이 검색 유입 문장으로도 잘 작동합니다.

## 마무리

Step 2는 UI를 예쁘게 만든 단계가 아니라 운영 루프를 열어 둔 단계였습니다. 이제부터는 어떤 기능을 추가해도 같은 콘솔 안에서 관찰하고 조정할 수 있게 됐습니다.
