import { Client } from "@notionhq/client";
import { config } from "dotenv";

config();

interface ExampleCode {
  제목: string;
  언어: string;
  코드: string;
}

interface TodoItem {
  작업: string;
  완료: boolean;
  완료일?: string;
  수행방법: string[];
}

interface StepRecord {
  페이지제목: string;
  블로그본문: string[];
  예시코드: ExampleCode[];
  핵심포인트: string[];
  결과: string[];
  다음액션: string[];
  할일: TodoItem[];
}

const stepRecords: StepRecord[] = [
  {
    페이지제목: "[AI_BISEO] Step 1 - 시스템 설계 및 인프라 구축",
    블로그본문: [
      "AI_BISEO 프로젝트의 첫 단계는 기능 구현보다 시스템의 수명을 길게 만드는 토대를 먼저 잡는 작업이었다. 특히 이번 프로젝트는 메인 서버를 컨테이너에서 실행하더라도 데이터는 반드시 로컬에 남아야 했기 때문에, 코드 실행 경로와 데이터 저장 경로를 처음부터 분리하는 것이 가장 중요한 목표였다.",
      "설계를 시작하면서 가장 먼저 확인한 원칙은 세 가지였다. 첫째, 비서 기능 중심의 모듈 구조를 유지할 것. 둘째, 시스템 관리자 영역(환경설정/핵심 인프라)은 임의로 건드리지 않을 것. 셋째, 컨테이너가 교체되어도 데이터와 산출물이 살아남도록 스토리지를 호스트 볼륨으로 고정할 것이다. 이 기준이 잡히면서 파일 구조와 docker-compose의 방향이 자연스럽게 결정됐다.",
      "디렉토리 구조는 운영 관점으로 분해했다. 런타임 코드와 모듈 코드는 src에, 대시보드는 dashboard에, 실제 데이터는 storage/sqlite와 storage/artifacts에 두었다. 이렇게 나누면 향후 트렌드 파서, 오토트레이딩, 코딩 이력 모듈이 추가되더라도 기존 모듈과 충돌 없이 독립적으로 확장할 수 있다.",
      "컨테이너 구성에서는 Node.js 서버를 실행하는 서비스 하나를 우선 두고, 볼륨 마운트에 집중했다. 핵심은 sqlite 파일과 산출물이 컨테이너 내부가 아닌 로컬 디스크에 저장되도록 경로를 강제하는 것이다. 이 덕분에 이미지 재빌드, 컨테이너 재생성, 개발환경 초기화 같은 이벤트가 발생해도 핵심 데이터가 유실되지 않는다.",
      "환경변수 설계도 같은 기준으로 정리했다. Telegram, Notion, OpenAI, n8n 관련 키를 .env.example에 명시하되 실제 값은 .env에서만 관리하도록 분리했다. 동시에 .gitignore 규칙을 강화해 .env와 파생 파일이 저장소에 섞이지 않게 막았다. 이 조치는 이후 협업 시 보안사고를 예방하는 데에도 직접적인 효과가 있다.",
      "TypeScript 설정은 과한 프레임워크 의존 없이 최소한의 안전장치에 집중했다. strict 모드를 활성화하고, 빌드/실행 스크립트를 분리해 개발 모드와 배포 모드를 명확히 나누었다. 이렇게 만들어 두면 이후 모듈이 늘어나도 타입 안정성을 유지하면서 코드 리팩토링이 가능하다.",
      "Step 1의 진짜 성과는 단순히 파일 몇 개를 만든 것이 아니라 운영 가능한 기준선을 만들었다는 점이다. 어느 폴더에 무엇이 있어야 하는지, 어떤 데이터가 어디에 살아야 하는지, 어떤 값은 절대 Git에 올라가면 안 되는지에 대한 팀 공통 기준이 생겼다.",
      "이 단계가 없었다면 뒤 단계에서 기능은 돌아가도 운영 중 예외가 쌓였을 것이다. 그래서 Step 1은 눈에 보이는 화려한 기능보다, 프로젝트를 오래 버티게 하는 기반 공사에 해당한다.",
    ],
    예시코드: [
      {
        제목: "Host 볼륨 마운트 핵심 설정",
        언어: "yaml",
        코드: "volumes:\n  - ./storage/sqlite:/app/storage/sqlite\n  - ./storage/artifacts:/app/storage/artifacts\n  - ./logs:/app/logs",
      },
      {
        제목: "환경변수 분리 샘플",
        언어: "bash",
        코드: "# .env.example\nNOTION_API_KEY=your_notion_api_key\nN8N_BLOG_CALLBACK_SECRET=your_n8n_callback_secret",
      },
    ],
    핵심포인트: [
      "데이터는 컨테이너가 아니라 Host 볼륨에 저장한다.",
      ".env는 저장소 추적 대상에서 제외한다.",
      "모듈 확장을 고려해 디렉토리 구조를 먼저 고정한다.",
    ],
    결과: [
      "docker-compose.yml, package.json, tsconfig.json, .env.example 구성 완료",
      "모듈형 디렉토리 골격 생성 완료",
      "운영 기준(데이터 보존/보안/구조) 정립 완료",
    ],
    다음액션: [
      "Express + Socket.io 서버 골격 구축",
      "Telegram/n8n 이벤트 수집 경로 개통",
    ],
    할일: [
      {
        작업: "디렉토리 구조 설계 및 생성",
        완료: true,
        완료일: "2026-02-27",
        수행방법: [
          "src/modules 하위 모듈 독립 경로 분리",
          "storage/logs/dashboard 운영 폴더 사전 생성",
        ],
      },
      {
        작업: "Docker 볼륨 영속성 설정",
        완료: true,
        완료일: "2026-02-27",
        수행방법: [
          "storage/sqlite와 storage/artifacts를 Host 볼륨으로 마운트",
          "컨테이너 재생성 후 데이터 잔존 전제 확인",
        ],
      },
      {
        작업: "보안형 환경변수 관리 규칙 확정",
        완료: true,
        완료일: "2026-02-27",
        수행방법: [
          ".env.example 템플릿 분리",
          ".gitignore에 .env/.env.* 차단 규칙 적용",
        ],
      },
    ],
  },
  {
    페이지제목: "[AI_BISEO] Step 2 - 메인 서버 및 UI 뼈대",
    블로그본문: [
      "Step 2에서는 이제 실제로 요청을 받고 상태를 중계하는 메인 서버의 최소 골격을 만들었다. 목표는 화려한 UI를 만드는 것이 아니라, Telegram 입력과 n8n 콜백 같은 외부 이벤트를 안정적으로 수신하고 내부 표준 이벤트로 변환하는 오케스트레이션 루프를 여는 것이었다.",
      "서버의 중심은 Express와 Socket.io 조합으로 잡았다. Express는 API와 webhook endpoint를 담당하고, Socket.io는 각 모듈의 실시간 진행 상태를 대시보드로 전달한다. 이렇게 역할을 분리하면 HTTP 요청/응답 흐름과 실시간 모니터링 흐름을 서로 간섭 없이 운영할 수 있다.",
      "Telegram 연동은 서비스 레이어로 분리해 메인 index.ts가 비대해지지 않도록 조정했다. 또한 운영 환경을 고려해 polling, webhook, both 모드를 모두 지원하도록 설계했다. 실제 Telegram 특성상 완전한 동시 수신은 제한이 있기 때문에 both 모드는 webhook 우선, polling 폴백 전략으로 운용한다.",
      "n8n 콜백은 별도 라우터에서 받아 X-N8N-SECRET 헤더로 인증하도록 고정했다. 여기서 중요한 부분은 단순 성공 응답이 아니라, 수신된 payload를 내부 표준 이벤트 형태로 정리해 대시보드와 모듈 이력 계층에 동일하게 전달하는 흐름을 만든 것이다.",
      "이 단계에서 실시간 모니터링 네임스페이스를 /monitoring으로 고정해 두었기 때문에, 이후 어떤 모듈이 추가되더라도 이벤트명을 약속만 하면 동일한 대시보드에서 통합 관제가 가능하다. 즉 Step 2는 기능 구현보다 관제 채널을 여는 단계라고 볼 수 있다.",
      "실제로 서버 헬스체크와 주요 라우트를 함께 구성해 Docker 내부에서 실행 확인까지 마쳤다. 이 검증 과정을 통해 이벤트 수신, 인증, 브로드캐스트라는 핵심 루프가 기본 수준에서 정상 동작함을 확인했다.",
      "Step 2의 성과는 메인 컨트롤러가 단순 API 서버를 넘어 모듈 운영 허브로 움직이기 시작했다는 점이다. 이제부터는 각 모듈의 상태/설정/이력을 공통 API로 묶는 작업만 추가하면 운영 관점에서의 일관성을 확보할 수 있다.",
      "결국 Step 2는 ‘연결’의 단계였다. Telegram, n8n, 대시보드가 하나의 서버 경계 안에서 상호 연동되는 기본 관문을 만든 것이 핵심이다.",
    ],
    예시코드: [
      {
        제목: "n8n 상태 이벤트 브로드캐스트",
        언어: "typescript",
        코드: "emitMonitoringEvent(\"n8n:blog_status\", {\n  moduleId: \"AI_Writer_TISTORY\",\n  event,\n});",
      },
      {
        제목: "텔레그램 기본 응답 처리",
        언어: "typescript",
        코드: "const replyText = `수신한 메시지: ${incomingText}\\n(현재는 Step 2 기본 응답 모드입니다.)`;\nawait ctx.reply(replyText);",
      },
    ],
    핵심포인트: [
      "Express는 요청 처리, Socket.io는 상태 중계로 역할을 분리한다.",
      "n8n 콜백은 반드시 헤더 인증을 통과해야 반영한다.",
      "Telegram both 모드는 webhook 우선 + polling 폴백으로 운용한다.",
    ],
    결과: [
      "메인 서버 골격 및 health endpoint 구성 완료",
      "Telegram/n8n 수신 루트 개통 완료",
      "실시간 모니터링 이벤트 전송 기반 확보",
    ],
    다음액션: [
      "모듈 공통 상태/설정/이력 API 구축",
      "콜백 이벤트를 모듈별 이력 저장 계층과 연동",
    ],
    할일: [
      {
        작업: "Express + Socket.io 초기 서버 구성",
        완료: true,
        완료일: "2026-02-27",
        수행방법: [
          "health endpoint/monitoring namespace/기본 미들웨어 구성",
          "single 모드 정적 대시보드 라우트 연결",
        ],
      },
      {
        작업: "Telegram 수신 모드 구현",
        완료: true,
        완료일: "2026-02-27",
        수행방법: [
          "polling|webhook|both 설정 분기 추가",
          "기본 응답 및 허용 채팅 필터 적용",
        ],
      },
      {
        작업: "n8n 콜백 인증 및 이벤트 중계",
        완료: true,
        완료일: "2026-02-27",
        수행방법: [
          "X-N8N-SECRET 헤더 검증",
          "수신 이벤트를 Socket.io로 브로드캐스트",
        ],
      },
    ],
  },
  {
    페이지제목: "[AI_BISEO] Step 3 - 모듈 공통 관리 레이어",
    블로그본문: [
      "Step 3의 핵심은 서버를 ‘기능 모음’에서 ‘운영 가능한 플랫폼’으로 바꾸는 작업이었다. 모듈이 늘어나면 결국 운영자가 먼저 보게 되는 것은 기능 코드가 아니라 상태, 설정, 이력이다. 그래서 이 세 가지를 공통 인터페이스로 묶는 것이 가장 먼저 필요했다.",
      "이를 위해 InMemoryAssistantModule과 ModuleRegistry를 도입했다. 각 모듈은 같은 계약으로 상태를 반환하고, 설정을 수정하고, 작업 이력을 조회할 수 있다. 구현은 메모리 기반이지만 인터페이스를 먼저 고정했기 때문에 이후 저장소를 SQLite(vec)로 바꿔도 상위 API는 거의 변경 없이 유지할 수 있다.",
      "API 레벨에서는 /api/modules를 기준으로 상태(status), 설정(config), 이력(history) 엔드포인트를 분리했다. 이 구조를 쓰면 대시보드, 운영 스크립트, 외부 연동 모듈이 모두 같은 REST 계약으로 동작하게 되어 운영 복잡도가 크게 낮아진다.",
      "특히 n8n 콜백 이벤트를 단순 로그로 버리지 않고 AI_Writer_TISTORY 모듈의 상태와 히스토리에 자동 반영하도록 연결한 부분이 중요하다. 이 연결 덕분에 어떤 에이전트 단계에서 어떤 상태가 들어왔는지 시간순으로 추적할 수 있는 기반이 만들어졌다.",
      "모듈 공통 레이어를 만든 이후에는 신규 모듈을 붙이는 비용이 확연히 줄어든다. 동일한 인터페이스만 맞추면 트렌드 파서, 오토트레이딩, 코딩 이력 모듈도 같은 운영 API로 편입할 수 있기 때문이다. 이것이 플랫폼화의 시작점이다.",
      "검증은 실제 API 호출 중심으로 진행했다. 모듈 목록 조회, 설정 PATCH, n8n 콜백 호출 후 히스토리 반영 여부를 순서대로 확인했다. 이 과정을 통해 Step 3 결과물이 문서 수준이 아니라 실제 운영 가능한 코드라는 점을 검증했다.",
      "Step 3 이후 과제는 명확하다. 첫째, InMemory 계층을 SQLite(vec) 영속 계층으로 전환한다. 둘째, 모듈별 설정 검증 스키마를 zod로 고도화한다. 셋째, 대시보드에서 모듈별 이력을 시각화해 운영자가 즉시 판단할 수 있게 만든다.",
      "결론적으로 Step 3은 AI_BISEO를 단순 서버에서 모듈 운영 플랫폼으로 한 단계 끌어올린 전환점이었다.",
    ],
    예시코드: [
      {
        제목: "모듈 API 마운트",
        언어: "typescript",
        코드: "const moduleRouter = createModuleRouter({ registry: moduleRegistry });\napp.use(\"/api/modules\", moduleRouter);",
      },
      {
        제목: "콜백 이력 반영",
        언어: "typescript",
        코드: "await writerModule.appendHistory({\n  action: \"n8n_status_callback\",\n  input: event.input,\n  output: { status: event.status, agentName: event.agentName },\n});",
      },
    ],
    핵심포인트: [
      "모듈 공통 인터페이스는 확장 비용을 크게 낮춘다.",
      "상태/설정/이력 API를 분리하면 운영 자동화가 쉬워진다.",
      "외부 콜백은 반드시 모듈 히스토리로 귀결되게 설계한다.",
    ],
    결과: [
      "ModuleRegistry + InMemoryAssistantModule 구축 완료",
      "모듈 상태/설정/이력 API 구현 및 검증 완료",
      "n8n 콜백 자동 반영 루프 완성",
    ],
    다음액션: [
      "SQLite(vec) 기반 영속 저장으로 교체",
      "모듈별 설정 검증 강화(zod)",
      "대시보드 이력 시각화 추가",
    ],
    할일: [
      {
        작업: "모듈 공통 인터페이스 확장",
        완료: true,
        완료일: "2026-02-27",
        수행방법: [
          "Module 타입에 상태/설정/이력 필드 확장",
          "setMonitoringStatus/appendHistory 메서드 추가",
        ],
      },
      {
        작업: "모듈 API 구현",
        완료: true,
        완료일: "2026-02-27",
        수행방법: [
          "GET /api/modules/* 및 PATCH config 구현",
          "모듈 미존재/입력오류 응답 처리",
        ],
      },
      {
        작업: "n8n 이벤트 자동 반영",
        완료: true,
        완료일: "2026-02-27",
        수행방법: [
          "콜백 수신 즉시 모듈 상태 갱신",
          "콜백 payload를 모듈 히스토리에 기록",
        ],
      },
    ],
  },
  {
    페이지제목: "[AI_BISEO] Step 4 - AI_Writer_TISTORY 파이프라인 추적",
    블로그본문: [
      "Step 4에서는 단순 상태 수신을 넘어서 n8n 블로그 파이프라인 실행 단위(run)를 추적할 수 있도록 구조를 확장했다. 핵심은 개별 이벤트를 기록하는 것을 넘어, 동일 실행(runId)에 속한 Agent 1~4 흐름을 한 묶음으로 조회할 수 있게 만드는 것이다.",
      "n8n 콜백 payload에서 runId 후보 필드를 우선 순위로 파싱하고, agentName을 기반으로 agentKey를 정규화했다. 이 과정을 통해 입력 데이터 포맷이 조금씩 달라도 내부에서는 일관된 키 체계로 저장할 수 있게 되었다.",
      "새로 추가한 AiWriterPipelineTracker는 run 단위로 이벤트를 누적하고 최신 상태, 최신 에이전트, 이벤트 개수를 요약해 제공한다. 즉 운영자는 단건 콜백 로그를 뒤지는 대신 ‘현재 실행이 어디까지 왔는지’를 즉시 볼 수 있다.",
      "API도 함께 확장해 /api/modules/AI_Writer_TISTORY/pipelines/runs 에서 최근 실행 목록을 조회하고, /runs/:runId 에서 특정 실행의 전체 이벤트 타임라인을 조회할 수 있게 만들었다. 이 구조는 이후 대시보드 타임라인 UI를 붙이기에도 적합하다.",
      "중요한 점은 기존 Step 3 구조를 깨지 않고 확장했다는 것이다. 모듈 공통 API는 유지한 채, AI_Writer_TISTORY 전용 파이프라인 뷰를 옆에 추가하는 방식으로 설계해 안정성과 확장성을 모두 확보했다.",
      "이 단계까지 완료되면서 운영 관점에서 가장 자주 묻는 질문, 즉 ‘지금 이 글 생성 파이프라인이 어느 단계에 있으며 실패 지점은 어디인가?’에 답할 수 있는 기반이 만들어졌다.",
    ],
    예시코드: [
      {
        제목: "runId/agentKey 포함 이벤트 수신",
        언어: "typescript",
        코드: "const event: N8nBlogStatusEvent = {\n  moduleId: \"AI_Writer_TISTORY\",\n  runId: resolveRunId(body),\n  agentKey: resolveAgentKey(agentName),\n  ...\n};",
      },
      {
        제목: "파이프라인 조회 API",
        언어: "typescript",
        코드: "app.use(\"/api/modules/AI_Writer_TISTORY/pipelines\", aiWriterPipelineRouter);",
      },
    ],
    핵심포인트: [
      "이벤트 단위에서 실행(run) 단위로 관점을 확장했다.",
      "agentName 변형을 agentKey로 정규화해 조회 일관성을 확보했다.",
      "전용 조회 API를 추가해 운영 가시성을 높였다.",
    ],
    결과: [
      "AiWriterPipelineTracker 도입 완료",
      "n8n 콜백 runId/agentKey 파싱 및 저장 완료",
      "파이프라인 실행 목록/상세 조회 API 추가 완료",
    ],
    다음액션: [
      "파이프라인 이력을 SQLite(vec)로 영속화",
      "대시보드에서 run 타임라인 시각화",
      "Agent 단계별 SLA/실패율 지표 추가",
    ],
    할일: [
      {
        작업: "runId/agentKey 정규화 로직 추가",
        완료: true,
        완료일: "2026-02-27",
        수행방법: [
          "콜백 body에서 실행 ID 후보 필드 순차 파싱",
          "agentName 패턴 기반 agentKey 매핑",
        ],
      },
      {
        작업: "파이프라인 트래커 구현",
        완료: true,
        완료일: "2026-02-27",
        수행방법: [
          "run 단위 Map 저장 구조 도입",
          "appendEvent/getRun/listRuns 메서드 구현",
        ],
      },
      {
        작업: "파이프라인 조회 API 추가",
        완료: true,
        완료일: "2026-02-27",
        수행방법: [
          "GET /runs, GET /runs/:runId 구현",
          "index.ts에 전용 라우터 마운트",
        ],
      },
      {
        작업: "대시보드 run 타임라인 연동",
        완료: false,
        수행방법: [
          "프론트에서 run 목록 조회 UI 추가",
          "단계별 이벤트를 타임라인 컴포넌트로 렌더링",
        ],
      },
    ],
  },
  {
    페이지제목: "[AI_BISEO] Step 5 - Phase 1 로컬 라우터/RAG 코어 통합",
    블로그본문: [
      "Step 5는 기존에 구축해 둔 서버 골격을 보존하면서, 프로젝트 방향을 Phase 1 중심으로 재정렬한 작업이다. 핵심은 외부 모듈의 실제 로직을 붙이는 것이 아니라, 메인 비서가 로컬에서 스스로 판단하고 분기하는 지능형 라우터 코어를 완성하는 데 있었다.",
      "가장 먼저 정리한 것은 Function Calling의 실행 위치였다. 이번 구조에서는 데이터가 로컬 SQLite에 있고, 민감한 운영 맥락도 로컬에 축적되므로 함수 실행 자체는 반드시 로컬 디스패처에서 수행해야 한다. 따라서 Phase 1에서는 클라우드 의존 함수 실행을 배제하고, 로컬 규칙 기반 라우터와 모듈 스텁 호출 구조를 채택했다.",
      "이를 위해 의도 라우터를 새로 만들고 사용자 입력을 RAG 검색, 블로그 스텁, 트레이딩 스텁, 가계부 스텁, 코딩 이력 스텁으로 분기하도록 구성했다. 분기 기준은 한국어/영어 키워드를 함께 지원해 실제 입력 편차에도 안정적으로 동작하게 했다.",
      "RAG 계층은 로컬 SQLite에 conversation_messages와 rag_documents 테이블을 두어 구현했다. 사용자가 남긴 대화는 저장과 동시에 RAG 문서로도 적재되기 때문에, 이후 비슷한 질문이 들어오면 과거 맥락을 바로 검색해 재사용할 수 있다. Phase 1에서는 vec 확장 자동 로딩보다 먼저 로컬 저장과 조회 파이프라인의 안정성을 확보하는 데 집중했다.",
      "또한 Telegram 응답 구조를 개선해 단순 답변만 보내는 것이 아니라 ‘판단 경로, 판단 근거, RAG 매칭 수’를 함께 반환하도록 바꿨다. 덕분에 운영자는 응답 품질뿐 아니라 라우팅이 왜 그렇게 결정됐는지까지 즉시 확인할 수 있다.",
      "중요하게도 이 과정에서 기존 모듈 코드와 n8n 콜백 경로, 모니터링 소켓 이벤트는 그대로 유지했다. 즉 기존 유효 코드를 갈아엎지 않고, 그 위에 Phase 1 코어를 증분 방식으로 얹는 전략을 지켰다.",
      "운영 정책 측면에서는 통합 TODO 보드를 누적형으로 전환했다. 앞으로는 동기화 시 기존 보드를 지우지 않고 스냅샷만 추가해 진행 히스토리가 자연스럽게 쌓이게 된다. 이는 나중에 회고와 장애 분석에서도 중요한 근거가 된다.",
      "결과적으로 Step 5는 기능 추가 이상의 의미를 가진다. 메인 비서가 모듈형 OS의 진짜 컨트롤 플레인으로 동작하기 위한 최소 완성 조건, 즉 로컬 판단/로컬 저장/근거 기반 응답/모듈 스텁 인터페이스를 한 번에 갖춘 단계다.",
    ],
    예시코드: [
      {
        제목: "로컬 의도 분기(Phase 1 라우터)",
        언어: "typescript",
        코드: "const decision = decideIntent(input.text);\\nif (decision.route === \\\"call_blog\\\") { ... }",
      },
      {
        제목: "판단 근거 포함 응답",
        언어: "typescript",
        코드: "const reasonLines = [\\n  `판단 경로: ${routeLabel}`,\\n  `판단 근거: ${decision.reason}`,\\n  `RAG 매칭 건수: ${ragCount}`\\n];",
      },
      {
        제목: "통합 TODO 보드 누적 스냅샷",
        언어: "typescript",
        코드: "await appendChildrenByChunk(boardPageId, snapshotBlocks); // 기존 보드 삭제 없음",
      },
    ],
    핵심포인트: [
      "Function Calling 실행은 로컬 디스패처에서 처리한다.",
      "RAG/대화 이력은 로컬 SQLite에 저장하고 검색한다.",
      "모듈 호출은 실제 구현 대신 Phase 1 스텁 인터페이스로만 분기한다.",
      "응답에는 판단 근거를 반드시 포함한다.",
      "통합 TODO 보드는 삭제/초기화 없이 누적한다.",
    ],
    결과: [
      "AssistantController + IntentRouter + SQLite 저장소 통합 완료",
      "Telegram/테스트 API에서 판단 근거 포함 응답 동작 확인",
      "모듈 스텁 분기(call_blog/call_trading_status/call_ledger/call_coding_history) 동작 확인",
      "통합 TODO 보드 누적 스냅샷 정책 적용 완료",
    ],
    다음액션: [
      "RAG 검색 품질 고도화(Phase 2: vec 인덱스 및 재랭킹)",
      "모듈 스텁을 실제 레포 연동 함수로 교체",
      "대시보드에 라우팅 근거/히스토리 시각화 추가",
    ],
    할일: [
      {
        작업: "로컬 Function Calling 권장안 반영",
        완료: true,
        완료일: "2026-02-27",
        수행방법: [
          "함수 실행 위치를 로컬 디스패처로 고정",
          "블로그/트레이딩/가계부/코딩이력은 스텁 함수로 분기",
        ],
      },
      {
        작업: "SQLite 기반 대화/RAG 저장소 구축",
        완료: true,
        완료일: "2026-02-27",
        수행방법: [
          "conversation_messages, rag_documents 테이블 생성",
          "대화 저장 시 RAG 문서 동시 적재",
        ],
      },
      {
        작업: "판단 근거 포함 응답 적용",
        완료: true,
        완료일: "2026-02-27",
        수행방법: [
          "판단 경로/판단 근거/RAG 건수를 응답 본문에 포함",
          "모니터링 이벤트에 route decision 추가",
        ],
      },
      {
        작업: "통합 TODO 보드 누적 정책 고정",
        완료: true,
        완료일: "2026-02-27",
        수행방법: [
          "기존 보드를 지우지 않고 스냅샷 append 방식으로 변경",
          "동기화 시 Step 페이지는 upsert, TODO 보드는 누적",
        ],
      },
    ],
  },
  {
    페이지제목: "[AI_BISEO] Step 6 - Phase 2 로컬 LLM(Ollama) 응답 계층 구축",
    블로그본문: [
      "Step 6에서는 Phase 1에서 완성한 로컬 라우터/RAG 코어 위에 실제 생성형 답변 계층을 얹었다. 이전 단계까지는 사용자의 질문을 분기하고 검색 결과를 나열하는 수준이었다면, 이제는 로컬에서 실행되는 LLM이 대화 문맥과 RAG 결과를 읽어 자연어 답변을 생성하는 단계로 올라왔다.",
      "가장 먼저 정리한 것은 모델 실행 위치와 데이터 위치를 분리해서 보는 관점이다. 로컬 SQLite를 사용한다는 사실은 모델이 반드시 로컬 프로세스여야 한다는 의미는 아니다. 서버가 로컬 DB를 조회해 필요한 문맥만 모델에 전달하면 클라우드 모델도 기술적으로 동작한다. 다만 이번 프로젝트의 목표는 비용 통제와 데이터 통제이므로, 기본 경로를 Ollama 로컬 실행으로 고정했다.",
      "구현은 단일 파일 하드코딩이 아니라 공급자 계층(provider abstraction)으로 설계했다. `ASSISTANT_LLM_PROVIDER` 값을 기준으로 현재는 `ollama`를 기본 사용하고, 이후 `gemini_cli`나 다른 경로를 추가하더라도 오케스트레이터 코드는 거의 손대지 않도록 분리했다. 즉 이번 Step의 핵심은 특정 모델 연결보다 확장 가능한 호출 구조를 먼저 만든 것이다.",
      "오케스트레이터에서는 `rag_search` 경로의 응답 전략을 교체했다. 사용자 입력이 들어오면 기존처럼 RAG 검색을 수행하고, 추가로 최근 대화 이력을 조회해 문맥을 묶은 뒤 LLM에 전달한다. 이때 시스템 프롬프트는 환경변수로 재정의 가능하게 열어두어 운영자가 역할과 답변 스타일을 런타임에서 조정할 수 있게 했다.",
      "안정성을 위해 폴백(fallback)도 반드시 넣었다. Ollama가 내려가 있거나 타임아웃이 나면 서버가 죽지 않고 기존 Phase 1 방식(검색 결과 나열 또는 기본 안내)으로 복귀한다. 운영에서는 모델 장애보다 서비스 연속성이 더 중요하기 때문에, 실패 시 동작을 명시적으로 설계했다.",
      "또 하나의 핵심은 로그 계층이다. `llm_call_logs` 테이블을 추가해 프롬프트 프리뷰, 모델 응답, 라우트, 공급자, 모델명을 로컬 SQLite에 저장한다. 이 기록은 단순 디버그를 넘어 품질 개선 데이터셋으로도 활용할 수 있고, 나중에 프롬프트 튜닝이나 회귀 분석에서도 중요한 근거가 된다.",
      "Docker 환경을 고려해 네트워크 경로도 정리했다. 컨테이너 내부 서버가 Host에서 실행 중인 Ollama에 접근할 수 있도록 `host.docker.internal` 경로를 기본값으로 채택하고, compose에 host-gateway 매핑을 추가했다. 덕분에 서버는 컨테이너에 두고 모델은 로컬 머신에서 실행하는 하이브리드 구성이 가능해졌다.",
      "이번 단계는 단순히 모델 API 하나 붙인 작업이 아니라, AI_BISEO가 실제 비서처럼 답변하는 최초 단계라는 의미가 있다. Phase 1이 컨트롤 플레인을 만든 단계였다면, Step 6은 그 플레인 위에 지능형 응답 엔진을 얹은 단계라고 정리할 수 있다.",
      "다음 확장 포인트도 명확하다. 첫째, SQLite vec 확장을 붙여 의미 기반 검색 품질을 높인다. 둘째, LLM 로그를 기준으로 잘못된 응답 패턴을 분류해 프롬프트 템플릿을 버전 관리한다. 셋째, `gemini_cli` 브리지나 클라우드 공급자를 옵션으로 붙여 로컬 우선 정책을 유지하면서도 선택지를 확보한다.",
      "결론적으로 Step 6의 성과는 ‘로컬 데이터 + 로컬 모델 + 로컬 로그’라는 폐쇄 루프를 구축했다는 점이다. 비용, 보안, 운영 통제를 모두 만족하면서도, 이후 모듈 연동 Phase로 자연스럽게 넘어갈 수 있는 기반이 완성됐다.",
    ],
    예시코드: [
      {
        제목: "Ollama 채팅 호출 계층",
        언어: "typescript",
        코드: "const response = await axios.post(`${env.OLLAMA_BASE_URL}/api/chat`, {\n  model: env.OLLAMA_MODEL,\n  messages,\n  stream: false,\n});",
      },
      {
        제목: "RAG + 최근 대화 맥락 결합",
        언어: "typescript",
        코드: "const llmMessages = [\n  { role: \"system\", content: systemPrompt },\n  { role: \"user\", content: mergedContextText },\n];",
      },
      {
        제목: "LLM 호출 로그 저장",
        언어: "typescript",
        코드: "await llmLogRepository.createLog({\n  sessionId,\n  chatId,\n  route,\n  provider,\n  model,\n  prompt,\n  response,\n});",
      },
    ],
    핵심포인트: [
      "로컬 DB 사용과 모델 위치는 별개이며, 이번 단계는 비용/통제 목적상 로컬 Ollama를 기본값으로 채택한다.",
      "LLM 공급자 계층을 분리해 이후 Gemini CLI/API 확장을 위한 구조를 확보한다.",
      "RAG 문맥과 최근 대화를 함께 주입해 답변 품질을 높인다.",
      "모델 실패 시 Phase 1 응답으로 폴백해 서비스 연속성을 유지한다.",
      "LLM 프롬프트/응답 로그를 로컬 SQLite에 저장해 추후 품질 개선 근거를 남긴다.",
    ],
    결과: [
      "Ollama 기반 생성형 응답 계층 연결 완료",
      "AssistantController의 rag_search 경로 생성형 응답 전환 완료",
      "llm_call_logs 테이블 및 저장소 계층 추가 완료",
      "Docker -> Host Ollama 연결 경로(host.docker.internal) 적용 완료",
    ],
    다음액션: [
      "SQLite vec 확장 로더 연결 및 의미 검색 고도화",
      "LLM 로그 기반 프롬프트 템플릿 버전 관리",
      "gemini_cli 브리지 구현(선택형 공급자) 및 품질/비용 비교",
    ],
    할일: [
      {
        작업: "Ollama 공급자 계층 추가",
        완료: true,
        완료일: "2026-02-27",
        수행방법: [
          "ASSISTANT_LLM_PROVIDER 환경변수 분기 도입",
          "Ollama /api/chat 호출 및 timeout 처리",
        ],
      },
      {
        작업: "RAG 경로 생성형 응답 전환",
        완료: true,
        완료일: "2026-02-27",
        수행방법: [
          "RAG 결과 + 최근 대화를 단일 프롬프트로 병합",
          "시스템 프롬프트를 환경변수로 외부화",
        ],
      },
      {
        작업: "LLM 호출 이력 로컬 저장",
        완료: true,
        완료일: "2026-02-27",
        수행방법: [
          "llm_call_logs 테이블 생성",
          "프롬프트 프리뷰/응답/메타데이터 저장",
        ],
      },
      {
        작업: "Docker-Host Ollama 네트워크 고정",
        완료: true,
        완료일: "2026-02-27",
        수행방법: [
          "compose extra_hosts에 host-gateway 매핑 추가",
          "OLLAMA_BASE_URL 기본값을 host.docker.internal로 지정",
        ],
      },
      {
        작업: "gemini_cli 공급자 브리지 구현",
        완료: false,
        수행방법: [
          "로컬 CLI 인증/실행 흐름 설계",
          "공급자 인터페이스에 CLI 어댑터 추가",
        ],
      },
    ],
  },
  {
    페이지제목: "[AI_BISEO] Step 7 - 서비스 운영화(명령어/대시보드/배포 문서)",
    블로그본문: [
      "Step 7에서는 기능 단위 구현을 넘어 실제 운영자 기준으로 시스템을 사용할 수 있게 만드는 작업에 집중했다. 핵심은 세 가지였다. 첫째, 텔레그램에서 자연어 외에 명령어 기반 운영이 가능해야 한다. 둘째, 대시보드를 운영 화면에 맞게 가독성과 시인성 중심으로 개선해야 한다. 셋째, 신규 인원이 바로 배포할 수 있도록 README를 서비스 운영 문서로 정리해야 한다.",
      "텔레그램 계층에는 명령어 파서를 추가해 /help, /status, /modules, /history, /blog, /pipeline, /run, /rag, /trade, /ledger, /coding, /ask 를 실제 동작으로 연결했다. 특히 /help는 단순 목록이 아니라 topic 기반 안내를 넣어 처음 보는 사용자도 바로 따라할 수 있도록 구성했다.",
      "AI Writer 파이프라인 검증에서는 n8n 로그를 debug 레벨로 올려 실제 실패 지점을 execution 단위로 확인했다. 결과적으로 워크플로우는 Agent_Editor 단계까지 진입했고, 실패 원인은 OpenAI 브리지의 API 키 미설정임을 확인했다. 이 과정에서 입력/출력 데이터와 실행 ID를 기준으로 문제를 재현 가능한 상태로 기록했다.",
      "웹 대시보드는 동일 기능을 유지하면서 운영 관점 UI로 재디자인했다. 타이포, 컬러 시스템, 카드 계층, 실시간 이벤트 가독성, 모바일 반응형을 정리해 실서비스 관제 화면 형태로 개선했다.",
      "README는 기존 개발 메모형에서 서비스 운영 매뉴얼 형태로 재작성했다. 환경 변수, 실행 순서, 배포 절차, 엔드포인트, 텔레그램 명령어, 트러블슈팅, 점검 체크리스트를 한 문서에서 확인할 수 있게 구성했다.",
      "Step 7의 결과는 '기능이 있는 코드'를 '운영 가능한 서비스'로 전환한 것이다. 남은 핵심 과제는 OpenAI 키 주입 및 모델 매핑 정책 정리, n8n 콜백 완결 경로 강화, 보안 하드닝이다.",
    ],
    예시코드: [
      {
        제목: "텔레그램 명령 파싱",
        언어: "typescript",
        코드: "const COMMAND_PATTERN = /^\\/([a-zA-Z0-9_]+)(?:@[a-zA-Z0-9_]+)?(?:\\s+([\\s\\S]*))?$/;",
      },
      {
        제목: "명령어 실행 분기 예시",
        언어: "typescript",
        코드: "if (input.command === \"status\") {\n  const modules = moduleRegistry.listModules();\n  // 상태 요약 응답 생성\n}",
      },
      {
        제목: "대시보드 배포 명령",
        언어: "bash",
        코드: "docker compose up -d --build",
      },
    ],
    핵심포인트: [
      "명령어 기반 운영 인터페이스를 추가해 Telegram UX를 표준화했다.",
      "n8n 실행 실패를 execution ID 기준으로 재현 가능한 형태로 기록했다.",
      "README를 서비스 운영 매뉴얼 형태로 정리해 온보딩 비용을 줄였다.",
      "웹 대시보드를 관제 화면 중심으로 리디자인했다.",
    ],
    결과: [
      "텔레그램 명령어/도움말 체계 구현 완료",
      "n8n debug 분석으로 OpenAI 키 미설정 실패 원인 확정",
      "대시보드 UI 리디자인 반영 완료",
      "README 서비스 운영 문서화 완료",
    ],
    다음액션: [
      "OPENAI_API_KEY 운영 주입 및 모델 매핑 fallback 정책 적용",
      "n8n 워크플로우 콜백 경로 강화(단계별 상태 확정)",
      "아티팩트 공개 범위/시크릿 노출 리스크 정리",
    ],
    할일: [
      {
        작업: "텔레그램 운영 명령어 구현",
        완료: true,
        완료일: "2026-03-02",
        수행방법: [
          "/help, /status, /modules, /history, /blog, /pipeline, /run 등 명령 추가",
          "명령어 미지원 시 사용자 안내 메시지 처리",
        ],
      },
      {
        작업: "AI Writer 실행 실패 원인 추적",
        완료: true,
        완료일: "2026-03-02",
        수행방법: [
          "n8n 컨테이너 로그 레벨 debug로 재기동",
          "execution 데이터에서 Agent_Editor 500 원인 추출",
        ],
      },
      {
        작업: "README 운영 매뉴얼화",
        완료: true,
        완료일: "2026-03-02",
        수행방법: [
          "배포/운영/명령어/트러블슈팅 섹션 재정리",
          "실행 체크리스트 추가",
        ],
      },
      {
        작업: "OpenAI 키 주입 후 E2E 성공 경로 검증",
        완료: false,
        수행방법: [
          "OPENAI_API_KEY 적용 후 /blog -> /pipeline -> /run 경로 재검증",
          "이미지 생성 단계까지 성공 데이터 확인",
        ],
      },
    ],
  },
];

const notionApiKey = process.env.NOTION_API_KEY?.trim() ?? "";
const notionParentPageIdRaw = process.env.NOTION_PARENT_PAGE_ID?.trim() ?? "";

if (!notionApiKey) {
  throw new Error("NOTION_API_KEY가 설정되지 않았습니다.");
}

const notion = new Client({ auth: notionApiKey });

const richText = (content: string): Array<Record<string, unknown>> => [
  {
    type: "text",
    text: { content },
  },
];

const heading2Block = (title: string): Record<string, unknown> => ({
  object: "block",
  type: "heading_2",
  heading_2: { rich_text: richText(title) },
});

const paragraphBlock = (content: string): Record<string, unknown> => ({
  object: "block",
  type: "paragraph",
  paragraph: { rich_text: richText(content) },
});

const bulletItemBlock = (content: string): Record<string, unknown> => ({
  object: "block",
  type: "bulleted_list_item",
  bulleted_list_item: { rich_text: richText(content) },
});

const codeBlock = (content: string, language: string): Record<string, unknown> => ({
  object: "block",
  type: "code",
  code: {
    language,
    rich_text: richText(content),
  },
});

const todoBlock = (item: TodoItem): Record<string, unknown> => {
  const suffix = item.완료 && item.완료일 ? ` (완료: ${item.완료일})` : "";

  return {
    object: "block",
    type: "to_do",
    to_do: {
      rich_text: richText(`${item.작업}${suffix}`),
      checked: item.완료,
      children: item.수행방법.map((line) => ({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: richText(`수행 방법: ${line}`),
        },
      })),
    },
  };
};

const progressText = (todos: TodoItem[]): string => {
  const total = todos.length;
  const done = todos.filter((item) => item.완료).length;
  return `TODO 진행률: ${done}/${total} 완료`;
};

const buildStepChildren = (record: StepRecord): Array<Record<string, unknown>> => {
  const blocks: Array<Record<string, unknown>> = [];

  blocks.push(paragraphBlock("아래 본문은 블로그에 바로 복사해서 사용할 수 있도록 작성한 원문입니다."));
  record.블로그본문.forEach((line) => blocks.push(paragraphBlock(line)));

  blocks.push(heading2Block("코드 및 설정 예시"));
  record.예시코드.forEach((example) => {
    blocks.push(bulletItemBlock(example.제목));
    blocks.push(codeBlock(example.코드, example.언어));
  });

  blocks.push(heading2Block("핵심 포인트"));
  record.핵심포인트.forEach((line) => blocks.push(bulletItemBlock(line)));

  blocks.push(heading2Block("TODO List"));
  record.할일.forEach((todo) => blocks.push(todoBlock(todo)));
  blocks.push(paragraphBlock(progressText(record.할일)));

  blocks.push(heading2Block("결과 및 산출물"));
  record.결과.forEach((line) => blocks.push(bulletItemBlock(line)));

  blocks.push(heading2Block("다음 액션"));
  record.다음액션.forEach((line) => blocks.push(bulletItemBlock(line)));

  return blocks;
};

const buildTodoBoardChildren = (records: StepRecord[]): Array<Record<string, unknown>> => {
  const blocks: Array<Record<string, unknown>> = [];

  blocks.push(heading2Block("운영 TODO 대시보드"));
  blocks.push(paragraphBlock("각 Step의 할일, 완료일, 수행방법을 통합해서 관리하는 체크 보드입니다."));

  records.forEach((record) => {
    blocks.push(heading2Block(record.페이지제목));
    record.할일.forEach((todo) => blocks.push(todoBlock(todo)));
    blocks.push(paragraphBlock(progressText(record.할일)));
  });

  return blocks;
};

const toDashedUuid = (value: string): string | null => {
  const compactId = value.replace(/-/g, "");
  if (!/^[0-9a-fA-F]{32}$/.test(compactId)) {
    return null;
  }

  return `${compactId.slice(0, 8)}-${compactId.slice(8, 12)}-${compactId.slice(12, 16)}-${compactId.slice(16, 20)}-${compactId.slice(20)}`;
};

const parsePageId = (raw: string): string | null => {
  if (!raw) {
    return null;
  }

  const direct = toDashedUuid(raw);
  if (direct) {
    return direct;
  }

  const matches = raw.match(/[0-9a-fA-F]{32}/g);
  if (!matches || matches.length === 0) {
    return null;
  }

  return toDashedUuid(matches[matches.length - 1]);
};

const normalizeId = (value: string): string => value.replace(/-/g, "").toLowerCase();

const resolveParentPageId = (): string => {
  const pageId = parsePageId(notionParentPageIdRaw);
  if (!pageId) {
    throw new Error("NOTION_PARENT_PAGE_ID가 비어 있거나 형식이 올바르지 않습니다.");
  }

  return pageId;
};

const extractPageTitle = (page: Record<string, unknown>): string => {
  const properties = (page.properties ?? {}) as Record<string, unknown>;
  const titleProperty = Object.values(properties).find((property) => {
    return typeof property === "object" && property !== null && (property as { type?: string }).type === "title";
  }) as { title?: Array<{ plain_text?: string }> } | undefined;

  const text = (titleProperty?.title ?? []).map((item) => item.plain_text ?? "").join("").trim();
  return text;
};

const findExistingChildPageId = async (parentPageId: string, title: string): Promise<string | null> => {
  let cursor: string | undefined;
  const normalizedParentId = normalizeId(parentPageId);

  for (let i = 0; i < 10; i += 1) {
    const response = await notion.search({
      query: title,
      filter: { property: "object", value: "page" },
      page_size: 100,
      start_cursor: cursor,
    });

    const found = (response.results as Array<Record<string, unknown>>).find((page) => {
      if (page.object !== "page") {
        return false;
      }

      if (page.archived === true || page.in_trash === true) {
        return false;
      }

      const parent = (page.parent ?? {}) as { type?: string; page_id?: string };
      if (parent.type !== "page_id" || !parent.page_id) {
        return false;
      }

      if (normalizeId(parent.page_id) !== normalizedParentId) {
        return false;
      }

      return extractPageTitle(page) === title;
    });

    if (found && typeof found.id === "string") {
      return found.id;
    }

    if (!response.has_more || !response.next_cursor) {
      break;
    }

    cursor = response.next_cursor;
  }

  return null;
};

const clearAllChildren = async (pageId: string): Promise<void> => {
  for (let i = 0; i < 10; i += 1) {
    const list = await notion.blocks.children.list({ block_id: pageId, page_size: 100 });
    const blocks = list.results as Array<{ id: string; archived?: boolean; in_trash?: boolean }>;
    const activeBlocks = blocks.filter((block) => !block.archived && !block.in_trash);

    if (activeBlocks.length === 0) {
      break;
    }

    for (const block of activeBlocks) {
      await notion.blocks.delete({ block_id: block.id });
    }
  }
};

const appendChildrenByChunk = async (pageId: string, children: Array<Record<string, unknown>>): Promise<void> => {
  for (let i = 0; i < children.length; i += 100) {
    const chunk = children.slice(i, i + 100);
    await notion.blocks.children.append({
      block_id: pageId,
      children: chunk as Array<Record<string, unknown>>,
    });
  }
};

const createPage = async (title: string, parentPageId: string, children: Array<Record<string, unknown>>): Promise<string> => {
  const firstChildren = children.slice(0, 100);

  const created = await notion.pages.create({
    parent: { page_id: parentPageId },
    properties: {
      title: [
        {
          type: "text",
          text: { content: title },
        },
      ],
    },
    children: firstChildren,
  } as Record<string, unknown>);

  const createdPageId = String((created as { id: string }).id);
  await appendChildrenByChunk(createdPageId, children.slice(100));

  console.log(`[Notion] 페이지 생성 완료: ${title}`);
  return createdPageId;
};

const upsertPage = async (title: string, parentPageId: string, children: Array<Record<string, unknown>>): Promise<void> => {
  const existingPageId = await findExistingChildPageId(parentPageId, title);

  if (!existingPageId) {
    await createPage(title, parentPageId, children);
    return;
  }

  await notion.pages.update({
    page_id: existingPageId,
    properties: {
      title: [
        {
          type: "text",
          text: { content: title },
        },
      ],
    },
  } as Record<string, unknown>);

  await clearAllChildren(existingPageId);
  await appendChildrenByChunk(existingPageId, children);

  console.log(`[Notion] 페이지 업데이트 완료: ${title}`);
};

const appendTodoBoardSnapshot = async (parentPageId: string): Promise<void> => {
  const boardTitle = "[AI_BISEO] 통합 TODO 보드";
  let boardPageId = await findExistingChildPageId(parentPageId, boardTitle);

  if (!boardPageId) {
    boardPageId = await createPage(boardTitle, parentPageId, [
      heading2Block("운영 TODO 대시보드"),
      paragraphBlock("이 페이지는 누적형 보드입니다. 기존 TODO 항목을 삭제하지 않고 스냅샷을 계속 추가합니다."),
    ]);
  }

  const snapshotTitle = `스냅샷 ${new Date().toISOString()}`;
  const snapshotBlocks: Array<Record<string, unknown>> = [
    heading2Block(snapshotTitle),
  ];

  stepRecords.forEach((record) => {
    snapshotBlocks.push(heading2Block(record.페이지제목));
    record.할일.forEach((todo) => {
      snapshotBlocks.push(todoBlock(todo));
    });
    snapshotBlocks.push(paragraphBlock(progressText(record.할일)));
  });

  await appendChildrenByChunk(boardPageId, snapshotBlocks);
  console.log("[Notion] 통합 TODO 보드에 스냅샷 누적 완료");
};

const pushRecords = async (): Promise<void> => {
  const parentPageId = resolveParentPageId();

  await appendTodoBoardSnapshot(parentPageId);

  for (const record of stepRecords) {
    await upsertPage(record.페이지제목, parentPageId, buildStepChildren(record));
  }
};

void pushRecords().catch((error) => {
  console.error("[Notion] 페이지 작성 실패:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
