import type { Agent, LogEntry } from "../types/agent";

export function LogPanel({ logs, agents }: { logs: LogEntry[]; agents: Agent[] }) {
  const agentName = (agentId: string) => agents.find((a) => a.id === agentId)?.name ?? agentId;

  return (
    <div className="panel">
      <h2>Live log</h2>
      {logs.length === 0 ? (
        <p className="panel__empty">No activity yet.</p>
      ) : (
        <ul className="log-list">
          {logs.map((log) => (
            <li key={log.id} className={`log-item log-item--${log.level}`}>
              <span className="log-item__time">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className="log-item__agent">{agentName(log.agentId)}</span>
              <span className="log-item__message">{log.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
