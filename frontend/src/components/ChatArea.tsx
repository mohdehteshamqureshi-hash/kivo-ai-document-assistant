import React, { useRef, useEffect, useState } from "react";
import { User, Copy, Check, Sparkles, BookOpen, Clock, AlertCircle } from "lucide-react";
import { CitationCard } from "./CitationCard";
import type { ChatMessage } from "../types";

interface ChatAreaProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ messages, isLoading }) => {
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Auto scroll to latest message
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto px-2.5 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex gap-2 sm:gap-4 max-w-4xl mx-auto w-full min-w-0 ${
            msg.role === "user" ? "justify-end" : "justify-start"
          }`}
        >
          {/* Assistant Avatar */}
          {msg.role === "assistant" && (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 p-[1.5px] flex-shrink-0 mt-0.5 shadow-xs shadow-blue-500/20">
              <div className="w-full h-full rounded-[10px] bg-white flex items-center justify-center shadow-inner">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
              </div>
            </div>
          )}

          {/* Message Bubble Card */}
          <div
            className={`flex flex-col min-w-0 max-w-[88%] sm:max-w-[80%] rounded-2xl p-3 sm:p-5 transition-all overflow-hidden ${
              msg.role === "user"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-xs shadow-sm shadow-blue-500/20 font-medium"
                : msg.isError
                ? "bg-rose-50 border border-rose-200 text-rose-800 rounded-tl-xs shadow-xs"
                : "bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs shadow-xs"
            }`}
          >
            {/* Header info for assistant */}
            {msg.role === "assistant" && (
              <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 mb-2.5 border-b border-slate-100 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-xs font-semibold text-slate-900 tracking-wide truncate">
                    Kivo AI Assistant
                  </span>
                  {msg.model && (
                    <span className="text-[10px] font-mono px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 truncate flex-shrink-0">
                      {msg.model}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {msg.totalTimeMs !== undefined && (
                    <span className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                      <Clock className="w-3 h-3 text-blue-600" />
                      {msg.totalTimeMs}ms
                    </span>
                  )}

                  {/* Copy button */}
                  <button
                    type="button"
                    onClick={() => handleCopy(msg.id, msg.text)}
                    title="Copy response"
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Error indicator */}
            {msg.isError && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 mb-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>RAG Service Notice</span>
              </div>
            )}

            {/* Main Content Body */}
            <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-slate-800 break-words [overflow-wrap:anywhere]">
              {msg.text}
            </div>

            {/* Citations Shelf (Verified Source Citations for answered queries) */}
            {msg.citations && msg.citations.length > 0 && (
              <div className="mt-3.5 pt-3.5 border-t border-slate-100">
                <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-blue-600">
                  <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Verified Source Citations ({msg.citations.length})</span>
                </div>

                <div className="space-y-2">
                  {msg.citations.map((citation, cIdx) => (
                    <CitationCard key={cIdx} citation={citation} index={cIdx} />
                  ))}
                </div>
              </div>
            )}

            {/* Diagnostic Retrieved Passages (when query was refused or no verified citations) */}
            {(!msg.citations || msg.citations.length === 0) &&
              msg.retrievedPassages &&
              msg.retrievedPassages.length > 0 && (
                <div className="mt-3.5 pt-3.5 border-t border-slate-100">
                  <details className="group text-xs">
                    <summary className="cursor-pointer select-none font-medium text-slate-500 hover:text-slate-700 flex items-start sm:items-center gap-1.5 focus:outline-none">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                      <span className="break-words">Retrieved passages inspected ({msg.retrievedPassages.length}) — unverified / not cited</span>
                    </summary>
                    <div className="mt-2.5 space-y-2 pt-1">
                      {msg.retrievedPassages.map((chunk, cIdx) => (
                        <CitationCard key={cIdx} citation={chunk} index={cIdx} isDiagnostic={true} />
                      ))}
                    </div>
                  </details>
                </div>
              )}
          </div>

          {/* User Avatar */}
          {msg.role === "user" && (
            <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5 text-slate-600 shadow-xs">
              <User className="w-4 h-4" />
            </div>
          )}
        </div>
      ))}

      {/* Loading RAG Pipeline Animation */}
      {isLoading && (
        <div className="flex gap-2 sm:gap-4 max-w-4xl mx-auto w-full min-w-0 justify-start animate-fadeIn">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 p-[1.5px] flex-shrink-0 mt-0.5 shadow-xs shadow-blue-500/20">
            <div className="w-full h-full rounded-[10px] bg-white flex items-center justify-center shadow-inner">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 animate-spin" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs p-3.5 sm:p-5 shadow-sm max-w-md min-w-0 overflow-hidden w-full">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              <span>NumPy Vector Retrieval in Progress</span>
            </div>

            <div className="space-y-2 text-xs text-slate-600 font-mono">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600">✓</span>
                <span>Tokenized query &amp; computed TF-IDF weights</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-600 animate-pulse">●</span>
                <span>Matrix dot product: Computing cosine similarity...</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <span>○</span>
                <span>Synthesizing grounded citations with zero hallucination</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div ref={scrollEndRef} />
    </div>
  );
};
