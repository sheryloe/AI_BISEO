# AI_BISEO

AI 비서 응답, Notion 운영 로그, n8n 연동, 블로그 자동화 흐름을 하나의 운영 루프로 묶은 Node.js 서비스 프로젝트입니다.

- 저장소: `https://github.com/sheryloe/AI_BISEO`
- GitHub Pages: `https://sheryloe.github.io/AI_BISEO/`

## 서비스 개요

- 개인용 AI 비서와 블로그 자동화를 같은 콘솔에서 운영합니다.
- 실행 로그, 프롬프트 기록, 연동 상태를 한 저장소 안에서 함께 관리합니다.
- 운영형 대시보드와 자동화 스크립트가 같이 있는 구조를 지향합니다.

## 핵심 기능

- Express 기반 서버와 운영 대시보드
- Prompt log 및 Notion 로그 연동
- n8n/Telegram/OpenAI 연계를 고려한 자동화 스크립트
- Docker Compose와 로컬 실행 흐름 동시 제공

## 기술 스택

- Node.js 20+
- TypeScript
- Express
- Socket.IO
- SQLite
- Docker Compose

## 실행 방법

```bash
npm install
npm run dev
```

컨테이너 기준으로 띄우려면 아래 명령을 사용합니다.

```bash
npm run docker:up
```

## 디렉터리

- `src/`: 서버 엔트리와 핵심 로직
- `scripts/`: 운영 자동화 스크립트
- `dashboard/`, `docs/`: 대시보드와 공개 문서
- `prompt_log/`: 프롬프트 실행 기록

## 다음 단계

- 운영용 권한 분리와 비밀키 관리 강화
- 프롬프트 버전 비교와 실패 재시도 흐름 추가
- AI 비서와 블로그 자동화의 역할 분리
