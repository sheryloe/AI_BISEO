# Phase 1 Docker Quickstart

## 1) Prepare `.env`

PowerShell:

```powershell
if (!(Test-Path .env)) {
  Copy-Item .env.example .env
}
```

Default `.env.example` is now safe for Phase 1:

- `ASSISTANT_ENABLE_LLM=false`
- `ASSISTANT_LLM_PROVIDER=none`
- Telegram/OpenAI/Notion secrets are blank by default

## 2) Bring up server in Docker

```bash
npm run docker:up
```

The API should be available at `http://localhost:3000`.

## 3) Run first smoke test

```bash
npm run test:smoke:phase1
```

Expected output ends with:

```text
All smoke checks passed.
```

## 4) Manual quick checks (optional)

```powershell
Invoke-RestMethod http://localhost:3000/health
```

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri http://localhost:3000/api/assistant/route `
  -ContentType "application/json" `
  -Body '{"chatId":"manual:test","text":"티스토리 글 작성해줘"}'
```

## 5) Stop Docker

```bash
npm run docker:down
```
