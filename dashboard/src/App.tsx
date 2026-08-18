import "./App.css";
import { AgentCard } from "./components/AgentCard";
import { TaskQueue } from "./components/TaskQueue";
import { LogPanel } from "./components/LogPanel";
import { useAgentFeed } from "./hooks/useAgentFeed";

function App() {
  const { agents, tasks, logs, connected } = useAgentFeed();

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h1>Agent Dashboard</h1>
        <span className={`connection-badge ${connected ? "connection-badge--live" : "connection-badge--offline"}`}>
          {connected ? "Live" : "Offline"}
        </span>
      </header>

      <section className="agent-grid">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </section>

      <section className="dashboard__panels">
        <TaskQueue tasks={tasks} agents={agents} />
        <LogPanel logs={logs} agents={agents} />
      </section>
    </div>
  );
}

export default App;
