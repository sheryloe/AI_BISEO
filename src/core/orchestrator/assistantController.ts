import { LlmLogRepository } from "../db/llmLogRepository";
import { ConversationRepository } from "../db/conversationRepository";
import { RagRepository } from "../db/ragRepository";
import { env } from "../env";
import { AssistantLlmService } from "../llm/assistantLlm";
import { logger } from "../logger";
import { decideIntent, getRouteLabel } from "../router/intentRouter";
import {
  getTradingStatusStub,
  queryCodingHistoryStub,
  queryLedgerStub,
} from "../../modules/interfaces/externalModuleStubs";
import { BlogWorkflowClient } from "../../modules/interfaces/blogWorkflowClient";

interface AssistantControllerOptions {
  conversationRepository: ConversationRepository;
  ragRepository: RagRepository;
  llmService: AssistantLlmService;
  llmLogRepository: LlmLogRepository;
  blogWorkflowClient: BlogWorkflowClient;
}

export interface AssistantMessageInput {
  chatId: string;
  username?: string;
  text: string;
}

export interface AssistantMessageOutput {
  replyText: string;
  route: string;
  routeLabel: string;
  reason: string;
  ragCount: number;
}

export interface AssistantHistoryItem {
  id: number;
  chatId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

const DEFAULT_SYSTEM_PROMPT = [
  "당신은 AI_BISEO의 메인 비서입니다.",
  "반드시 한국어로 답변하고, 사용자가 바로 실행할 수 있는 형태로 간결하게 작성하세요.",
  "RAG 참고 문맥이 있으면 우선 사용하고, 없으면 없다고 짧게 밝힌 뒤 일반 지식으로 답변하세요.",
  "근거가 부족한 내용은 단정하지 말고 확인 필요로 표시하세요.",
].join("\n");

const toSessionId = (chatId: string): string => {
  return `telegram:${chatId}`;
};

const toSnippet = (content: string, maxChars: number): string => {
  if (content.length <= maxChars) {
    return content;
  }

  return `${content.slice(0, maxChars)}...`;
};

const buildRagContext = (ragItems: Array<{ source: string; content: string }>): string => {
  if (ragItems.length === 0) {
    return "RAG 검색 결과 없음";
  }

  return ragItems
    .map((item, index) => `${index + 1}. [${item.source}] ${toSnippet(item.content, env.RAG_SNIPPET_MAX_CHARS)}`)
    .join("\n");
};

const buildConversationContext = (
  messages: Array<{ role: string; content: string }>,
  maxChars: number,
): string => {
  if (messages.length === 0) {
    return "최근 대화 없음";
  }

  return messages
    .map((message) => `${message.role}: ${toSnippet(message.content, maxChars)}`)
    .join("\n");
};

export class AssistantController {
  constructor(private readonly options: AssistantControllerOptions) {}

  public async listConversationHistory(chatId: string, limit = 30): Promise<AssistantHistoryItem[]> {
    const normalizedLimit = Math.max(1, Math.min(limit, 100));
    const items = await this.options.conversationRepository.listRecentMessagesByChat(chatId, normalizedLimit);

    return items.map((item) => ({
      id: item.id,
      chatId: item.chatId,
      role: item.role,
      content: item.content,
      createdAt: item.createdAt,
    }));
  }

  public async handleTelegramText(input: AssistantMessageInput): Promise<AssistantMessageOutput> {
    const sessionId = toSessionId(input.chatId);

    await this.options.conversationRepository.createMessage({
      sessionId,
      chatId: input.chatId,
      role: "user",
      content: input.text,
    });

    const decision = decideIntent(input.text);
    const routeLabel = getRouteLabel(decision.route);

    let replyBody = "";
    let ragCount = 0;
    let llmProvider = "none";
    let llmModel = "none";
    let executionContext = "로컬 디스패처(Phase 1 스텁)";

    if (decision.route === "rag_search") {
      const ragResults = await this.options.ragRepository.searchDocuments(input.text, env.RAG_DEFAULT_LIMIT);
      ragCount = ragResults.length;

      const recentMessages = await this.options.conversationRepository.listRecentMessagesByChat(
        input.chatId,
        env.ASSISTANT_HISTORY_LIMIT,
      );

      if (env.ASSISTANT_ENABLE_LLM) {
        const systemPrompt = env.ASSISTANT_LLM_SYSTEM_PROMPT.trim() || DEFAULT_SYSTEM_PROMPT;
        const llmMessages = [
          { role: "system" as const, content: systemPrompt },
          {
            role: "user" as const,
            content: [
              "[사용자 요청]",
              input.text,
              "",
              "[최근 대화 맥락]",
              buildConversationContext(recentMessages, 200),
              "",
              "[로컬 RAG 참고 문맥]",
              buildRagContext(ragResults),
              "",
              "위 맥락을 참고해 사용자 요청에 답변해 주세요.",
            ].join("\n"),
          },
        ];

        const llmResult = await this.options.llmService.generate({
          sessionId,
          chatId: input.chatId,
          route: decision.route,
          messages: llmMessages,
        });

        if (llmResult) {
          replyBody = llmResult.text;
          llmProvider = llmResult.provider;
          llmModel = llmResult.model;

          await this.options.llmLogRepository.createLog({
            sessionId,
            chatId: input.chatId,
            route: decision.route,
            provider: llmResult.provider,
            model: llmResult.model,
            prompt: llmResult.promptPreview,
            response: llmResult.text,
            metadata: {
              ragCount,
              recentMessageCount: recentMessages.length,
            },
          });
        }
      }

      if (!replyBody && ragResults.length === 0) {
        replyBody = "로컬 기억 저장소에서 관련 내용을 찾지 못했습니다. 다른 키워드로 다시 물어보거나 작업을 더 구체화해 주세요.";
      } else if (!replyBody) {
        const lines = ragResults.map((item, index) => {
          const snippet = toSnippet(item.content, env.RAG_SNIPPET_MAX_CHARS);
          return `${index + 1}. [${item.source}] ${snippet}`;
        });

        replyBody = [
          "로컬 RAG 검색 결과입니다.",
          ...lines,
        ].join("\n");
      }
    } else if (decision.route === "call_blog") {
      const result = await this.options.blogWorkflowClient.trigger({
        sessionId,
        chatId: input.chatId,
        username: input.username,
        text: input.text,
      });
      replyBody = result.message;
      executionContext = result.status === "triggered"
        ? "n8n Webhook 트리거(실연동)"
        : "n8n Webhook 트리거(폴백 응답)";
    } else if (decision.route === "call_trading_status") {
      const result = await getTradingStatusStub(input.text);
      replyBody = result.message;
    } else if (decision.route === "call_ledger") {
      const result = await queryLedgerStub(input.text);
      replyBody = result.message;
    } else if (decision.route === "call_coding_history") {
      const result = await queryCodingHistoryStub(input.text);
      replyBody = result.message;
    } else {
      replyBody = "입력을 분류하지 못했습니다. 질문을 더 구체적으로 작성해 주세요.";
    }

    const reasonLines = [
      `판단 경로: ${routeLabel}`,
      `판단 근거: ${decision.reason}`,
      `RAG 매칭 건수: ${ragCount}`,
      `함수 실행 위치: ${executionContext}`,
      `LLM 사용 여부: ${env.ASSISTANT_ENABLE_LLM ? "enabled" : "disabled"}`,
      `LLM 공급자: ${llmProvider}`,
      `LLM 모델: ${llmModel}`,
    ];

    const replyText = env.ASSISTANT_SHOW_REASONING
      ? `${replyBody}\n\n[판단 근거]\n- ${reasonLines.join("\n- ")}`
      : replyBody;

    await this.options.conversationRepository.createMessage({
      sessionId,
      chatId: input.chatId,
      role: "assistant",
      content: replyText,
    });

    logger.info("메인 비서 라우팅이 완료되었습니다.", {
      chatId: input.chatId,
      route: decision.route,
      ragCount,
      llmProvider,
      llmModel,
    });

    return {
      replyText,
      route: decision.route,
      routeLabel,
      reason: decision.reason,
      ragCount,
    };
  }
}
