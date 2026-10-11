import React from "react";
import { Menu, Plus, ExternalLink, Filter, Bot, Sparkles } from "lucide-react";
import type { DocumentItem, HealthStatus } from "../types";
import { DOCS_URL } from "../services/api";

interface TopNavbarProps {
  onToggleSidebar: () => void;
  onNewChat: () => void;
  documents: DocumentItem[];
  selectedDocId: string | null;
  onSelectDocFilter: (docId: string | null) => void;
  backendHealth: HealthStatus | null;
  isBackendOnline: boolean;
  activeView?: "home" | "workspace";
  onNavigateHome?: () => void;
  onNavigateWorkspace?: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  onToggleSidebar,
  onNewChat,
  documents,
  selectedDocId,
  onSelectDocFilter,
  backendHealth,
  isBackendOnline,
  activeView = "workspace",
  onNavigateHome,
  onNavigateWorkspace,
}) => {

  return (
    <header className="h-14 sm:h-16 border-b border-slate-200/90 bg-white/90 backdrop-blur-md px-2.5 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs max-w-full">
      {/* Left: Mobile Toggle & Filter Selector */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* View Switcher: Home vs Workspace */}
        <div className="inline-flex items-center p-0.5 sm:p-1 rounded-xl bg-slate-100/90 border border-slate-200 shadow-inner">
          <button
            type="button"
            onClick={onNavigateHome}
            className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeView === "home"
                ? "bg-white text-slate-900 border border-slate-200/90 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
            title="Switch to 3D Mascot Landing Page"
          >
            <Bot className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Home</span>
          </button>
          <button
            type="button"
            onClick={onNavigateWorkspace}
            className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeView === "workspace"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs shadow-blue-500/20"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
            title="Active Full-Screen Document Assistant Workspace"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Workspace</span>
          </button>
        </div>

        {/* Target Document Selector / Filter */}
        <div className="hidden md:flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>Scope:</span>
          </div>

          <div className="relative">
            <select
              value={selectedDocId || "all"}
              onChange={(e) => onSelectDocFilter(e.target.value === "all" ? null : e.target.value)}
              className="bg-white border border-slate-200 hover:border-slate-300 text-slate-800 text-xs rounded-xl px-2.5 py-1.5 pr-7 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer font-medium max-w-[200px] truncate shadow-xs"
            >
              <option value="all">All Documents ({documents.length})</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  📄 {doc.name} ({doc.pages}p)
                </option>
              ))}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
              ▼
            </div>
          </div>
        </div>
      </div>

      {/* Right: Actions & System Health */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Backend Status Pill */}
        <div
          className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-full text-xs border font-medium transition-all ${
            isBackendOnline
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
          title={isBackendOnline ? `Vector Engine: ${backendHealth?.vector_engine}` : "Backend offline"}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isBackendOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
            }`}
          />
          <span className="text-[11px] sm:text-xs">
            {isBackendOnline ? "Live" : "Offline"}
          </span>
          {isBackendOnline && backendHealth && (
            <span className="hidden lg:inline text-[10px] text-emerald-700 font-mono">
              ({backendHealth.total_chunks} chunks)
            </span>
          )}
        </div>

        {/* Swagger Docs Link */}
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors px-2.5 py-1 rounded-lg hover:bg-slate-100"
        >
          <span>Swagger Docs</span>
          <ExternalLink className="w-3 h-3" />
        </a>

        {/* New Chat Button */}
        <button
          type="button"
          onClick={onNewChat}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-xs shadow-blue-500/20 transition-all cursor-pointer min-h-[34px]"
          title="Start New Chat Session"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Chat</span>
        </button>
      </div>
    </header>
  );
};
