# AI_BISEO

AI 비서 응답, n8n 연동, Notion 로그, 블로그 자동화 흐름을 한 서비스로 묶은 운영형 프로젝트입니다.

- Repository: https://github.com/sheryloe/AI_BISEO
- Live page: https://sheryloe.github.io/AI_BISEO/
- Audience: 개인 AI 비서, 블로그 자동화, Notion 기반 운영 로그, Node.js 백엔드 대시보드를 함께 굴리고 싶은 사용자

## Overview
AI 비서와 블로그 자동화를 함께 운영하는 Node.js 대시보드

## Why This Exists
개인용 AI 비서와 블로그 운영 자동화를 따로 관리하면 프롬프트, 실행 이력, 상태 확인, API 키 관리가 분산됩니다.

## What You Can Do
- Express 기반 메인 서버와 Socket.IO 중심 운영 흐름
- OpenAI, Notion, Telegram, n8n 연계를 고려한 자동화 스크립트 포함
- SQLite 저장소와 `storage/`, `prompt_log/` 기반 이력 관리
- Docker Compose와 로컬 개발 스크립트 둘 다 제공

## Typical Flow
- API 키와 환경 변수 설정
- 로컬 개발 또는 Docker Compose로 서버 기동
- 대시보드에서 AI 비서 상태와 블로그 자동화 흐름 점검

## Tech Stack
- Node.js 20+
- TypeScript
- Express
- Socket.IO
- SQLite
- Docker Compose

## Quick Start
- `.env.example`을 기준으로 환경 변수를 준비합니다.
- `npm install` 후 `npm run dev`로 로컬 개발 서버를 실행합니다.
- 또는 `npm run docker:up`으로 컨테이너 기반 실행을 시작합니다.

## Repository Structure
- `src/`: 서버 엔트리와 핵심 로직
- `scripts/`: 운영 자동화 및 연동 스크립트
- `dashboard/`, `docs/`: 운영 화면과 문서

## Search Keywords
`AI assistant dashboard`, `blog automation nodejs`, `notion automation server`, `AI 비서 대시보드`, `블로그 자동화 프로젝트`

## FAQ
### AI_BISEO는 어떤 프로젝트인가요?
AI 비서 기능과 블로그 자동화를 같은 운영 대시보드에서 처리하기 위한 Node.js 서비스입니다.

### 어떤 자동화를 포함하나요?
n8n 패치 스크립트, Notion 푸시, 운영 상태 체크와 같은 업무 자동화가 포함됩니다.

### Docker 없이도 실행할 수 있나요?
가능합니다. `npm install` 후 `npm run dev`로 로컬 개발 모드 실행이 가능합니다.

