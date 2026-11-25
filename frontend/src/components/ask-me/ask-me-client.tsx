"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileText,
  ListChecks,
  Loader2,
  MapPin,
  MessageSquarePlus,
  Mic,
  MicOff,
  Paperclip,
  Phone,
  Radio,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  streamAskMeQuery,
  synthesizeAskMeSpeech,
  transcribeAskMeAudio,
  uploadAskMeAttachment,
  type AskMeAttachment,
  type AskMeHistoryTurn,
  type AskMeResponse,
} from "@/services/ask-me";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachmentName?: string;
  response?: AskMeResponse;
  isStreaming?: boolean;
  showSimplified?: boolean;
  answerMode?: "brief" | "simple" | "statute";
  highlightedCitation?: number | null;
}

const SAMPLE_PROBLEMS = [
  "My cheque of ₹1,20,000 bounced due to insufficient funds.",
  "A seller delivered a defective product and refuses a refund.",
  "My landlord is refusing to return my ₹60,000 security deposit.",
  "Police called someone for questioning without giving written grounds of arrest.",
];

const SPEECH_LANGS = [
  { code: "en", speechCode: "en-IN", label: "English" },
  { code: "hi", speechCode: "hi-IN", label: "हिन्दी (Hindi)" },
  { code: "kn", speechCode: "kn-IN", label: "ಕನ್ನಡ (Kannada)" },
] as const;

export function AskMeClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<"en" | "hi" | "kn">("en");
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<AskMeAttachment | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [handsFreeMode, setHandsFreeMode] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeAudioUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const nextIdRef = useRef(0);
  const handsFreeRef = useRef(false);
  const autoSpeakRef = useRef(true);
  const sendMessageRef = useRef<(overrideText?: string) => Promise<void>>(async () => {});

  useEffect(() => {
    handsFreeRef.current = handsFreeMode;
  }, [handsFreeMode]);

  useEffect(() => {
    autoSpeakRef.current = autoSpeak;
  }, [autoSpeak]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore cleanup errors
        }
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
      if (activeAudioUrlRef.current) {
        URL.revokeObjectURL(activeAudioUrlRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    if (activeAudioUrlRef.current) {
      URL.revokeObjectURL(activeAudioUrlRef.current);
      activeAudioUrlRef.current = null;
    }
    setSpeakingMessageId(null);
  };

  const speakText = (messageId: string, text: string, langCode: string = language) => {
    const cleanText = text.replace(/\[\d+\]/g, "").replace(/https?:\/\/\S+/g, "").trim();
    if (!cleanText) return;

    stopSpeaking();
    setSpeakingMessageId(messageId);

    void (async () => {
      // 1. Try Gemini TTS from backend first
      const audioBlob = await synthesizeAskMeSpeech(cleanText, langCode);
      if (audioBlob) {
        const url = URL.createObjectURL(audioBlob);
        activeAudioUrlRef.current = url;
        const audio = new Audio(url);
        activeAudioRef.current = audio;
        audio.onended = () => {
          stopSpeaking();
          if (handsFreeRef.current) {
            startVoiceCapture(true);
          }
        };
        audio.onerror = () => {
          stopSpeaking();
        };
        try {
          await audio.play();
          return;
        } catch {
          stopSpeaking();
        }
      }

      // 2. Fallback to browser SpeechSynthesis
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setSpeakingMessageId(null);
        setSpeechError("Voice playback (Text-to-Speech) is not supported in this browser.");
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const targetLang = SPEECH_LANGS.find((l) => l.code === langCode)?.speechCode ?? "en-IN";
      utterance.lang = targetLang;
      utterance.rate = 0.98;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase()) ||
        voices.find((v) => v.lang.toLowerCase().startsWith(langCode.toLowerCase()));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        setSpeakingMessageId(messageId);
      };
      utterance.onend = () => {
        setSpeakingMessageId(null);
        if (handsFreeRef.current) {
          startVoiceCapture(true);
        }
      };
      utterance.onerror = () => {
        setSpeakingMessageId(null);
      };

      window.speechSynthesis.speak(utterance);
    })();
  };

  const handleNewChat = () => {
    stopSpeaking();
    setHandsFreeMode(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
    setMessages([]);
    setQuery("");
    setAttachment(null);
    setSubmitError(null);
    setSpeechError(null);
  };

  const stopVoiceCapture = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsListening(false);
  };

  const startVoiceCapture = (autoSubmitOnEnd: boolean) => {
    setSpeechError(null);
    stopSpeaking();

    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    // If browser has MediaRecorder, record audio for Gemini STT (with SpeechRecognition live preview if available)
    if (
      typeof navigator !== "undefined" &&
      navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined"
    ) {
      void (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaStreamRef.current = stream;
          audioChunksRef.current = [];
          const recorder = new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (ev) => {
            if (ev.data.size > 0) {
              audioChunksRef.current.push(ev.data);
            }
          };

          const baseText = autoSubmitOnEnd ? "" : query.trim();

          recorder.onstop = async () => {
            setIsListening(false);
            if (mediaStreamRef.current) {
              mediaStreamRef.current.getTracks().forEach((t) => t.stop());
              mediaStreamRef.current = null;
            }
            const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
            if (blob.size < 200) return;

            const geminiTranscript = await transcribeAskMeAudio(blob, language);
            if (geminiTranscript) {
              const combined = baseText ? `${baseText} ${geminiTranscript}` : geminiTranscript;
              setQuery(combined);
              if (autoSubmitOnEnd && geminiTranscript.length >= 3) {
                void sendMessageRef.current(geminiTranscript);
              }
            }
          };

          recorder.start();
          setIsListening(true);
          return;
        } catch {
          // Fall through to browser SpeechRecognition if getUserMedia/MediaRecorder fails
        }
      })();
      return;
    }

    if (!SpeechRec) {
      setSpeechError(
        "Voice-to-text is not supported in this browser. Please type your problem below or use Chrome / Edge."
      );
      setHandsFreeMode(false);
      return;
    }

    const recognition = new SpeechRec();
    const selectedLang = SPEECH_LANGS.find((l) => l.code === language) ?? SPEECH_LANGS[0];
    recognition.lang = selectedLang.speechCode;
    recognition.interimResults = true;
    recognition.continuous = false;

    const baseText = autoSubmitOnEnd ? "" : query.trim();
    let latestTranscript = "";

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      latestTranscript = transcript.trim();
      const combined = baseText ? `${baseText} ${latestTranscript}` : latestTranscript;
      setQuery(combined);
    };

    recognition.onerror = (event) => {
      setSpeechError(
        event.error === "not-allowed"
          ? "Microphone permission was denied. Please allow microphone access or type your problem."
          : `Voice capture stopped (${event.error}). You can type or retry speaking.`
      );
      setIsListening(false);
      if (event.error === "not-allowed") {
        setHandsFreeMode(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (autoSubmitOnEnd && latestTranscript.length >= 3) {
        void sendMessageRef.current(latestTranscript);
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const handleToggleSpeech = () => {
    if (isListening) {
      stopVoiceCapture();
      return;
    }
    startVoiceCapture(false);
  };

  const handleToggleHandsFree = () => {
    if (handsFreeMode) {
      setHandsFreeMode(false);
      stopSpeaking();
      if (isListening) {
        stopVoiceCapture();
      }
      return;
    }
    setAutoSpeak(true);
    setHandsFreeMode(true);
    startVoiceCapture(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubmitError(null);
    setIsUploading(true);
    try {
      const extracted = await uploadAskMeAttachment(file);
      setAttachment(extracted);
    } catch {
      setSubmitError("Could not read the attached file. Try a clear PDF, PNG, or JPG.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const trimmed = (overrideText ?? query).trim();
    if (trimmed.length < 3 || isStreaming) {
      if (trimmed.length < 3) {
        setSubmitError("Please describe your legal problem in at least a few words.");
      }
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    setSubmitError(null);
    setIsStreaming(true);

    const history: AskMeHistoryTurn[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    nextIdRef.current += 1;
    const userMsgId = `usr_${nextIdRef.current}`;
    nextIdRef.current += 1;
    const assistantMsgId = `ast_${nextIdRef.current}`;
    const currentAttachment = attachment;

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        content: trimmed,
        attachmentName: currentAttachment?.file_name,
      },
      {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        isStreaming: true,
        showSimplified: false,
      },
    ]);

    if (!overrideText) setQuery("");
    setAttachment(null);

    let latestMeta: AskMeResponse | null = null;
    try {
      await streamAskMeQuery(
        {
          query: trimmed,
          preferredLanguage: language,
          history,
          attachment: currentAttachment,
        },
        {
          onMeta: (meta) => {
            latestMeta = meta;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, response: meta } : m
              )
            );
          },
          onDelta: (chunk) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: m.content + chunk }
                  : m
              )
            );
          },
          onDone: () => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, isStreaming: false } : m
              )
            );
            if (latestMeta && (autoSpeakRef.current || handsFreeRef.current)) {
              const script =
                latestMeta.spoken_summary ||
                latestMeta.simplified_answer ||
                latestMeta.brief_answer;
              speakText(assistantMsgId, script, latestMeta.detected_language || language);
            }
          },
        }
      );
    } catch {
      setSubmitError("Unable to process your question right now. Please try again.");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, isStreaming: false } : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  });

  const toggleSimplified = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              showSimplified: !m.showSimplified,
              answerMode: !m.showSimplified ? "simple" : "brief",
            }
          : m
      )
    );
  };

  const setAnswerMode = (messageId: string, mode: "brief" | "simple" | "statute") => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              answerMode: mode,
              showSimplified: mode === "simple",
            }
          : m
      )
    );
  };

  const focusCitation = (messageId: string, citationIndex: number) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              answerMode: "statute",
              highlightedCitation: citationIndex,
            }
          : m
      )
    );
  };

  const renderCitedText = (text: string, messageId: string, totalProvisions: number) => {
    const parts = text.split(/(\[\d+\])/g);
    return parts.map((part, idx) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (!match) return <span key={idx}>{part}</span>;
      const num = Number(match[1]);
      if (num < 1 || num > totalProvisions) {
        return <span key={idx}>{part}</span>;
      }
      return (
        <button
          key={idx}
          type="button"
          onClick={() => focusCitation(messageId, num)}
          title={`View verified source [${num}]`}
          className="inline-flex items-center justify-center mx-0.5 px-1.5 py-0.5 align-super text-[10.5px] font-mono font-semibold bg-[#f4efe6] border border-[#9a6a35] text-[#9a6a35] hover:bg-[#9a6a35] hover:text-[#fffaf2] rounded-[2px] transition-colors"
        >
          {num}
        </button>
      );
    });
  };

  return (
    <div className="bg-[#f4efe6] text-[#2a1c12] min-h-[calc(100vh-5rem)] py-8 sm:py-10">
      <Container size="lg" className="space-y-6">
        {/* Top Bar & Editorial Header */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[13px] font-medium text-[#705c49] hover:text-[#2a1c12] transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to NyayaSetu Home
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !autoSpeak;
                  setAutoSpeak(next);
                  if (!next) stopSpeaking();
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-[2px] text-[12.5px] font-semibold transition-colors ${
                  autoSpeak
                    ? "bg-[#fffaf2] border-[#9a6a35] text-[#2a1c12]"
                    : "bg-[#f4efe6] border-[#e2d5c1] text-[#705c49]"
                }`}
              >
                {autoSpeak ? (
                  <Volume2 className="h-3.5 w-3.5 text-[#9a6a35]" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5" />
                )}
                Voice Replies: {autoSpeak ? "On" : "Off"}
              </button>

              <button
                type="button"
                onClick={handleToggleHandsFree}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-[2px] text-[12.5px] font-semibold transition-colors ${
                  handsFreeMode
                    ? "bg-[#9a6a35] border-[#9a6a35] text-[#fffaf2]"
                    : "bg-[#2a1c12] border-[#2a1c12] text-[#fffaf2] hover:bg-[#9a6a35] hover:border-[#9a6a35]"
                }`}
              >
                <Radio className={`h-3.5 w-3.5 ${handsFreeMode ? "animate-pulse" : ""}`} />
                {handsFreeMode ? "Stop Hands-Free Voice" : "Hands-Free Voice Mode"}
              </button>

              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#fffaf2] border border-[#e2d5c1] hover:border-[#9a6a35] text-[#2a1c12] rounded-[2px] text-[12.5px] font-semibold transition-colors"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5 text-[#9a6a35]" />
                  New Chat
                </button>
              )}
            </div>
          </div>

          {handsFreeMode && (
            <div className="bg-[#fffaf2] border border-[#9a6a35] rounded-[2px] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[13px]">
              <div className="flex items-center gap-2 text-[#2a1c12]">
                <Radio className="h-4 w-4 text-[#9a6a35] animate-pulse" />
                <span>
                  <strong>Hands-Free Voice Mode:</strong>{" "}
                  {isListening
                    ? "Listening… Speak your legal question or follow-up."
                    : isStreaming
                      ? "Analyzing verified Indian statutes…"
                      : speakingMessageId
                        ? "Speaking reply aloud… Mic will reopen automatically."
                        : "Ready for your voice."}
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleHandsFree}
                className="text-[12px] font-semibold text-[#9a6a35] hover:text-[#2a1c12]"
              >
                Exit Voice Mode
              </button>
            </div>
          )}

          <div className="border-b border-[#e2d5c1] pb-5 space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-[#fffaf2] border border-[#e2d5c1] rounded-[2px] text-[11.5px] font-mono uppercase tracking-[0.1em] text-[#9a6a35]">
              <Scale className="h-3.5 w-3.5" />
              Ask Me · Conversational Indian Legal Assistant
            </div>
            <h1 className="font-serif text-[30px] sm:text-[40px] leading-[1.08] tracking-[-0.03em] text-[#2a1c12]">
              Describe Your Problem. <span className="text-[#9a6a35]">Get Verified Law.</span>
            </h1>
            <p className="text-[14px] sm:text-[15px] leading-[1.55] text-[#5b4a3b] max-w-2xl">
              Chat naturally via text, voice, or an attached notice/PDF. NyayaSetu remembers your
              conversation, cites only verified Indian Sections &amp; Articles, simplifies the law,
              and connects serious matters to verified advocates.
            </p>
          </div>
        </div>

        {/* Empty State / Quick Starters */}
        {messages.length === 0 && (
          <div className="bg-[#fffaf2] border border-[#e2d5c1] rounded-[2px] p-5 sm:p-6 space-y-3">
            <p className="text-[12px] font-mono uppercase tracking-[0.08em] text-[#705c49]">
              Start a conversation with a sample problem:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SAMPLE_PROBLEMS.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => sendMessage(sample)}
                  className="text-left text-[13px] p-3 bg-[#f4efe6]/70 hover:bg-[#ebe1d1] border border-[#e2d5c1] rounded-[2px] text-[#2a1c12] transition-colors flex items-center justify-between gap-2"
                >
                  <span>{sample}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#9a6a35]" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Multi-Turn Conversation Thread */}
        {messages.length > 0 && (
          <div className="space-y-6">
            {messages.map((msg) =>
              msg.role === "user" ? (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-2xl bg-[#2a1c12] text-[#fffaf2] rounded-[2px] px-4.5 py-3.5 shadow-xs space-y-2">
                    {msg.attachmentName && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#fffaf2]/10 border border-white/20 rounded-[2px] text-[11.5px] font-mono">
                        <FileText className="h-3 w-3 text-[#d1a46a]" />
                        {msg.attachmentName}
                      </div>
                    )}
                    <p className="text-[14.5px] leading-[1.55] whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="space-y-4">
                  {/* Grounded Assistant Message Card */}
                  <section className="bg-[#fffaf2] border border-[#e2d5c1] rounded-[2px] p-5 sm:p-6 shadow-xs space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2d5c1] pb-3.5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-[#9a6a35]" />
                        <h2 className="font-serif text-[20px] text-[#2a1c12]">
                          NyayaSetu Legal Assessment
                        </h2>
                      </div>
                      {msg.response && !msg.isStreaming && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (speakingMessageId === msg.id) {
                                stopSpeaking();
                              } else {
                                const script =
                                  msg.response?.spoken_summary ||
                                  msg.response?.simplified_answer ||
                                  msg.content;
                                speakText(
                                  msg.id,
                                  script,
                                  msg.response?.detected_language || language
                                );
                              }
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-[2px] text-[11.5px] font-semibold transition-colors ${
                              speakingMessageId === msg.id
                                ? "bg-[#9a6a35] border-[#9a6a35] text-[#fffaf2]"
                                : "bg-[#f4efe6] border-[#e2d5c1] hover:border-[#9a6a35] text-[#2a1c12]"
                            }`}
                          >
                            {speakingMessageId === msg.id ? (
                              <>
                                <Square className="h-3 w-3" />
                                Stop Speaking
                              </>
                            ) : (
                              <>
                                <Volume2 className="h-3.5 w-3.5 text-[#9a6a35]" />
                                Listen
                              </>
                            )}
                          </button>
                          <span className="text-[11px] font-mono uppercase tracking-[0.06em] px-2.5 py-1 bg-[#f4efe6] border border-[#e2d5c1] rounded-[2px] text-[#5b4a3b]">
                            {msg.response.sources_found
                              ? "Verified Corpus Match"
                              : "No False Law Policy"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Perplexity-Style Sources Strip */}
                    {msg.response && msg.response.applicable_provisions.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11.5px] font-mono uppercase tracking-[0.08em] text-[#705c49]">
                          Sources ({msg.response.applicable_provisions.length} Verified)
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {msg.response.applicable_provisions.map((prov) => {
                            const isHighlighted = msg.highlightedCitation === prov.citation_index;
                            return (
                              <button
                                key={`src-${prov.citation_index}-${prov.section_or_article}`}
                                type="button"
                                onClick={() => focusCitation(msg.id, prov.citation_index)}
                                className={`text-left p-3 rounded-[2px] border transition-colors space-y-1 ${
                                  isHighlighted
                                    ? "bg-[#ebe1d1] border-[#9a6a35]"
                                    : "bg-[#f4efe6]/70 border-[#e2d5c1] hover:border-[#9a6a35]"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="px-1.5 py-0.5 bg-[#2a1c12] text-[#fffaf2] font-mono text-[10.5px] rounded-[2px]">
                                    [{prov.citation_index}] {prov.section_or_article}
                                  </span>
                                  <span className="text-[10px] font-mono uppercase text-[#705c49]">
                                    {(prov.source_type || "BARE_ACT").replace(/_/g, " ")}
                                  </span>
                                </div>
                                <p className="text-[12.5px] font-medium text-[#2a1c12] line-clamp-1">
                                  {prov.act_name}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Perplexity-Style Answer Mode Switcher */}
                    {msg.response && !msg.isStreaming && (
                      <div className="flex flex-wrap items-center gap-1.5 border-b border-[#e2d5c1] pb-3">
                        {(
                          [
                            { id: "brief", label: "Brief Answer" },
                            { id: "simple", label: "Simple Words" },
                            { id: "statute", label: "Bare Act & Case Law" },
                          ] as const
                        ).map((tab) => {
                          const active = (msg.answerMode ?? "brief") === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setAnswerMode(msg.id, tab.id)}
                              className={`px-3 py-1.5 rounded-[2px] text-[12px] font-semibold border transition-colors ${
                                active
                                  ? "bg-[#2a1c12] border-[#2a1c12] text-[#fffaf2]"
                                  : "bg-[#f4efe6]/70 border-[#e2d5c1] text-[#5b4a3b] hover:border-[#9a6a35] hover:text-[#2a1c12]"
                              }`}
                            >
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Streamed Answer Text (Brief Answer mode or streaming) */}
                    {(msg.isStreaming || (msg.answerMode ?? "brief") === "brief") && (
                      <div className="text-[15px] leading-[1.65] text-[#2a1c12] min-h-[1.5rem]">
                        {msg.content
                          ? renderCitedText(
                              msg.content,
                              msg.id,
                              msg.response?.applicable_provisions.length ?? 0
                            )
                          : msg.isStreaming
                            ? "Checking verified Indian statutes…"
                            : ""}
                        {msg.isStreaming && (
                          <span className="inline-block w-2 h-4 ml-1 align-middle bg-[#9a6a35] animate-pulse" />
                        )}
                      </div>
                    )}

                    {/* Simple Words Tab View */}
                    {!msg.isStreaming && msg.response && msg.answerMode === "simple" && (
                      <div className="bg-[#f4efe6] border-l-4 border-[#9a6a35] border-y border-r border-[#e2d5c1] rounded-[2px] p-4 space-y-1.5">
                        <p className="text-[11.5px] font-mono uppercase tracking-[0.08em] text-[#9a6a35]">
                          Plain-Language Summary
                        </p>
                        <p className="text-[14.5px] leading-[1.65] text-[#2a1c12]">
                          {msg.response.simplified_answer}
                        </p>
                      </div>
                    )}

                    {/* Once response metadata is ready, render provisions, Simplify, Solutions, Follow-ups, and Escalation */}
                    {msg.response && !msg.isStreaming && (
                      <>
                        {/* Verified Sections / Articles (always shown in Brief & Statute modes) */}
                        {((msg.answerMode ?? "brief") === "brief" ||
                          msg.answerMode === "statute") &&
                          (msg.response.applicable_provisions.length > 0 ? (
                            <div className="space-y-2.5">
                              <h3 className="text-[12px] font-mono uppercase tracking-[0.08em] text-[#705c49]">
                                Applicable Sections, Articles &amp; References
                              </h3>
                              <div className="grid grid-cols-1 gap-3">
                                {msg.response.applicable_provisions.map((prov, idx) => {
                                  const isHighlighted =
                                    msg.highlightedCitation === prov.citation_index;
                                  return (
                                    <div
                                      key={`${prov.act_name}-${prov.section_or_article}-${idx}`}
                                      className={`rounded-[2px] p-4 space-y-1.5 border transition-colors ${
                                        isHighlighted
                                          ? "bg-[#ebe1d1]/80 border-[#9a6a35]"
                                          : "bg-[#f4efe6]/70 border-[#e2d5c1]"
                                      }`}
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="px-2.5 py-0.5 bg-[#2a1c12] text-[#fffaf2] font-mono text-[12px] rounded-[2px]">
                                            [{prov.citation_index}] {prov.section_or_article}
                                          </span>
                                          <span className="font-serif text-[16px] text-[#2a1c12]">
                                            {prov.act_name}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {prov.identifier && (
                                            <span className="text-[11px] font-mono text-[#705c49]">
                                              {prov.identifier}
                                            </span>
                                          )}
                                          {prov.content_checksum && (
                                            <span className="text-[10.5px] font-mono px-1.5 py-0.5 bg-[#fffaf2] border border-[#e2d5c1] rounded-[2px] text-[#705c49]">
                                              SHA256:{prov.content_checksum.slice(0, 8)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      {prov.heading && (
                                        <p className="text-[13px] font-semibold text-[#9a6a35]">
                                          {prov.heading}
                                        </p>
                                      )}
                                      <p className="text-[13.5px] leading-[1.55] text-[#4a392b]">
                                        {prov.brief}
                                      </p>
                                      {prov.official_source_url && (
                                        <a
                                          href={prov.official_source_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#9a6a35] hover:text-[#2a1c12] transition-colors"
                                        >
                                          <BookOpen className="h-3.5 w-3.5" />
                                          Official Bare Act Reference
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-[#f4efe6] border border-[#d1a46a] rounded-[2px] p-3.5 text-[13.5px] text-[#4a392b]">
                              No exact statutory section matched in our verified Bare Act corpus, so
                              no section number was invented.
                            </div>
                          ))}

                        {/* Button right below chatbot response: Simplify */}
                        {msg.answerMode !== "simple" && (
                          <div className="pt-2 border-t border-[#e2d5c1]/80 space-y-3">
                            <button
                              type="button"
                              onClick={() => toggleSimplified(msg.id)}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-[#fffaf2] border-[1.5px] border-[#9a6a35] text-[#2a1c12] hover:bg-[#9a6a35] hover:text-[#fffaf2] transition-colors rounded-[2px] text-[13px] font-semibold"
                            >
                              <Sparkles className="h-4 w-4 text-[#9a6a35]" />
                              {msg.showSimplified
                                ? "Hide Simpler Explanation"
                                : "Simplify — Tell Me in Even Simpler Words"}
                            </button>

                            {msg.showSimplified && (
                              <div className="bg-[#f4efe6] border-l-4 border-[#9a6a35] border-y border-r border-[#e2d5c1] rounded-[2px] p-4 space-y-1">
                                <p className="text-[11.5px] font-mono uppercase tracking-[0.08em] text-[#9a6a35]">
                                  Plain-Language Summary
                                </p>
                                <p className="text-[14px] leading-[1.6] text-[#2a1c12]">
                                  {msg.response.simplified_answer}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 2. Solutions */}
                        <div className="pt-2 border-t border-[#e2d5c1]/80 space-y-3">
                          <div className="flex items-center gap-2">
                            <ListChecks className="h-4.5 w-4.5 text-[#9a6a35]" />
                            <h3 className="font-serif text-[18px] text-[#2a1c12]">
                              Solutions: How You Should Tackle This Problem
                            </h3>
                          </div>
                          <ol className="space-y-2">
                            {msg.response.solutions.map((step, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2.5 bg-[#f4efe6]/60 border border-[#e2d5c1] rounded-[2px] p-3"
                              >
                                <span className="flex items-center justify-center h-5 w-5 shrink-0 bg-[#2a1c12] text-[#fffaf2] font-mono text-[11px] rounded-[2px] mt-0.5">
                                  {i + 1}
                                </span>
                                <span className="text-[13.5px] leading-[1.55] text-[#2a1c12]">
                                  {step}
                                </span>
                              </li>
                            ))}
                          </ol>
                        </div>

                        {/* Smart Follow-Up Chips */}
                        {msg.response.follow_up_questions.length > 0 && (
                          <div className="pt-2 border-t border-[#e2d5c1]/80 space-y-2">
                            <p className="text-[11.5px] font-mono uppercase tracking-[0.08em] text-[#705c49]">
                              Ask a Follow-Up Question
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {msg.response.follow_up_questions.map((fq) => (
                                <button
                                  key={fq}
                                  type="button"
                                  disabled={isStreaming}
                                  onClick={() => sendMessage(fq)}
                                  className="text-left text-[12.5px] px-3 py-1.5 bg-[#f4efe6] hover:bg-[#ebe1d1] disabled:opacity-50 border border-[#e2d5c1] rounded-[2px] text-[#2a1c12] transition-colors"
                                >
                                  {fq}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 3. Contact Us / Serious Matter Advocate Escalation */}
                        <div className="pt-3 border-t border-[#e2d5c1] space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {msg.response.is_serious ? (
                                <AlertTriangle className="h-4.5 w-4.5 text-[#9a6a35]" />
                              ) : (
                                <Phone className="h-4.5 w-4.5 text-[#9a6a35]" />
                              )}
                              <h3 className="font-serif text-[18px] text-[#2a1c12]">
                                {msg.response.is_serious
                                  ? "Serious Matter — Contact a Verified Advocate"
                                  : "Need Personal Advice? Contact an Advocate"}
                              </h3>
                            </div>
                            {msg.response.is_serious && (
                              <span className="px-2 py-0.5 bg-[#2a1c12] text-[#fffaf2] font-mono text-[10.5px] uppercase tracking-[0.06em] rounded-[2px]">
                                Priority Escalation
                              </span>
                            )}
                          </div>

                          {msg.response.seriousness_reason && (
                            <div className="bg-[#f4efe6] border border-[#d1a46a] rounded-[2px] p-3 text-[13px] text-[#2a1c12]">
                              <strong>Why advocate review is advised:</strong>{" "}
                              {msg.response.seriousness_reason}
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {msg.response.advocate_contacts.map((adv) => (
                              <div
                                key={adv.id}
                                className="bg-[#f4efe6]/70 border border-[#e2d5c1] rounded-[2px] p-4 space-y-2.5 flex flex-col justify-between"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <h4 className="font-serif text-[17.5px] text-[#2a1c12]">
                                        {adv.name}
                                      </h4>
                                      <p className="text-[12px] font-medium text-[#9a6a35]">
                                        {adv.primary_practice}
                                      </p>
                                    </div>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#fffaf2] border border-[#d1a46a] rounded-[2px] text-[10.5px] font-mono text-[#2a1c12]">
                                      <CheckCircle2 className="h-3 w-3 text-[#9a6a35]" />
                                      Verified
                                    </span>
                                  </div>

                                  <div className="space-y-1 text-[12.5px] text-[#4a392b]">
                                    <p className="flex items-start gap-2">
                                      <Award className="h-3.5 w-3.5 text-[#9a6a35] shrink-0 mt-0.5" />
                                      <span>
                                        <strong>Qualifications:</strong> {adv.qualifications}
                                      </span>
                                    </p>
                                    <p className="flex items-start gap-2">
                                      <Scale className="h-3.5 w-3.5 text-[#9a6a35] shrink-0 mt-0.5" />
                                      <span>
                                        <strong>Bar Council ID:</strong>{" "}
                                        <span className="font-mono text-[11.5px]">
                                          {adv.bar_council_id}
                                        </span>{" "}
                                        ({adv.bar_council_name})
                                      </span>
                                    </p>
                                    <p className="flex items-start gap-2">
                                      <MapPin className="h-3.5 w-3.5 text-[#9a6a35] shrink-0 mt-0.5" />
                                      <span>
                                        <strong>Courts &amp; City:</strong> {adv.courts.join(", ")} ·{" "}
                                        {adv.city} ({adv.experience_years} yrs)
                                      </span>
                                    </p>
                                  </div>
                                </div>

                                <div className="pt-2.5 border-t border-[#e2d5c1] flex flex-wrap items-center justify-between gap-2">
                                  <a
                                    href={`tel:${adv.phone.replace(/\s+/g, "")}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2a1c12] text-[#fffaf2] hover:bg-[#9a6a35] transition-colors rounded-[2px] text-[12.5px] font-semibold"
                                  >
                                    <Phone className="h-3.5 w-3.5" />
                                    {adv.phone}
                                  </a>

                                  <Link
                                    href="/contact"
                                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#2a1c12] text-[#2a1c12] hover:bg-[#2a1c12] hover:text-[#fffaf2] transition-colors rounded-[2px] text-[12px] font-semibold"
                                  >
                                    Contact Us
                                    <ArrowRight className="h-3 w-3" />
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </div>

                          <p className="text-[11.5px] leading-[1.5] text-[#705c49]">
                            {msg.response.disclaimer} Advocates are displayed strictly on objective
                            credentials without paid placement (BCI Rule 36).
                          </p>
                        </div>
                      </>
                    )}
                  </section>
                </div>
              )
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* ChatGPT-Style Composer Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="sticky bottom-3 z-20 bg-[#fffaf2] border border-[#2a1c12]/25 rounded-[2px] p-4 shadow-md space-y-3"
        >
          {attachment && (
            <div className="flex items-center justify-between gap-2 bg-[#f4efe6] border border-[#d1a46a] rounded-[2px] px-3 py-2 text-[12.5px]">
              <div className="flex items-center gap-2 truncate">
                <FileText className="h-4 w-4 text-[#9a6a35] shrink-0" />
                <span className="font-medium truncate">{attachment.file_name}</span>
                <span className="font-mono text-[11px] text-[#705c49]">
                  ({attachment.page_count}p · {attachment.engine_name})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                aria-label="Remove attachment"
                className="text-[#705c49] hover:text-[#2a1c12]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <textarea
            id="ask-me-input"
            rows={2}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={
              messages.length > 0
                ? "Ask a follow-up question (e.g., What if 30 days already passed?)..."
                : "Describe your legal problem or attach a notice/photo (Enter to send, Shift+Enter for new line)..."
            }
            className="w-full bg-[#f4efe6]/60 border border-[#e2d5c1] focus:border-[#9a6a35] focus:outline-none rounded-[2px] p-3 text-[14px] leading-[1.5] text-[#2a1c12] placeholder:text-[#8c7763] resize-none"
          />

          {speechError && (
            <div className="text-[12px] text-[#8a3b22] bg-[#f4efe6] border border-[#d1a46a] rounded-[2px] px-3 py-1.5">
              {speechError}
            </div>
          )}

          {submitError && (
            <div className="text-[12px] text-[#8a3b22] bg-[#f4efe6] border border-[#d1a46a] rounded-[2px] px-3 py-1.5">
              {submitError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                disabled={isUploading || isStreaming}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#f4efe6] border border-[#e2d5c1] hover:border-[#2a1c12] text-[#2a1c12] rounded-[2px] text-[12.5px] font-semibold transition-colors disabled:opacity-60"
              >
                {isUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#9a6a35]" />
                ) : (
                  <Paperclip className="h-3.5 w-3.5 text-[#9a6a35]" />
                )}
                Attach Notice / Photo
              </button>

              <button
                type="button"
                onClick={handleToggleSpeech}
                className={`inline-flex items-center gap-1.5 px-3 py-2 border rounded-[2px] text-[12.5px] font-semibold transition-colors ${
                  isListening
                    ? "bg-[#9a6a35] border-[#9a6a35] text-[#fffaf2]"
                    : "bg-[#f4efe6] border-[#e2d5c1] hover:border-[#2a1c12] text-[#2a1c12]"
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="h-3.5 w-3.5 animate-pulse" />
                    Stop Voice
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5 text-[#9a6a35]" />
                    Speak
                  </>
                )}
              </button>

              <select
                aria-label="Preferred language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as "en" | "hi" | "kn")}
                className="bg-[#f4efe6] border border-[#e2d5c1] rounded-[2px] px-2.5 py-2 text-[12.5px] font-medium text-[#2a1c12] focus:outline-none focus:border-[#9a6a35]"
              >
                {SPEECH_LANGS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isStreaming}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#2a1c12] text-[#fffaf2] hover:bg-[#9a6a35] disabled:opacity-60 transition-colors rounded-[2px] text-[13.5px] font-semibold"
            >
              {isStreaming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Responding…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send
                </>
              )}
            </button>
          </div>
        </form>
      </Container>
    </div>
  );
}
