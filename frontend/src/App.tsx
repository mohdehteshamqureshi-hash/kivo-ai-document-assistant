import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopNavbar } from "./components/TopNavbar";
import { UploadDropzone } from "./components/UploadDropzone";
import { EmptyWelcome } from "./components/EmptyWelcome";
import { ChatArea } from "./components/ChatArea";
import { ChatInput } from "./components/ChatInput";
import { ConnectionBanner } from "./components/ConnectionBanner";
import { BrandLogo } from "./components/BrandLogo";
import { RobotHero } from "./components/ui/robot-hero";
import { ragApi, ApiError, BACKEND_API_URL, DOCS_URL } from "./services/api";
import type { DocumentItem, HealthStatus, ChatMessage } from "./types";
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileText,
  Cpu,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  Bot,
} from "lucide-react";
import "./App.css";

type ViewMode = "home" | "workspace";

export default function App() {
  // Navigation & View switcher states
  const getViewFromHash = (): ViewMode => {
    if (typeof window !== "undefined") {
      const h = window.location.hash.toLowerCase();
      if (h === "#workspace" || h === "#/workspace") {
        return "workspace";
      }
    }
    return "home";
  };

  const [activeView, setActiveView] = useState<ViewMode>(getViewFromHash);
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

  // Navigation switcher handler
  const navigateTo = (view: ViewMode) => {
    setActiveView(view);
    if (view === "workspace") {
      window.location.hash = "workspace";
    } else {
      if (window.location.hash) {
        window.history.pushState(null, "", window.location.pathname);
      }
    }
  };

  // Listen to browser hash changes (back/forward button & direct URL navigation)
  useEffect(() => {
    const handleHash = () => {
      setActiveView(getViewFromHash());
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

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
      alert("Cannot upload: Backend server is offline. Please start the backend service.");
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
        text: `📄 **${newDoc.name}** has been processed and indexed into the Vector Space (${newDoc.pages} pages, ${newDoc.chunks_count} passages).\n\nYou can now ask any questions about this document. Every answer will cite exact page coordinates.`,
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
        text: `⚠️ Cannot process query: The Kivo AI backend is offline at ${BACKEND_API_URL}.\n\nIf running locally, please start the server:\n\`\`\`powershell\ncd backend\npython run.py\n\`\`\`\nOnce the backend is live, your query will be processed with real-time vector search.`,
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

  // ---------------------------------------------------------------------------
  // VIEW 1: DEDICATED FULL-SCREEN RAG WORKSPACE (Option 3 Approved Design)
  // ---------------------------------------------------------------------------
  if (activeView === "workspace") {
    return (
      <div className="flex h-[100dvh] w-full max-w-full bg-[#f8fafc] text-slate-900 font-sans overflow-x-hidden selection:bg-blue-600 selection:text-white">
        {/* Left Full-Height Sidebar */}
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
          onNavigateHome={() => navigateTo("home")}
        />

        {/* Main Full-Screen Workspace Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f8fafc] min-w-0">
          {/* Top Navbar with Responsive Switcher */}
          <TopNavbar
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            onNewChat={handleNewChat}
            documents={documents}
            selectedDocId={selectedDocId}
            onSelectDocFilter={setSelectedDocId}
            backendHealth={backendHealth}
            isBackendOnline={isBackendOnline}
            activeView={activeView}
            onNavigateHome={() => navigateTo("home")}
            onNavigateWorkspace={() => navigateTo("workspace")}
          />

          {/* Full Viewport Scrollable Content Area */}
          <main className="flex-1 overflow-y-auto flex flex-col px-2.5 sm:px-6 lg:px-8 py-3 sm:py-4 max-w-5xl w-full mx-auto min-w-0">
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
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Document Ingestion ({documents.length} Indexed)</span>
                  {showUploadArea ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </button>

                {documents.length > 0 && !showUploadArea && (
                  <span className="text-[11px] text-slate-500">
                    Targeting: <strong className="text-slate-800">{activeDocName || "All Documents"}</strong>
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
            <div className="pt-3 pb-2 sticky bottom-0 bg-[#f8fafc]/90 backdrop-blur-md">
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
          </main>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW 2: 3D ROBOT LANDING PAGE & ARCHITECTURE OVERVIEW (Home View)
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen w-full bg-white text-slate-900 font-sans selection:bg-blue-600 selection:text-white flex flex-col">
      {/* 1. Futuristic Landing Page with Interactive 3D Robot */}
      <section id="overview" className="w-full relative">
        <RobotHero
          backgroundText="KIVO AI"
          ctaText="Open Workspace"
          onCtaClick={() => navigateTo("workspace")}
          navItemsLeft={[
            {
              label: "Home",
              active: true,
              onClick: () => navigateTo("home"),
            },
            {
              label: "Workspace",
              active: false,
              onClick: () => navigateTo("workspace"),
            },
            {
              label: "Architecture",
              href: "#features",
            },
          ]}
          contactText="Swagger Docs"
          contactHref={DOCS_URL}
          contactTarget="_blank"
        />
      </section>

      {/* 2. Architecture & Capabilities Section */}
      <section id="features" className="w-full py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-200 bg-gradient-to-b from-[#f8fafc] via-white to-[#f8fafc] relative">
        {/* Ambient Glows */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-sky-500/10 blur-[120px] pointer-events-none rounded-full" />
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-blue-600/10 blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-3 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Core Engineering Principles</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-4">
              Groundbreaking Grounded RAG Architecture
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Designed from first principles to solve LLM hallucination in technical document interrogation through pure linear algebra, coordinate preservation, and contextual citation ranking.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-16">
            {/* Card 1 */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 hover:border-blue-400 transition-all duration-300 shadow-xs hover:shadow-xl group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-blue-600 mb-5 group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                  Page-Aware PDF Ingestion
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Extracts text directly from binary PDF structures, preserving 1-indexed page coordinates for every paragraph so you can verify exact original coordinates.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-mono text-blue-600">
                <span>01. Ingestion Layer</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 2 */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 hover:border-sky-400 transition-all duration-300 shadow-xs hover:shadow-xl group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 mb-5 group-hover:scale-110 transition-transform">
                  <Cpu className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-sky-600 transition-colors">
                  Normalized Vector Engine
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Eliminates heavy external vector databases. Embeddings are stored in normalized 384-dimensional dense arrays with sub-millisecond cosine similarity calculation.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-mono text-sky-600">
                <span>02. Vector Space</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 3 */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 hover:border-indigo-400 transition-all duration-300 shadow-xs hover:shadow-xl group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-5 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">
                  100% Grounded Citations
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Answers cite exact document names, page indices, relevance match percentages, and excerpt passages. Zero blind generation; inspect exact verified sources for each statement.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-mono text-indigo-600">
                <span>03. Synthesis &amp; Citation</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          {/* Real-time Diagnostics Bar with Direct Workspace Launch */}
          <div className="p-4 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
              <span className="text-xs sm:text-sm font-semibold text-slate-800">
                Active Knowledge Engine Status
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {isBackendOnline ? "Engine Online" : "Service Offline"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-8 text-xs font-mono text-slate-500">
              <div>
                <span className="text-slate-400">Indexed Documents: </span>
                <strong className="text-slate-800">{documents.length}</strong>
              </div>
              <div>
                <span className="text-slate-400">Vector Chunks: </span>
                <strong className="text-blue-600 font-bold">{backendHealth?.total_chunks || 0}</strong>
              </div>
              <div>
                <span className="text-slate-400">Engine: </span>
                <strong className="text-sky-600 font-semibold">Normalized Dense Vector Space</strong>
              </div>
            </div>

            <button
              onClick={() => navigateTo("workspace")}
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 text-white font-bold text-xs hover:opacity-95 transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/20 cursor-pointer min-h-[44px]"
            >
              <span>Launch Full Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 3. Footer */}
      <footer className="w-full border-t border-slate-200 bg-white py-8 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" showTagline={false} />
            <span className="text-slate-300">|</span>
            <span className="text-slate-600 font-medium">Intelligent RAG-Based Document Assistant</span>
          </div>

          <div className="flex items-center gap-4 text-slate-500">
            <button
              onClick={() => navigateTo("workspace")}
              className="hover:text-blue-600 transition-colors flex items-center gap-1 cursor-pointer font-semibold"
            >
              <Bot className="w-3.5 h-3.5 text-blue-600" />
              <span>Full Workspace</span>
            </button>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 transition-colors flex items-center gap-1"
            >
              <span>API Diagnostics</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
