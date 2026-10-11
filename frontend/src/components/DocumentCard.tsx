import React from "react";
import { FileText, Trash2, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import type { DocumentItem } from "../types";

interface DocumentCardProps {
  document: DocumentItem;
  isSelected?: boolean;
  onSelect?: (doc: DocumentItem) => void;
  onDelete: (id: string, name: string) => void;
  isDeleting?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  isSelected = false,
  onSelect,
  onDelete,
  isDeleting = false,
}) => {
  return (
    <div
      onClick={() => onSelect && onSelect(document)}
      className={`group relative flex items-center justify-between p-3.5 rounded-xl transition-all duration-200 border cursor-pointer ${
        isSelected
          ? "bg-blue-50/70 border-blue-500 shadow-xs shadow-blue-500/10"
          : "bg-white border-slate-200/90 hover:border-blue-400 hover:bg-blue-50/20 shadow-xs"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 pr-2">
        {/* PDF Icon Badge */}
        <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200 text-red-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
          <FileText className="w-5 h-5 text-red-500" />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors" title={document.name}>
            {document.name}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
            <span>{document.pages} {document.pages === 1 ? "page" : "pages"}</span>
            <span className="text-slate-300">•</span>
            <span>{document.chunks_count || 1} chunks</span>
            <span className="text-slate-300">•</span>
            <span>{formatBytes(document.size_bytes)}</span>
          </div>
        </div>
      </div>

      {/* Right Actions & Status */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Status Badge */}
        {document.status === "ready" && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Indexed
          </span>
        )}
        {document.status === "processing" && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
            <Clock className="w-3 h-3 animate-spin text-amber-600" /> Processing
          </span>
        )}
        {document.status === "error" && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
            <AlertTriangle className="w-3 h-3 text-rose-600" /> Error
          </span>
        )}

        {/* Delete Button */}
        <button
          type="button"
          disabled={isDeleting}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(document.id, document.name);
          }}
          title="Remove from knowledge base"
          className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 opacity-80 group-hover:opacity-100 transition-all focus:outline-none cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
