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

/**
 * Shape of an event pushed by an orchestrator (n8n, LangGraph, Claude Agent SDK, ...)
 * to whatever feeds the dashboard. useAgentFeed() consumes a stream of these.
 */
export type AgentEvent =
  | { type: "agent_status"; agent: Agent }
  | { type: "task_update"; task: Task }
  | { type: "log"; log: LogEntry };
