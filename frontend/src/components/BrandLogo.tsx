import React from "react";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = "md", showTagline = false }) => {
  const iconSize = size === "sm" ? "w-7 h-7" : size === "lg" ? "w-11 h-11" : "w-9 h-9";
  const titleSize = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg";

  return (
    <div className="flex items-center gap-3 select-none">
      {/* Brain/Neural-Circuit AI Icon */}
      <div className={`relative ${iconSize} flex-shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-500 p-[1.5px] shadow-md shadow-blue-500/20`}>
        <div className="w-full h-full rounded-[10px] bg-white flex items-center justify-center overflow-hidden relative shadow-inner">
          {/* Subtle background glow */}
          <div className="absolute inset-0 bg-blue-50/80 blur-[2px]" />

          <svg
            className="w-5 h-5 text-blue-600 relative z-10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Abstract neural brain circuit */}
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04" />
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04" />
            <circle cx="12" cy="7" r="1" fill="#2563EB" />
            <circle cx="12" cy="12" r="1" fill="#2563EB" />
            <circle cx="12" cy="17" r="1" fill="#2563EB" />
            <line x1="12" y1="7" x2="8.5" y2="9.5" stroke="#3B82F6" strokeWidth="1.2" />
            <line x1="12" y1="12" x2="15.5" y2="10" stroke="#3B82F6" strokeWidth="1.2" />
            <line x1="12" y1="17" x2="8.5" y2="15" stroke="#3B82F6" strokeWidth="1.2" />
          </svg>
        </div>
      </div>

      {/* Brand Text */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className={`font-bold tracking-tight text-slate-900 font-sans ${titleSize}`}>
            Kivo<span className="text-blue-600 font-extrabold ml-0.5">AI</span>
          </span>
          <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            RAG
          </span>
        </div>
        {showTagline && (
          <span className="text-xs text-slate-500 font-medium tracking-normal mt-0.5">
            Your Knowledge. One Conversation.
          </span>
        )}
      </div>
    </div>
  );
};
