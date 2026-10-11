import React, { useState } from "react";
import { FileText, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type { Citation } from "../types";

interface CitationCardProps {
  citation: Citation;
  index: number;
  isDiagnostic?: boolean;
}

export const CitationCard: React.FC<CitationCardProps> = ({ citation, index, isDiagnostic = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const formattedScore =
    typeof citation.score === "number" && !isNaN(citation.score)
      ? citation.score.toFixed(2)
      : null;

  return (
    <div className={`w-full max-w-full min-w-0 border rounded-xl overflow-hidden transition-all duration-200 shadow-xs hover:shadow-sm ${
      isDiagnostic
        ? "border-amber-200/90 bg-amber-50/20 hover:border-amber-400"
        : "border-slate-200/90 bg-white hover:border-blue-400"
    }`}>
      {/* Clickable Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full min-w-0 flex items-center justify-between gap-1 sm:gap-2 p-2 sm:p-2.5 px-2.5 sm:px-3 text-left hover:bg-slate-50 transition-colors focus:outline-none cursor-pointer min-h-[44px]"
      >
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1 pr-0.5 sm:pr-1">
          <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center flex-shrink-0 text-[11px] sm:text-xs font-bold border ${
            isDiagnostic
              ? "bg-amber-50 text-amber-800 border-amber-200"
              : "bg-blue-50 text-blue-700 border-blue-200"
          }`}>
            {index + 1}
          </div>
          <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-slate-800 truncate min-w-0">
            {citation.file}
          </span>
          <span className="text-[10px] sm:text-[11px] font-mono px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold flex-shrink-0">
            <span className="sm:hidden">p.{citation.page}</span>
            <span className="hidden sm:inline">Page {citation.page}</span>
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 ml-1">
          {isDiagnostic && (
            <span className="text-[9px] sm:text-[10px] font-mono font-semibold px-1 sm:px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
              Unverified
            </span>
          )}
          {formattedScore !== null && (
            <span
              className="text-[9px] sm:text-[10px] font-mono font-semibold px-1 sm:px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200"
              title={`Retrieval ranking score: ${formattedScore}`}
            >
              <span className="hidden sm:inline">Retrieval </span>Score {formattedScore}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          )}
        </div>
      </button>

      {/* Expanded Passage Snippet */}
      {isExpanded && citation.snippet && (
        <div className="p-2.5 sm:p-3 border-t border-slate-100 bg-slate-50/70 text-xs text-slate-700 font-sans leading-relaxed break-words [overflow-wrap:anywhere] max-w-full overflow-hidden">
          <div className={`flex items-center gap-1.5 text-[11px] font-semibold mb-1.5 ${
            isDiagnostic ? "text-amber-700" : "text-blue-600"
          }`}>
            <Sparkles className="w-3 h-3 flex-shrink-0" />
            <span className="break-words">
              {isDiagnostic
                ? `Candidate Passage from Page ${citation.page} (Unverified):`
                : `Extracted Passage from Page ${citation.page}:`}
            </span>
          </div>
          <p className="italic bg-white p-2.5 rounded-lg border border-slate-200 text-slate-800 shadow-xs break-words [overflow-wrap:anywhere]">
            "{citation.snippet}"
          </p>
        </div>
      )}
    </div>
  );
};
