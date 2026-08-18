import type { Agent } from "../types/agent";

const STATUS_LABEL: Record<Agent["status"], string> = {
  idle: "Idle",
  running: "Running",
  success: "Done",
  error: "Error",
};

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div className={`agent-card agent-card--${agent.status}`}>
      <div className="agent-card__header">
        <span className={`status-dot status-dot--${agent.status}`} aria-hidden="true" />
        <h3>{agent.name}</h3>
        <span className="agent-card__status">{STATUS_LABEL[agent.status]}</span>
      </div>
      <p className="agent-card__role">{agent.role}</p>
      <p className="agent-card__task">
        {agent.currentTask ? agent.currentTask : "No active task"}
      </p>
    </div>
  );
}
