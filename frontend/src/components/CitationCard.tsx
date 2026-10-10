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
    <div className="border border-slate-200/90 bg-white hover:border-blue-400 rounded-xl overflow-hidden transition-all duration-200 shadow-xs hover:shadow-sm">
      {/* Clickable Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2.5 px-3 text-left hover:bg-slate-50 transition-colors focus:outline-none cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center flex-shrink-0 text-xs font-bold">
            {index + 1}
          </div>
          <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-slate-800 truncate">
            {citation.file}
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold flex-shrink-0">
            Page {citation.page}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {matchPercent > 0 && (
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
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
        <div className="p-3 border-t border-slate-100 bg-slate-50/70 text-xs text-slate-700 font-sans leading-relaxed">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 mb-1.5">
            <Sparkles className="w-3 h-3" />
            <span>Extracted Passage from Page {citation.page}:</span>
          </div>
          <p className="italic bg-white p-2.5 rounded-lg border border-slate-200 text-slate-800 shadow-xs">
            "{citation.snippet}"
          </p>
        </div>
      )}
    </div>
  );
};
