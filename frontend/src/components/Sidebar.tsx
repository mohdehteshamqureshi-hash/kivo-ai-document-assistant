import React, { useState } from "react";
import { Plus, Trash2, Database, BookOpen, Layers, X, Search } from "lucide-react";
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
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-80 bg-[#070d1e] border-r border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <BrandLogo size="md" showTagline={true} />
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Action: New Chat */}
        <div className="p-4 border-b border-slate-800/80">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white font-semibold text-sm shadow-lg shadow-blue-500/20 transition-all group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
            <span>New Chat Session</span>
          </button>
        </div>

        {/* Document Library Header */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Knowledge Base
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-sky-300 font-semibold">
              {documents.length}
            </span>
          </div>

          {documents.length > 0 && (
            <button
              type="button"
              onClick={onClearAllDocs}
              className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
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
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter documents..."
                className="w-full bg-[#0b1329] border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        )}

        {/* Document List Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2.5">
          {filteredDocs.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs px-2">
              <Database className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
              <p className="font-medium text-slate-400">Knowledge base is empty</p>
              <p className="text-[11px] text-slate-500 mt-1">
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
        <div className="p-4 border-t border-slate-800/80 bg-[#050a18]/70">
          <div className="p-3 rounded-xl bg-[#091124] border border-slate-800 text-xs">
            <div className="flex items-center justify-between text-slate-300 font-semibold mb-2">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>Vector Engine</span>
              </span>
              <span className="text-[10px] text-sky-400 font-mono">v1.0 (NumPy)</span>
            </div>

            <div className="space-y-1.5 text-[11px] text-slate-400 font-mono">
              <div className="flex justify-between">
                <span>Total Passages:</span>
                <span className="text-slate-200">{backendHealth?.total_chunks || 0} chunks</span>
              </div>
              <div className="flex justify-between">
                <span>Vocab Terms:</span>
                <span className="text-slate-200">{backendHealth?.vocabulary_size || 0} tokens</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
                <span>FastAPI Service:</span>
                <span className={`inline-flex items-center gap-1 font-sans ${isBackendOnline ? "text-emerald-400" : "text-rose-400"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isBackendOnline ? "bg-emerald-400" : "bg-rose-400"}`} />
                  {isBackendOnline ? "Operational" : "Offline"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
