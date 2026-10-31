# Code Mentor UI

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![CopilotKit](https://img.shields.io/badge/CopilotKit-6C47FF)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![Ansible](https://img.shields.io/badge/Ansible-EE0000?logo=ansible&logoColor=white)

Web client for **[AI Code Mentor](https://github.com/Hungmanh286/AI-CODE-MENTOR)**, an AI tutor that learns from your study documents. Upload a PDF, chat with it in real time, and generate quizzes, flashcards, and mind maps.

## Features

- **Real-time chat** over WebSocket with streamed Markdown answers, including math (KaTeX) and GitHub-flavoured Markdown
- **Source panel:** upload documents, poll their processing status, and crop images to ask about a specific region
- **Studio dashboard:** one-click quiz, flashcard, and mind-map generation from the active document
- **Sessions:** create, reopen, and delete study sessions
- **Production deploy:** multi-stage Docker image (Bun build → Nginx) and Ansible playbooks with Vault-encrypted secrets

## Tech stack

React 18 · React Router · Vite · Bun · CopilotKit · react-markdown (remark-gfm, remark-math, rehype-katex) · use-immer · Docker · Nginx · Ansible

## Project structure

```
src/
  components/   Chatbot, ChatMessages, ChatInput, SourcePanel, StudioDashboard…
  pages/        HomePage (session list), SessionPage (chat + sources + studio)
  hooks/        useAutoScroll, useAutosize
  api.js        REST client for the backend
  websocket.js  WebSocket chat client
ansible/        Server provisioning and deployment playbooks
```

## Getting started

Requirements: [Bun](https://bun.sh/) and Node.js 18+.

```bash
bun install
cp .env.sample .env      # VITE_CHAT_URL points to the AI Code Mentor backend
bun run dev              # http://localhost:3001
```

Build and preview:

```bash
bun run build
bun run preview
```

### Docker

```bash
docker compose up --build   # http://localhost:4000
```

## License

Released under the [MIT License](LICENSE).
