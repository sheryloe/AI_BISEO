import { Router } from "express";

import { AssistantController } from "../core/orchestrator/assistantController";

interface AssistantRouterOptions {
  controller: AssistantController;
}

export const createAssistantRouter = ({ controller }: AssistantRouterOptions): Router => {
  const router = Router();

  router.post("/route", async (req, res) => {
    const body = req.body;
    const query = req.query as Record<string, unknown>;

    const chatIdFromBody = typeof body === "object" && body !== null && "chatId" in body
      ? (body as { chatId?: unknown }).chatId
      : undefined;

    const textFromBody = (() => {
      if (typeof body === "string") {
        return body;
      }

      if (typeof body === "object" && body !== null) {
        if (typeof body.text === "string") {
          return body.text;
        }
        if (typeof body.command === "string") {
          return body.command;
        }
        if (typeof body.message === "string") {
          return body.message;
        }
      }

      if (typeof query.text === "string") {
        return query.text;
      }
      if (typeof query.command === "string") {
        return query.command;
      }
      if (typeof query.message === "string") {
        return query.message;
      }

      return "";
    })();

    const chatId = typeof chatIdFromBody === "string" && chatIdFromBody.trim().length > 0
      ? chatIdFromBody.trim()
      : "web:anonymous";

    const text = typeof textFromBody === "string" ? textFromBody.trim() : "";

    if (!text) {
      res.status(200).json({
        ok: true,
        item: {
          replyText: "메시지가 비어 있습니다. 예: `내일 일정 알려줘`",
          route: "input_missing",
          routeLabel: "입력값 누락",
          reason: "텍스트가 비어 있습니다.",
          ragCount: 0,
        },
      });
      return;
    }

    const result = await controller.handleTelegramText({
      chatId,
      username:
        typeof body === "object" && body !== null && typeof (body as { username?: unknown }).username === "string"
          ? (body as { username?: string }).username
          : undefined,
      text,
    });

    res.status(200).json({
      ok: true,
      item: result,
    });
  });

  return router;
};
