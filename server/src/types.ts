/**
 * Mirrors dashboard/src/types/agent.ts — keep the two in sync by hand since
 * this relay and the dashboard are separate deployables (e.g. relay runs on
 * a Pi next to n8n, dashboard is static hosting).
 */
export type AgentStatus = "idle" | "running" | "success" | "error";

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  currentTask: string | null;
  updatedAt: number;
}

export type TaskStatus = "queued" | "running" | "done" | "failed";

export interface Task {
  id: string;
  agentId: string;
  title: string;
  status: TaskStatus;
  createdAt: number;
}

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  agentId: string;
  message: string;
  level: LogLevel;
  timestamp: number;
}

export type AgentEvent =
  | { type: "agent_status"; agent: Agent }
  | { type: "task_update"; task: Task }
  | { type: "log"; log: LogEntry };

const AGENT_STATUSES: AgentStatus[] = ["idle", "running", "success", "error"];
const TASK_STATUSES: TaskStatus[] = ["queued", "running", "done", "failed"];
const LOG_LEVELS: LogLevel[] = ["info", "warn", "error"];

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseAgentEvent(body: unknown): AgentEvent | null {
  if (typeof body !== "object" || body === null || !("type" in body)) return null;
  const { type } = body as { type: unknown };

  if (type === "agent_status") {
    const agent = (body as { agent?: unknown }).agent;
    if (typeof agent !== "object" || agent === null) return null;
    const a = agent as Record<string, unknown>;
    if (
      isString(a.id) &&
      isString(a.name) &&
      isString(a.role) &&
      typeof a.status === "string" &&
      AGENT_STATUSES.includes(a.status as AgentStatus) &&
      (a.currentTask === null || isString(a.currentTask)) &&
      isNumber(a.updatedAt)
    ) {
      return { type: "agent_status", agent: a as unknown as Agent };
    }
    return null;
  }

  if (type === "task_update") {
    const task = (body as { task?: unknown }).task;
    if (typeof task !== "object" || task === null) return null;
    const t = task as Record<string, unknown>;
    if (
      isString(t.id) &&
      isString(t.agentId) &&
      isString(t.title) &&
      typeof t.status === "string" &&
      TASK_STATUSES.includes(t.status as TaskStatus) &&
      isNumber(t.createdAt)
    ) {
      return { type: "task_update", task: t as unknown as Task };
    }
    return null;
  }

  if (type === "log") {
    const log = (body as { log?: unknown }).log;
    if (typeof log !== "object" || log === null) return null;
    const l = log as Record<string, unknown>;
    if (
      isString(l.id) &&
      isString(l.agentId) &&
      isString(l.message) &&
      typeof l.level === "string" &&
      LOG_LEVELS.includes(l.level as LogLevel) &&
      isNumber(l.timestamp)
    ) {
      return { type: "log", log: l as unknown as LogEntry };
    }
    return null;
  }

  return null;
}
