import fs from "fs";
import path from "path";

import { env } from "./env";
import { logger } from "./logger";

export type PromptLogSource = "web_route" | "telegram";

export interface PromptLogRecordInput {
  source: PromptLogSource;
  chatId: string;
  text: string;
  username?: string;
  attachedModules?: string[];
}

let promptLogDirReady = false;

const ensurePromptLogDir = async (): Promise<void> => {
  if (promptLogDirReady) {
    return;
  }

  await fs.promises.mkdir(env.PROMPT_LOG_DIR, { recursive: true });
  promptLogDirReady = true;
};

const toDateKey = (date: Date): string => {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: env.TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
};

export const appendPromptLog = async (input: PromptLogRecordInput): Promise<void> => {
  if (!env.PROMPT_LOG_ENABLED) {
    return;
  }

  try {
    await ensurePromptLogDir();
    const now = new Date();
    const fileName = `${toDateKey(now)}_prompts.jsonl`;
    const filePath = path.join(env.PROMPT_LOG_DIR, fileName);

    const record = {
      ts: now.toISOString(),
      source: input.source,
      chatId: input.chatId,
      username: input.username ?? "",
      attachedModules: input.attachedModules ?? [],
      text: input.text,
    };

    await fs.promises.appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
  } catch (error) {
    logger.error("프롬프트 로그 저장에 실패했습니다.", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
