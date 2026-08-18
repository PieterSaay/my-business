import type { Agent, Task } from "../types/agent";

const STATUS_LABEL: Record<Task["status"], string> = {
  queued: "Queued",
  running: "Running",
  done: "Done",
  failed: "Failed",
};

export function TaskQueue({ tasks, agents }: { tasks: Task[]; agents: Agent[] }) {
  const agentName = (agentId: string) => agents.find((a) => a.id === agentId)?.name ?? agentId;

  return (
    <div className="panel">
      <h2>Task queue</h2>
      {tasks.length === 0 ? (
        <p className="panel__empty">No tasks yet.</p>
      ) : (
        <ul className="task-list">
          {tasks.slice(0, 20).map((task) => (
            <li key={task.id} className={`task-item task-item--${task.status}`}>
              <span className="task-item__title">{task.title}</span>
              <span className="task-item__agent">{agentName(task.agentId)}</span>
              <span className="task-item__status">{STATUS_LABEL[task.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
