import React, { useState } from "react";
import { Plus, Trash2, Database, BookOpen, Layers, X, Search, Bot } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { DocumentCard } from "./DocumentCard";
import type { DocumentItem, HealthStatus } from "../types";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  documents: DocumentItem[];
  selectedDocId: string | null;
  onSelectDoc: (doc: DocumentItem) => void;
  onDeleteDoc: (id: string, name: string) => void;
  onClearAllDocs: () => void;
  backendHealth: HealthStatus | null;
  isBackendOnline: boolean;
  onNavigateHome?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  onNewChat,
  documents,
  selectedDocId,
  onSelectDoc,
  onDeleteDoc,
  onClearAllDocs,
  backendHealth,
  isBackendOnline,
  onNavigateHome,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredDocs = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-[280px] sm:w-80 max-w-[88vw] bg-white border-r border-slate-200/90 flex flex-col transition-transform duration-300 ease-in-out shadow-xs ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <BrandLogo size="md" showTagline={true} />
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            title="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Action: New Chat */}
        <div className="p-4 border-b border-slate-100">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 hover:from-blue-700 hover:to-sky-400 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition-all group cursor-pointer"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
            <span>New Chat Session</span>
          </button>
        </div>

        {/* Document Library Header */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Knowledge Base
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
              {documents.length}
            </span>
          </div>

          {documents.length > 0 && (
            <button
              type="button"
              onClick={onClearAllDocs}
              className="text-[11px] text-slate-400 hover:text-rose-600 flex items-center gap-1 transition-colors cursor-pointer"
              title="Clear all documents from memory"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear All</span>
            </button>
          )}
        </div>

        {/* Document Search filter if > 2 docs */}
        {documents.length > 2 && (
          <div className="px-4 py-1.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter documents..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 shadow-xs"
              />
            </div>
          </div>
        )}

        {/* Document List Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2.5">
          {filteredDocs.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs px-2">
              <Database className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">Knowledge base is empty</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Upload a PDF in the workspace to index passages for RAG interrogation.
              </p>
            </div>
          ) : (
            filteredDocs.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                isSelected={selectedDocId === doc.id}
                onSelect={(d) => {
                  onSelectDoc(d);
                  onClose();
                }}
                onDelete={onDeleteDoc}
              />
            ))
          )}
        </div>

        {/* Bottom Diagnostics Widget */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70">
          <div className="p-3 rounded-xl bg-white border border-slate-200/90 text-xs shadow-xs">
            <div className="flex items-center justify-between text-slate-800 font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Vector Engine</span>
              </span>
              <span className="text-[10px] text-blue-600 font-mono font-medium">v1.0 (NumPy)</span>
            </div>

            <div className="space-y-1.5 text-[11px] text-slate-500 font-mono">
              <div className="flex justify-between">
                <span>Total Passages:</span>
                <span className="text-slate-900 font-semibold">{backendHealth?.total_chunks || 0} chunks</span>
              </div>
              <div className="flex justify-between">
                <span>Vocab Terms:</span>
                <span className="text-slate-900 font-semibold">{backendHealth?.vocabulary_size || 0} tokens</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                <span>{backendHealth?.vector_engine?.includes("Netlify") ? "Netlify Service:" : "FastAPI Service:"}</span>
                <span className={`inline-flex items-center gap-1 font-sans ${isBackendOnline ? "text-emerald-700 font-medium" : "text-rose-700 font-medium"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isBackendOnline ? "bg-emerald-500" : "bg-rose-500"}`} />
                  {isBackendOnline ? "Operational" : "Offline"}
                </span>
              </div>
            </div>
          </div>

          {onNavigateHome && (
            <button
              type="button"
              onClick={() => {
                onNavigateHome();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 text-xs font-semibold transition-all mt-3 cursor-pointer shadow-xs"
              title="Return to 3D Robot Mascot Home Page"
            >
              <Bot className="w-4 h-4 text-blue-600" />
              <span>Back to 3D Robot Home</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
