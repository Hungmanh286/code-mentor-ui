"""FastAPI wiring for the Mentor AG-UI agent (reference).

Run standalone (dev, in-memory checkpointer)::

    cd backend-reference && uvicorn agent.server:app --port 8686

Routes (docs/agui/PLAN.md 4.3):
    POST /agent                      AG-UI run (text/event-stream), via ag-ui-langgraph
    GET  /agent/health               added by add_langgraph_fastapi_endpoint
    GET  /health                     {"ok": true}   (AGENT_BASE/health in the contract)
    GET  /threads/{id}/messages      {"messages": AgUiMessage[]}

Checkpointer: Postgres when MENTOR_CHECKPOINT_DB_URL is set
(``postgresql://user:pass@host:5432/db``), otherwise InMemorySaver (dev only:
history is lost on restart). thread_id = session uuid (= frontend threadId).

``MentorLangGraphAgent`` adapts ag-ui-langgraph 0.0.47 to the contract. Each
override is listed in README ("Cần xác minh khi port") and exercised by
selfcheck.py; re-run it after upgrading ag-ui-langgraph.
"""

from __future__ import annotations

import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Dict, List, Mapping, Optional

from ag_ui.core import EventType, Interrupt, ResumeEntry, RunAgentInput, RunErrorEvent
from ag_ui_langgraph import LangGraphAgent, add_langgraph_fastapi_endpoint
from ag_ui_langgraph.interrupts import lg_interrupt_to_agui

# VERIFY: not in ag_ui_langgraph.__all__; it is the converter LangGraphAgent itself
# uses for RunAgentInput.messages, so reusing it keeps ids/content identical.
from ag_ui_langgraph.utils import agui_messages_to_langchain
from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from .graph import build_graph
from .history import get_thread_messages
from .state import shared_state

logger = logging.getLogger(__name__)

PUBLIC_ERROR_MESSAGE = "Trợ lý gặp lỗi khi xử lý yêu cầu. Bạn thử lại nhé."
KNOWN_REQUESTED_TOOLS = {"generate-questions", "mindmap"}
CORS_ALLOW_HEADERS = "content-type, authorization, accept"


# ---------------------------------------------------------------------------
# Context (contract 4.4): Context.value is always a JSON string
# ---------------------------------------------------------------------------


def _context_items(context: Optional[List[Any]]) -> Dict[str, str]:
    items: Dict[str, str] = {}
    for entry in context or []:
        description = entry.get("description") if isinstance(entry, Mapping) else getattr(entry, "description", None)
        value = entry.get("value") if isinstance(entry, Mapping) else getattr(entry, "value", None)
        if isinstance(description, str) and isinstance(value, str):
            items[description] = value
    return items


def _json_or(raw: Optional[str], default: Any) -> Any:
    if raw is None:
        return default
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        logger.warning("context value is not JSON: %r", raw[:200])
        return default


def parse_run_context(context: Optional[List[Any]]) -> Dict[str, Any]:
    """Context[] -> state keys. Always returns all three keys so a run without
    chips resets ``requested_tools`` left over from the previous run."""
    items = _context_items(context)
    tools = _json_or(items.get("requested_tools"), [])
    docs = _json_or(items.get("active_document_ids"), [])
    user = _json_or(items.get("user"), {})
    return {
        "requested_tools": [t for t in tools if t in KNOWN_REQUESTED_TOOLS] if isinstance(tools, list) else [],
        "active_document_ids": [str(d) for d in docs] if isinstance(docs, list) else [],
        "user": user if isinstance(user, dict) else {},
    }


# ---------------------------------------------------------------------------
# Agent adapter
# ---------------------------------------------------------------------------


class MentorLangGraphAgent(LangGraphAgent):
    """LangGraphAgent + the contract adaptations (no new constructor args, so
    ``LangGraphAgent.clone()`` — called once per request — keeps working)."""

    _steer_update: Optional[Dict[str, Any]] = None

    # (1) Contract 4.6: interrupt.metadata = {"kind": ..., "defaults": ..., ...}.
    # The default mapper nests the raw value under metadata["langgraph"].
    def _interrupts_to_agui(self, lg_interrupts) -> List[Interrupt]:
        out: List[Interrupt] = []
        for lg in lg_interrupts:
            mapped = lg_interrupt_to_agui(lg)
            raw = getattr(lg, "value", None)
            if isinstance(raw, Mapping) and isinstance(raw.get("metadata"), Mapping):
                mapped = mapped.model_copy(update={"metadata": dict(raw["metadata"])})
            out.append(mapped)
        return out

    # (2) Contract 4.7: STATE_SNAPSHOT carries exactly {artifacts, jobs}.
    # The default keeps every output-schema key, including `messages`.
    def get_state_snapshot(self, state: Mapping[str, Any]) -> Dict[str, Any]:
        return shared_state(state or {})

    # (3) Contract 4.4: copy RunAgentInput.context into graph state keys.
    # By default context only lands in state["ag-ui"]["context"], which our
    # input schema (MentorInput) does not accept.
    # Also a safety net against duplicated tool results: a client-side id for a
    # tool message (or tool-call message) already stored under another id
    # would otherwise be appended again. Only genuinely new ids are filtered;
    # the library's own "repair" copies reuse stored ids and pass through.
    def langgraph_default_merge_state(self, state, messages, input: RunAgentInput):
        merged = super().langgraph_default_merge_state(state, messages, input)
        merged.update(parse_run_context(input.context))
        merged.pop("artifacts", None)  # the server owns shared state
        merged.pop("jobs", None)

        stored = list(state.get("messages") or [])
        stored_ids = {getattr(m, "id", None) for m in stored}
        stored_results = {m.tool_call_id for m in stored if isinstance(m, ToolMessage)}
        stored_calls = {c.get("id") for m in stored if isinstance(m, AIMessage) for c in (m.tool_calls or [])}

        def already_stored(m) -> bool:
            if getattr(m, "id", None) in stored_ids:
                return False
            if isinstance(m, ToolMessage):
                return m.tool_call_id in stored_results
            if isinstance(m, AIMessage) and m.tool_calls:
                return all(c.get("id") in stored_calls for c in m.tool_calls)
            return False

        merged["messages"] = [m for m in merged.get("messages") or [] if not already_stored(m)]
        return merged

    # (4) New user message while an interrupt is open.
    #  a) useAgUiSteerAway sends resume=[cancelled] + the new message. The
    #     default resume path builds Command(resume=...) only, silently
    #     dropping the message; we add it via Command(update=...).
    #  b) No resume at all (e.g. after a page reload the form is gone): the
    #     default re-emits the old interrupt without running the graph and
    #     without an assistant text message (breaks contract 4.6). We cancel
    #     the open interrupt and answer the new message instead.
    #  c) resolved + a new message (standard clients do not send this): the
    #     message is stored but the resolved branch wins (contract 4.6).
    # "New" = id not present in the thread's checkpoint (contract 4.6).
    async def prepare_stream(self, input: RunAgentInput, agent_state, config):
        self._steer_update = None
        open_interrupts = [
            itr for task in (getattr(agent_state, "tasks", None) or ()) for itr in (getattr(task, "interrupts", None) or ())
        ]
        if open_interrupts:
            checkpoint_ids = {getattr(m, "id", None) for m in (agent_state.values or {}).get("messages", [])}
            new_user_messages = [
                m for m in agui_messages_to_langchain(list(input.messages or []))
                if isinstance(m, HumanMessage) and m.id not in checkpoint_ids
            ]
            if new_user_messages:
                if not input.resume:
                    input = input.model_copy(update={
                        "resume": [ResumeEntry(interrupt_id=itr.id, status="cancelled") for itr in open_interrupts]
                    })
                self._steer_update = {"messages": new_user_messages, **parse_run_context(input.context)}
        return await super().prepare_stream(input=input, agent_state=agent_state, config=config)

    def _build_command_from_agui_resume(self, entries, *, open_interrupts=None) -> Command:
        command = super()._build_command_from_agui_resume(entries, open_interrupts=open_interrupts)
        if self._steer_update:
            return Command(resume=command.resume, update=self._steer_update)
        return command

    # (5) RUN_ERROR {message, code}: never leak exception text to the browser.
    async def run(self, input: RunAgentInput):
        async for event in super().run(input):
            if getattr(event, "type", None) == EventType.RUN_ERROR:
                logger.error("agent run failed thread=%s run=%s: %s", input.thread_id, input.run_id,
                             getattr(event, "message", ""))
                event = RunErrorEvent(
                    type=EventType.RUN_ERROR,
                    message=PUBLIC_ERROR_MESSAGE,
                    code=getattr(event, "code", None) or "AGENT_ERROR",
                )
            yield event


def make_agent(graph) -> MentorLangGraphAgent:
    return MentorLangGraphAgent(
        name="mentor",
        graph=graph,
        description="Mentor Code: trợ lý học lập trình",
        emit_interrupt_outcome=True,  # RUN_FINISHED.outcome = {type:"interrupt", interrupts:[...]}
        enable_legacy_on_interrupt_event=False,  # no extra CUSTOM "on_interrupt" event
        emit_raw_events=False,  # no RAW events / raw_event copies (payload size)
    )


# ---------------------------------------------------------------------------
# Checkpointer
# ---------------------------------------------------------------------------


@asynccontextmanager
async def checkpointer_from_env() -> AsyncIterator[Any]:
    url = os.getenv("MENTOR_CHECKPOINT_DB_URL")
    if not url:
        logger.warning("MENTOR_CHECKPOINT_DB_URL not set: using InMemorySaver (dev only)")
        yield InMemorySaver()
        return
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    from psycopg.rows import dict_row
    from psycopg_pool import AsyncConnectionPool

    # Same connection settings AsyncPostgresSaver.from_conn_string uses, but
    # pooled for concurrent requests. AsyncPostgresSaver() must be created
    # inside the running event loop, hence the lifespan.
    async with AsyncConnectionPool(
        conninfo=url,
        max_size=int(os.getenv("MENTOR_CHECKPOINT_POOL_SIZE", "10")),
        open=False,
        kwargs={"autocommit": True, "prepare_threshold": 0, "row_factory": dict_row},
    ) as pool:
        saver = AsyncPostgresSaver(pool)
        await saver.setup()  # idempotent: creates/migrates checkpoint tables
        yield saver


# ---------------------------------------------------------------------------
# CORS: preflight must answer 204 (contract 4.3); Starlette's CORSMiddleware
# answers 200, so a tiny ASGI layer answers preflights before it.
# ---------------------------------------------------------------------------


class Preflight204:
    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope.get("type") == "http" and scope.get("method") == "OPTIONS":
            headers = {k.lower(): v for k, v in scope.get("headers") or []}
            if b"access-control-request-method" in headers:
                await send({
                    "type": "http.response.start",
                    "status": 204,
                    "headers": [
                        (b"access-control-allow-origin", b"*"),
                        (b"access-control-allow-methods", b"GET, POST, OPTIONS"),
                        (b"access-control-allow-headers", CORS_ALLOW_HEADERS.encode()),
                        (b"access-control-max-age", b"600"),
                    ],
                })
                await send({"type": "http.response.body", "body": b""})
                return
        await self.app(scope, receive, send)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with checkpointer_from_env() as checkpointer:
        graph = build_graph(checkpointer=checkpointer)
        app.state.graph = graph
        # Registered here because the Postgres checkpointer only exists once the
        # event loop runs. Signature verified on 0.0.47:
        # add_langgraph_fastapi_endpoint(app, agent: LangGraphAgent, path="/", **kwargs)
        add_langgraph_fastapi_endpoint(app=app, agent=make_agent(graph), path="/agent")
        yield


def create_app() -> FastAPI:
    app = FastAPI(title="Mentor AG-UI agent (reference)", lifespan=lifespan)
    # Order matters: the last added middleware is the outermost one.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=[h.strip() for h in CORS_ALLOW_HEADERS.split(",")],
    )
    app.add_middleware(Preflight204)

    # Contract (6.D/6.E): a malformed /agent body gets 400 before any stream is
    # opened. FastAPI answers 422 by default; keep that for every other route.
    @app.exception_handler(RequestValidationError)
    async def agent_body_400(request: Request, exc: RequestValidationError):
        if request.url.path == "/agent":
            return JSONResponse(status_code=400, content={"error": "invalid RunAgentInput", "detail": jsonable_encoder(exc.errors()[:5])})
        return await request_validation_exception_handler(request, exc)

    @app.get("/health")
    async def health() -> Dict[str, bool]:
        return {"ok": True}

    @app.get("/threads/{thread_id}/messages")
    async def thread_messages(thread_id: str, request: Request):
        graph = getattr(request.app.state, "graph", None)
        if graph is None:
            raise HTTPException(status_code=503, detail="agent not ready")
        return await get_thread_messages(graph, thread_id)

    return app


app = create_app()
