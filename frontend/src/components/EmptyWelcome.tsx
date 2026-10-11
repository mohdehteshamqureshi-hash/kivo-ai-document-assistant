import React from "react";
import { Sparkles, ShieldCheck, Cpu, ArrowUpRight, BookOpen } from "lucide-react";

interface EmptyWelcomeProps {
  hasDocuments: boolean;
  onSelectPrompt: (prompt: string) => void;
}

export const EmptyWelcome: React.FC<EmptyWelcomeProps> = ({
  hasDocuments,
  onSelectPrompt,
}) => {
  const samplePrompts = hasDocuments
    ? [
        "What are the main findings and conclusions in the uploaded document?",
        "Can you summarize the methodology described in the document?",
        "What key principles or guidelines are highlighted?",
        "Extract the most important statistics and citations mentioned.",
      ]
    : [
        "What are the core principles of AI ethics and data provenance?",
        "How does Retrieval-Augmented Generation (RAG) eliminate hallucinations?",
        "Explain how cosine similarity computes vector relevance.",
      ];

  return (
    <div className="flex flex-col items-center justify-center text-center py-4 sm:py-6 px-2 sm:px-4 max-w-3xl mx-auto w-full">
      {/* Badge */}
      <div className="inline-flex items-center justify-center text-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] sm:text-xs font-semibold mb-3 sm:mb-4 shadow-xs max-w-full">
        <Sparkles className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
        <span className="truncate">Kivo AI RAG Engine • NumPy Vector Retrieval</span>
      </div>

      {/* Main Title & Tagline */}
      <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-2 break-words">
        Your Knowledge.{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500">
          One Conversation.
        </span>
      </h1>

      <p className="text-xs sm:text-base text-slate-600 max-w-xl mb-6 sm:mb-8 leading-relaxed">
        Upload PDF manuals, papers, or textbooks. Interrogate your documents with instant,
        mathematically grounded answers and exact page citations.
      </p>

      {/* 3 Core SaaS Pillar Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mb-8 text-left">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:border-blue-300 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-sky-50 text-blue-600 flex items-center justify-center mb-2">
            <Cpu className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-semibold text-slate-900">NumPy Cosine Search</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Vector space search with sublinear TF-IDF and normalized dot-products.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:border-blue-300 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
            <BookOpen className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-semibold text-slate-900">Verified Page Citations</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Every fact links directly to its source PDF filename and 1-indexed page.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:border-blue-300 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-semibold text-slate-900">Zero Hallucination Guard</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Answers are strictly extracted from verified passages in your library.
          </p>
        </div>
      </div>

      {/* Prompt Starter Pills */}
      <div className="w-full text-left">
        <p className="text-xs font-medium text-slate-500 mb-2.5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Suggested queries to get started:</span>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {samplePrompts.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPrompt(prompt)}
              className="flex items-center justify-between p-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-400 text-left text-xs text-slate-700 hover:text-slate-900 transition-all shadow-xs group cursor-pointer min-h-[44px]"
            >
              <span className="truncate pr-2">{prompt}</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 flex-shrink-0 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
