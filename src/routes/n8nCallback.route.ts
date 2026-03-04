import { Router } from "express";

import { env } from "../core/env";
import { logger } from "../core/logger";
import { WriterAgentKey } from "../modules/ai_writer_tistory/pipelineTracker";

export interface N8nBlogStatusEvent {
  moduleId: "AI_Writer_TISTORY";
  runId: string;
  agentKey: WriterAgentKey;
  agentName?: string;
  status: string;
  input?: unknown;
  output?: unknown;
  raw: Record<string, unknown>;
  receivedAt: string;
}

interface N8nCallbackRouterOptions {
  callbackSecret: string;
  callbackSecretHeader: string;
  onStatusReceived: (event: N8nBlogStatusEvent) => Promise<void>;
}

const takeOptionalString = (value: unknown): string | undefined => {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const resolveRunId = (body: Record<string, unknown>): string => {
  const candidates = [
    body.runId,
    body.executionId,
    body.execution_id,
    body.workflowExecutionId,
    body.workflow_execution_id,
    body.traceId,
    body.trace_id,
    body.sessionId,
    body.session_id,
  ];

  for (const candidate of candidates) {
    const normalized = takeOptionalString(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return `run_${Date.now().toString(36)}`;
};

const resolveAgentKey = (agentName?: string): WriterAgentKey => {
  const normalized = (agentName ?? "").toLowerCase();

  if (normalized.includes("agent 1") || normalized.includes("메인 작가")) {
    return "agent_1_main_writer";
  }

  if (normalized.includes("agent 2") || normalized.includes("검토 2차 작가")) {
    return "agent_2_review_writer";
  }

  if (normalized.includes("agent 3") || normalized.includes("이미지 생성기")) {
    return "agent_3_image_generator";
  }

  if (normalized.includes("agent 4") || normalized.includes("최종 검토 작가")) {
    return "agent_4_final_writer";
  }

  return "unknown";
};

export const createN8nCallbackRouter = ({
  callbackSecret,
  callbackSecretHeader,
  onStatusReceived,
}: N8nCallbackRouterOptions): Router => {
  const router = Router();

  router.post(env.N8N_BLOG_CALLBACK_ROUTE, async (req, res) => {
    if (!callbackSecret.trim()) {
      logger.error("n8n 콜백 시크릿이 설정되지 않았습니다.");
      res.status(503).json({ ok: false, message: "N8N_BLOG_CALLBACK_SECRET is required." });
      return;
    }

    const incomingSecret = req.header(callbackSecretHeader) ?? "";

    if (incomingSecret !== callbackSecret) {
      logger.warn("n8n 콜백 인증이 실패했습니다.", {
        header: callbackSecretHeader,
      });
      res.status(401).json({ ok: false, message: "인증에 실패했습니다." });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const agentName = takeOptionalString(body.agentName ?? body.agent ?? body.stage);

    const event: N8nBlogStatusEvent = {
      moduleId: "AI_Writer_TISTORY",
      runId: resolveRunId(body),
      agentKey: resolveAgentKey(agentName),
      agentName,
      status: takeOptionalString(body.status) ?? "unknown",
      input: body.input,
      output: body.output,
      raw: body,
      receivedAt: new Date().toISOString(),
    };

    try {
      await onStatusReceived(event);
    } catch (error) {
      logger.error("n8n 상태 이벤트 처리 중 오류가 발생했습니다.", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ ok: false, message: "상태 이벤트 처리에 실패했습니다." });
      return;
    }

    logger.info("n8n 블로그 상태 콜백을 수신했습니다.", {
      runId: event.runId,
      status: event.status,
      agentKey: event.agentKey,
      agentName: event.agentName,
    });

    res.status(202).json({
      ok: true,
      message: "콜백을 정상 수신했습니다.",
      event,
    });
  });

  return router;
};
