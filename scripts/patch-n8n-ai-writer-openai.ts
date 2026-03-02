import { execSync } from "child_process";
import { writeFileSync } from "fs";
import path from "path";

interface N8nNode {
  name?: string;
  parameters?: Record<string, unknown>;
}

interface N8nWorkflow {
  id?: string;
  name?: string;
  nodes?: N8nNode[];
}

const run = (command: string): string => {
  return execSync(command, {
    stdio: ["pipe", "pipe", "pipe"],
    encoding: "utf8",
  }).trim();
};

const pickWorkflowId = (containerName: string): string => {
  const requestedId = process.env.N8N_WORKFLOW_ID?.trim();
  if (requestedId) {
    return requestedId;
  }

  const output = run(`docker exec ${containerName} n8n list:workflow`);
  const line = output
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.includes("AI Mother - Tistory Prompt Pack"));

  if (!line) {
    throw new Error("AI Mother - Tistory Prompt Pack 워크플로우를 찾지 못했습니다.");
  }

  const [workflowId] = line.split("|");
  if (!workflowId) {
    throw new Error("워크플로우 ID 파싱에 실패했습니다.");
  }

  return workflowId.trim();
};

const setBridgeUrl = (node: N8nNode, url: string): void => {
  if (!node.parameters) {
    node.parameters = {};
  }
  node.parameters.url = url;
};

const setHeaderSecret = (node: N8nNode, headerName: string, secret: string): void => {
  if (!secret) {
    return;
  }

  if (!node.parameters) {
    node.parameters = {};
  }

  node.parameters.sendHeaders = true;
  node.parameters.headerParameters = {
    parameters: [
      {
        name: headerName,
        value: secret,
      },
    ],
  };
};

const main = (): void => {
  const containerName = process.env.N8N_CONTAINER_NAME?.trim() || "ai_mother_n8n";
  const bridgeBaseUrl = process.env.AI_BISEO_BRIDGE_BASE_URL?.trim() || "http://host.docker.internal:3010";
  const headerName = process.env.N8N_CALLBACK_SECRET_HEADER?.trim() || "X-N8N-SECRET";
  const secret = process.env.N8N_BLOG_CALLBACK_SECRET?.trim() || "";

  const workflowId = pickWorkflowId(containerName);
  const tempInContainer = `/tmp/ai_writer_${workflowId}_patch_src.json`;
  run(`docker exec ${containerName} n8n export:workflow --id=${workflowId} --output=${tempInContainer}`);

  const raw = run(`docker exec ${containerName} cat ${tempInContainer}`);
  const parsed = JSON.parse(raw) as N8nWorkflow[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("워크플로우 JSON 파싱에 실패했습니다.");
  }

  const workflow = parsed[0];
  const nodes = workflow.nodes ?? [];

  const llmBridgeUrl = `${bridgeBaseUrl}/api/modules/AI_Writer_TISTORY/pipelines/llm/generate`;
  const imageBridgeUrl = `${bridgeBaseUrl}/api/modules/AI_Writer_TISTORY/pipelines/image/generate`;

  for (const node of nodes) {
    if (!node.name) {
      continue;
    }

    if (node.name === "Agent_Editor" || node.name === "Agent_Artist" || node.name === "Agent_Director") {
      setBridgeUrl(node, llmBridgeUrl);
      setHeaderSecret(node, headerName, secret);
      continue;
    }

    if (node.name === "Image_Generate") {
      setBridgeUrl(node, imageBridgeUrl);
      setHeaderSecret(node, headerName, secret);

      const body = typeof node.parameters?.body === "string" ? node.parameters.body : "";
      if (body && !body.includes("run_id")) {
        node.parameters = node.parameters ?? {};
        node.parameters.body = body.replace(
          "})\n}}",
          ",\n  \"run_id\": ($node[\"Webhook\"].json.body.runId || \"\")\n})\n}}",
        );
      }
    }
  }

  const localPatchFile = path.resolve(process.cwd(), "storage", "artifacts", `n8n_ai_writer_patch_${workflowId}.json`);
  writeFileSync(localPatchFile, JSON.stringify(parsed, null, 2), "utf8");

  run(`docker cp "${localPatchFile}" ${containerName}:/tmp/ai_writer_patch.json`);
  run(`docker exec ${containerName} n8n import:workflow --input=/tmp/ai_writer_patch.json`);
  run(`docker exec ${containerName} n8n update:workflow --id=${workflowId} --active=true`);

  console.log(`Patched workflow ${workflowId}`);
  console.log(`LLM bridge: ${llmBridgeUrl}`);
  console.log(`Image bridge: ${imageBridgeUrl}`);
};

main();
