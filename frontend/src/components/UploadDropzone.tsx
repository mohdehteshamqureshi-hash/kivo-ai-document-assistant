import React, { useState, useRef } from "react";
import { Upload, Loader2, AlertCircle, ShieldCheck } from "lucide-react";

interface UploadDropzoneProps {
  onFileUpload: (file: File) => Promise<void>;
  isUploading: boolean;
  disabled?: boolean;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  onFileUpload,
  isUploading,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndUpload = (file: File) => {
    setErrorMessage(null);

    // Validate type strictly
    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
    if (!isPdf) {
      setErrorMessage(`"${file.name}" is not a PDF. Kivo AI currently supports PDF documents for exact page citations.`);
      return;
    }

    // Validate size (max 25MB)
    const maxBytes = 25 * 1024 * 1024;
    if (file.size > maxBytes) {
      setErrorMessage(`"${file.name}" exceeds the 25 MB file limit. Please select a smaller document.`);
      return;
    }

    onFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled || isUploading) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndUpload(e.target.files[0]);
      // Reset input value so same file can be re-uploaded if needed
      e.target.value = "";
    }
  };

  return (
    <div className="w-full">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf"
        className="hidden"
        disabled={disabled || isUploading}
        onChange={handleFileInputChange}
      />

      {/* Drop area */}
      <div
        onClick={() => !isUploading && !disabled && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-4 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group ${
          isDragging
            ? "border-blue-500 bg-blue-50/60 shadow-md shadow-blue-500/10"
            : disabled
            ? "border-slate-200 bg-slate-50/50 opacity-60 cursor-not-allowed"
            : "border-slate-300/80 bg-white hover:border-blue-500/80 hover:bg-blue-50/30 shadow-xs hover:shadow-sm"
        }`}
      >
        {/* Glow accent */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-blue-500/[0.02] to-transparent pointer-events-none" />

        <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 group-hover:scale-110 group-hover:bg-blue-100 transition-all mb-3 shadow-inner">
          {isUploading ? (
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          ) : (
            <Upload className="w-6 h-6" />
          )}
        </div>

        <div className="flex flex-col items-center gap-1 max-w-full px-1">
          <p className="text-sm font-semibold text-slate-800 break-words">
            {isUploading ? (
              <span className="text-blue-600 animate-pulse">
                Parsing PDF &amp; Indexing Vectors into NumPy Engine...
              </span>
            ) : (
              <>
                Drag &amp; drop your PDF here, or{" "}
                <span className="text-blue-600 group-hover:underline underline-offset-4">browse</span>
              </>
            )}
          </p>
          <p className="text-xs text-slate-500 max-w-sm">
            Supports research papers, textbooks, reports, and manuals up to 25 MB
          </p>
        </div>

        <div className="mt-3 inline-flex items-center justify-center text-center gap-1.5 text-[11px] font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200 max-w-full">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
          <span className="truncate">Page metadata preserved for citations</span>
        </div>
      </div>

      {/* Validation Error Toast */}
      {errorMessage && (
        <div className="mt-3 flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-800 text-xs font-semibold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
