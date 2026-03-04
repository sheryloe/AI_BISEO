import { promises as fs } from "fs";
import path from "path";
import { Router } from "express";

import { applyRuntimeEnvPatch, env, RuntimeMutableEnvKey } from "../core/env";
import { logger } from "../core/logger";

interface UpdateSettingsInput {
  telegramBotToken?: string;
  telegramAllowedChatIds?: string;
  openAiApiKey?: string;
  googleAiStudioApiKey?: string;
  notionApiKey?: string;
  notionParentPageId?: string;
  n8nBlogCallbackSecret?: string;
}

const ENV_PATH = path.resolve(process.cwd(), ".env");

const KNOWN_KEYS = {
  telegramBotToken: "TELEGRAM_BOT_TOKEN",
  telegramAllowedChatIds: "TELEGRAM_ALLOWED_CHAT_IDS",
  openAiApiKey: "OPENAI_API_KEY",
  googleAiStudioApiKey: "GOOGLE_AI_STUDIO_API_KEY",
  notionApiKey: "NOTION_API_KEY",
  notionParentPageId: "NOTION_PARENT_PAGE_ID",
  n8nBlogCallbackSecret: "N8N_BLOG_CALLBACK_SECRET",
} as const;

type KnownEnvKey = (typeof KNOWN_KEYS)[keyof typeof KNOWN_KEYS];

const RESTART_REQUIRED_KEYS = new Set<KnownEnvKey>([
  "TELEGRAM_BOT_TOKEN",
]);

const toStringValue = (value: string): string => {
  if (value.length === 0) {
    return "";
  }

  if (/^[A-Za-z0-9._:/@-]+$/.test(value)) {
    return value;
  }

  return JSON.stringify(value);
};

const sanitizeInputValue = (value: string): string => {
  return value.replace(/\r?\n/g, "").trim();
};

const mask = (value: string): string => {
  if (!value) {
    return "";
  }

  if (value.length <= 8) {
    return "********";
  }

  return `${value.slice(0, 3)}***${value.slice(-3)}`;
};

const escapeForRegex = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const readEnvValue = (content: string, key: KnownEnvKey): string => {
  const regex = new RegExp(`^${escapeForRegex(key)}=(.*)$`, "m");
  const matched = content.match(regex)?.[1] ?? "";
  return matched.replace(/^["']|["']$/g, "");
};

const upsertEnvLine = (content: string, key: string, value: string): string => {
  const escaped = toStringValue(value);
  const regex = new RegExp(`^${escapeForRegex(key)}=(.*)$`, "m");

  if (regex.test(content)) {
    return content.replace(regex, `${key}=${escaped}`);
  }

  const normalized = content.endsWith("\n") || content.length === 0 ? content : `${content}\n`;
  return `${normalized}${key}=${escaped}\n`;
};

const readSettingsFromEnv = async (): Promise<Record<KnownEnvKey, string>> => {
  try {
    const raw = await fs.readFile(ENV_PATH, "utf8");

    return {
      TELEGRAM_BOT_TOKEN: readEnvValue(raw, "TELEGRAM_BOT_TOKEN"),
      TELEGRAM_ALLOWED_CHAT_IDS: readEnvValue(raw, "TELEGRAM_ALLOWED_CHAT_IDS"),
      OPENAI_API_KEY: readEnvValue(raw, "OPENAI_API_KEY"),
      GOOGLE_AI_STUDIO_API_KEY: readEnvValue(raw, "GOOGLE_AI_STUDIO_API_KEY"),
      NOTION_API_KEY: readEnvValue(raw, "NOTION_API_KEY"),
      NOTION_PARENT_PAGE_ID: readEnvValue(raw, "NOTION_PARENT_PAGE_ID"),
      N8N_BLOG_CALLBACK_SECRET: readEnvValue(raw, "N8N_BLOG_CALLBACK_SECRET"),
    };
  } catch (error) {
    logger.warn("설정 조회 중 .env 읽기에 실패했습니다.", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? "",
      TELEGRAM_ALLOWED_CHAT_IDS: process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? "",
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
      GOOGLE_AI_STUDIO_API_KEY: process.env.GOOGLE_AI_STUDIO_API_KEY ?? "",
      NOTION_API_KEY: process.env.NOTION_API_KEY ?? "",
      NOTION_PARENT_PAGE_ID: process.env.NOTION_PARENT_PAGE_ID ?? "",
      N8N_BLOG_CALLBACK_SECRET: process.env.N8N_BLOG_CALLBACK_SECRET ?? "",
    };
  }
};

export const createConfigRouter = (): Router => {
  const router = Router();

  router.get("/env", async (_req, res) => {
    const settings = await readSettingsFromEnv();

    res.status(200).json({
      ok: true,
      item: {
        telegramBotToken: mask(settings.TELEGRAM_BOT_TOKEN),
        telegramAllowedChatIds: mask(settings.TELEGRAM_ALLOWED_CHAT_IDS),
        openAiApiKey: mask(settings.OPENAI_API_KEY),
        googleAiStudioApiKey: mask(settings.GOOGLE_AI_STUDIO_API_KEY),
        notionApiKey: mask(settings.NOTION_API_KEY),
        notionParentPageId: mask(settings.NOTION_PARENT_PAGE_ID),
        n8nBlogCallbackSecret: mask(settings.N8N_BLOG_CALLBACK_SECRET),
        n8nCallbackSecretHeader: env.N8N_CALLBACK_SECRET_HEADER,
        settingsWriteEnabled: env.SETTINGS_UI_WRITE_ENABLED,
      },
    });
  });

  router.post("/env", async (req, res) => {
    if (!env.SETTINGS_UI_WRITE_ENABLED) {
      res.status(403).json({ ok: false, message: "현재 모드에서는 대시보드에서 환경변수 저장을 허용하지 않습니다." });
      return;
    }

    const body = req.body as Partial<UpdateSettingsInput>;
    const updates: Array<{ key: KnownEnvKey; value: string }> = [];

    if (typeof body.telegramBotToken === "string") {
      updates.push({
        key: KNOWN_KEYS.telegramBotToken,
        value: sanitizeInputValue(body.telegramBotToken),
      });
    }

    if (typeof body.telegramAllowedChatIds === "string") {
      updates.push({
        key: KNOWN_KEYS.telegramAllowedChatIds,
        value: sanitizeInputValue(body.telegramAllowedChatIds),
      });
    }

    if (typeof body.openAiApiKey === "string") {
      updates.push({
        key: KNOWN_KEYS.openAiApiKey,
        value: sanitizeInputValue(body.openAiApiKey),
      });
    }

    if (typeof body.googleAiStudioApiKey === "string") {
      updates.push({
        key: KNOWN_KEYS.googleAiStudioApiKey,
        value: sanitizeInputValue(body.googleAiStudioApiKey),
      });
    }

    if (typeof body.notionApiKey === "string") {
      updates.push({
        key: KNOWN_KEYS.notionApiKey,
        value: sanitizeInputValue(body.notionApiKey),
      });
    }

    if (typeof body.notionParentPageId === "string") {
      updates.push({
        key: KNOWN_KEYS.notionParentPageId,
        value: sanitizeInputValue(body.notionParentPageId),
      });
    }

    if (typeof body.n8nBlogCallbackSecret === "string") {
      updates.push({
        key: KNOWN_KEYS.n8nBlogCallbackSecret,
        value: sanitizeInputValue(body.n8nBlogCallbackSecret),
      });
    }

    if (updates.length === 0) {
      res.status(400).json({ ok: false, message: "저장할 값이 없습니다." });
      return;
    }

    let envContent = "";

    try {
      envContent = await fs.readFile(ENV_PATH, "utf8");
    } catch (error) {
      logger.warn(".env 파일이 없어 새로 생성합니다.", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const dedupedByKey = new Map<KnownEnvKey, string>();
    for (const update of updates) {
      dedupedByKey.set(update.key, update.value);
    }

    for (const [key, value] of dedupedByKey.entries()) {
      envContent = upsertEnvLine(envContent, key, value);
    }

    await fs.writeFile(ENV_PATH, envContent, "utf8");

    const runtimePatch: Partial<Record<RuntimeMutableEnvKey, string>> = {};
    for (const [key, value] of dedupedByKey.entries()) {
      runtimePatch[key as RuntimeMutableEnvKey] = value;
    }
    applyRuntimeEnvPatch(runtimePatch);

    const updatedKeys = Array.from(dedupedByKey.keys());
    const restartRequired = updatedKeys.filter((key) => RESTART_REQUIRED_KEYS.has(key));
    const appliedImmediately = updatedKeys.filter((key) => !RESTART_REQUIRED_KEYS.has(key));

    logger.info("설정을 .env 및 런타임에 반영했습니다.", {
      updatedKeys,
      restartRequired,
      appliedImmediately,
    });

    res.status(200).json({
      ok: true,
      message:
        restartRequired.length > 0
          ? "설정이 저장되었습니다. 일부 항목은 서비스 재시작이 필요합니다."
          : "설정이 저장되어 즉시 반영되었습니다.",
      item: {
        updatedKeys,
        appliedImmediately,
        restartRequired,
      },
    });
  });

  return router;
};

