# Agent Dashboard

A live-updating dashboard for watching multiple AI agents work: status cards
per agent, a task queue, and a live log feed.

## Running it

```bash
npm install
npm run dev
```

Opens standalone with a simulated feed (three demo agents cycling through
fake tasks) so the UI is testable without any backend in place.

## Wiring it to a real feed

The dashboard doesn't care what's orchestrating the agents (n8n, LangGraph,
CrewAI, the Claude Agent SDK, ...) — it just consumes a stream of JSON events
matching `AgentEvent` in `src/types/agent.ts`:

```ts
type AgentEvent =
  | { type: "agent_status"; agent: Agent }
  | { type: "task_update"; task: Task }
  | { type: "log"; log: LogEntry };
```

To connect a real source, set `VITE_FEED_URL` to a Server-Sent Events (SSE)
endpoint that emits one `AgentEvent` JSON payload per message — e.g. a small
webhook relay that receives POSTs from n8n and rebroadcasts them over SSE.
With that env var unset, `useAgentFeed` (`src/hooks/useAgentFeed.ts`) falls
back to the local simulation.

```bash
echo "VITE_FEED_URL=http://localhost:4000/events" > .env.local
```

## Structure

- `src/types/agent.ts` — the `Agent` / `Task` / `LogEntry` / `AgentEvent` shapes
- `src/hooks/useAgentFeed.ts` — reducer + feed connection (SSE or simulated)
- `src/components/` — `AgentCard`, `TaskQueue`, `LogPanel`
- `src/App.tsx` — layout
