import { Router } from "express";

import { AssistantController } from "../core/orchestrator/assistantController";
import { appendPromptLog } from "../core/promptLog";

interface AssistantRouterOptions {
  controller: AssistantController;
}

interface NormalizedError {
  status: number;
  body: {
    message: string;
    detail?: string;
  };
}

const DEFAULT_CLIENT_ERROR_MESSAGE = "클라이언트 요청을 처리할 수 없습니다.";

const getClientErrorDetail = (status: number): string => {
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

  return DEFAULT_CLIENT_ERROR_MESSAGE;
};

const sanitizeClientErrorText = (message: string): string => {
  const trimmed = message.trim();
  if (!trimmed || trimmed === "Bad Request") {
    return DEFAULT_CLIENT_ERROR_MESSAGE;
  }

  return trimmed;
};

const parseLimit = (raw: unknown, fallback: number): number => {
  if (typeof raw !== "string" || !raw.trim()) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.min(parsed, 100));
};

const getStatusCode = (error: unknown): number => {
  if (error && typeof error === "object") {
    const candidate = error as { status?: unknown; statusCode?: unknown };

    if (typeof candidate.status === "number") {
      return candidate.status;
    }

    if (typeof candidate.statusCode === "number") {
      return candidate.statusCode;
    }
  }

  return 500;
};

const normalizeError = (error: unknown): NormalizedError => {
  const status = getStatusCode(error);
  const normalizedStatus = status >= 400 && status < 600 ? status : 500;
  const isServerError = normalizedStatus >= 500;
  const message = error instanceof Error ? sanitizeClientErrorText(error.message) : "요청 처리 중 오류가 발생했습니다.";

  return {
    status: normalizedStatus,
    body: {
      message,
      detail: isServerError ? "Internal Server Error" : getClientErrorDetail(normalizedStatus),
    },
  };
};

const pickFirstString = (candidates: unknown[]): string => {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
};

const readTextFromMessages = (value: unknown): string => {
  if (!Array.isArray(value)) {
    return "";
  }

  const reversed = [...value].reverse();

  for (const item of reversed) {
    if (typeof item === "string" && item.trim()) {
      return item.trim();
    }

    if (item && typeof item === "object") {
      const content = (item as { content?: unknown }).content;
      if (typeof content === "string" && content.trim()) {
        return content.trim();
      }
    }
  }

  return "";
};

const parseAttachedModules = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
};

export const createAssistantRouter = ({ controller }: AssistantRouterOptions): Router => {
  const router = Router();

  router.get("/history", async (req, res) => {
    try {
      const query = req.query as Record<string, unknown>;
      const chatId = typeof query.chatId === "string" && query.chatId.trim().length > 0
        ? query.chatId.trim()
        : "web:anonymous";
      const limit = parseLimit(query.limit, 30);

      const items = await controller.listConversationHistory(chatId, limit);

      res.status(200).json({
        ok: true,
        item: {
          chatId,
          count: items.length,
          items,
        },
      });
    } catch (error) {
      const normalized = normalizeError(error);
      res.status(normalized.status).json({
        ok: false,
        error: normalized.body,
      });
    }
  });

  router.post("/route", async (req, res) => {
    try {
      const body = req.body;
      const query = req.query as Record<string, unknown>;
      const normalizedBody = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

      const chatId = pickFirstString([
        normalizedBody.chatId,
        normalizedBody.sessionId,
        query.chatId,
      ]) || "web:anonymous";

      const text = pickFirstString([
        typeof body === "string" ? body : "",
        normalizedBody.text,
        normalizedBody.command,
        normalizedBody.message,
        normalizedBody.prompt,
        normalizedBody.input,
        readTextFromMessages(normalizedBody.messages),
        query.text,
        query.command,
        query.message,
        query.prompt,
        query.input,
      ]);
      const attachedModules = parseAttachedModules(
        normalizedBody.attachedModules ?? query.attachedModules,
      );

      if (!text) {
        res.status(422).json({
          ok: false,
          error: {
            message: "입력 텍스트가 비어 있습니다.",
            detail: "text/message/command/prompt/input/messages 중 하나를 전달해 주세요.",
          },
        });
        return;
      }

      await appendPromptLog({
        source: "web_route",
        chatId,
        username: pickFirstString([normalizedBody.username]) || undefined,
        text,
        attachedModules,
      });

      const result = await controller.handleTelegramText({
        chatId,
        username: pickFirstString([normalizedBody.username]) || undefined,
        text,
      });

      res.status(200).json({
        ok: true,
        item: result,
      });
    } catch (error) {
      const normalized = normalizeError(error);
      res.status(normalized.status).json({
        ok: false,
        error: normalized.body,
      });
    }
  });

  return router;
};
