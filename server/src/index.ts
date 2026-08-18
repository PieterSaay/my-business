import crypto from "node:crypto";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { parseAgentEvent } from "./types.js";

const PORT = Number(process.env.PORT ?? 4000);
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: "100kb" }));

const clients = new Set<Response>();

function broadcast(event: unknown) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) client.write(payload);
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
  res.json({ ok: true, clients: clients.size });
});

// SSE stream the dashboard connects to (VITE_FEED_URL).
app.get("/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  res.write(": connected\n\n");

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

  broadcast(event);
  res.status(202).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`webhook relay listening on :${PORT}`);
  if (!WEBHOOK_SECRET) {
    console.warn("WEBHOOK_SECRET not set — /webhook/agent-event is unauthenticated");
  }
});
