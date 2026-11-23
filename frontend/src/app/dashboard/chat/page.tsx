"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PlusCircle, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useDashboardUI } from "@/lib/dashboard-ui-context";
import { Button, PageLoader } from "@/components/dashboard/ui";
import {
  getAssistantAnswer,
  type AssistantAnswer,
  type ScanExplainResult,
} from "@/services/dashboard/chat-assistant";
import { EmptyState } from "./components/EmptyState";
import { ThinkingState } from "./components/ThinkingState";
import { AssistantAnswerCard } from "./components/AssistantAnswerCard";
import { ChatComposer } from "./components/ChatComposer";
import { ScanExplainResultCard } from "./components/ScanExplainResultCard";
import { Toast, type ToastMessage } from "./components/Toast";

interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  userText?: string;
  detectedLang?: string;
  assistantAnswer?: AssistantAnswer;
  isStreaming?: boolean;
  streamedText?: string;
  scanResult?: ScanExplainResult;
  timestamp: string;
}

export default function ChatPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ChatContent />
    </Suspense>
  );
}

function ChatContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { pushNotification } = useDashboardUI();
  const initialQuestion = searchParams.get("question");

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [streamingTurnId, setStreamingTurnId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [activeScanResult, setActiveScanResult] = useState<ScanExplainResult | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const initialTriggered = useRef(false);

  const showToast = (message: string, type: ToastMessage["type"] = "success") => {
    setToast({
      id: `toast_${Date.now()}`,
      message,
      type,
    });
  };

  // Robust internal auto-scroll that only scrolls the message list
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior,
      });
    }
  };

  // Scroll to latest message smoothly whenever turns or thinking state changes
  useEffect(() => {
    const timeout = setTimeout(() => {
      scrollToBottom("smooth");
    }, 40);
    return () => clearTimeout(timeout);
  }, [turns, isThinking, streamingTurnId, activeScanResult]);

  // Handle new conversation
  const handleNewChat = () => {
    setTurns([]);
    setInput("");
    setIsThinking(false);
    setStreamingTurnId(null);
    setActiveScanResult(null);
    showToast("Started new consultation session");
  };

  // Send message and execute mock streaming pipeline
  const handleSend = async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query || isThinking || streamingTurnId) return;

    setInput("");
    const userTurnId = `usr_${Date.now()}`;
    const assistantTurnId = `ast_${Date.now() + 1}`;

    // Append user message
    setTurns((prev) => [
      ...prev,
      {
        id: userTurnId,
        role: "user",
        userText: query,
        timestamp: new Date().toISOString(),
      },
    ]);

    // Activate thinking state
    setIsThinking(true);
    setTimeout(() => scrollToBottom("smooth"), 50);

    try {
      // Fetch assistant response from typed mock service (600-900ms delay)
      const answer = await getAssistantAnswer(query);

      setIsThinking(false);
      setStreamingTurnId(assistantTurnId);

      // Initialize assistant turn in streaming mode
      setTurns((prev) => [
        ...prev,
        {
          id: assistantTurnId,
          role: "assistant",
          isStreaming: true,
          streamedText: "",
          assistantAnswer: answer,
          timestamp: new Date().toISOString(),
        },
      ]);

      // Stream words for natural agent reading experience
      const textToStream = answer.oneLineSummary;
      const words = textToStream.split(" ");
      let currentAcc = "";

      for (let i = 0; i < words.length; i++) {
        currentAcc += (i === 0 ? "" : " ") + words[i];
        const snapshot = currentAcc;
        setTurns((prev) =>
          prev.map((t) =>
            t.id === assistantTurnId
              ? { ...t, streamedText: snapshot }
              : t
          )
        );
        scrollToBottom("instant");
        // Short token delay
        await new Promise((r) => setTimeout(r, 40));
      }

      // Finalize turn
      setTurns((prev) =>
        prev.map((t) =>
          t.id === assistantTurnId
            ? { ...t, isStreaming: false, streamedText: undefined }
            : t
        )
      );

      // Final smooth scroll to show full structured result card
      setTimeout(() => {
        scrollToBottom("smooth");
      }, 100);
    } catch {
      setIsThinking(false);
      showToast("Unable to process statutory inquiry. Please retry.", "warn");
    } finally {
      setStreamingTurnId(null);
    }
  };

  // Check URL query param on mount
  useEffect(() => {
    if (initialQuestion && !initialTriggered.current) {
      initialTriggered.current = true;
      void handleSend(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  // Handle Scan & Explain file attach
  const handleAttachFile = (file: File) => {
    const sizeKB = (file.size / 1024).toFixed(1) + " KB";
    const name = file.name;

    let whatThisIs = "Formal Statutory Demand Notice under Sec 138 NI Act / Section 106 TPA.";
    let deadlinesFound = "15 calendar days from date of receipt to tender settlement.";
    let amounts = "₹60,000 principal claim + 18% statutory penal interest.";
    let whatToDoNext = "Issue a formal advocate reply denying non-wear deductions or disputed liability.";

    if (/agreement|lease|rent/i.test(name)) {
      whatThisIs = "Registered Residential Tenancy Agreement under Karnataka Rent Act, 1999.";
      deadlinesFound = "30-day notice period required before termination of tenancy.";
      amounts = "Monthly rental ₹22,000 · Security Deposit held: ₹1,10,000.";
      whatToDoNext = "Compile handover inspection memo and bank transaction clearance slips.";
    }

    const mockResult: ScanExplainResult = {
      fileName: name,
      fileSize: sizeKB,
      whatThisIs,
      deadlinesFound,
      amounts,
      whatToDoNext,
    };

    setActiveScanResult(mockResult);
    showToast(`Scanned and analyzed ${name}`);
    setTimeout(() => scrollToBottom("smooth"), 100);
  };

  // Handle Voice input transcript
  const handleVoiceTranscript = (transcript: string, detectedLang: string) => {
    setInput(transcript);
    showToast(`Voice transcribed · Detected: ${detectedLang}`);
  };

  // Save to My Cases
  const handleSaveToCases = (title: string, summary: string) => {
    pushNotification({
      title: `Matter Saved: ${title}`,
      body: summary.slice(0, 90) + "...",
      href: "/dashboard/cases",
    });
  };

  // Add to Court Deadlines
  const handleAddToDeadlines = (title: string, dueDate: string) => {
    pushNotification({
      title: `Deadline Scheduled: ${title}`,
      body: `Filing window due on ${dueDate} under statutory schedules.`,
      href: "/dashboard/deadlines",
    });
  };

  // Request Consultation
  const handleRequestConsultation = (advocateName: string) => {
    pushNotification({
      title: `Consultation Dispatched: ${advocateName}`,
      body: "Preliminary matter profile transmitted for docket review.",
      href: "/dashboard/bookings",
    });
  };

  return (
    <>
      {/* Scoped CSS ensuring the chat window remains stationary like ChatGPT/Claude */}
      <style>{`
        /* Keep page stationary on chat route: only message container scrolls */
        body:has(#chat-agent-root) {
          overflow: hidden !important;
        }
        body:has(#chat-agent-root) #main-content {
          padding-top: 0.75rem !important;
          padding-bottom: 0 !important;
          overflow: hidden !important;
          display: flex !important;
          flex-direction: column !important;
          height: calc(100dvh - 128px) !important;
        }
        @media (min-width: 1024px) {
          body:has(#chat-agent-root) #main-content {
            height: calc(100dvh - 64px) !important;
          }
        }
        body:has(#chat-agent-root) #main-content > div {
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
        }
        body:has(#chat-agent-root) footer:not(#composer-container) {
          display: none !important;
        }
      `}</style>

      <div
        id="chat-agent-root"
        className="relative flex flex-col h-full max-w-[760px] mx-auto w-full px-2 sm:px-4 select-none animate-fade"
      >
        {/* Toast Notification Container */}
        <Toast toast={toast} onDismiss={() => setToast(null)} />

        {/* 1. Header: Stationary Title in Gambetta serif + small ghost "New chat" button */}
        <header className="shrink-0 flex items-center justify-between pb-3.5 border-b border-[#e2d5c1]">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8.5 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/50 text-[#9a6a35]">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            <h1 className="font-serif text-[22px] sm:text-[26px] font-normal tracking-tight text-[#2a1c12] leading-none">
              AI Legal Assistant
            </h1>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleNewChat}
            className="h-8 text-xs text-[#5b4a3b] hover:text-[#2a1c12] hover:bg-[#ebe1d1]/50 rounded-[2px]"
            aria-label="Start new consultation chat"
          >
            <PlusCircle className="size-3.5 mr-1 text-[#9a6a35]" aria-hidden="true" />
            New chat
          </Button>
        </header>

        {/* 2. Scrollable Messages Area: ONLY this element scrolls! */}
        <div
          ref={messagesContainerRef}
          className="flex-1 min-h-0 overflow-y-auto py-5 space-y-6 pr-1 select-text scroll-smooth"
          aria-live="polite"
        >
          {turns.length === 0 && !isThinking ? (
            <EmptyState
              userName={user?.name?.split(" ")[0]}
              onSelectPrompt={(p) => void handleSend(p)}
            />
          ) : (
            <div className="space-y-6">
              {turns.map((turn) => {
                if (turn.role === "user") {
                  return (
                    <div key={turn.id} className="flex justify-end gap-2.5 animate-in-up">
                      <div className="max-w-[88%] sm:max-w-[80%]">
                        <div className="rounded-[2px] bg-[#2a1c12] px-4.5 py-3.5 text-xs sm:text-[13.5px] leading-relaxed text-[#fffaf2] shadow-xs select-text">
                          {turn.userText}
                        </div>
                        <div className="mt-1 flex items-center justify-end gap-1.5 text-[10.5px] font-mono text-[#85725f]">
                          <span className="size-1.5 rounded-full bg-[#2e7d32]" aria-hidden="true" />
                          Delivered
                        </div>
                      </div>
                    </div>
                  );
                }

                if (turn.role === "assistant" && turn.assistantAnswer) {
                  // Streaming transition state
                  if (turn.isStreaming) {
                    return (
                      <div key={turn.id} className="space-y-3 animate-in-up">
                        <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-5 shadow-xs space-y-3">
                          <div className="h-5 w-28 rounded-[2px] bg-[#ebe1d1]/60 animate-pulse" />
                          <p className="font-serif text-[17px] sm:text-[19px] font-normal leading-snug text-[#2a1c12]">
                            {turn.streamedText}
                            <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-[#9a6a35] align-middle" />
                          </p>
                        </div>
                      </div>
                    );
                  }

                  // Fully populated structured answer anatomy
                  return (
                    <AssistantAnswerCard
                      key={turn.id}
                      answer={turn.assistantAnswer}
                      onSaveToCases={handleSaveToCases}
                      onAddToDeadlines={handleAddToDeadlines}
                      onRequestConsultation={handleRequestConsultation}
                      onFollowUpClick={(prompt) => void handleSend(prompt)}
                      onShowToast={(msg) => showToast(msg)}
                    />
                  );
                }

                return null;
              })}

              {/* Cycling Thinking State while awaiting response */}
              {isThinking && (
                <div className="animate-in-up">
                  <ThinkingState />
                </div>
              )}

              {/* Scan & Explain Inline Card Result */}
              {activeScanResult && (
                <ScanExplainResultCard
                  result={activeScanResult}
                  onClose={() => setActiveScanResult(null)}
                  onAskFollowUp={(p) => void handleSend(p)}
                />
              )}

              {/* Anchor for auto-scroll tracking */}
              <div ref={scrollAnchorRef} className="h-2" />
            </div>
          )}
        </div>

        {/* 3. Stationary Pinned Composer at Bottom: Never scrolls up! */}
        <footer
          id="composer-container"
          className="shrink-0 pt-2.5 pb-2.5 bg-[#f4efe6] border-t border-[#e2d5c1]/70"
        >
          <ChatComposer
            input={input}
            setInput={setInput}
            onSend={(text) => void handleSend(text)}
            onAttachFile={handleAttachFile}
            onVoiceTranscript={handleVoiceTranscript}
            streaming={isThinking || Boolean(streamingTurnId)}
          />
        </footer>
      </div>
    </>
  );
}
