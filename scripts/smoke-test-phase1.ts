type JsonRecord = Record<string, unknown>;

interface StepResult {
  name: string;
  ok: boolean;
  detail: string;
}

const baseUrl = process.env.SMOKE_BASE_URL?.trim() || "http://localhost:3000";
const timeoutMsRaw = process.env.SMOKE_TIMEOUT_MS?.trim() || "12000";
const timeoutMs = Number.parseInt(timeoutMsRaw, 10);
const requestTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 12000;

const results: StepResult[] = [];

const pushResult = (name: string, ok: boolean, detail: string): void => {
  results.push({ name, ok, detail });
};

const requestJson = async (
  method: "GET" | "POST",
  path: string,
  body?: JsonRecord,
): Promise<{ status: number; data: JsonRecord }> => {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), requestTimeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: abortController.signal,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) as JsonRecord : {};

    return {
      status: response.status,
      data,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const expectAssistantRoute = async (name: string, text: string, expectedRoute: string): Promise<void> => {
  const response = await requestJson("POST", "/api/assistant/route", {
    chatId: "smoke:phase1",
    text,
  });

  const ok = response.status === 200
    && response.data.ok === true
    && typeof response.data.item === "object"
    && response.data.item !== null
    && (response.data.item as JsonRecord).route === expectedRoute;

  const detail = ok
    ? `route=${expectedRoute}`
    : `status=${response.status} body=${JSON.stringify(response.data)}`;

  pushResult(name, ok, detail);
};

const run = async (): Promise<void> => {
  try {
    const health = await requestJson("GET", "/health");
    const healthOk = health.status === 200 && health.data.ok === true;
    pushResult(
      "Health endpoint",
      healthOk,
      healthOk ? "service is healthy" : `status=${health.status} body=${JSON.stringify(health.data)}`,
    );

    await expectAssistantRoute("RAG route", "지난 작업 정리해줘", "rag_search");
    await expectAssistantRoute("Blog route", "티스토리 블로그 글 작성해줘", "call_blog");
    await expectAssistantRoute("Trading stub route", "트레이딩 상태 확인해줘", "call_trading_status");
    await expectAssistantRoute("Ledger stub route", "이번 달 가계부 지출 합계 보여줘", "call_ledger");
    await expectAssistantRoute("Coding history stub route", "코딩 이력 최근 커밋 보여줘", "call_coding_history");

    const history = await requestJson("GET", "/api/assistant/history?chatId=smoke:phase1&limit=12");
    const historyItem = history.data.item as JsonRecord | undefined;
    const historyCount = typeof historyItem?.count === "number" ? historyItem.count : -1;
    const historyOk = history.status === 200 && history.data.ok === true && historyCount >= 2;

    pushResult(
      "Conversation history",
      historyOk,
      historyOk ? `count=${historyCount}` : `status=${history.status} body=${JSON.stringify(history.data)}`,
    );

    const failed = results.filter((item) => !item.ok);

    console.log("== Phase 1 Smoke Test Results ==");
    for (const result of results) {
      console.log(`[${result.ok ? "PASS" : "FAIL"}] ${result.name} -> ${result.detail}`);
    }

    if (failed.length > 0) {
      process.exitCode = 1;
      return;
    }

    console.log("All smoke checks passed.");
  } catch (error) {
    console.error("Smoke test execution failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
};

void run();
