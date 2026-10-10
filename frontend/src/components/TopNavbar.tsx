import React from "react";
import { Menu, Plus, ExternalLink, Filter } from "lucide-react";
import type { DocumentItem, HealthStatus } from "../types";

interface TopNavbarProps {
  onToggleSidebar: () => void;
  onNewChat: () => void;
  documents: DocumentItem[];
  selectedDocId: string | null;
  onSelectDocFilter: (docId: string | null) => void;
  backendHealth: HealthStatus | null;
  isBackendOnline: boolean;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  onToggleSidebar,
  onNewChat,
  documents,
  selectedDocId,
  onSelectDocFilter,
  backendHealth,
  isBackendOnline,
}) => {

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#070d1e]/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Left: Mobile Toggle & Filter Selector */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Target Document Selector / Filter */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-sky-400" />
            <span>Search Scope:</span>
          </div>

          <div className="relative">
            <select
              value={selectedDocId || "all"}
              onChange={(e) => onSelectDocFilter(e.target.value === "all" ? null : e.target.value)}
              className="bg-[#0b1329] border border-slate-800 hover:border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-1.5 pr-8 focus:outline-none focus:border-sky-500 appearance-none cursor-pointer font-medium"
            >
              <option value="all">Entire Knowledge Base ({documents.length} docs)</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  📄 {doc.name} ({doc.pages}p)
                </option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-[10px]">
              ▼
            </div>
          </div>
        </div>
      </div>

      {/* Right: Actions & System Health */}
      <div className="flex items-center gap-3">
        {/* Backend Status Pill */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border font-medium transition-all ${
            isBackendOnline
              ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
              : "bg-rose-950/40 border-rose-800/60 text-rose-300"
          }`}
          title={isBackendOnline ? `Vector Engine: ${backendHealth?.vector_engine}` : "Backend offline"}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isBackendOnline ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
            }`}
          />
          <span className="hidden sm:inline">
            {isBackendOnline ? "FastAPI Live" : "Offline"}
          </span>
          {isBackendOnline && backendHealth && (
            <span className="hidden md:inline text-[10px] text-emerald-400/80 font-mono">
              ({backendHealth.total_chunks} chunks)
            </span>
          )}
        </div>

        {/* Swagger Docs Link */}
        <a
          href="http://127.0.0.1:8000/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:flex items-center gap-1 text-xs text-slate-400 hover:text-sky-400 transition-colors px-2.5 py-1 rounded-lg hover:bg-slate-800/60"
        >
          <span>Swagger Docs</span>
          <ExternalLink className="w-3 h-3" />
        </a>

        {/* New Chat Button */}
        <button
          type="button"
          onClick={onNewChat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Chat</span>
        </button>
      </div>
    </header>
  );
};
