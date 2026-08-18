# n8n → Webhook Relay

`agent-dashboard-demo.json` is an importable n8n workflow with three
agents (Researcher, Reviewer, Writer) that each call Claude and report
their lifecycle to the [webhook relay](../server) — the pattern to copy
for wiring your real agents in.

```
Manual Trigger → Define Agents (3 items)
  → Notify: agent running → Notify: task running → Notify: log started
  → Call Claude
      ├─ success → Notify: log completed → task done → agent success
      └─ error   → Notify: log failed    → task failed → agent error
```

## Importing it

1. In n8n: **Workflows → Import from File** → select `agent-dashboard-demo.json`.
2. Create two credentials (n8n **Credentials → New → HTTP Header Auth**):
   - **"Webhook Relay Auth"** — Name: `Authorization`, Value: `Bearer <your WEBHOOK_SECRET>`
   - **"Anthropic API Key"** — Name: `x-api-key`, Value: `<your Anthropic API key>`
3. Open each `Notify: *` node and the `Call Claude` node — n8n will show
   the credential as unresolved (it's referenced by name, not by an ID
   that exists on your instance yet); pick the matching one you just made.
4. Open the **Define Agents** node and edit `relayUrl` at the top to point
   at your relay (e.g. `http://<pi-address>:4000` if n8n and the relay run
   on the same box, or wherever you deploy it).
5. Run it manually once to check the relay's `/health` shows the event
   counts going up, then check the dashboard.

## What it actually does

`Define Agents` is a Code node producing three items (one per agent), each
carrying a role, a system prompt, and a task title — edit these to your
real agents' prompts and tasks. Everything downstream runs once per item,
so all three agents go through the same node chain.

`Call Claude` posts to `https://api.anthropic.com/v1/messages` with
`model: "claude-opus-5"` — the current default model — and its node
**On Error** setting is `Continue Using Error Output`, which is what
splits execution into the two branches shown above without an extra IF
node: output 0 carries successful items, output 1 carries failed ones.

## I couldn't test-import this myself

I don't have network access to your n8n-pi instance from this session, so
I validated the file itself — JSON structure, all node connections resolve,
the Code node and every expression parse and execute correctly — and I
simulated the exact `jsonBody` expressions stored in this file against a
real running relay (both the success and the error branch), confirming
the relay accepts every payload and the dashboard renders it correctly.
What I could **not** verify is a real import into n8n's UI, since n8n's
exact node-parameter schema can drift slightly between versions. If import
fails or a node shows a parameter error, the fallback is to build it by
hand — the node list and connections above are the spec; each `Notify: *`
node is just an HTTP Request node (POST, JSON body, header auth credential)
matching one of the three `AgentEvent` shapes documented in
`../server/src/types.ts`.

## Adapting to your real agents

Swap the `Call Claude` HTTP Request node for whatever your agent actually
does (a different API call, a sub-workflow, a tool loop) — the only
contract that matters is the three `Notify: *` node shapes around it:
`agent_status` on start/finish, `task_update` alongside it, and `log` for
anything worth showing in the feed. Duplicate the running → work → done/failed
pattern for as many agents/branches as you want.
