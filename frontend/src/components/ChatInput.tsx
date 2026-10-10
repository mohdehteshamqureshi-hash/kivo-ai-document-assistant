import React, { useRef, useEffect } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
  activeDocName?: string | null;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSubmit,
  isLoading,
  disabled = false,
  placeholder = "Ask any question about your indexed documents...",
  activeDocName,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading && !disabled) {
        onSubmit();
      }
    }
  };

  return (
    <div className="w-full relative">
      <div className="relative rounded-2xl bg-[#091124] border border-slate-800 focus-within:border-sky-500/60 focus-within:ring-1 focus-within:ring-sky-500/30 transition-all shadow-2xl">
        {/* Active Doc Filter indicator if specified */}
        {activeDocName && (
          <div className="px-4 pt-2.5 pb-1 flex items-center gap-1.5 text-[11px] text-sky-400 font-medium">
            <Sparkles className="w-3 h-3" />
            <span>Targeting: <strong className="text-white">{activeDocName}</strong></span>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled || isLoading}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-transparent px-4 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none leading-relaxed disabled:opacity-50"
          style={{ minHeight: "52px", maxHeight: "160px" }}
        />

        {/* Bottom Actions Bar inside input */}
        <div className="px-3 pb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 hidden sm:flex">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">Enter</kbd> to ask
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">Shift+Enter</kbd> for newline
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              disabled={!value.trim() || isLoading || disabled}
              onClick={onSubmit}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white font-semibold text-xs transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <span>Send</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
