import { Router } from "express";

import { env } from "../core/env";
import { AiWriterOpenAiBridge } from "../modules/ai_writer_tistory/openAiBridge";
import { AiWriterPipelineTracker } from "../modules/ai_writer_tistory/pipelineTracker";
import { BlogWorkflowClient } from "../modules/interfaces/blogWorkflowClient";

interface AiWriterPipelineRouterOptions {
  tracker: AiWriterPipelineTracker;
  blogWorkflowClient: BlogWorkflowClient;
  openAiBridge: AiWriterOpenAiBridge;
}

const parseLimit = (rawLimit: unknown): number => {
  if (typeof rawLimit !== "string") {
    return 30;
  }

  const parsed = Number.parseInt(rawLimit, 10);
  if (Number.isNaN(parsed)) {
    return 30;
  }

  return Math.max(1, Math.min(parsed, 200));
};

const verifyBridgeSecret = (request: { header: (name: string) => string | undefined }): boolean => {
  const configured = env.N8N_BLOG_CALLBACK_SECRET.trim();
  if (!configured) {
    return true;
  }

  const incoming = request.header(env.N8N_CALLBACK_SECRET_HEADER) ?? "";
  return incoming === configured;
};

export const createAiWriterPipelineRouter = ({
  tracker,
  blogWorkflowClient,
  openAiBridge,
}: AiWriterPipelineRouterOptions): Router => {
  const router = Router();

  router.post("/trigger", async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";

    if (!topic) {
      res.status(422).json({
        ok: false,
        message: "topic이 비어 있습니다.",
      });
      return;
    }

    try {
      const imageCountRaw = typeof body.imageCount === "number"
        ? body.imageCount
        : Number.parseInt(String(body.imageCount ?? "1"), 10);
      const result = await blogWorkflowClient.trigger({
        sessionId: `web:${Date.now().toString(36)}`,
        chatId: typeof body.chatId === "string" && body.chatId.trim() ? body.chatId.trim() : "web:dashboard",
        username: typeof body.username === "string" && body.username.trim() ? body.username.trim() : "dashboard",
        text: topic,
        imageCount: Number.isFinite(imageCountRaw) ? imageCountRaw : 1,
        imageSize: typeof body.imageSize === "string" ? body.imageSize : undefined,
        imageStyle: typeof body.imageStyle === "string" ? body.imageStyle : undefined,
      });

      res.status(200).json({
        ok: true,
        item: result,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post("/llm/generate", async (req, res) => {
    if (!verifyBridgeSecret(req)) {
      res.status(401).json({
        ok: false,
        message: "인증에 실패했습니다.",
      });
      return;
    }

    try {
      const prompt = AiWriterOpenAiBridge.extractPrompt(req.body);
      if (!prompt.trim()) {
        res.status(422).json({
          ok: false,
          message: "prompt가 비어 있습니다.",
        });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const requestedModel = typeof body.model === "string" ? body.model : undefined;
      const text = await openAiBridge.generateTextFromPrompt(prompt, requestedModel);

      res.status(200).json(AiWriterOpenAiBridge.toOllamaShape(text));
    } catch (error) {
      res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post("/image/generate", async (req, res) => {
    if (!verifyBridgeSecret(req)) {
      res.status(401).json({
        ok: false,
        message: "인증에 실패했습니다.",
      });
      return;
    }

    try {
      const request = AiWriterOpenAiBridge.extractImageRequest(req.body);
      const result = await openAiBridge.generateImages(request);

      res.status(200).json(AiWriterOpenAiBridge.toLegacyImageShape(result));
    } catch (error) {
      res.status(500).json({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.get("/runs", (req, res) => {
    const limit = parseLimit(req.query.limit);
    const items = tracker.listRuns(limit);

    res.status(200).json({
      ok: true,
      limit,
      items,
    });
  });

  router.get("/runs/:runId", (req, res) => {
    const run = tracker.getRun(req.params.runId);

    if (!run) {
      res.status(404).json({ ok: false, message: "요청한 파이프라인 실행 이력을 찾을 수 없습니다." });
      return;
    }

    res.status(200).json({
      ok: true,
      item: run,
    });
  });

  return router;
};
