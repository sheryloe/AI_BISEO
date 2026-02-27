import axios from "axios";

import { env } from "../env";
import { logger } from "../logger";
import {
  AssistantLlmProvider,
  LlmGenerateInput,
  LlmGenerateOutput,
  LlmMessage,
} from "./types";

interface OllamaChatResponse {
  model?: string;
  message?: {
    role?: string;
    content?: string;
  };
}

interface OllamaTagsResponse {
  models?: Array<{
    name?: string;
  }>;
}

const toNormalizedModel = (name: string): string => name.trim().toLowerCase();

const truncateText = (value: string, maxLength = 2400): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
};

const safeStringify = (value: unknown): string => {
  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const toAxiosErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const statusText = error.response?.statusText;
    const statusPart = status ? `HTTP ${status}${statusText ? ` ${statusText}` : ""}` : "HTTP 요청 실패";
    const responseData = error.response?.data;

    if (responseData !== undefined) {
      const responsePayload = truncateText(safeStringify(responseData), 2200);
      const responseText = responsePayload === "{}" || responsePayload === "undefined" ? "응답 본문 없음" : responsePayload;
      const requestData = error.config?.data;
      const requestPayload = requestData ? truncateText(safeStringify(requestData), 1200) : "요청 데이터 없음";
      const requestInfo = error.config?.url
        ? `\n요청URL: ${error.config.method?.toUpperCase() ?? "GET"} ${error.config.url}`
        : "";
      return `${statusPart} | error.response.data: ${responseText} | request.data: ${requestPayload}${requestInfo}`.trim();
    }

    const code = error.code ?? "axios_error";
    const message = error.message?.trim() || "요청 실패";
    return `${code}: ${message}`;
  }

  if (error instanceof Error) {
    return error.message || "오류 메시지 없음";
  }

  return String(error);
};

const normalizeText = (value: string): string => {
  return value.replace(/\s+/g, " ").trim();
};

const buildPromptPreview = (messages: LlmMessage[]): string => {
  const lines = messages.map((message) => `${message.role.toUpperCase()}: ${normalizeText(message.content)}`);
  const joined = lines.join("\n");
  if (joined.length <= 600) {
    return joined;
  }

  return `${joined.slice(0, 600)}...`;
};

class NoopAssistantLlmProvider implements AssistantLlmProvider {
  public async generate(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
    return {
      provider: env.ASSISTANT_LLM_PROVIDER,
      model: "disabled",
      text: "",
      promptPreview: buildPromptPreview(input.messages),
    };
  }
}

class OllamaAssistantLlmProvider implements AssistantLlmProvider {
  private describeAxiosFailure(error: unknown, context: string, baseUrl: string): void {
    if (!axios.isAxiosError(error)) {
      return;
    }

    logger.error(`Ollama ${context} 호출 실패`, {
      baseUrl,
      status: error.response?.status,
      statusText: error.response?.statusText,
      code: error.code,
      requestUrl: error.config?.url,
      requestMethod: error.config?.method?.toUpperCase(),
      responseHeaders: error.response?.headers,
      responseData: truncateText(safeStringify(error.response?.data), 4000),
      requestData: error.config?.data ? truncateText(safeStringify(error.config.data), 2000) : undefined,
      url: error.config?.url,
      message: error.message,
    });
  }

  private async resolveBaseUrls(): Promise<string[]> {
    const baseUrl = env.OLLAMA_BASE_URL.replace(/\/$/, "");
    const candidateBaseUrls = [baseUrl];

    if (baseUrl.includes("localhost")) {
      candidateBaseUrls.push(baseUrl.replace("localhost", "host.docker.internal"));
    }

    return [...new Set(candidateBaseUrls)];
  }

  private async ensureModelExists(baseUrl: string): Promise<string | null> {
    try {
      const tagsResponse = await axios.get<OllamaTagsResponse>(`${baseUrl}/api/tags`, {
        timeout: env.OLLAMA_REQUEST_TIMEOUT_MS,
      });

      const candidates = (tagsResponse.data.models ?? [])
        .map((model) => model.name)
        .filter((name): name is string => Boolean(name))
        .map(toNormalizedModel);

      const targetModel = toNormalizedModel(env.OLLAMA_MODEL);
      if (candidates.includes(targetModel)) {
        return env.OLLAMA_MODEL;
      }

      if (candidates.length === 0) {
        return null;
      }

      return candidates[0];
    } catch (error) {
      this.describeAxiosFailure(error, "모델 목록 조회(/api/tags)", baseUrl);
      throw error;
    }
  }

  public async generate(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
    const candidateBaseUrls = await this.resolveBaseUrls();

    let lastError: unknown;

    for (const candidateBaseUrl of candidateBaseUrls) {
      try {
        const model = await this.ensureModelExists(candidateBaseUrl);
        if (!model) {
          throw new Error("설치된 Ollama 모델이 없습니다.");
        }

        if (model !== env.OLLAMA_MODEL) {
          logger.warn("요청 모델이 없어 대체 모델로 폴백합니다.", {
            requested: env.OLLAMA_MODEL,
            fallback: model,
          });
        }

        const response = await axios.post<OllamaChatResponse>(
          `${candidateBaseUrl}/api/chat`,
          {
            model,
            messages: input.messages,
            stream: false,
          },
          {
            timeout: env.OLLAMA_REQUEST_TIMEOUT_MS,
          },
        );

        const text = response.data.message?.content?.trim() ?? "";
        if (!text) {
          throw new Error("Ollama 응답 본문이 비어 있습니다.");
        }

        return {
          provider: "ollama",
          model: response.data.model ?? env.OLLAMA_MODEL,
          text,
          promptPreview: buildPromptPreview(input.messages),
        };
      } catch (error) {
        logger.error("Ollama 후보 URL 처리 중 오류", {
          candidateBaseUrl,
          error: toAxiosErrorMessage(error),
        });
        lastError = error;
      }
    }

    throw lastError ?? new Error("Ollama 호출 실패");
  }
}

const createProvider = (): AssistantLlmProvider => {
  if (env.ASSISTANT_LLM_PROVIDER === "ollama") {
    return new OllamaAssistantLlmProvider();
  }

  if (env.ASSISTANT_LLM_PROVIDER === "gemini_cli") {
    logger.warn("gemini_cli 공급자는 아직 구현되지 않아 LLM 생성을 건너뜁니다.");
    return new NoopAssistantLlmProvider();
  }

  return new NoopAssistantLlmProvider();
};

export class AssistantLlmService {
  private readonly provider: AssistantLlmProvider;

  constructor() {
    this.provider = createProvider();
  }

  public async generate(input: LlmGenerateInput): Promise<LlmGenerateOutput | null> {
    try {
      const result = await this.provider.generate(input);
      if (!result.text) {
        return null;
      }

      return result;
    } catch (error) {
      logger.error("LLM 응답 생성 에러 본문", {
        provider: env.ASSISTANT_LLM_PROVIDER,
        route: input.route,
        rawError: toAxiosErrorMessage(error),
      });
      logger.warn("LLM 응답 생성에 실패했습니다. Phase 1 기본 응답으로 폴백합니다.", {
        provider: env.ASSISTANT_LLM_PROVIDER,
        route: input.route,
        error: toAxiosErrorMessage(error),
      });
      return null;
    }
  }
}
