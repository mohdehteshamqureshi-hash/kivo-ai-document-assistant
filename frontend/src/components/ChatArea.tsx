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
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex gap-3 sm:gap-4 max-w-4xl mx-auto ${
            msg.role === "user" ? "justify-end" : "justify-start"
          }`}
        >
          {/* Assistant Avatar */}
          {msg.role === "assistant" && (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 p-[1.5px] flex-shrink-0 mt-0.5 shadow-xs shadow-blue-500/20">
              <div className="w-full h-full rounded-[10px] bg-white flex items-center justify-center shadow-inner">
                <Sparkles className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          )}

          {/* Message Bubble Card */}
          <div
            className={`flex flex-col max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 sm:p-5 transition-all ${
              msg.role === "user"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-xs shadow-sm shadow-blue-500/20 font-medium"
                : msg.isError
                ? "bg-rose-50 border border-rose-200 text-rose-800 rounded-tl-xs shadow-xs"
                : "bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs shadow-xs"
            }`}
          >
            {/* Header info for assistant */}
            {msg.role === "assistant" && (
              <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-900 tracking-wide">
                    Kivo AI Assistant
                  </span>
                  {msg.model && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {msg.model}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
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
                <AlertCircle className="w-4 h-4" />
                <span>RAG Service Notice</span>
              </div>
            )}

            {/* Main Content Body */}
            <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-slate-800">
              {msg.text}
            </div>

            {/* Citations Shelf */}
            {msg.citations && msg.citations.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-blue-600">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Verified Source Citations ({msg.citations.length})</span>
                </div>

                <div className="space-y-2">
                  {msg.citations.map((citation, cIdx) => (
                    <CitationCard key={cIdx} citation={citation} index={cIdx} />
                  ))}
                </div>
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
        <div className="flex gap-3 sm:gap-4 max-w-4xl mx-auto justify-start animate-fadeIn">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 p-[1.5px] flex-shrink-0 mt-0.5 shadow-xs shadow-blue-500/20">
            <div className="w-full h-full rounded-[10px] bg-white flex items-center justify-center shadow-inner">
              <Sparkles className="w-4 h-4 text-blue-600 animate-spin" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs p-4 sm:p-5 shadow-sm max-w-md">
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
