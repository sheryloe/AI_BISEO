import cors from "cors";
import express from "express";
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
import { aiWriterPipelineTracker } from "./modules/ai_writer_tistory/pipelineTracker";
import { moduleRegistry } from "./modules/registry";
import { createAiWriterPipelineRouter } from "./routes/aiWriterPipeline.route";
import { createAssistantRouter } from "./routes/assistant.route";
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

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "AI_BISEO",
    now: new Date().toISOString(),
  });
});

const bootstrap = async (): Promise<void> => {
  const sqliteClient = await createSqliteClient();
  const ragRepository = new RagRepository(sqliteClient.db);
  const conversationRepository = new ConversationRepository(sqliteClient.db, ragRepository);
  const llmLogRepository = new LlmLogRepository(sqliteClient.db);
  const llmService = new AssistantLlmService();
  const assistantController = new AssistantController({
    conversationRepository,
    ragRepository,
    llmService,
    llmLogRepository,
  });

  const moduleRouter = createModuleRouter({ registry: moduleRegistry });
  app.use("/api/modules", moduleRouter);

  const aiWriterPipelineRouter = createAiWriterPipelineRouter({ tracker: aiWriterPipelineTracker });
  app.use("/api/modules/AI_Writer_TISTORY/pipelines", aiWriterPipelineRouter);

  const ragRouter = createRagRouter({ ragRepository });
  app.use("/api/rag", ragRouter);

  const assistantRouter = createAssistantRouter({ controller: assistantController });
  app.use("/api/assistant", assistantRouter);

  if (env.DASHBOARD_SERVE_MODE === "single") {
    const dashboardDir = path.resolve(process.cwd(), env.DASHBOARD_STATIC_DIR);
    app.use("/dashboard", express.static(dashboardDir));
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

  void initializeTelegramIntegration({
    app,
    emitMonitoringEvent,
    onTextMessage: async (input) => {
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
    },
  }).catch((error) => {
    logger.error("텔레그램 통합 초기화에 실패했습니다.", {
      error: error instanceof Error ? error.message : String(error),
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
