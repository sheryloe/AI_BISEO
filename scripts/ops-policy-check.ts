import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { config } from "dotenv";

config();

type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
};

const workspaceRoot = path.resolve(__dirname, "..");
const promptLogDir = path.resolve(workspaceRoot, process.env.PROMPT_LOG_DIR?.trim() || "prompt_log");
const timezone = process.env.TZ?.trim() || "Asia/Seoul";

const formatDateKey = (date: Date): string => {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
};

const checkPromptLog = (): CheckResult => {
  const dateKey = formatDateKey(new Date());
  const targetFile = path.join(promptLogDir, `${dateKey}_prompts.jsonl`);

  if (!fs.existsSync(promptLogDir)) {
    return {
      name: "prompt_log_dir",
      ok: false,
      detail: `폴더 없음: ${promptLogDir}`,
    };
  }

  if (!fs.existsSync(targetFile)) {
    return {
      name: "prompt_log_today",
      ok: false,
      detail: `오늘 로그 없음: ${targetFile}`,
    };
  }

  const stat = fs.statSync(targetFile);
  return {
    name: "prompt_log_today",
    ok: stat.size > 0,
    detail: stat.size > 0 ? `OK (${stat.size} bytes)` : "파일은 있으나 비어 있음",
  };
};

const run = (command: string): string => {
  return execSync(command, {
    cwd: workspaceRoot,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  }).trim();
};

const checkGitRemote = (): CheckResult => {
  try {
    const remoteText = run("git remote -v");
    const hasOrigin = remoteText.split(/\r?\n/).some((line) => line.startsWith("origin"));
    return {
      name: "git_remote",
      ok: hasOrigin,
      detail: hasOrigin ? "origin remote configured" : "origin remote 미설정",
    };
  } catch (error) {
    return {
      name: "git_remote",
      ok: false,
      detail: `git remote 조회 실패: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const checkNotionEnv = (): CheckResult => {
  const notionApiKey = process.env.NOTION_API_KEY?.trim() || "";
  const notionParentPageId = process.env.NOTION_PARENT_PAGE_ID?.trim() || "";

  const ok = notionApiKey.length > 0 && notionParentPageId.length > 0;
  return {
    name: "notion_env",
    ok,
    detail: ok
      ? "NOTION_API_KEY / NOTION_PARENT_PAGE_ID 설정됨"
      : "NOTION_API_KEY 또는 NOTION_PARENT_PAGE_ID 누락",
  };
};

const checks: CheckResult[] = [
  checkPromptLog(),
  checkGitRemote(),
  checkNotionEnv(),
];

for (const check of checks) {
  const mark = check.ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${check.name} - ${check.detail}`);
}

const hasFailure = checks.some((check) => !check.ok);
if (hasFailure) {
  process.exit(1);
}
