import axios from "axios";

import { env } from "../../core/env";
import { logger } from "../../core/logger";
import { AiWriterPipelineTracker } from "../ai_writer_tistory/pipelineTracker";
import { ModuleRegistry } from "../base/moduleRegistry";

export interface BlogWorkflowTriggerInput {
  sessionId: string;
  chatId: string;
  username?: string;
  text: string;
  imageCount?: number;
  imageSize?: string;
  imageStyle?: string;
}

export interface BlogWorkflowTriggerResult {
  moduleId: "AI_Writer_TISTORY";
  action: "trigger_blog_workflow";
  status: "triggered" | "skipped" | "failed";
  message: string;
  runId?: string;
  webhookStatus?: number;
}

interface BlogWorkflowClientOptions {
  moduleRegistry: ModuleRegistry;
  tracker: AiWriterPipelineTracker;
  emitMonitoringEvent?: (eventName: string, payload: Record<string, unknown>) => void;
}

const N8N_TRIGGER_TIMEOUT_MS = 10000;

const toImageCount = (value: number | undefined): number => {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.min(Math.floor(value ?? 1), 3));
};

const createRunId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `blog_${timestamp}_${random}`;
};

const parseWebhookUrl = (rawUrl: string): URL | null => {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.includes("your-n8n-host")) {
    return null;
  }

  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
};

const toErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const statusCode = error.response?.status;
    const statusLabel = statusCode ? `HTTP ${statusCode}` : "요청 실패";
    const reason = error.message?.trim() || "상세 오류를 확인해 주세요.";
    return `${statusLabel}: ${reason}`;
  }

  if (error instanceof Error) {
    return error.message || "상세 오류를 확인해 주세요.";
  }

  return String(error);
};

export class BlogWorkflowClient {
  constructor(private readonly options: BlogWorkflowClientOptions) {}

  private async markModuleStatus(
    healthy: boolean,
    stage: string,
    message: string,
  ): Promise<void> {
    const writerModule = this.options.moduleRegistry.getModule("AI_Writer_TISTORY");
    if (!writerModule) {
      return;
    }

    await writerModule.setMonitoringStatus({
      healthy,
      stage,
      message,
    });
  }

  private async appendModuleHistory(payload: {
    action: string;
    input?: unknown;
    output?: unknown;
  }): Promise<void> {
    const writerModule = this.options.moduleRegistry.getModule("AI_Writer_TISTORY");
    if (!writerModule) {
      return;
    }

    await writerModule.appendHistory(payload);
  }

  public async trigger(input: BlogWorkflowTriggerInput): Promise<BlogWorkflowTriggerResult> {
    const webhookUrl = parseWebhookUrl(env.N8N_BLOG_TRIGGER_WEBHOOK_URL);
    const callbackSecret = env.N8N_BLOG_CALLBACK_SECRET.trim();

    if (!webhookUrl) {
      const message = "블로그 자동화 웹훅이 설정되지 않았습니다. N8N_BLOG_TRIGGER_WEBHOOK_URL을 설정해 주세요.";

      await this.markModuleStatus(true, "idle", "n8n 트리거 URL 미설정");
      await this.appendModuleHistory({
        action: "trigger_blog_workflow_skipped",
        input: {
          chatId: input.chatId,
          username: input.username,
          text: input.text,
        },
        output: {
          reason: "N8N_BLOG_TRIGGER_WEBHOOK_URL is not configured",
        },
      });

      return {
        moduleId: "AI_Writer_TISTORY",
        action: "trigger_blog_workflow",
        status: "skipped",
        message,
      };
    }

    if (!callbackSecret) {
      const message = "N8N_BLOG_CALLBACK_SECRET is not configured.";

      await this.markModuleStatus(false, "trigger_blocked", "N8N_BLOG_CALLBACK_SECRET is missing");
      await this.appendModuleHistory({
        action: "trigger_blog_workflow_blocked",
        input: {
          chatId: input.chatId,
          username: input.username,
          text: input.text,
        },
        output: {
          reason: "N8N_BLOG_CALLBACK_SECRET is missing",
        },
      });

      return {
        moduleId: "AI_Writer_TISTORY",
        action: "trigger_blog_workflow",
        status: "failed",
        message,
      };
    }

    const runId = createRunId();
    const now = new Date().toISOString();
    const callbackPath = `${env.N8N_BLOG_CALLBACK_BASE_PATH}${env.N8N_BLOG_CALLBACK_ROUTE}`;

    const payload = {
      moduleId: "AI_Writer_TISTORY",
      runId,
      requestedAt: now,
      source: "AI_BISEO",
      chatId: input.chatId,
      sessionId: input.sessionId,
      username: input.username,
      commandText: input.text,
      topic: input.text,
      keyword: input.text,
      image_count: toImageCount(input.imageCount),
      image_size: input.imageSize?.trim() || "1024x1024",
      image_style: input.imageStyle?.trim() || "clean modern",
      callback: {
        path: callbackPath,
        secretHeader: env.N8N_CALLBACK_SECRET_HEADER,
      },
    };

    this.options.tracker.appendEvent({
      runId,
      moduleId: "AI_Writer_TISTORY",
      agentKey: "unknown",
      agentName: "trigger",
      status: "requested",
      input: payload,
      raw: {
        triggerWebhookUrl: webhookUrl.toString(),
      },
      receivedAt: now,
    });

    await this.markModuleStatus(true, "triggering", `run=${runId} / n8n 트리거 전송`);

    const headers: Record<string, string> = {
      "content-type": "application/json",
      [env.N8N_CALLBACK_SECRET_HEADER]: callbackSecret,
    };

    try {
      const response = await axios.post(
        webhookUrl.toString(),
        payload,
        {
          headers,
          timeout: N8N_TRIGGER_TIMEOUT_MS,
          validateStatus: () => true,
        },
      );

      if (response.status >= 200 && response.status < 300) {
        const responseData = (response.data ?? {}) as Record<string, unknown>;
        const writer = typeof responseData.writer === "string" ? responseData.writer : "";
        const editor = typeof responseData.editor === "string" ? responseData.editor : "";
        const artist = typeof responseData.artist === "string" ? responseData.artist : "";
        const director = typeof responseData.director === "string" ? responseData.director : "";
        const imageUrls = Array.isArray(responseData.image_urls)
          ? responseData.image_urls.filter((item): item is string => typeof item === "string")
          : [];
        const imagePaths = Array.isArray(responseData.image_paths)
          ? responseData.image_paths.filter((item): item is string => typeof item === "string")
          : [];

        await this.markModuleStatus(true, "queued", `run=${runId} / n8n 접수 완료 (${response.status})`);
        await this.appendModuleHistory({
          action: "trigger_blog_workflow",
          input: {
            chatId: input.chatId,
            username: input.username,
            text: input.text,
            runId,
          },
          output: {
            webhookStatus: response.status,
            webhookData: response.data,
            writerLength: writer.length,
            editorLength: editor.length,
            directorLength: director.length,
            imageCount: imageUrls.length || imagePaths.length,
          },
        });

        this.options.tracker.appendEvent({
          runId,
          moduleId: "AI_Writer_TISTORY",
          agentKey: "unknown",
          agentName: "trigger",
          status: "triggered",
          input: payload,
          output: response.data,
          raw: {
            triggerWebhookUrl: webhookUrl.toString(),
            statusCode: response.status,
          },
          receivedAt: now,
        });

        this.options.emitMonitoringEvent?.("n8n:blog_trigger", {
          moduleId: "AI_Writer_TISTORY",
          runId,
          status: "triggered",
          webhookStatus: response.status,
          requestedAt: now,
        });

        if (writer) {
          this.options.tracker.appendEvent({
            runId,
            moduleId: "AI_Writer_TISTORY",
            agentKey: "agent_1_main_writer",
            agentName: "Agent 1 Main Writer",
            status: "completed",
            output: writer,
            raw: {
              source: "n8n_response",
              field: "writer",
            },
            receivedAt: new Date().toISOString(),
          });
        }

        if (editor) {
          this.options.tracker.appendEvent({
            runId,
            moduleId: "AI_Writer_TISTORY",
            agentKey: "agent_2_review_writer",
            agentName: "Agent 2 Review Writer",
            status: "completed",
            output: editor,
            raw: {
              source: "n8n_response",
              field: "editor",
            },
            receivedAt: new Date().toISOString(),
          });
        }

        if (artist || imageUrls.length > 0 || imagePaths.length > 0) {
          this.options.tracker.appendEvent({
            runId,
            moduleId: "AI_Writer_TISTORY",
            agentKey: "agent_3_image_generator",
            agentName: "Agent 3 Image Generator",
            status: "completed",
            output: {
              artistPrompt: artist,
              imageUrls,
              imagePaths,
            },
            raw: {
              source: "n8n_response",
              field: "artist/image",
            },
            receivedAt: new Date().toISOString(),
          });
        }

        if (director) {
          this.options.tracker.appendEvent({
            runId,
            moduleId: "AI_Writer_TISTORY",
            agentKey: "agent_4_final_writer",
            agentName: "Agent 4 Final Writer",
            status: "completed",
            output: director,
            raw: {
              source: "n8n_response",
              field: "director",
            },
            receivedAt: new Date().toISOString(),
          });
        }

        return {
          moduleId: "AI_Writer_TISTORY",
          action: "trigger_blog_workflow",
          status: "triggered",
          runId,
          webhookStatus: response.status,
          message: [
            "티스토리 블로그 파이프라인 트리거를 전송했습니다.",
            `runId: ${runId}`,
            `n8n status: ${response.status}`,
            director ? "최종 원고 생성까지 완료되었습니다." : "워크플로우 실행이 시작되었습니다.",
            `콜백 경로: ${callbackPath}`,
          ].join("\n"),
        };
      }

      const failedMessage = `n8n 트리거 호출 실패(${response.status}). 워크플로우 URL/인증을 확인해 주세요.`;

      await this.markModuleStatus(false, "trigger_failed", `run=${runId} / n8n 응답 ${response.status}`);
      await this.appendModuleHistory({
        action: "trigger_blog_workflow_failed",
        input: {
          chatId: input.chatId,
          username: input.username,
          text: input.text,
          runId,
        },
        output: {
          webhookStatus: response.status,
          webhookData: response.data,
        },
      });

      logger.warn("n8n 블로그 트리거가 실패했습니다.", {
        runId,
        status: response.status,
        webhookUrl: webhookUrl.toString(),
      });

      this.options.emitMonitoringEvent?.("n8n:blog_trigger", {
        moduleId: "AI_Writer_TISTORY",
        runId,
        status: "failed",
        webhookStatus: response.status,
        requestedAt: now,
      });

      this.options.tracker.appendEvent({
        runId,
        moduleId: "AI_Writer_TISTORY",
        agentKey: "unknown",
        agentName: "trigger",
        status: "failed",
        output: {
          webhookStatus: response.status,
          webhookData: response.data,
        },
        raw: {
          triggerWebhookUrl: webhookUrl.toString(),
          reason: "non_2xx",
        },
        receivedAt: new Date().toISOString(),
      });

      return {
        moduleId: "AI_Writer_TISTORY",
        action: "trigger_blog_workflow",
        status: "failed",
        runId,
        webhookStatus: response.status,
        message: failedMessage,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === "ECONNABORTED") {
        await this.markModuleStatus(true, "queued", `run=${runId} / n8n 실행 중(응답 대기 타임아웃)`);
        await this.appendModuleHistory({
          action: "trigger_blog_workflow_timeout",
          input: {
            chatId: input.chatId,
            username: input.username,
            text: input.text,
            runId,
          },
          output: {
            reason: "request timeout while waiting for n8n response",
            timeoutMs: N8N_TRIGGER_TIMEOUT_MS,
          },
        });

        this.options.emitMonitoringEvent?.("n8n:blog_trigger", {
          moduleId: "AI_Writer_TISTORY",
          runId,
          status: "triggered",
          pending: true,
          requestedAt: now,
          timeoutMs: N8N_TRIGGER_TIMEOUT_MS,
        });

        this.options.tracker.appendEvent({
          runId,
          moduleId: "AI_Writer_TISTORY",
          agentKey: "unknown",
          agentName: "trigger",
          status: "pending",
          output: {
            timeoutMs: N8N_TRIGGER_TIMEOUT_MS,
            message: "request timeout while waiting for n8n response",
          },
          raw: {
            triggerWebhookUrl: webhookUrl.toString(),
            reason: "timeout",
          },
          receivedAt: new Date().toISOString(),
        });

        return {
          moduleId: "AI_Writer_TISTORY",
          action: "trigger_blog_workflow",
          status: "triggered",
          runId,
          message: [
            "티스토리 블로그 파이프라인 트리거를 전송했습니다.",
            `runId: ${runId}`,
            `n8n 응답 대기 시간(${N8N_TRIGGER_TIMEOUT_MS}ms)을 초과해 비동기 진행으로 전환했습니다.`,
            `콜백 경로: ${callbackPath}`,
          ].join("\n"),
        };
      }

      const errorMessage = toErrorMessage(error);

      await this.markModuleStatus(false, "trigger_failed", `run=${runId} / ${errorMessage}`);
      await this.appendModuleHistory({
        action: "trigger_blog_workflow_failed",
        input: {
          chatId: input.chatId,
          username: input.username,
          text: input.text,
          runId,
        },
        output: {
          error: errorMessage,
        },
      });

      logger.error("n8n 블로그 트리거 호출 중 예외가 발생했습니다.", {
        runId,
        error: errorMessage,
        webhookUrl: webhookUrl.toString(),
      });

      this.options.emitMonitoringEvent?.("n8n:blog_trigger", {
        moduleId: "AI_Writer_TISTORY",
        runId,
        status: "failed",
        error: errorMessage,
        requestedAt: now,
      });

      this.options.tracker.appendEvent({
        runId,
        moduleId: "AI_Writer_TISTORY",
        agentKey: "unknown",
        agentName: "trigger",
        status: "failed",
        output: {
          error: errorMessage,
        },
        raw: {
          triggerWebhookUrl: webhookUrl.toString(),
          reason: "exception",
        },
        receivedAt: new Date().toISOString(),
      });

      return {
        moduleId: "AI_Writer_TISTORY",
        action: "trigger_blog_workflow",
        status: "failed",
        runId,
        message: `n8n 트리거 호출 중 오류가 발생했습니다.\n${errorMessage}`,
      };
    }
  }
}
