const healthText = document.getElementById("healthText");
const requestCount = document.getElementById("requestCount");
const lastRoute = document.getElementById("lastRoute");
const lastEvent = document.getElementById("lastEvent");
const wsStatus = document.getElementById("wsStatus");
const eventLog = document.getElementById("eventLog");
const moduleList = document.getElementById("moduleList");
const refreshModules = document.getElementById("refreshModules");
const clearEvents = document.getElementById("clearEvents");
const assistantForm = document.getElementById("assistantForm");
const assistantResult = document.getElementById("assistantResult");

const state = {
  requests: 0,
};

const safeText = (value) => {
  if (value === undefined || value === null) return "-";
  return String(value);
};

const formatEvent = (eventName, payload) => {
  return {
    time: new Date().toLocaleTimeString(),
    name: eventName,
    payload,
  };
};

const appendEvent = (item) => {
  const li = document.createElement("li");
  li.textContent = `[${item.time}] ${item.name} - ${safeText(item.payload?.type || "event")} | ${safeText(item.payload?.message || JSON.stringify(item.payload))}`;
  eventLog.prepend(li);
  if (eventLog.children.length > 120) {
    eventLog.removeChild(eventLog.lastElementChild);
  }
};

const toText = (obj) => {
  if (typeof obj === "string") return obj;
  return JSON.stringify(obj, null, 2);
};

const refreshHealth = async () => {
  try {
    const response = await fetch("/health");
    const data = await response.json();
    healthText.textContent = data.ok ? `OK (${data.service})` : "비정상";
  } catch (error) {
    healthText.textContent = `헬스체크 실패: ${error.message}`;
  }
};

const renderModules = async () => {
  try {
    const response = await fetch("/api/modules");
    const data = await response.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    moduleList.innerHTML = "";

    if (!items.length) {
      moduleList.textContent = "등록된 모듈이 없습니다.";
      return;
    }

    for (const item of items) {
      const card = document.createElement("article");
      card.className = "module-item";
      card.textContent = `${item.moduleId} / ${item.moduleName} - ${safeText(item.monitoringStatus?.stage)} / ${safeText(item.monitoringStatus?.message)}`;
      moduleList.appendChild(card);
    }
  } catch (error) {
    moduleList.textContent = `모듈 조회 실패: ${error.message}`;
  }
};

const renderEvent = (eventName, payload) => {
  const node = formatEvent(eventName, payload);
  appendEvent(node);
  lastEvent.textContent = `${eventName} | ${safeText(payload?.type || payload?.status || payload?.route || "")}`;
};

const socket = io("/monitoring", {
  path: "/socket.io/",
});

socket.on("connect", () => {
  wsStatus.textContent = "연결됨";
  appendEvent(formatEvent("socket.connected", { message: "socket.io 연결" }));
});

socket.on("disconnect", () => {
  wsStatus.textContent = "연결 끊김";
  appendEvent(formatEvent("socket.disconnected", { message: "socket.io 연결 해제" }));
});

socket.on("monitoring:hello", (payload) => {
  appendEvent(formatEvent("monitoring:hello", payload));
});

socket.on("telegram:message", (payload) => {
  renderEvent("telegram:message", payload);
  state.requests += 1;
  requestCount.textContent = String(state.requests);
});

socket.on("router:decision", (payload) => {
  renderEvent("router:decision", payload);
  lastRoute.textContent = `${payload.routeLabel} / ${payload.route}`;
  state.requests += 1;
  requestCount.textContent = String(state.requests);
});

socket.on("n8n:blog_status", (payload) => {
  renderEvent("n8n:blog_status", payload);
  state.requests += 1;
  requestCount.textContent = String(state.requests);
});

assistantForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const chatId = document.getElementById("chatId").value || "web:test-user";
  const text = document.getElementById("assistantText").value || "";
  assistantResult.textContent = "요청 중...";

  try {
    const response = await fetch("/api/assistant/route", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chatId, text }),
    });

    const data = await response.json();
    if (data?.ok && data.item) {
      assistantResult.textContent = toText(data.item);
      lastRoute.textContent = `${safeText(data.item.routeLabel)} / ${safeText(data.item.route)}`;
    } else {
      assistantResult.textContent = toText(data);
    }
  } catch (error) {
    assistantResult.textContent = `요청 실패: ${error.message}`;
  }

  state.requests += 1;
  requestCount.textContent = String(state.requests);
});

refreshModules.addEventListener("click", () => {
  renderModules();
});

clearEvents.addEventListener("click", () => {
  eventLog.innerHTML = "";
  lastEvent.textContent = "-";
});

setInterval(() => {
  refreshHealth();
  renderModules();
}, 15000);

refreshHealth();
renderModules();
