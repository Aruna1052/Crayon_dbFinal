import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import ClientOverview from "./components/ClientOverview";
import AgentTracker from "./components/AgentTracker";
import ResourceDashboard from "./components/ResourceDashboard";
import crayonLogo from "./assets/Crayon_Logo.jpg";

const TABS = [
  { key: "client-overview", label: "Client Overview", path: "/clients", component: <ClientOverview /> },
  { key: "agent-tracker", label: "Agent Readiness Tracker", path: "/agents", component: <AgentTracker /> },
  { key: "resource-dashboard", label: "Resource Dashboard", path: "/resources", component: <ResourceDashboard /> },
];

function SidebarNav() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <aside className="w-64 bg-white shadow flex flex-col items-center py-6">
      <div className="mb-8">
        <img src={crayonLogo} alt="Crayon Data Logo" className="w-40 mb-2" />
        <span className="block text-2xl font-bold text-indigo-600">Crayon Data</span>
      </div>
      <nav className="flex flex-col w-full">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => navigate(tab.path)}
            className={`w-full px-6 py-3 text-left rounded-lg mb-2 font-semibold transition-all duration-200 ${location.pathname === tab.path ? "bg-indigo-100 text-indigo-700" : "text-gray-700 hover:bg-gray-100"}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex bg-gray-50">
        <SidebarNav />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/clients" />} />
              <Route path="/clients" element={<ClientOverview />} />
              <Route path="/agents" element={<AgentTracker />} />
              <Route path="/resources" element={<ResourceDashboard />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}