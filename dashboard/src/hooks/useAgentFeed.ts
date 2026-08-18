import { useEffect, useReducer, useRef } from "react";
import type { Agent, AgentEvent, LogEntry, Task } from "../types/agent";

const MAX_LOGS = 200;

interface FeedState {
  agents: Record<string, Agent>;
  tasks: Record<string, Task>;
  logs: LogEntry[];
  connected: boolean;
}

const initialState: FeedState = {
  agents: {},
  tasks: {},
  logs: [],
  connected: false,
};

type Action = AgentEvent | { type: "connection"; connected: boolean };

function reducer(state: FeedState, action: Action): FeedState {
  switch (action.type) {
    case "agent_status":
      return {
        ...state,
        agents: { ...state.agents, [action.agent.id]: action.agent },
      };
    case "task_update":
      return {
        ...state,
        tasks: { ...state.tasks, [action.task.id]: action.task },
      };
    case "log":
      return {
        ...state,
        logs: [action.log, ...state.logs].slice(0, MAX_LOGS),
      };
    case "connection":
      return { ...state, connected: action.connected };
    default:
      return state;
  }
}

/**
 * Feeds the dashboard from a live source when VITE_FEED_URL is set (an SSE
 * endpoint on a webhook relay fed by n8n/LangGraph/etc), otherwise runs a
 * local simulation so the dashboard is usable standalone during development.
 */
export function useAgentFeed() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  useEffect(() => {
    const feedUrl = import.meta.env.VITE_FEED_URL as string | undefined;

    if (feedUrl) {
      const source = new EventSource(feedUrl);
      source.onopen = () => dispatchRef.current({ type: "connection", connected: true });
      source.onerror = () => dispatchRef.current({ type: "connection", connected: false });
      source.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as AgentEvent;
          dispatchRef.current(parsed);
        } catch {
          // ignore malformed events
        }
      };
      return () => source.close();
    }

    dispatchRef.current({ type: "connection", connected: true });
    return simulateFeed((event) => dispatchRef.current(event));
  }, []);

  return {
    agents: Object.values(state.agents).sort((a, b) => a.name.localeCompare(b.name)),
    tasks: Object.values(state.tasks).sort((a, b) => b.createdAt - a.createdAt),
    logs: state.logs,
    connected: state.connected,
  };
}

function simulateFeed(emit: (event: AgentEvent) => void): () => void {
  const agents: Agent[] = [
    { id: "researcher", name: "Researcher", role: "Gathers source material", status: "idle", currentTask: null, updatedAt: Date.now() },
    { id: "reviewer", name: "Reviewer", role: "Checks facts and quality", status: "idle", currentTask: null, updatedAt: Date.now() },
    { id: "writer", name: "Writer", role: "Drafts the final output", status: "idle", currentTask: null, updatedAt: Date.now() },
  ];
  agents.forEach((agent) => emit({ type: "agent_status", agent }));

  const sampleTasks = [
    "Summarize competitor pricing",
    "Draft Q3 newsletter",
    "Fact-check client report",
    "Outline landing page copy",
    "Research supplier options",
  ];

  let taskCounter = 0;
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  const runCycle = (agent: Agent) => {
    if (cancelled) return;
    const title = sampleTasks[taskCounter % sampleTasks.length];
    taskCounter += 1;
    const taskId = `${agent.id}-${taskCounter}`;
    const now = Date.now();

    emit({ type: "task_update", task: { id: taskId, agentId: agent.id, title, status: "queued", createdAt: now } });
    emit({ type: "log", log: { id: `${taskId}-queued`, agentId: agent.id, message: `Queued: ${title}`, level: "info", timestamp: now } });

    timers.push(
      setTimeout(() => {
        if (cancelled) return;
        emit({ type: "agent_status", agent: { ...agent, status: "running", currentTask: title, updatedAt: Date.now() } });
        emit({ type: "task_update", task: { id: taskId, agentId: agent.id, title, status: "running", createdAt: now } });
        emit({ type: "log", log: { id: `${taskId}-running`, agentId: agent.id, message: `Started: ${title}`, level: "info", timestamp: Date.now() } });

        const willFail = Math.random() < 0.12;
        timers.push(
          setTimeout(() => {
            if (cancelled) return;
            const finalStatus = willFail ? "error" : "success";
            emit({ type: "agent_status", agent: { ...agent, status: finalStatus, currentTask: null, updatedAt: Date.now() } });
            emit({ type: "task_update", task: { id: taskId, agentId: agent.id, title, status: willFail ? "failed" : "done", createdAt: now } });
            emit({
              type: "log",
              log: {
                id: `${taskId}-done`,
                agentId: agent.id,
                message: willFail ? `Failed: ${title}` : `Completed: ${title}`,
                level: willFail ? "error" : "info",
                timestamp: Date.now(),
              },
            });

            timers.push(
              setTimeout(() => {
                if (cancelled) return;
                emit({ type: "agent_status", agent: { ...agent, status: "idle", currentTask: null, updatedAt: Date.now() } });
                runCycle(agent);
              }, 1500 + Math.random() * 2000),
            );
          }, 2000 + Math.random() * 3000),
        );
      }, 400 + Math.random() * 800),
    );
  };

  agents.forEach((agent, index) => {
    timers.push(setTimeout(() => runCycle(agent), index * 700));
  });

  return () => {
    cancelled = true;
    timers.forEach(clearTimeout);
  };
}
