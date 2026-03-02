import { Express } from "express";
import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";

import { env } from "../core/env";
import { logger } from "../core/logger";

export interface TelegramTextMessageInput {
  chatId: string;
  username?: string;
  text: string;
}

export interface TelegramCommandInput {
  chatId: string;
  username?: string;
  rawText: string;
  command: string;
  args: string;
}

export interface TelegramTextMessageOutput {
  replyText: string;
  route?: string;
  routeLabel?: string;
  reason?: string;
  ragCount?: number;
}

interface TelegramIntegrationOptions {
  app: Express;
  emitMonitoringEvent: (eventName: string, payload: Record<string, unknown>) => void;
  onTextMessage?: (input: TelegramTextMessageInput) => Promise<TelegramTextMessageOutput>;
  onCommandMessage?: (input: TelegramCommandInput) => Promise<TelegramTextMessageOutput | null>;
}

const isAllowedChat = (chatId: string): boolean => {
  if (env.allowedTelegramChatIds.size === 0) {
    return true;
  }

  return env.allowedTelegramChatIds.has(chatId);
};

const buildWebhookUrl = (): string => {
  const normalizedBase = env.TELEGRAM_WEBHOOK_URL.replace(/\/$/, "");
  return `${normalizedBase}${env.TELEGRAM_WEBHOOK_PATH}`;
};

const COMMAND_PATTERN = /^\/([a-zA-Z0-9_]+)(?:@[a-zA-Z0-9_]+)?(?:\s+([\s\S]*))?$/;

const parseCommand = (text: string): { command: string; args: string } | null => {
  const matched = text.trim().match(COMMAND_PATTERN);
  if (!matched) {
    return null;
  }

  return {
    command: matched[1].toLowerCase(),
    args: (matched[2] ?? "").trim(),
  };
};

const buildStartMessage = (): string => {
  return [
    "AI_BISEO 비서가 연결되었습니다.",
    "명령어 목록은 /help 로 확인할 수 있습니다.",
    "자연어로 바로 질문해도 됩니다.",
  ].join("\n");
};

const buildHelpMessage = (topicRaw: string): string => {
  const topic = topicRaw.trim().toLowerCase();

  if (topic === "blog" || topic === "블로그") {
    return [
      "[블로그 자동화 도움말]",
      "- /blog <주제>: 티스토리 글 생성 파이프라인 트리거",
      "- /pipeline [개수]: 최근 블로그 실행 목록 조회",
      "- /run <runId>: 특정 실행 상세 조회",
      "",
      "예시",
      "- /blog 2026년 임시 공휴일 정리",
      "- /pipeline 5",
      "- /run blog_xxx",
    ].join("\n");
  }

  if (topic === "status" || topic === "상태") {
    return [
      "[상태 조회 도움말]",
      "- /status: 서비스 요약 상태",
      "- /modules: 모듈별 헬스/스테이지",
      "- /history [개수]: 내 최근 대화 기록",
      "",
      "예시",
      "- /status",
      "- /modules",
      "- /history 8",
    ].join("\n");
  }

  return [
    "[AI_BISEO 텔레그램 도움말]",
    "자연어 질문도 가능하고, 아래 명령어도 지원합니다.",
    "",
    "[공통]",
    "- /help [topic]: 도움말 보기 (topic: blog, status)",
    "- /menu: 도움말 보기",
    "- /ping: 응답 체크",
    "",
    "[상태/운영]",
    "- /status: 서비스 상태 요약",
    "- /modules: 모듈별 상태",
    "- /history [개수]: 최근 대화 기록",
    "",
    "[블로그 파이프라인]",
    "- /blog <주제>: 티스토리 블로그 파이프라인 실행",
    "- /pipeline [개수]: 최근 실행 목록",
    "- /run <runId>: 실행 상세",
    "",
    "[비서 라우팅 빠른 실행]",
    "- /rag <질문>: RAG 경로 질문",
    "- /trade [요청]: 트레이딩 경로",
    "- /ledger [요청]: 가계부 경로",
    "- /coding [요청]: 코딩 이력 경로",
    "- /ask <질문>: 일반 질의",
    "",
    "예시",
    "- /blog 2026년 임시 공휴일 정리",
    "- /rag 지난 작업 핵심 요약해줘",
    "- /status",
  ].join("\n");
};

const buildUnknownCommandMessage = (command: string): string => {
  return [
    `알 수 없는 명령어입니다: /${command}`,
    "사용 가능한 명령어는 /help 에서 확인해 주세요.",
  ].join("\n");
};

export const initializeTelegramIntegration = async ({
  app,
  emitMonitoringEvent,
  onTextMessage,
  onCommandMessage,
}: TelegramIntegrationOptions): Promise<void> => {
  if (!env.TELEGRAM_BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN이 없어 텔레그램 기능을 비활성화합니다.");
    return;
  }

  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  bot.catch((error) => {
    logger.error("텔레그램 업데이트 처리 중 오류가 발생했습니다.", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  bot.start(async (ctx) => {
    const chatId = String(ctx.chat.id);

    if (!isAllowedChat(chatId)) {
      await ctx.reply("이 채팅은 현재 비서 사용 허용 목록에 없습니다.");
      return;
    }

    await ctx.reply(buildStartMessage());

    emitMonitoringEvent("telegram:message", {
      type: "start",
      chatId,
      username: ctx.from?.username,
      text: "/start",
    });
  });

  bot.on(message("text"), async (ctx) => {
    const chatId = String(ctx.chat.id);

    if (!isAllowedChat(chatId)) {
      await ctx.reply("이 채팅은 현재 비서 사용 허용 목록에 없습니다.");
      return;
    }

    const incomingText = ctx.message.text;

    const parsedCommand = parseCommand(incomingText);
    if (parsedCommand) {
      let commandResponse: TelegramTextMessageOutput | null = null;

      if (parsedCommand.command === "help" || parsedCommand.command === "menu") {
        commandResponse = {
          replyText: buildHelpMessage(parsedCommand.args),
          route: "telegram_command",
          routeLabel: "도움말",
          reason: "사용자 명령어 요청",
        };
      } else if (parsedCommand.command === "ping") {
        commandResponse = {
          replyText: `pong\n${new Date().toISOString()}`,
          route: "telegram_command",
          routeLabel: "헬스 체크",
          reason: "사용자 명령어 요청",
        };
      } else if (onCommandMessage) {
        commandResponse = await onCommandMessage({
          chatId,
          username: ctx.from?.username,
          rawText: incomingText,
          command: parsedCommand.command,
          args: parsedCommand.args,
        });
      }

      if (!commandResponse) {
        commandResponse = {
          replyText: buildUnknownCommandMessage(parsedCommand.command),
          route: "telegram_command",
          routeLabel: "명령어 미지원",
          reason: "등록되지 않은 명령어",
        };
      }

      await ctx.reply(commandResponse.replyText);

      emitMonitoringEvent("telegram:message", {
        type: "command",
        chatId,
        username: ctx.from?.username,
        text: incomingText,
        command: parsedCommand.command,
        args: parsedCommand.args,
        reply: commandResponse.replyText,
        route: commandResponse.route,
        routeLabel: commandResponse.routeLabel,
        reason: commandResponse.reason,
        ragCount: commandResponse.ragCount,
      });

      return;
    }

    let response: TelegramTextMessageOutput = {
      replyText: `수신한 메시지: ${incomingText}\n(현재는 Phase 1 기본 응답 모드입니다.)`,
      route: "fallback",
    };

    if (onTextMessage) {
      response = await onTextMessage({
        chatId,
        username: ctx.from?.username,
        text: incomingText,
      });
    }

    await ctx.reply(response.replyText);

    emitMonitoringEvent("telegram:message", {
      type: "text",
      chatId,
      username: ctx.from?.username,
      text: incomingText,
      reply: response.replyText,
      route: response.route,
      routeLabel: response.routeLabel,
      reason: response.reason,
      ragCount: response.ragCount,
    });
  });

  let webhookActive = false;

  if (env.TELEGRAM_MODE === "webhook" || env.TELEGRAM_MODE === "both") {
    if (env.TELEGRAM_WEBHOOK_URL) {
      const callbackOptions = env.TELEGRAM_SECRET_TOKEN
        ? { secretToken: env.TELEGRAM_SECRET_TOKEN }
        : undefined;

      app.use(bot.webhookCallback(env.TELEGRAM_WEBHOOK_PATH, callbackOptions));

      const webhookOptions = env.TELEGRAM_SECRET_TOKEN
        ? { secret_token: env.TELEGRAM_SECRET_TOKEN }
        : undefined;

      await bot.telegram.setWebhook(buildWebhookUrl(), webhookOptions);
      webhookActive = true;

      logger.info("텔레그램 Webhook 모드를 활성화했습니다.", {
        webhookPath: env.TELEGRAM_WEBHOOK_PATH,
      });
    } else {
      logger.warn("TELEGRAM_WEBHOOK_URL이 비어 있어 Webhook 모드를 건너뜁니다.");
    }
  }

  const pollingRequired = env.TELEGRAM_MODE === "polling" || (env.TELEGRAM_MODE === "both" && !webhookActive);

  if (pollingRequired) {
    await bot.launch({ dropPendingUpdates: true });

    logger.info("텔레그램 Polling 모드를 활성화했습니다.");
  }

  if (env.TELEGRAM_MODE === "both" && webhookActive) {
    logger.info("텔레그램 both 모드에서 Webhook 우선 전략을 사용합니다.");
  }

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
};
