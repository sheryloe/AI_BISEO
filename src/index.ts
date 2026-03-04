import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import http from "http";
import path from "path";
import { Server as SocketIOServer } from "socket.io";

import { ConversationRepository } from "./core/db/conversationRepository";
import { LlmLogRepository } from "./core/db/llmLogRepository";
import { RagRepository } from "./core/db/ragRepository";
import { createSqliteClient } from "./core/db/sqliteClient";
import { env } from "./core/env";
import { AssistantLlmService } from "./core/llm/assistantLlm";
import { logger } from "./core/logger";
import { AssistantController } from "./core/orchestrator/assistantController";
import { AiWriterOpenAiBridge } from "./modules/ai_writer_tistory/openAiBridge";
import { aiWriterPipelineTracker } from "./modules/ai_writer_tistory/pipelineTracker";
import { BlogWorkflowClient } from "./modules/interfaces/blogWorkflowClient";
import { moduleRegistry } from "./modules/registry";
import { createAiWriterPipelineRouter } from "./routes/aiWriterPipeline.route";
import { createAssistantRouter } from "./routes/assistant.route";
import { createConfigRouter } from "./routes/config.route";
import { createModuleRouter } from "./routes/module.route";
import { createN8nCallbackRouter } from "./routes/n8nCallback.route";
import { createRagRouter } from "./routes/rag.route";
import { initializeTelegramIntegration } from "./services/telegram.service";

const app = express();
const httpServer = http.createServer(app);

const corsOrigins = env.CORS_ORIGIN === "*"
  ? true
  : env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);

app.use(cors({ origin: corsOrigins }));
app.use(express.text({
  type: (req) => {
    const contentType = req.headers["content-type"]?.toString().toLowerCase() ?? "";
    return contentType.includes("application/json")
      || contentType.includes("+json")
      || contentType.startsWith("text/");
  },
  limit: "2mb",
}));
app.use((req, _res, next) => {
  if (typeof req.body !== "string") {
    next();
    return;
  }

  const rawBody = req.body.trim();
  if (!rawBody) {
    req.body = {};
    next();
    return;
  }

  const contentType = req.headers["content-type"]?.toString().toLowerCase() ?? "";

  if (contentType.includes("application/json") || contentType.includes("+json")) {
    try {
      req.body = JSON.parse(rawBody);
    } catch {
      req.body = { text: rawBody };
    }
  }

  next();
});
app.use(express.urlencoded({ extended: true }));

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: corsOrigins,
  },
});

const monitoringNamespace = io.of(env.SOCKET_NAMESPACE);

monitoringNamespace.on("connection", (socket) => {
  logger.info("모니터링 클라이언트가 연결되었습니다.", { socketId: socket.id });
  socket.emit("monitoring:hello", {
    message: "AI_BISEO 모니터링 네임스페이스에 연결되었습니다.",
    namespace: env.SOCKET_NAMESPACE,
    connectedAt: new Date().toISOString(),
  });

  socket.on("disconnect", (reason) => {
    logger.info("모니터링 클라이언트 연결이 종료되었습니다.", {
      socketId: socket.id,
      reason,
    });
  });
});

const emitMonitoringEvent = (eventName: string, payload: Record<string, unknown>) => {
  monitoringNamespace.emit(eventName, {
    ...payload,
    emittedAt: new Date().toISOString(),
  });
};

type HttpErrorRecord = {
  requestId?: number;
  method: string;
  path: string;
  status: number;
  message: string;
  detail?: string;
  stack?: string;
  requestBody: string;
  query: Record<string, unknown>;
  contentType: string;
  userAgent: string;
  timestamp: string;
  origin: string;
};

const httpErrorHistory: HttpErrorRecord[] = [];
const MAX_HTTP_ERROR_HISTORY = 120;
const SENSITIVE_REQUEST_KEYS = new Set([
  "telegramBotToken",
  "openAiApiKey",
  "googleAiStudioApiKey",
  "notionApiKey",
  "notionParentPageId",
  "n8nBlogCallbackSecret",
  "OPENAI_API_KEY",
  "GOOGLE_AI_STUDIO_API_KEY",
  "NOTION_API_KEY",
  "NOTION_PARENT_PAGE_ID",
  "N8N_BLOG_CALLBACK_SECRET",
  "TELEGRAM_BOT_TOKEN",
]);

const sanitizeForLog = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (value === undefined || value === null) {
    return "";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const sanitizeLogBody = (value: unknown): string => {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value.length > 600 ? `${value.slice(0, 600)}...` : value;
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => sanitizeLogBody(item)).join(", ")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value).map(([key, raw]) => {
      if (SENSITIVE_REQUEST_KEYS.has(key)) {
        return `${key}:[redacted]`;
      }
      const sanitizedValue = typeof raw === "string" ? raw : sanitizeForLog(raw);
      return `${key}:${sanitizedValue}`;
    });
    return `{${entries.join(", ")}}`;
  }

  return sanitizeForLog(value);
};

const summarizeRequestBody = (req: { body?: unknown }): string => {
  const summary = sanitizeLogBody(req.body);
  if (summary.length <= 1400) {
    return summary;
  }

  return `${summary.slice(0, 1400)}...`;
};

const pushHttpErrorRecord = (record: HttpErrorRecord): void => {
  httpErrorHistory.push(record);
  if (httpErrorHistory.length > MAX_HTTP_ERROR_HISTORY) {
    httpErrorHistory.shift();
  }
};

const getStatusCodeFromError = (error: unknown): number => {
  if (error && typeof error === "object") {
    const withStatusCode = error as { status?: unknown; statusCode?: unknown };

    if (typeof withStatusCode.status === "number") {
      return withStatusCode.status;
    }

    if (typeof withStatusCode.statusCode === "number") {
      return withStatusCode.statusCode;
    }
  }

  return 500;
};

const sanitizeClientErrorText = (message: string): string => {
  const trimmed = message.trim();
  return trimmed === "Bad Request" ? "요청 형식이 올바르지 않습니다." : trimmed || "요청 처리 중 오류가 발생했습니다.";
};

const buildClientErrorDetail = (status: number): string => {
  if (status === 400) {
    return "요청 형식/파라미터를 확인해 주세요.";
  }

  if (status === 401) {
    return "인증이 필요하거나 토큰이 유효하지 않습니다.";
  }

  if (status === 403) {
    return "권한이 없습니다.";
  }

  if (status === 404) {
    return "요청한 리소스를 찾을 수 없습니다.";
  }

  return "클라이언트 요청을 처리할 수 없습니다.";
};

const toSnippet = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}...`;
};

const parsePositiveIntArg = (raw: string, fallback: number, min: number, max: number): number => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return fallback;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(parsed, max));
};

const formatIsoTime = (iso: string): string => {
  if (!iso) {
    return "-";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toISOString();
};

let requestSequence = 0;
app.use((req, res, next) => {
  const requestId = ++requestSequence;
  const startedAt = Date.now();
  (req as { requestId?: number }).requestId = requestId;

  logger.info("HTTP 요청 수신", {
    requestId,
    method: req.method,
    path: req.originalUrl,
    contentType: req.headers["content-type"],
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const payload = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    };

    logger.info("HTTP 요청 완료", payload);
    emitMonitoringEvent("http:request", payload);
  });

  next();
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "AI_BISEO",
    now: new Date().toISOString(),
  });
});

app.get("/api/diagnostics/http-errors", (_req, res) => {
  const payload = httpErrorHistory.slice(-MAX_HTTP_ERROR_HISTORY).map((entry) => ({ ...entry }));
  res.status(200).json({
    ok: true,
    item: {
      count: payload.length,
      max: MAX_HTTP_ERROR_HISTORY,
      items: payload,
    },
  });
});

const bootstrap = async (): Promise<void> => {
  const sqliteClient = await createSqliteClient();
  const ragRepository = new RagRepository(sqliteClient.db);
  const conversationRepository = new ConversationRepository(sqliteClient.db, ragRepository);
  const llmLogRepository = new LlmLogRepository(sqliteClient.db);
  const llmService = new AssistantLlmService();
  const openAiBridge = new AiWriterOpenAiBridge();
  const blogWorkflowClient = new BlogWorkflowClient({
    moduleRegistry,
    tracker: aiWriterPipelineTracker,
    emitMonitoringEvent,
  });
  const assistantController = new AssistantController({
    conversationRepository,
    ragRepository,
    llmService,
    llmLogRepository,
    blogWorkflowClient,
  });

  const moduleRouter = createModuleRouter({ registry: moduleRegistry });
  app.use("/api/modules", moduleRouter);

  const aiWriterPipelineRouter = createAiWriterPipelineRouter({
    tracker: aiWriterPipelineTracker,
    blogWorkflowClient,
    openAiBridge,
  });
  app.use("/api/modules/AI_Writer_TISTORY/pipelines", aiWriterPipelineRouter);

  const ragRouter = createRagRouter({ ragRepository });
  app.use("/api/rag", ragRouter);

  const assistantRouter = createAssistantRouter({ controller: assistantController });
  app.use("/api/assistant", assistantRouter);

  const configRouter = createConfigRouter();
  app.use("/api/settings", configRouter);

  if (env.DASHBOARD_SERVE_MODE === "single") {
    const dashboardDir = path.resolve(process.cwd(), env.DASHBOARD_STATIC_DIR);
    app.use("/dashboard", express.static(dashboardDir));
    const artifactDir = path.resolve(process.cwd(), "./storage/artifacts");
    app.use("/artifacts", express.static(artifactDir));
    app.get("/dashboard", (_req, res) => {
      res.sendFile(path.join(dashboardDir, "index.html"));
    });
    app.get("/dashboard/*", (_req, res) => {
      res.sendFile(path.join(dashboardDir, "index.html"));
    });
    logger.info("대시보드 정적 리소스를 단일 서버 모드로 제공합니다.", {
      route: "/dashboard",
      directory: dashboardDir,
    });
  }

  const n8nRouter = createN8nCallbackRouter({
    callbackSecret: env.N8N_BLOG_CALLBACK_SECRET,
    callbackSecretHeader: env.N8N_CALLBACK_SECRET_HEADER,
    onStatusReceived: async (event) => {
      const writerModule = moduleRegistry.getModule("AI_Writer_TISTORY");

      if (writerModule) {
        await writerModule.setMonitoringStatus({
          healthy: !["error", "failed"].includes(event.status.toLowerCase()),
          stage: event.agentName ?? event.agentKey,
          message: `run=${event.runId} / 상태=${event.status}`,
        });

        await writerModule.appendHistory({
          action: "n8n_status_callback",
          input: event.input,
          output: {
            runId: event.runId,
            agentKey: event.agentKey,
            agentName: event.agentName,
            status: event.status,
            output: event.output,
          },
        });
      }

      const runSummary = aiWriterPipelineTracker.appendEvent({
        runId: event.runId,
        moduleId: "AI_Writer_TISTORY",
        agentKey: event.agentKey,
        agentName: event.agentName ?? event.agentKey,
        status: event.status,
        input: event.input,
        output: event.output,
        raw: event.raw,
        receivedAt: event.receivedAt,
      });

      emitMonitoringEvent("n8n:blog_status", {
        moduleId: "AI_Writer_TISTORY",
        event,
        runSummary,
      });
    },
  });
  app.use(env.N8N_BLOG_CALLBACK_BASE_PATH, n8nRouter);

  const executeAssistantMessage = async (input: {
    chatId: string;
    username?: string;
    text: string;
  }) => {
    const response = await assistantController.handleTelegramText({
      chatId: input.chatId,
      username: input.username,
      text: input.text,
    });

    emitMonitoringEvent("router:decision", {
      chatId: input.chatId,
      route: response.route,
      routeLabel: response.routeLabel,
      reason: response.reason,
      ragCount: response.ragCount,
    });

    return {
      replyText: response.replyText,
      route: response.route,
      routeLabel: response.routeLabel,
      reason: response.reason,
      ragCount: response.ragCount,
    };
  };

  void initializeTelegramIntegration({
    app,
    emitMonitoringEvent,
    onTextMessage: async (input) => {
      return executeAssistantMessage(input);
    },
    onCommandMessage: async (input) => {
      if (input.command === "status") {
        const modules = moduleRegistry.listModules();
        const statuses = await Promise.all(
          modules.map(async (module) => ({
            moduleId: module.moduleId,
            moduleName: module.moduleName,
            status: await module.getMonitoringStatus(),
          })),
        );

        const healthyCount = statuses.filter((item) => item.status.healthy).length;
        const unhealthyCount = statuses.length - healthyCount;
        const moduleSummary = statuses
          .map((item) => {
            const icon = item.status.healthy ? "OK" : "WARN";
            return `${icon} ${item.moduleId} (${item.status.stage})`;
          })
          .join("\n");

        return {
          replyText: [
            "[AI_BISEO 상태 요약]",
            `- 시각: ${new Date().toISOString()}`,
            `- Telegram mode: ${env.TELEGRAM_MODE}`,
            `- 모듈 헬스: ${healthyCount}/${statuses.length} healthy`,
            unhealthyCount > 0 ? `- 경고 모듈 수: ${unhealthyCount}` : "- 경고 모듈 수: 0",
            "",
            "[모듈 요약]",
            moduleSummary || "등록된 모듈이 없습니다.",
          ].join("\n"),
          route: "telegram_command",
          routeLabel: "상태 조회",
          reason: "/status 명령",
        };
      }

      if (input.command === "modules") {
        const modules = moduleRegistry.listModules();
        const statuses = await Promise.all(
          modules.map(async (module) => ({
            moduleId: module.moduleId,
            moduleName: module.moduleName,
            status: await module.getMonitoringStatus(),
          })),
        );

        const lines = statuses.map((item, index) => {
          const icon = item.status.healthy ? "OK" : "WARN";
          return [
            `${index + 1}. ${item.moduleId} / ${item.moduleName}`,
            `   - healthy: ${icon}`,
            `   - stage: ${item.status.stage}`,
            `   - message: ${item.status.message}`,
            `   - updatedAt: ${formatIsoTime(item.status.updatedAt)}`,
          ].join("\n");
        });

        return {
          replyText: [
            "[모듈 상태 상세]",
            lines.length > 0 ? lines.join("\n") : "등록된 모듈이 없습니다.",
          ].join("\n"),
          route: "telegram_command",
          routeLabel: "모듈 상태 조회",
          reason: "/modules 명령",
        };
      }

      if (input.command === "history") {
        const limit = parsePositiveIntArg(input.args, 8, 1, 20);
        const history = await assistantController.listConversationHistory(input.chatId, limit);

        if (history.length === 0) {
          return {
            replyText: "최근 대화 기록이 없습니다.",
            route: "telegram_command",
            routeLabel: "대화 이력 조회",
            reason: "/history 명령",
          };
        }

        const lines = history.map((item, index) => {
          return [
            `${index + 1}. [${item.role}] ${formatIsoTime(item.createdAt)}`,
            `   ${toSnippet(item.content.replace(/\s+/g, " ").trim(), 160)}`,
          ].join("\n");
        });

        return {
          replyText: [
            `[최근 대화 기록 ${history.length}건]`,
            lines.join("\n"),
          ].join("\n"),
          route: "telegram_command",
          routeLabel: "대화 이력 조회",
          reason: "/history 명령",
        };
      }

      if (input.command === "pipeline") {
        const limit = parsePositiveIntArg(input.args, 5, 1, 15);
        const runs = aiWriterPipelineTracker.listRuns(limit);

        if (runs.length === 0) {
          return {
            replyText: "블로그 파이프라인 실행 이력이 없습니다.",
            route: "telegram_command",
            routeLabel: "파이프라인 조회",
            reason: "/pipeline 명령",
          };
        }

        const lines = runs.map((run, index) => {
          return [
            `${index + 1}. runId: ${run.runId}`,
            `   - latest: ${run.latestStatus} / ${run.latestAgentName}`,
            `   - events: ${run.eventCount}`,
            `   - updatedAt: ${formatIsoTime(run.updatedAt)}`,
          ].join("\n");
        });

        return {
          replyText: [
            `[최근 파이프라인 실행 ${runs.length}건]`,
            lines.join("\n"),
          ].join("\n"),
          route: "telegram_command",
          routeLabel: "파이프라인 조회",
          reason: "/pipeline 명령",
        };
      }

      if (input.command === "run") {
        const runId = input.args.trim();
        if (!runId) {
          return {
            replyText: "사용법: /run <runId>",
            route: "telegram_command",
            routeLabel: "실행 상세 조회",
            reason: "/run 명령 파라미터 부족",
          };
        }

        const run = aiWriterPipelineTracker.getRun(runId);
        if (!run) {
          return {
            replyText: `runId를 찾지 못했습니다: ${runId}`,
            route: "telegram_command",
            routeLabel: "실행 상세 조회",
            reason: "/run 명령 조회 실패",
          };
        }

        const recentEvents = run.events.slice(-10).map((event, index) => {
          return `${index + 1}. ${formatIsoTime(event.receivedAt)} / ${event.agentName} / ${event.status}`;
        });

        return {
          replyText: [
            `[run 상세] ${run.runId}`,
            `- startedAt: ${formatIsoTime(run.startedAt)}`,
            `- updatedAt: ${formatIsoTime(run.updatedAt)}`,
            `- latest: ${run.latestStatus} / ${run.latestAgentName}`,
            `- eventCount: ${run.eventCount}`,
            "",
            "[최근 이벤트]",
            recentEvents.join("\n"),
          ].join("\n"),
          route: "telegram_command",
          routeLabel: "실행 상세 조회",
          reason: "/run 명령",
        };
      }

      if (input.command === "blog") {
        const topic = input.args.trim();
        if (!topic) {
          return {
            replyText: "사용법: /blog <주제>\n예시: /blog 2026년 임시 공휴일 정리",
            route: "telegram_command",
            routeLabel: "블로그 트리거",
            reason: "/blog 명령 파라미터 부족",
          };
        }

        return executeAssistantMessage({
          chatId: input.chatId,
          username: input.username,
          text: `티스토리 블로그 글 작성해줘: ${topic}`,
        });
      }

      if (input.command === "rag") {
        const question = input.args.trim();
        if (!question) {
          return {
            replyText: "사용법: /rag <질문>\n예시: /rag 지난 작업 핵심 요약해줘",
            route: "telegram_command",
            routeLabel: "RAG 검색",
            reason: "/rag 명령 파라미터 부족",
          };
        }

        return executeAssistantMessage({
          chatId: input.chatId,
          username: input.username,
          text: question,
        });
      }

      if (input.command === "trade") {
        const requestText = input.args.trim() || "트레이딩 상태 확인해줘";
        return executeAssistantMessage({
          chatId: input.chatId,
          username: input.username,
          text: requestText,
        });
      }

      if (input.command === "ledger") {
        const requestText = input.args.trim() || "이번 달 가계부 지출 합계 보여줘";
        return executeAssistantMessage({
          chatId: input.chatId,
          username: input.username,
          text: requestText,
        });
      }

      if (input.command === "coding") {
        const requestText = input.args.trim() || "최근 코딩 변경 이력 요약해줘";
        return executeAssistantMessage({
          chatId: input.chatId,
          username: input.username,
          text: requestText,
        });
      }

      if (input.command === "ask") {
        const question = input.args.trim();
        if (!question) {
          return {
            replyText: "사용법: /ask <질문>",
            route: "telegram_command",
            routeLabel: "일반 질의",
            reason: "/ask 명령 파라미터 부족",
          };
        }

        return executeAssistantMessage({
          chatId: input.chatId,
          username: input.username,
          text: question,
        });
      }

      return null;
    },
  }).catch((error) => {
    logger.error("텔레그램 통합 초기화에 실패했습니다.", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    const statusCode = getStatusCodeFromError(error);
    const status = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
    const baseMessage = error instanceof Error ? error.message : "요청 처리 중 알 수 없는 오류가 발생했습니다.";
    const message = sanitizeClientErrorText(baseMessage);
    const requestId = (req as { requestId?: number }).requestId;

    logger.error("요청 처리 중 오류가 발생했습니다.", {
      method: req.method,
      path: req.originalUrl,
      status,
      message,
      requestId,
      requestBodyType: typeof req.body,
    });

    const record: HttpErrorRecord = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status,
      message,
      detail: status < 500 ? buildClientErrorDetail(status) : "Internal Server Error",
      stack: error instanceof Error ? error.stack : undefined,
      requestBody: summarizeRequestBody(req),
      query: req.query as Record<string, unknown>,
      contentType: req.headers["content-type"]?.toString() ?? "",
      userAgent: req.headers["user-agent"]?.toString() ?? "",
      timestamp: new Date().toISOString(),
      origin: req.ip ?? "",
    };

    pushHttpErrorRecord(record);

    emitMonitoringEvent("http:error", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status,
      message,
      requestBodyType: typeof req.body,
    });

    if (res.headersSent) {
      next(error as Error);
      return;
    }

    const detail = status >= 500 ? "Internal Server Error" : buildClientErrorDetail(status);

    res.status(status).json({
      ok: false,
      error: {
        message,
        detail,
        statusCode: status,
        path: req.originalUrl,
        requestId,
      },
    });
  });
  let isShuttingDown = false;

  const closeHttpServer = async (): Promise<void> => {
    if (!httpServer.listening) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  };

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    logger.info("프로세스 종료 시그널을 수신했습니다.", { signal });

    const closeResults = await Promise.allSettled([
      closeHttpServer(),
      sqliteClient.close(),
    ]);

    const hasCloseError = closeResults.some((result) => result.status === "rejected");

    if (hasCloseError) {
      for (const result of closeResults) {
        if (result.status === "rejected") {
          logger.error("종료 처리 중 오류가 발생했습니다.", {
            signal,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
        }
      }
      process.exitCode = 1;
    }

    const shouldFail = signal === "SERVER_ERROR" || hasCloseError || process.exitCode === 1;
    process.exit(shouldFail ? 1 : 0);
  };

  httpServer.on("error", (error: NodeJS.ErrnoException) => {
    process.exitCode = 1;

    logger.error("HTTP 서버 초기화 중 오류가 발생했습니다.", {
      port: env.APP_PORT,
      code: error.code,
      message: error.message,
    });

    if (error.code === "EADDRINUSE") {
      logger.error("포트가 이미 사용 중입니다. 기존 프로세스를 종료하거나 APP_PORT를 변경해 주세요.", {
        port: env.APP_PORT,
      });
    }

    void shutdown("SERVER_ERROR");
  });

  httpServer.listen(env.APP_PORT, () => {
    logger.info("AI_BISEO 메인 서버가 시작되었습니다.", {
      port: env.APP_PORT,
      telegramMode: env.TELEGRAM_MODE,
      n8nCallbackPath: `${env.N8N_BLOG_CALLBACK_BASE_PATH}${env.N8N_BLOG_CALLBACK_ROUTE}`,
    });

    const coreModule = moduleRegistry.getModule("AI_BISEO");
    if (coreModule) {
      void coreModule.setMonitoringStatus({
        healthy: true,
        stage: "running",
        message: "메인 서버가 실행 중입니다.",
      });

      void coreModule.appendHistory({
        action: "server_started",
        output: {
          port: env.APP_PORT,
          telegramMode: env.TELEGRAM_MODE,
        },
      });
    }
  });

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
};

void bootstrap().catch((error) => {
  logger.error("부트스트랩 중 치명적 오류가 발생했습니다.", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});

process.on("uncaughtException", (error) => {
  logger.error("처리되지 않은 예외가 발생했습니다.", {
    message: error.message,
    stack: error.stack,
  });
});

process.on("unhandledRejection", (reason) => {
  logger.error("처리되지 않은 Promise rejection이 발생했습니다.", {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});




