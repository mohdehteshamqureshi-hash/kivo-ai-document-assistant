import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopNavbar } from "./components/TopNavbar";
import { UploadDropzone } from "./components/UploadDropzone";
import { EmptyWelcome } from "./components/EmptyWelcome";
import { ChatArea } from "./components/ChatArea";
import { ChatInput } from "./components/ChatInput";
import { ConnectionBanner } from "./components/ConnectionBanner";
import { ragApi, ApiError, BACKEND_API_URL } from "./services/api";
import type { DocumentItem, HealthStatus, ChatMessage } from "./types";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import "./App.css";

export default function App() {
  // Navigation & UI states
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showUploadArea, setShowUploadArea] = useState(true);

  // Backend Health & Document Library
  const [backendHealth, setBackendHealth] = useState<HealthStatus | null>(null);
  const [isBackendOnline, setIsBackendOnline] = useState(true);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Upload & Chat states
  const [isUploading, setIsUploading] = useState(false);
  const [inputQuery, setInputQuery] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // 1. Initial Data Fetch & Health Polling
  const checkHealthAndSync = useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      const health = await ragApi.getHealth();
      setBackendHealth(health);
      setIsBackendOnline(true);

      // Load active knowledge base documents
      try {
        const docs = await ragApi.getDocuments();
        setDocuments(docs);
      } catch (docErr) {
        console.warn("Failed to retrieve document library:", docErr);
      }
    } catch {
      setIsBackendOnline(false);
      setBackendHealth(null);
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkHealthAndSync();
    }, 0);
    const interval = setInterval(checkHealthAndSync, 12000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [checkHealthAndSync]);

  // 2. Upload Document Handler
  const handleFileUpload = async (file: File) => {
    if (!isBackendOnline) {
      alert("Cannot upload: Backend server is offline. Please start the FastAPI backend with 'python run.py'.");
      return;
    }

    setIsUploading(true);
    try {
      const newDoc = await ragApi.uploadDocument(file);
      setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);

      // Select the newly uploaded document
      setSelectedDocId(newDoc.id);

      // Add a system welcome note in the conversation
      const uploadNotice: ChatMessage = {
        id: `sys-${Date.now()}`,
        role: "assistant",
        text: `📄 **${newDoc.name}** has been processed and indexed into the NumPy Vector Space (${newDoc.pages} pages, ${newDoc.chunks_count} passages).\n\nYou can now ask any questions about this document. Every answer will cite exact page coordinates.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, uploadNotice]);
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : "Document upload failed.";
      alert(`Upload Error: ${message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // 3. Delete Document Handler
  const handleDeleteDocument = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}" from the active knowledge base?`)) {
      return;
    }

    try {
      if (isBackendOnline) {
        await ragApi.deleteDocument(id);
      }
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (selectedDocId === id) {
        setSelectedDocId(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : "Failed to delete document.";
      alert(msg);
    }
  };

  // 4. Clear All Documents Handler
  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to clear all documents from memory?")) {
      return;
    }

    try {
      if (isBackendOnline) {
        await ragApi.clearAllDocuments();
      }
      setDocuments([]);
      setSelectedDocId(null);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : "Failed to clear knowledge base.";
      alert(msg);
    }
  };

  // 5. New Chat Session
  const handleNewChat = () => {
    setMessages([]);
    setInputQuery("");
  };

  // 6. Execute RAG Query
  const handleSendMessage = async (queryToRun?: string) => {
    const textToSend = (queryToRun || inputQuery).trim();
    if (!textToSend || isQuerying) return;

    if (!isBackendOnline) {
      const offlineMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        text: `⚠️ Cannot process query: The Kivo AI backend is offline.\n\nPlease start the server by running:\n\`\`\`powershell\ncd backend\npython run.py\n\`\`\`\nOnce the backend is live at http://127.0.0.1:8000, your query will be processed with real-time vector search.`,
        timestamp: new Date().toISOString(),
        isError: true,
      };
      setMessages((prev) => [
        ...prev,
        {
          id: `usr-${Date.now()}`,
          role: "user",
          text: textToSend,
          timestamp: new Date().toISOString(),
        },
        offlineMsg,
      ]);
      setInputQuery("");
      return;
    }

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      text: textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery("");
    setIsQuerying(true);

    try {
      const response = await ragApi.queryChat(textToSend, 4, selectedDocId || undefined);

      const assistantMessage: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        text: response.answer,
        citations: response.citations,
        model: response.model_used,
        totalTimeMs: response.total_time_ms,
        retrievalTimeMs: response.retrieval_time_ms,
        confidence: response.confidence,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const errorDetail =
        err instanceof ApiError
          ? err.message
          : "An unexpected error occurred while processing your request.";

      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        text: `⚠️ Error executing RAG search: ${errorDetail}`,
        timestamp: new Date().toISOString(),
        isError: true,
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsQuerying(false);
    }
  };

  const activeDocName = documents.find((d) => d.id === selectedDocId)?.name;

  return (
    <div className="flex h-screen w-screen bg-[#070d1e] text-slate-100 font-sans overflow-hidden selection:bg-blue-600 selection:text-white">
      {/* Left Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNewChat={handleNewChat}
        documents={documents}
        selectedDocId={selectedDocId}
        onSelectDoc={(doc) => setSelectedDocId(doc.id)}
        onDeleteDoc={handleDeleteDocument}
        onClearAllDocs={handleClearAll}
        backendHealth={backendHealth}
        isBackendOnline={isBackendOnline}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#070d1e]">
        {/* Top Navbar */}
        <TopNavbar
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onNewChat={handleNewChat}
          documents={documents}
          selectedDocId={selectedDocId}
          onSelectDocFilter={setSelectedDocId}
          backendHealth={backendHealth}
          isBackendOnline={isBackendOnline}
        />

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto flex flex-col px-4 sm:px-6 lg:px-8 py-4 max-w-5xl w-full mx-auto">
          {/* Offline Warning Banner */}
          {!isBackendOnline && (
            <ConnectionBanner
              apiUrl={BACKEND_API_URL}
              onRetry={checkHealthAndSync}
              isRetrying={isCheckingHealth}
            />
          )}

          {/* Collapsible Document Upload Dropzone Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setShowUploadArea(!showUploadArea)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                <span>Document Ingestion ({documents.length} Indexed)</span>
                {showUploadArea ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>

              {documents.length > 0 && !showUploadArea && (
                <span className="text-[11px] text-slate-400">
                  Targeting: <strong className="text-slate-200">{activeDocName || "All Documents"}</strong>
                </span>
              )}
            </div>

            {showUploadArea && (
              <div className="animate-fadeIn">
                <UploadDropzone
                  onFileUpload={handleFileUpload}
                  isUploading={isUploading}
                  disabled={!isBackendOnline}
                />
              </div>
            )}
          </div>

          {/* Chat or Empty Welcome State */}
          <div className="flex-1 flex flex-col min-h-0">
            {messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <EmptyWelcome
                  hasDocuments={documents.length > 0}
                  onSelectPrompt={(prompt) => {
                    setInputQuery(prompt);
                    handleSendMessage(prompt);
                  }}
                />
              </div>
            ) : (
              <ChatArea messages={messages} isLoading={isQuerying} />
            )}
          </div>

          {/* Sticky Bottom Input Bar */}
          <div className="pt-3 pb-2 sticky bottom-0 bg-[#070d1e]/90 backdrop-blur-md">
            <ChatInput
              value={inputQuery}
              onChange={setInputQuery}
              onSubmit={() => handleSendMessage()}
              isLoading={isQuerying}
              disabled={false}
              placeholder={
                activeDocName
                  ? `Ask a question about ${activeDocName}...`
                  : "Ask any question about your indexed documents..."
              }
              activeDocName={activeDocName}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
