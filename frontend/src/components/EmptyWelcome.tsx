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
    <div className="flex flex-col items-center justify-center text-center py-6 px-4 max-w-3xl mx-auto">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-sky-400 text-xs font-semibold mb-4 shadow-sm">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Kivo AI RAG Engine • Sub-millisecond Vector Retrieval</span>
      </div>

      {/* Main Title & Tagline */}
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
        Your Knowledge.{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-300">
          One Conversation.
        </span>
      </h1>

      <p className="text-sm sm:text-base text-slate-300 max-w-xl mb-8 leading-relaxed">
        Upload PDF manuals, papers, or textbooks. Interrogate your documents with instant,
        mathematically grounded answers and exact page citations.
      </p>

      {/* 3 Core SaaS Pillar Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mb-8 text-left">
        <div className="p-3.5 rounded-xl bg-[#091124]/80 border border-slate-800/80 shadow-md">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center mb-2">
            <Cpu className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-semibold text-white">NumPy Cosine Search</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Vector space search with sublinear TF-IDF and normalized dot-products.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-[#091124]/80 border border-slate-800/80 shadow-md">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-2">
            <BookOpen className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-semibold text-white">Verified Page Citations</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Every fact links directly to its source PDF filename and 1-indexed page.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-[#091124]/80 border border-slate-800/80 shadow-md">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-semibold text-white">Zero Hallucination Guard</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Answers are strictly extracted from verified passages in your library.
          </p>
        </div>
      </div>

      {/* Prompt Starter Pills */}
      <div className="w-full text-left">
        <p className="text-xs font-medium text-slate-400 mb-2.5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>Suggested queries to get started:</span>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {samplePrompts.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPrompt(prompt)}
              className="flex items-center justify-between p-3 rounded-xl bg-[#0b1329]/90 hover:bg-[#111c3d] border border-slate-800 hover:border-sky-500/40 text-left text-xs text-slate-300 hover:text-white transition-all group"
            >
              <span className="truncate pr-2">{prompt}</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 flex-shrink-0 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
