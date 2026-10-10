import React, { useState } from "react";
import { FileText, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type { Citation } from "../types";

interface CitationCardProps {
  citation: Citation;
  index: number;
}

export const CitationCard: React.FC<CitationCardProps> = ({ citation, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const matchPercent = Math.round((citation.score || 0) * 100);

  return (
    <div className="border border-slate-800 bg-[#070e22]/90 hover:border-blue-500/40 rounded-xl overflow-hidden transition-all duration-200">
      {/* Clickable Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2.5 px-3 text-left hover:bg-blue-500/5 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <div className="w-6 h-6 rounded-md bg-blue-500/10 text-sky-400 border border-blue-500/20 flex items-center justify-center flex-shrink-0 text-xs font-semibold">
            {index + 1}
          </div>
          <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs font-medium text-slate-200 truncate">
            {citation.file}
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-sky-300 font-semibold flex-shrink-0">
            Page {citation.page}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {matchPercent > 0 && (
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-blue-950/60 text-sky-400 border border-blue-800/40">
              {matchPercent}% relevance
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Passage Snippet */}
      {isExpanded && citation.snippet && (
        <div className="p-3 border-t border-slate-800/80 bg-[#050a18] text-xs text-slate-300 font-sans leading-relaxed">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-400 mb-1.5">
            <Sparkles className="w-3 h-3" />
            <span>Extracted Passage from Page {citation.page}:</span>
          </div>
          <p className="italic bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-slate-300">
            "{citation.snippet}"
          </p>
        </div>
      )}
    </div>
  );
};
