import React from "react";
import { AlertCircle, RefreshCw, Terminal } from "lucide-react";

interface ConnectionBannerProps {
  apiUrl: string;
  onRetry: () => void;
  isRetrying: boolean;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({
  apiUrl,
  onRetry,
  isRetrying,
}) => {
  return (
    <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-3 sm:p-4 mb-4 text-rose-200 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-lg bg-rose-900/50 text-rose-400 mt-0.5 flex-shrink-0">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-rose-100 flex items-center gap-2">
            Backend Offline — RAG Service Unreachable
          </h4>
          <p className="text-xs text-rose-300 mt-0.5">
            Unable to connect to FastAPI at <code className="bg-black/40 px-1.5 py-0.5 rounded text-rose-200 font-mono">{apiUrl}</code>.
            Real-time vector indexing and chat queries are paused.
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-rose-400 mt-1 font-mono">
            <Terminal className="w-3.5 h-3.5" />
            <span>To start backend: cd backend &amp;&amp; python run.py</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={isRetrying}
        onClick={onRetry}
        className="self-start sm:self-center flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-100 text-xs font-semibold border border-rose-700/60 transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin" : ""}`} />
        <span>{isRetrying ? "Checking..." : "Retry Connection"}</span>
      </button>
    </div>
  );
};
