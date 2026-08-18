import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import cors from "cors";
import express, { type Request, type Response } from "express";
import type { Agent, AgentEvent, LogEntry, Task } from "./types.js";
import { parseAgentEvent } from "./types.js";

const PORT = Number(process.env.PORT ?? 4000);
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";
const MAX_TASKS = 200;
const MAX_LOGS = 200;
const HISTORY_FILE = process.env.HISTORY_FILE ?? path.join(process.cwd(), "data", "history.json");

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: "100kb" }));

const clients = new Set<Response>();

// Latest known state, kept so a client connecting after events have already
// fired still sees where things stand instead of starting from empty.
// Persisted to HISTORY_FILE so it also survives a restart.
const agentHistory = new Map<string, Agent>();
const taskHistory = new Map<string, Task>();
const logHistory: LogEntry[] = [];

async function loadHistory() {
  let raw: string;
  try {
    raw = await fs.readFile(HISTORY_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`could not read ${HISTORY_FILE}:`, err);
    }
    return;
  }

  try {
    const snapshot = JSON.parse(raw) as { agents?: Agent[]; tasks?: Task[]; logs?: LogEntry[] };
    for (const agent of snapshot.agents ?? []) agentHistory.set(agent.id, agent);
    for (const task of snapshot.tasks ?? []) taskHistory.set(task.id, task);
    logHistory.push(...(snapshot.logs ?? []).slice(-MAX_LOGS));
    console.log(
      `loaded history from ${HISTORY_FILE}: ${agentHistory.size} agents, ${taskHistory.size} tasks, ${logHistory.length} logs`,
    );
  } catch (err) {
    console.warn(`ignoring unreadable ${HISTORY_FILE}:`, err);
  }
}

// Writes are serialized on this promise chain so concurrent events never
// interleave two saves, and written atomically (temp file + rename) so a
// crash mid-write can't leave a truncated/corrupt history file behind.
let saveQueue: Promise<void> = Promise.resolve();

function scheduleSave() {
  saveQueue = saveQueue.then(saveHistory).catch((err) => {
    console.error(`failed to persist history to ${HISTORY_FILE}:`, err);
  });
}

async function saveHistory() {
  const snapshot = {
    agents: Array.from(agentHistory.values()),
    tasks: Array.from(taskHistory.values()),
    logs: logHistory,
  };
  await fs.mkdir(path.dirname(HISTORY_FILE), { recursive: true });
  const tmpFile = `${HISTORY_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(snapshot));
  await fs.rename(tmpFile, HISTORY_FILE);
}

function recordEvent(event: AgentEvent) {
  if (event.type === "agent_status") {
    agentHistory.set(event.agent.id, event.agent);
  } else if (event.type === "task_update") {
    if (!taskHistory.has(event.task.id) && taskHistory.size >= MAX_TASKS) {
      const oldestId = taskHistory.keys().next().value;
      if (oldestId !== undefined) taskHistory.delete(oldestId);
    }
    taskHistory.set(event.task.id, event.task);
  } else if (event.type === "log") {
    logHistory.push(event.log);
    if (logHistory.length > MAX_LOGS) logHistory.shift();
  }
  scheduleSave();
}

function writeEvent(res: Response, event: AgentEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function replayHistory(res: Response) {
  for (const agent of agentHistory.values()) writeEvent(res, { type: "agent_status", agent });
  for (const task of taskHistory.values()) writeEvent(res, { type: "task_update", task });
  for (const log of logHistory) writeEvent(res, { type: "log", log });
}

function broadcast(event: AgentEvent) {
  for (const client of clients) writeEvent(client, event);
}

function isAuthorized(req: Request): boolean {
  if (!WEBHOOK_SECRET) return true;
  const header = req.header("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expected = Buffer.from(WEBHOOK_SECRET);
  const actual = Buffer.from(provided);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    clients: clients.size,
    history: { agents: agentHistory.size, tasks: taskHistory.size, logs: logHistory.length },
  });
});

// SSE stream the dashboard connects to (VITE_FEED_URL). New connections
// immediately replay current state so late joiners aren't stuck empty.
app.get("/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  res.write(": connected\n\n");
  replayHistory(res);

  clients.add(res);
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
});

// Orchestrator (n8n, LangGraph, ...) posts one AgentEvent JSON body here per call.
app.post("/webhook/agent-event", (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const event = parseAgentEvent(req.body);
  if (!event) {
    res.status(400).json({ error: "invalid AgentEvent payload" });
    return;
  }

  recordEvent(event);
  broadcast(event);
  res.status(202).json({ ok: true });
});

await loadHistory();
app.listen(PORT, () => {
  console.log(`webhook relay listening on :${PORT}`);
  if (!WEBHOOK_SECRET) {
    console.warn("WEBHOOK_SECRET not set — /webhook/agent-event is unauthenticated");
  }
});
