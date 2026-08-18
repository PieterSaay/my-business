# Webhook Relay

A small Express server that sits between an orchestrator (n8n, LangGraph,
CrewAI, the Claude Agent SDK, ...) and the [dashboard](../dashboard). It
accepts one `AgentEvent` JSON payload per webhook POST and rebroadcasts it
to every connected dashboard over Server-Sent Events (SSE).

```
n8n / orchestrator --POST--> /webhook/agent-event --SSE--> /events --> dashboard
```

## Running it

```bash
npm install
cp .env.example .env   # set WEBHOOK_SECRET before exposing this beyond localhost
npm run dev
```

Health check: `curl http://localhost:4000/health`

## Sending events

POST an `AgentEvent` (see `src/types.ts`, mirrors `dashboard/src/types/agent.ts`)
to `/webhook/agent-event`:

```bash
curl -X POST http://localhost:4000/webhook/agent-event \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WEBHOOK_SECRET" \
  -d '{
    "type": "agent_status",
    "agent": {
      "id": "researcher",
      "name": "Researcher",
      "role": "Gathers source material",
      "status": "running",
      "currentTask": "Summarize competitor pricing",
      "updatedAt": 1729000000000
    }
  }'
```

Malformed or unrecognized payloads get a `400`; a missing/wrong bearer
token (when `WEBHOOK_SECRET` is set) gets a `401`.

### From n8n

Add an HTTP Request node after each agent step (status change, task
start/finish, log line) pointed at this relay's `/webhook/agent-event`,
method POST, JSON body shaped as one of the three `AgentEvent` variants,
with an `Authorization: Bearer {{$env.WEBHOOK_SECRET}}` header.

## Pointing the dashboard here

In `dashboard/.env.local`:

```
VITE_FEED_URL=http://localhost:4000/events
```

## Notes

- In-memory history only (no disk persistence, lost on restart): the relay
  keeps the latest status per agent, the latest state of the last 200 tasks,
  and the last 200 log lines. A dashboard that connects after events have
  already fired gets this replayed immediately on connect, so it opens
  in the current state rather than empty. Check `/health` for current
  history sizes.
- `WEBHOOK_SECRET` is optional for local dev but should always be set
  before this is reachable from outside localhost — put it behind your
  own reverse proxy/TLS too, this doesn't terminate TLS itself.
