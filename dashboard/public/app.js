const byId = (id) => document.getElementById(id);

const healthText = byId("healthText");
const requestCount = byId("requestCount");
const lastRoute = byId("lastRoute");
const lastEvent = byId("lastEvent");
const wsStatus = byId("wsStatus");
const wsChip = byId("wsChip");
const eventLog = byId("eventLog");
const moduleList = byId("moduleList");
const refreshModules = byId("refreshModules");
const clearEvents = byId("clearEvents");
const assistantForm = byId("assistantForm");
const assistantResult = byId("assistantResult");
const assistantHistory = byId("assistantHistory");
const settingsForm = byId("settingsForm");
const settingsResult = byId("settingsResult");
const settingsSubmitBtn = byId("settingsSubmitBtn");
const quickPrompts = byId("quickPrompts");
const refreshDiagnostics = byId("refreshDiagnostics");
const diagnosticResult = byId("diagnosticResult");
const blogTriggerForm = byId("blogTriggerForm");
const blogTopicInput = byId("blogTopicInput");
const blogImageCountInput = byId("blogImageCountInput");
const blogTriggerResult = byId("blogTriggerResult");
const blogRunList = byId("blogRunList");
const blogRunDetail = byId("blogRunDetail");
const refreshBlogRuns = byId("refreshBlogRuns");

const telegramBotTokenInput = byId("telegramBotTokenInput");
const openAiApiKeyInput = byId("openAiApiKeyInput");
const googleAiStudioApiKeyInput = byId("googleAiStudioApiKeyInput");
const notionApiKeyInput = byId("notionApiKeyInput");
const notionParentPageIdInput = byId("notionParentPageIdInput");

const state = {
  requests: 0,
};

if (document?.body) {
  requestAnimationFrame(() => {
    document.body.classList.add("ready");
  });
}

const safeText = (value) => {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  return String(value);
};

const setText = (element, value) => {
  if (!element) {
    return;
  }

  element.textContent = value;
};

const setWsState = (stateText) => {
  setText(wsStatus, stateText);

  if (wsChip) {
    wsChip.dataset.state = stateText;
  }
};

setWsState("connecting");

const toText = (obj) => {
  if (typeof obj === "string") {
    return obj;
  }

  return JSON.stringify(obj, null, 2);
};

const formatEvent = (eventName, payload) => ({
  time: new Date().toLocaleTimeString(),
  name: eventName,
  payload,
});

const appendEvent = (item) => {
  if (!eventLog) {
    return;
  }

  const li = document.createElement("li");
  const signal = safeText(item.payload?.type || item.payload?.event || item.payload?.path || item.payload?.status || "event");
  const message = safeText(item.payload?.message || item.payload?.reason || JSON.stringify(item.payload));

  const timeCell = document.createElement("span");
  timeCell.className = "event-time";
  timeCell.textContent = item.time;

  const nameCell = document.createElement("span");
  nameCell.className = "event-name";
  nameCell.textContent = `${item.name} / ${signal}`;

  const messageCell = document.createElement("span");
  messageCell.className = "event-message";
  messageCell.textContent = message;

  li.appendChild(timeCell);
  li.appendChild(nameCell);
  li.appendChild(messageCell);
  eventLog.prepend(li);

  if (eventLog.children.length > 120) {
    eventLog.removeChild(eventLog.lastElementChild);
  }

  setText(lastEvent, `${item.name} / ${signal}`);
};

const readResponse = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();
  let data;

  if (contentType.includes("application/json")) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = undefined;
    }
  }

  return {
    status: response.status,
    ok: response.ok,
    raw,
    data,
  };
};

const formatErrorText = (result, fallback = "request failed") => {
  if (!result) {
    return fallback;
  }

  const normalizeLabel = (value) => {
    if (!value || typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return value;
    }

    if (trimmed === "Bad Request") {
      return "요청이 올바르지 않습니다";
    }

    if (trimmed === "Client Error") {
      return "요청 처리 중 오류가 발생했습니다";
    }

    return trimmed;
  };

  const payload = result.data;
  if (payload && typeof payload === "object") {
    const topDetail = typeof payload.detail === "string" ? normalizeLabel(payload.detail) : "";
    const apiError = payload.error && typeof payload.error === "object" ? payload.error : null;
    const errorMessage = typeof apiError?.message === "string" ? normalizeLabel(apiError.message) : "";
    const errorDetail = typeof apiError?.detail === "string" ? normalizeLabel(apiError.detail) : "";
    const requestId = safeText(payload.requestId || payload.error?.requestId);
    const path = safeText(payload.path || payload.error?.path);

    const merged = [errorMessage || topDetail, errorDetail, requestId !== "-" ? `requestId=${requestId}` : "", path !== "-" ? `path=${path}` : ""].filter(Boolean).join(" | ");
    if (merged) {
      return `${result.status} ${merged}`;
    }
  }

  if (result.raw) {
    return `${result.status} ${result.raw}`;
  }

  return fallback;
};

const updateRequestCount = () => {
  state.requests += 1;
  setText(requestCount, String(state.requests));
};

const setSettingsWriteEnabled = (enabled) => {
  const controls = [
    telegramBotTokenInput,
    openAiApiKeyInput,
    googleAiStudioApiKeyInput,
    notionApiKeyInput,
    notionParentPageIdInput,
    settingsSubmitBtn,
  ];

  for (const control of controls) {
    if (control) {
      control.disabled = !enabled;
    }
  }

  if (!enabled) {
    setText(settingsResult, "운영 모드에서는 대시보드 저장이 비활성화되어 있습니다. .env를 직접 편집하세요.");
  }
};

const renderHistoryItems = (items) => {
  if (!assistantHistory) {
    return;
  }

  assistantHistory.innerHTML = "";

  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "기록이 없습니다.";
    assistantHistory.appendChild(empty);
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");

    const meta = document.createElement("div");
    meta.className = "chat-meta";
    meta.textContent = `${safeText(item.role)} / ${safeText(item.createdAt)}`;

    const body = document.createElement("div");
    body.textContent = safeText(item.content);

    li.appendChild(meta);
    li.appendChild(body);
    assistantHistory.appendChild(li);
  }
};

const loadAssistantHistory = async (chatId) => {
  if (!chatId) {
    return;
  }

  try {
    const response = await fetch(`/api/assistant/history?chatId=${encodeURIComponent(chatId)}&limit=14`);
    const result = await readResponse(response);

    if (!result.ok) {
      const message = formatErrorText(result, "history load failed");
      appendEvent(formatEvent("http.bad_response", { message, endpoint: "/api/assistant/history" }));
      return;
    }

    const data = result.data;
    renderHistoryItems(data?.item?.items || []);
  } catch (error) {
    appendEvent(formatEvent("http.exception", { message: error.message, endpoint: "/api/assistant/history" }));
  }
};

const refreshHealth = async () => {
  try {
    const response = await fetch("/health");
    const result = await readResponse(response);

    if (!result.ok) {
      const message = formatErrorText(result, "health check failed");
      setText(healthText, message);
      appendEvent(formatEvent("http.bad_response", { message, endpoint: "/health" }));
      return;
    }

    const data = result.data;
    setText(healthText, data?.ok ? `OK (${data.service})` : "unhealthy");
  } catch (error) {
    setText(healthText, `health check failed: ${error.message}`);
    appendEvent(formatEvent("http.exception", { message: error.message, endpoint: "/health" }));
  }
};

const renderModules = async () => {
  if (!moduleList) {
    return;
  }

  try {
    const response = await fetch("/api/modules");
    const result = await readResponse(response);

    if (!result.ok) {
      const message = formatErrorText(result, "module load failed");
      moduleList.textContent = message;
      appendEvent(formatEvent("http.bad_response", { message, endpoint: "/api/modules" }));
      return;
    }

    const data = result.data;
    const items = Array.isArray(data?.items) ? data.items : [];
    moduleList.innerHTML = "";

    if (!items.length) {
      moduleList.textContent = "No module registered.";
      return;
    }

    for (const item of items) {
      const card = document.createElement("article");
      card.className = "module-item";

      const top = document.createElement("div");
      top.className = "module-top";

      const id = document.createElement("span");
      id.className = "module-id";
      id.textContent = safeText(item.moduleId);

      const stage = document.createElement("span");
      stage.className = "module-stage";
      stage.textContent = safeText(item.monitoringStatus?.stage);

      const name = document.createElement("div");
      name.className = "module-name";
      name.textContent = safeText(item.moduleName);

      const message = document.createElement("div");
      message.className = "module-message";
      message.textContent = safeText(item.monitoringStatus?.message);

      top.appendChild(id);
      top.appendChild(stage);
      card.appendChild(top);
      card.appendChild(name);
      card.appendChild(message);
      moduleList.appendChild(card);
    }
  } catch (error) {
    moduleList.textContent = `module load failed: ${error.message}`;
    appendEvent(formatEvent("http.exception", { message: error.message, endpoint: "/api/modules" }));
  }
};

const loadErrorDiagnostics = async () => {
  try {
    const response = await fetch("/api/diagnostics/http-errors");
    const result = await readResponse(response);

    if (!result.ok) {
      const message = formatErrorText(result, "diagnostic load failed");
      setText(diagnosticResult, message);
      appendEvent(formatEvent("http.bad_response", { message, endpoint: "/api/diagnostics/http-errors" }));
      return;
    }

    if (!result.data || !result.data.ok) {
      setText(diagnosticResult, `diagnostic response invalid: ${toText(result.data)}`);
      return;
    }

    const items = result.data.item?.items || [];
    if (!Array.isArray(items) || items.length === 0) {
      setText(diagnosticResult, "최근 에러 기록이 없습니다.");
      return;
    }

    setText(diagnosticResult, toText(items));
  } catch (error) {
    const message = `diagnostic load failed: ${error.message}`;
    setText(diagnosticResult, message);
    appendEvent(formatEvent("http.exception", { message, endpoint: "/api/diagnostics/http-errors" }));
  }
};

const renderBlogRuns = (items) => {
  if (!blogRunList) {
    return;
  }

  blogRunList.innerHTML = "";
  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "실행 이력이 없습니다.";
    blogRunList.appendChild(empty);
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "blog-run-item";
    button.dataset.runId = safeText(item.runId);

    const runId = document.createElement("span");
    runId.className = "run-id";
    runId.textContent = safeText(item.runId);

    const main = document.createElement("span");
    main.className = "run-main";
    main.textContent = `${safeText(item.latestStatus)} / ${safeText(item.latestAgentName)} / events=${safeText(item.eventCount)}`;

    button.appendChild(runId);
    button.appendChild(main);
    li.appendChild(button);
    blogRunList.appendChild(li);
  }
};

const loadBlogRunDetail = async (runId) => {
  if (!runId || !blogRunDetail) {
    return;
  }

  setText(blogRunDetail, "loading...");

  try {
    const response = await fetch(`/api/modules/AI_Writer_TISTORY/pipelines/runs/${encodeURIComponent(runId)}`);
    const result = await readResponse(response);

    if (!result.ok) {
      setText(blogRunDetail, formatErrorText(result, "run detail load failed"));
      return;
    }

    setText(blogRunDetail, toText(result.data?.item || {}));
  } catch (error) {
    setText(blogRunDetail, `run detail load failed: ${error.message}`);
  }
};

const loadBlogRuns = async () => {
  try {
    const response = await fetch("/api/modules/AI_Writer_TISTORY/pipelines/runs?limit=12");
    const result = await readResponse(response);

    if (!result.ok) {
      setText(blogTriggerResult, formatErrorText(result, "run list load failed"));
      return;
    }

    const items = result.data?.items || [];
    renderBlogRuns(items);
  } catch (error) {
    setText(blogTriggerResult, `run list load failed: ${error.message}`);
  }
};

if (typeof io === "function") {
  const socket = io("/monitoring", { path: "/socket.io/" });

  socket.on("connect", () => {
    setWsState("connected");
    appendEvent(formatEvent("socket.connected", { message: "socket.io connected" }));
  });

  socket.on("disconnect", () => {
    setWsState("disconnected");
    appendEvent(formatEvent("socket.disconnected", { message: "socket.io disconnected" }));
  });

  socket.on("monitoring:hello", (payload) => appendEvent(formatEvent("monitoring:hello", payload)));
  socket.on("http:request", (payload) => appendEvent(formatEvent("http:request", payload)));
  socket.on("http:error", (payload) => appendEvent(formatEvent("http:error", payload)));

  socket.on("telegram:message", (payload) => {
    appendEvent(formatEvent("telegram:message", payload));
    updateRequestCount();
  });

  socket.on("router:decision", (payload) => {
    appendEvent(formatEvent("router:decision", payload));
    setText(lastRoute, `${safeText(payload.routeLabel)} / ${safeText(payload.route)}`);
    updateRequestCount();
  });

  socket.on("n8n:blog_status", (payload) => {
    appendEvent(formatEvent("n8n:blog_status", payload));
    void loadBlogRuns();
    if (payload?.event?.runId) {
      void loadBlogRunDetail(payload.event.runId);
    }
    updateRequestCount();
  });

  socket.on("n8n:blog_trigger", (payload) => {
    appendEvent(formatEvent("n8n:blog_trigger", payload));
    void loadBlogRuns();
    if (payload?.runId) {
      void loadBlogRunDetail(payload.runId);
    }
    updateRequestCount();
  });
} else {
  setWsState("unavailable");
}

if (assistantForm) {
  assistantForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const chatId = byId("chatId")?.value?.trim() || "web:test-user";
    const text = byId("assistantText")?.value?.trim() || "";

    if (!text) {
      setText(assistantResult, "메시지를 입력해 주세요.");
      return;
    }

    setText(assistantResult, "processing...");

    try {
      const response = await fetch("/api/assistant/route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chatId, text }),
      });

      const result = await readResponse(response);
      const data = result.data;

      if (!result.ok) {
        const message = formatErrorText(result, "assistant request failed");
        setText(assistantResult, message);
        appendEvent(formatEvent("http.bad_response", { message, endpoint: "/api/assistant/route" }));
        return;
      }

      if (data?.ok && data.item) {
        const item = data.item;
        const output = [
          `[${safeText(item.routeLabel)} / ${safeText(item.route)}]`,
          `reason: ${safeText(item.reason)}`,
          `ragCount: ${safeText(item.ragCount)}`,
          "",
          safeText(item.replyText),
        ].join("\n");

        setText(assistantResult, output);
        setText(lastRoute, `${safeText(item.routeLabel)} / ${safeText(item.route)}`);
        await loadAssistantHistory(chatId);
      } else {
        setText(assistantResult, toText(data));
      }
    } catch (error) {
      const message = `request failed: ${error.message}`;
      setText(assistantResult, message);
      appendEvent(formatEvent("http.exception", { message, endpoint: "/api/assistant/route" }));
    }

    updateRequestCount();
  });
}

if (quickPrompts) {
  quickPrompts.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const prompt = target.dataset.prompt;
    if (!prompt) {
      return;
    }

    const textarea = byId("assistantText");
    if (textarea) {
      textarea.value = prompt;
      textarea.focus();
    }
  });
}

if (refreshModules) {
  refreshModules.addEventListener("click", () => {
    void renderModules();
  });
}

if (clearEvents) {
  clearEvents.addEventListener("click", () => {
    if (eventLog) {
      eventLog.innerHTML = "";
    }

    setText(lastEvent, "-");
  });
}

if (refreshDiagnostics) {
  refreshDiagnostics.addEventListener("click", () => {
    void loadErrorDiagnostics();
  });
}

if (blogRunList) {
  blogRunList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest(".blog-run-item");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const runId = button.dataset.runId;
    if (!runId) {
      return;
    }

    void loadBlogRunDetail(runId);
  });
}

if (refreshBlogRuns) {
  refreshBlogRuns.addEventListener("click", () => {
    void loadBlogRuns();
  });
}

if (blogTriggerForm) {
  blogTriggerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const topic = blogTopicInput?.value?.trim() || "";
    const imageCountRaw = blogImageCountInput?.value?.trim() || "1";
    const imageCount = Number.parseInt(imageCountRaw, 10);

    if (!topic) {
      setText(blogTriggerResult, "topic을 입력해 주세요.");
      return;
    }

    setText(blogTriggerResult, "triggering...");

    try {
      const body = {
        topic,
        chatId: byId("chatId")?.value?.trim() || "web:dashboard",
        imageCount: Number.isFinite(imageCount) ? imageCount : 1,
      };

      const response = await fetch("/api/modules/AI_Writer_TISTORY/pipelines/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await readResponse(response);

      if (!result.ok) {
        setText(blogTriggerResult, formatErrorText(result, "blog trigger failed"));
        appendEvent(formatEvent("http.bad_response", { message: formatErrorText(result, "blog trigger failed"), endpoint: "/api/modules/AI_Writer_TISTORY/pipelines/trigger" }));
        return;
      }

      const item = result.data?.item || {};
      setText(blogTriggerResult, safeText(item.message || "triggered"));
      await loadBlogRuns();
      if (item.runId) {
        await loadBlogRunDetail(item.runId);
      }
      updateRequestCount();
    } catch (error) {
      setText(blogTriggerResult, `blog trigger failed: ${error.message}`);
      appendEvent(formatEvent("http.exception", { message: error.message, endpoint: "/api/modules/AI_Writer_TISTORY/pipelines/trigger" }));
    }
  });
}

const loadSettings = async () => {
  try {
    const response = await fetch("/api/settings/env");
    const result = await readResponse(response);

    if (!result.ok) {
      const message = formatErrorText(result, "settings load failed");
      setText(settingsResult, `settings load failed: ${message}`);
      appendEvent(formatEvent("http.bad_response", { message, endpoint: "/api/settings/env" }));
      return;
    }

    const data = result.data;

    if (data?.ok && data.item) {
      const allowWrite = data.item.settingsWriteEnabled !== false;
      setSettingsWriteEnabled(allowWrite);

      if (telegramBotTokenInput) {
        telegramBotTokenInput.placeholder = data.item.telegramBotToken || "TELEGRAM_BOT_TOKEN";
      }

      if (openAiApiKeyInput) {
        openAiApiKeyInput.placeholder = data.item.openAiApiKey || "OPENAI_API_KEY";
      }

      if (googleAiStudioApiKeyInput) {
        googleAiStudioApiKeyInput.placeholder = data.item.googleAiStudioApiKey || "GOOGLE_AI_STUDIO_API_KEY";
      }

      if (notionApiKeyInput) {
        notionApiKeyInput.placeholder = data.item.notionApiKey || "NOTION_API_KEY";
      }

      if (notionParentPageIdInput) {
        notionParentPageIdInput.placeholder = data.item.notionParentPageId || "NOTION_PARENT_PAGE_ID";
      }
    }
  } catch (error) {
    const message = `settings load failed: ${error.message}`;
    setText(settingsResult, message);
    appendEvent(formatEvent("http.exception", { message, endpoint: "/api/settings/env" }));
  }
};

if (settingsForm) {
  settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const telegramBotToken = telegramBotTokenInput?.value?.trim() || "";
    const openAiApiKey = openAiApiKeyInput?.value?.trim() || "";
    const googleAiStudioApiKey = googleAiStudioApiKeyInput?.value?.trim() || "";
    const notionApiKey = notionApiKeyInput?.value?.trim() || "";
    const notionParentPageId = notionParentPageIdInput?.value?.trim() || "";

    const payload = {};

    if (telegramBotToken) {
      payload.telegramBotToken = telegramBotToken;
    }

    if (openAiApiKey) {
      payload.openAiApiKey = openAiApiKey;
    }

    if (googleAiStudioApiKey) {
      payload.googleAiStudioApiKey = googleAiStudioApiKey;
    }

    if (notionApiKey) {
      payload.notionApiKey = notionApiKey;
    }

    if (notionParentPageId) {
      payload.notionParentPageId = notionParentPageId;
    }

    if (Object.keys(payload).length === 0) {
      setText(settingsResult, "저장할 값이 없습니다.");
      return;
    }

    setText(settingsResult, "saving...");

    try {
      const response = await fetch("/api/settings/env", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await readResponse(response);
      const data = result.data;

      if (result.ok && data?.ok) {
        setText(settingsResult, data.message || "saved");

        if (telegramBotTokenInput && telegramBotToken) {
          telegramBotTokenInput.value = "";
        }

        if (openAiApiKeyInput && openAiApiKey) {
          openAiApiKeyInput.value = "";
        }

        if (googleAiStudioApiKeyInput && googleAiStudioApiKey) {
          googleAiStudioApiKeyInput.value = "";
        }

        if (notionApiKeyInput && notionApiKey) {
          notionApiKeyInput.value = "";
        }

        if (notionParentPageIdInput && notionParentPageId) {
          notionParentPageIdInput.value = "";
        }

        await loadSettings();
      } else {
        const reason = data?.error?.message || data?.message || formatErrorText(result, "save failed");
        setText(settingsResult, `save failed: ${safeText(reason)}`);
        appendEvent(formatEvent("http.bad_response", { message: `settings save failed: ${reason}`, endpoint: "/api/settings/env" }));
      }
    } catch (error) {
      const message = `save failed: ${error.message}`;
      setText(settingsResult, message);
      appendEvent(formatEvent("http.exception", { message, endpoint: "/api/settings/env" }));
    }
  });
}

setInterval(() => {
  void refreshHealth();
  void renderModules();
}, 15000);

const initialChatId = byId("chatId")?.value || "web:test-user";
void refreshHealth();
void renderModules();
void loadSettings();
void loadAssistantHistory(initialChatId);
void loadErrorDiagnostics();
void loadBlogRuns();
