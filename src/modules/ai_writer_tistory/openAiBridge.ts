import { promises as fs } from "fs";
import path from "path";
import OpenAI from "openai";

import { env } from "../../core/env";

interface ImageBridgeOptions {
  prompt: string;
  count: number;
  size: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  quality: "low" | "medium" | "high" | "auto";
  style: string;
  runId?: string;
}

interface ImageBridgeResult {
  imageUrls: string[];
  imagePaths: string[];
  revisedPrompt?: string;
}

const ensureOpenAi = (): OpenAI => {
  const apiKey = env.OPENAI_API_KEY.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  return new OpenAI({ apiKey });
};

const sanitizeFilenamePart = (value: string): string => {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64) || "item";
};

const ensureArtifactDir = async (): Promise<string> => {
  const dir = path.resolve(process.cwd(), "storage", "artifacts", "ai_writer_tistory");
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

const toDataUrl = (mimeType: string, b64: string): string => {
  return `data:${mimeType};base64,${b64}`;
};

export class AiWriterOpenAiBridge {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (this.client) {
      return this.client;
    }

    this.client = ensureOpenAi();
    return this.client;
  }

  public async generateTextFromPrompt(prompt: string, requestedModel?: string): Promise<string> {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) {
      throw new Error("prompt가 비어 있습니다.");
    }

    const model = requestedModel?.trim() || env.OPENAI_MODEL;
    const response = await this.getClient().chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: normalizedPrompt,
        },
      ],
      temperature: 0.7,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? "";
    if (!text) {
      throw new Error("OpenAI 텍스트 응답이 비어 있습니다.");
    }

    return text;
  }

  public async generateImages(options: ImageBridgeOptions): Promise<ImageBridgeResult> {
    const prompt = options.prompt.trim();
    if (!prompt) {
      throw new Error("이미지 프롬프트가 비어 있습니다.");
    }

    const requestedCount = Number.isFinite(options.count) ? options.count : 1;
    const count = Math.max(1, Math.min(requestedCount, 3));
    const size = options.size;
    const quality = options.quality;
    const dir = await ensureArtifactDir();

    const response = await this.getClient().images.generate({
      model: "gpt-image-1",
      prompt: `${prompt}\n\nStyle guide: ${options.style}`.trim(),
      size,
      quality,
      n: count,
    });

    const imageUrls: string[] = [];
    const imagePaths: string[] = [];
    const runLabel = sanitizeFilenamePart(options.runId ?? `run_${Date.now().toString(36)}`);
    const data = response.data ?? [];

    for (let i = 0; i < data.length; i += 1) {
      const item = data[i] as Record<string, unknown>;
      const index = String(i + 1).padStart(2, "0");

      if (typeof item.url === "string" && item.url) {
        imageUrls.push(item.url);
        imagePaths.push("");
        continue;
      }

      if (typeof item.b64_json === "string" && item.b64_json) {
        const filename = `${runLabel}_${index}.png`;
        const filePath = path.join(dir, filename);
        const buffer = Buffer.from(item.b64_json, "base64");
        await fs.writeFile(filePath, buffer);

        imagePaths.push(filePath);
        imageUrls.push(`/artifacts/ai_writer_tistory/${filename}`);
        continue;
      }

      if (typeof item.result === "string" && item.result) {
        const base64 = item.result.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
        const filename = `${runLabel}_${index}.png`;
        const filePath = path.join(dir, filename);
        await fs.writeFile(filePath, Buffer.from(base64, "base64"));
        imagePaths.push(filePath);
        imageUrls.push(`/artifacts/ai_writer_tistory/${filename}`);
      }
    }

    return {
      imageUrls,
      imagePaths,
      revisedPrompt: typeof (data[0] as Record<string, unknown> | undefined)?.revised_prompt === "string"
        ? String((data[0] as Record<string, unknown>).revised_prompt)
        : undefined,
    };
  }

  public static toOllamaShape(text: string): { response: string; done: boolean } {
    return {
      response: text,
      done: true,
    };
  }

  public static extractPrompt(value: unknown): string {
    if (!value || typeof value !== "object") {
      return "";
    }

    const body = value as Record<string, unknown>;
    if (typeof body.prompt === "string") {
      return body.prompt;
    }

    return "";
  }

  public static extractImageRequest(value: unknown): ImageBridgeOptions {
    const body = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    const prompt = typeof body.prompt === "string" ? body.prompt : "";
    const countRaw = typeof body.image_count === "number"
      ? body.image_count
      : Number.parseInt(String(body.image_count ?? "1"), 10);
    const sizeRaw = typeof body.image_size === "string" ? body.image_size : "1024x1024";
    const qualityRaw = typeof body.image_quality === "string" ? body.image_quality : "high";
    const styleRaw = typeof body.image_style === "string" ? body.image_style : "clean modern";
    const runIdRaw = typeof body.run_id === "string" ? body.run_id : undefined;

    const size: ImageBridgeOptions["size"] = (
      sizeRaw === "1024x1024"
      || sizeRaw === "1024x1536"
      || sizeRaw === "1536x1024"
      || sizeRaw === "auto"
    ) ? sizeRaw : "1024x1024";

    const quality: ImageBridgeOptions["quality"] = (
      qualityRaw === "low"
      || qualityRaw === "medium"
      || qualityRaw === "high"
      || qualityRaw === "auto"
    ) ? qualityRaw : "high";

    return {
      prompt,
      count: Number.isFinite(countRaw) ? countRaw : 1,
      size,
      quality,
      style: styleRaw,
      runId: runIdRaw,
    };
  }

  public static toLegacyImageShape(result: ImageBridgeResult): {
    image_paths: string[];
    image_urls: string[];
    revised_prompt?: string;
  } {
    return {
      image_paths: result.imagePaths,
      image_urls: result.imageUrls,
      revised_prompt: result.revisedPrompt,
    };
  }

  public static toDataUrlFromB64(mimeType: string, b64: string): string {
    return toDataUrl(mimeType, b64);
  }
}
