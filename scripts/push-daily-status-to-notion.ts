import { Client } from "@notionhq/client";
import { config } from "dotenv";
import fs from "fs/promises";
import path from "path";

config();

const notionApiKey = process.env.NOTION_API_KEY?.trim() ?? "";
const notionParentPageIdRaw = process.env.NOTION_PARENT_PAGE_ID?.trim() ?? "";
const today = new Date().toISOString().slice(0, 10);

const DAILY_STATUS_PATTERN = /^DAILY_STATUS_(\d{4}-\d{2}-\d{2})\.md$/;

const parsePageId = (raw: string): string => {
  const normalized = raw.replace(/[^a-fA-F0-9]/g, "");
  if (normalized.length !== 32) {
    return "";
  }
  return normalized;
};

const toParagraphBlock = (text: string) => ({
  object: "block" as const,
  type: "paragraph" as const,
  paragraph: {
    rich_text: [
      {
        type: "text" as const,
        text: {
          content: text,
        },
      },
    ],
  },
});

const toHeadingBlock = (level: 1 | 2 | 3, text: string) => {
  if (level === 1) {
    return {
      object: "block" as const,
      type: "heading_1" as const,
      heading_1: {
        rich_text: [{ type: "text" as const, text: { content: text } }],
      },
    };
  }

  if (level === 2) {
    return {
      object: "block" as const,
      type: "heading_2" as const,
      heading_2: {
        rich_text: [{ type: "text" as const, text: { content: text } }],
      },
    };
  }

  return {
    object: "block" as const,
    type: "heading_3" as const,
    heading_3: {
      rich_text: [{ type: "text" as const, text: { content: text } }],
    },
  };
};

const toBulletBlock = (text: string) => ({
  object: "block" as const,
  type: "bulleted_list_item" as const,
  bulleted_list_item: {
    rich_text: [
      {
        type: "text" as const,
        text: {
          content: text,
        },
      },
    ],
  },
});

const markdownToBlocks = (markdown: string) => {
  const lines = markdown.split(/\r?\n/);
  const blocks: Array<ReturnType<typeof toParagraphBlock> | ReturnType<typeof toHeadingBlock> | ReturnType<typeof toBulletBlock>> = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(toHeadingBlock(3, line.slice(4).trim()));
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(toHeadingBlock(2, line.slice(3).trim()));
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push(toHeadingBlock(1, line.slice(2).trim()));
      continue;
    }

    if (line.startsWith("- ")) {
      blocks.push(toBulletBlock(line.slice(2).trim()));
      continue;
    }

    blocks.push(toParagraphBlock(line));
  }

  return blocks;
};

const appendBlocksInChunks = async (
  notion: Client,
  pageId: string,
  blocks: ReturnType<typeof markdownToBlocks>,
): Promise<void> => {
  const chunkSize = 80;

  for (let i = 0; i < blocks.length; i += chunkSize) {
    const chunk = blocks.slice(i, i + chunkSize);
    await notion.blocks.children.append({
      block_id: pageId,
      children: chunk,
    });
  }
};

const resolveDailyStatusFile = async (): Promise<{ filePath: string; dateKey: string }> => {
  const docsDir = path.resolve(process.cwd(), "docs");
  const todayFile = path.join(docsDir, `DAILY_STATUS_${today}.md`);

  try {
    await fs.access(todayFile);
    return { filePath: todayFile, dateKey: today };
  } catch {
    // fall through
  }

  const entries = await fs.readdir(docsDir);
  const candidates = entries
    .map((name) => {
      const match = name.match(DAILY_STATUS_PATTERN);
      if (!match) {
        return null;
      }

      return {
        name,
        dateKey: match[1],
      };
    })
    .filter((item): item is { name: string; dateKey: string } => item !== null)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  if (candidates.length === 0) {
    throw new Error("docs/DAILY_STATUS_YYYY-MM-DD.md 파일을 찾지 못했습니다.");
  }

  const latest = candidates[0];
  return {
    filePath: path.join(docsDir, latest.name),
    dateKey: latest.dateKey,
  };
};

const run = async (): Promise<void> => {
  if (!notionApiKey) {
    throw new Error("NOTION_API_KEY가 설정되지 않았습니다.");
  }

  const parentPageId = parsePageId(notionParentPageIdRaw);
  if (!parentPageId) {
    throw new Error("NOTION_PARENT_PAGE_ID 형식이 올바르지 않습니다.");
  }

  const dailyStatus = await resolveDailyStatusFile();
  const markdown = await fs.readFile(dailyStatus.filePath, "utf8");
  const blocks = markdownToBlocks(markdown);

  const notion = new Client({ auth: notionApiKey });

  const page = await notion.pages.create({
    parent: {
      type: "page_id",
      page_id: parentPageId,
    },
    properties: {
      title: {
        title: [
          {
            type: "text",
            text: {
              content: `AI_BISEO Daily Status ${today}`,
            },
          },
        ],
      },
    },
  });

  await appendBlocksInChunks(notion, page.id, blocks);
  console.log(`[Notion] Daily status 페이지 업로드 완료: ${page.id} (source=${dailyStatus.dateKey})`);
};

run().catch((error: unknown) => {
  console.error("[Notion] Daily status 업로드 실패:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
