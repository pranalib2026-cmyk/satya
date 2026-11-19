"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Lock,
  RotateCcw,
  ShieldCheck,
  User,
  Briefcase,
} from "lucide-react";
import { useAuth, DEMO_OTP } from "@/lib/auth-context";
import type { Language } from "@/types/citizen";
import { Logo } from "@/components/ui/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export default function LoginPage() {
  const router = useRouter();
  const { loginCitizen, loginAdvocate, loginWithEmail, completeOnboarding } = useAuth();

  // Role selector: citizen vs advocate
  const [activeRole, setActiveRole] = useState<"citizen" | "advocate">("citizen");

  // Authentication method: 'otp' vs 'password'
  const [authMethod, setAuthMethod] = useState<"otp" | "password">("otp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Citizen flow stages: 'phone' -> 'otp' -> 'onboarding'
  const [stage, setStage] = useState<"phone" | "otp" | "onboarding">("phone");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // OTP state
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [seconds, setSeconds] = useState(30);
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Onboarding state
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("en");
  const [readDisclaimer, setReadDisclaimer] = useState(false);
  const [consents, setConsents] = useState({
    dpdp: false,
    information: false,
    improve: true,
  });

  // Advocate login state
  const [barEnrolment, setBarEnrolment] = useState("");
  const [advocatePhone, setAdvocatePhone] = useState("");
  const [advocateOtpStep, setAdvocateOtpStep] = useState(false);
  const [advocateDigits, setAdvocateDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const advocateDigitRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Timer for OTP resend
  useEffect(() => {
    if (stage !== "otp" && !advocateOtpStep) return;
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds, stage, advocateOtpStep]);

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const clean = phone.replace(/\D/g, "");
    if (clean.length < 10) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSeconds(30);
      setDigits(["", "", "", "", "", ""]);
      setStage("otp");
      setTimeout(() => digitRefs.current[0]?.focus(), 100);
    }, 400);
  };

  const handleEmailLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Please provide both email address and password.");
      return;
    }
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpDigit = (index: number, val: string) => {
    const clean = val.replace(/\D/g, "");
    if (!clean) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }

    if (clean.length > 1) {
      const pasteDigits = clean.slice(0, 6).split("");
      const next = [...digits];
      pasteDigits.forEach((d, i) => (next[i] = d));
      setDigits(next);
      const targetFocus = Math.min(pasteDigits.length, 5);
      digitRefs.current[targetFocus]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (index < 5 && clean) {
      digitRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const otpValue = digits.join("");
    if (otpValue.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      await loginCitizen(phone || "98450 12345", otpValue);
      const previouslyOnboarded = typeof window !== "undefined" && localStorage.getItem("nyayasetu_onboarded") === "true";
      if (previouslyOnboarded) {
        router.push("/dashboard");
      } else {
        setStage("onboarding");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to verify OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdvocateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!barEnrolment.trim()) {
      setError("Please enter your State Bar Council Enrolment Number.");
      return;
    }
    const clean = advocatePhone.replace(/\D/g, "");
    if (clean.length < 10) {
      setError("Please enter your registered 10-digit mobile number.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setAdvocateOtpStep(true);
      setSeconds(30);
      setTimeout(() => advocateDigitRefs.current[0]?.focus(), 100);
    }, 400);
  };

  const handleAdvocateOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const otp = advocateDigits.join("");
    if (otp.length !== 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }
    setLoading(true);
    try {
      await loginAdvocate(barEnrolment, advocatePhone, otp);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to verify advocate credentials.");
    } finally {
      setLoading(false);
    }
  };

  const finishCitizenOnboarding = () => {
    completeOnboarding(selectedLanguage);
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#f4efe6] text-[#2a1c12] flex flex-col justify-between selection:bg-[#2a1c12] selection:text-[#fffaf2]">
      {/* Top Header Bar */}
      <header className="w-full border-b border-[#e2d5c1] bg-[#f4efe6]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 lg:px-12 h-18">
          <Logo size="md" href="/" />

          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-sans uppercase tracking-[0.12em] font-medium text-[#5b4a3b] hover:text-[#2a1c12] transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Centered Content */}
      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-[500px]">
          {/* Card Container */}
          <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-7 sm:p-10 shadow-[0_8px_30px_rgba(42,28,18,0.06)] transition-all">
            {/* Role Selector Tabs */}
            {stage !== "onboarding" && (
              <div className="mb-7 grid grid-cols-2 gap-1 border border-[#e2d5c1] bg-[#ebe1d1]/50 p-1 rounded-[2px]">
                <button
                  type="button"
                  onClick={() => {
                    setActiveRole("citizen");
                    setError("");
                  }}
                  className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-sans uppercase tracking-[0.12em] font-medium transition cursor-pointer rounded-[2px] ${
                    activeRole === "citizen"
                      ? "bg-[#2a1c12] text-[#fffaf2] shadow-xs"
                      : "text-[#5b4a3b] hover:text-[#2a1c12]"
                  }`}
                >
                  <User className="size-3.5" />
                  <span>Citizen · नागरिक</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveRole("advocate");
                    setError("");
                  }}
                  className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-sans uppercase tracking-[0.12em] font-medium transition cursor-pointer rounded-[2px] ${
                    activeRole === "advocate"
                      ? "bg-[#2a1c12] text-[#fffaf2] shadow-xs"
                      : "text-[#5b4a3b] hover:text-[#2a1c12]"
                  }`}
                >
                  <Briefcase className="size-3.5" />
                  <span>Advocate · अधिवक्ता</span>
                </button>
              </div>
            )}

            {/* CITIZEN FLOW */}
            {activeRole === "citizen" && (
              <>
                {/* 1. Phone stage */}
                {stage === "phone" && (
                  <div>
                    <div className="space-y-1.5 mb-6">
                      <Badge variant="stamp">Citizen Access</Badge>
                      <h1 className="font-serif text-[28px] sm:text-[32px] font-normal tracking-tight text-[#2a1c12] leading-tight">
                        Sign In to NyayaSetu
                      </h1>
                      <p className="text-xs sm:text-[13.5px] text-[#5b4a3b] leading-relaxed">
                        Access AI preliminary case assessments, verified advocate matches, and your matter ledger.
                      </p>
                    </div>

                    {/* Method Selector Tabs */}
                    <div className="flex border-b border-[#e2d5c1] mb-5">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMethod("otp");
                          setError("");
                        }}
                        className={`pb-2.5 text-xs font-sans uppercase tracking-[0.12em] font-medium transition cursor-pointer mr-6 border-b-2 ${
                          authMethod === "otp"
                            ? "border-[#9a6a35] text-[#2a1c12]"
                            : "border-transparent text-[#85725f] hover:text-[#2a1c12]"
                        }`}
                      >
                        Mobile OTP
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMethod("password");
                          setError("");
                        }}
                        className={`pb-2.5 text-xs font-sans uppercase tracking-[0.12em] font-medium transition cursor-pointer border-b-2 ${
                          authMethod === "password"
                            ? "border-[#9a6a35] text-[#2a1c12]"
                            : "border-transparent text-[#85725f] hover:text-[#2a1c12]"
                        }`}
                      >
                        Email & Password
                      </button>
                    </div>

                    {authMethod === "otp" ? (
                      <form onSubmit={handlePhoneSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                          <label
                            htmlFor="phone"
                            className="block text-xs font-sans uppercase tracking-[0.12em] font-medium text-[#5b4a3b]"
                          >
                            Indian Mobile Number
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-semibold text-[#5b4a3b] font-mono">
                              +91
                            </span>
                            <input
                              id="phone"
                              inputMode="numeric"
                              autoComplete="tel"
                              placeholder="98450 12345"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, "").slice(0, 12))}
                              className="flex h-11 w-full rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] pl-12 pr-4 py-2 text-sm text-[#2a1c12] placeholder:text-[#85725f]/60 transition-colors focus:border-[#9a6a35] focus:outline-none focus:ring-1 focus:ring-[#9a6a35]"
                              autoFocus
                            />
                          </div>
                          <p className="text-[11px] text-[#85725f]">
                            A 6-digit verification code will be sent to confirm your identity.
                          </p>
                        </div>

                        {error && (
                          <div className="rounded-[2px] border border-[#c0392b]/30 bg-[#fdf2f0] p-3 text-xs text-[#c0392b] font-medium">
                            {error}
                          </div>
                        )}

                        <Button
                          type="submit"
                          variant="compound"
                          size="md"
                          fullWidth
                          isLoading={loading}
                        >
                          Continue with Mobile OTP
                        </Button>

                        <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-[#85725f]">
                          <Lock className="size-3 text-[#9a6a35]" aria-hidden="true" />
                          <span>Protected by Digital Personal Data Protection Act, 2023</span>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleEmailLoginSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                          <label
                            htmlFor="email"
                            className="block text-xs font-sans uppercase tracking-[0.12em] font-medium text-[#5b4a3b]"
                          >
                            Email Address
                          </label>
                          <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            placeholder="citizen@nyayasetu.in"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="flex h-11 w-full rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] px-3.5 py-2 text-sm text-[#2a1c12] placeholder:text-[#85725f]/60 transition-colors focus:border-[#9a6a35] focus:outline-none focus:ring-1 focus:ring-[#9a6a35]"
                            required
                            autoFocus
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label
                            htmlFor="password"
                            className="block text-xs font-sans uppercase tracking-[0.12em] font-medium text-[#5b4a3b]"
                          >
                            Password
                          </label>
                          <input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            placeholder="••••••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="flex h-11 w-full rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] px-3.5 py-2 text-sm text-[#2a1c12] placeholder:text-[#85725f]/60 transition-colors focus:border-[#9a6a35] focus:outline-none focus:ring-1 focus:ring-[#9a6a35]"
                            required
                          />
                        </div>

                        {error && (
                          <div className="rounded-[2px] border border-[#c0392b]/30 bg-[#fdf2f0] p-3 text-xs text-[#c0392b] font-medium">
                            {error}
                          </div>
                        )}

                        <Button
                          type="submit"
                          variant="compound"
                          size="md"
                          fullWidth
                          isLoading={loading}
                        >
                          Sign In with Credentials
                        </Button>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEmail("citizen@nyayasetu.in");
                              setPassword("CitizenPassword2026");
                              setError("");
                            }}
                            className="text-[11px] text-[#9a6a35] hover:underline cursor-pointer"
                          >
                            Quick-Fill Demo Citizen
                          </button>
                          <span className="text-[#e2d5c1]">|</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEmail("advocate@nyayasetu.in");
                              setPassword("AdvocatePassword2026");
                              setError("");
                            }}
                            className="text-[11px] text-[#9a6a35] hover:underline cursor-pointer"
                          >
                            Quick-Fill Demo Advocate
                          </button>
                        </div>

                        <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-[#85725f]">
                          <Lock className="size-3 text-[#9a6a35]" aria-hidden="true" />
                          <span>Protected by Digital Personal Data Protection Act, 2023</span>
                        </div>
                      </form>
                    )}

                    {/* Demo Access Callout */}
                    <div className="mt-6 pt-5 border-t border-[#e2d5c1] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-sans uppercase tracking-[0.12em] font-semibold text-[#2a1c12]">
                          Evaluation Credentials
                        </span>
                        <Badge variant="gold">Demo Build</Badge>
                      </div>
                      <p className="text-xs text-[#5b4a3b] leading-relaxed">
                        Enter any 10-digit number. When prompted for the OTP, submit{" "}
                        <strong className="text-[#2a1c12] font-mono font-semibold">{DEMO_OTP}</strong>.
                      </p>
                    </div>

                    <div className="mt-5 text-center">
                      <button
                        type="button"
                        onClick={() => setTermsOpen(true)}
                        className="text-xs text-[#85725f] hover:text-[#2a1c12] underline underline-offset-4 transition-colors cursor-pointer"
                      >
                        Review Platform Terms & Statutory Privacy Policy
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. OTP stage */}
                {stage === "otp" && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setStage("phone")}
                      className="mb-5 inline-flex items-center gap-1.5 text-xs font-sans uppercase tracking-[0.12em] font-medium text-[#5b4a3b] hover:text-[#2a1c12] transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="size-3.5" />
                      <span>Change Mobile Number</span>
                    </button>

                    <div className="space-y-1.5 mb-6">
                      <Badge variant="stamp">Identity Verification</Badge>
                      <h1 className="font-serif text-[28px] sm:text-[32px] font-normal tracking-tight text-[#2a1c12] leading-tight">
                        Enter One-Time Password
                      </h1>
                      <p className="text-xs sm:text-[13.5px] text-[#5b4a3b] leading-relaxed">
                        We sent a 6-digit authentication code to{" "}
                        <strong className="font-mono text-[#2a1c12]">+91 {phone || "98450 12345"}</strong>.
                      </p>
                    </div>

                    <form onSubmit={handleOtpSubmit} className="space-y-5">
                      <div className="flex justify-between gap-2" role="group" aria-label="One-time password">
                        {digits.map((digit, i) => (
                          <input
                            key={i}
                            ref={(el) => {
                              digitRefs.current[i] = el;
                            }}
                            value={digit}
                            onChange={(e) => handleOtpDigit(i, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(i, e)}
                            inputMode="numeric"
                            maxLength={1}
                            className="h-12 w-11 sm:w-12 rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] text-center font-mono text-[20px] font-bold text-[#2a1c12] transition focus:border-[#9a6a35] focus:outline-none focus:ring-1 focus:ring-[#9a6a35]"
                          />
                        ))}
                      </div>

                      {error && (
                        <div className="rounded-[2px] border border-[#c0392b]/30 bg-[#fdf2f0] p-3 text-xs text-[#c0392b] font-medium">
                          {error}
                        </div>
                      )}

                      <Button
                        type="submit"
                        variant="compound"
                        size="md"
                        fullWidth
                        isLoading={loading}
                      >
                        Verify and Enter Portal
                      </Button>

                      <div className="flex items-center justify-between text-xs text-[#5b4a3b] pt-1">
                        <span>Didn&apos;t receive the code?</span>
                        {seconds > 0 ? (
                          <span className="font-mono text-[#85725f]">Resend in {seconds}s</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSeconds(30);
                              setDigits(["", "", "", "", "", ""]);
                            }}
                            className="inline-flex items-center gap-1 font-semibold text-[#9a6a35] hover:underline cursor-pointer"
                          >
                            <RotateCcw className="size-3" /> Resend Code
                          </button>
                        )}
                      </div>
                    </form>

                    <div className="mt-6 pt-4 border-t border-[#e2d5c1] flex items-center justify-between text-xs text-[#85725f]">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="size-4 text-[#9a6a35]" /> Demo code:
                      </span>
                      <strong className="font-mono text-[#2a1c12]">{DEMO_OTP}</strong>
                    </div>
                  </div>
                )}

                {/* 3. Onboarding stage */}
                {stage === "onboarding" && (
                  <div>
                    {/* Step indicator */}
                    <div className="mb-6 pb-4 border-b border-[#e2d5c1] flex items-center justify-between">
                      <div className="flex items-center gap-1.5" aria-label={`Step ${onboardingStep + 1} of 3`}>
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className={`h-1 rounded-[1px] transition-all ${
                              i === onboardingStep
                                ? "w-7 bg-[#9a6a35]"
                                : i < onboardingStep
                                ? "w-2.5 bg-[#2e7d32]"
                                : "w-2.5 bg-[#e2d5c1]"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs font-sans uppercase tracking-[0.14em] text-[#85725f] font-medium">
                        Step {onboardingStep + 1} of 3
                      </span>
                    </div>

                    {/* Step 0: Language Preference */}
                    {onboardingStep === 0 && (
                      <div className="space-y-5">
                        <div className="space-y-1.5">
                          <Badge variant="stamp">Language Selection</Badge>
                          <h1 className="font-serif text-[26px] sm:text-[30px] font-normal tracking-tight text-[#2a1c12] leading-tight">
                            Choose Your Preferred Language
                          </h1>
                          <p className="text-xs sm:text-[13.5px] text-[#5b4a3b] leading-relaxed">
                            Navigation and legal information adapt to your choice. You may switch at any time.
                          </p>
                        </div>

                        <div className="space-y-2">
                          {[
                            { id: "en", label: "English", sub: "National Court Language" },
                            { id: "hi", label: "हिन्दी", sub: "Hindi" },
                            { id: "kn", label: "ಕನ್ನಡ", sub: "Kannada" },
                          ].map((lang) => (
                            <button
                              key={lang.id}
                              type="button"
                              onClick={() => setSelectedLanguage(lang.id as Language)}
                              className={`flex w-full items-center justify-between p-3.5 border rounded-[2px] transition-all text-left cursor-pointer ${
                                selectedLanguage === lang.id
                                  ? "border-[#2a1c12] bg-[#ebe1d1]/40"
                                  : "border-[#e2d5c1] bg-[#fffaf2] hover:border-[#cfbe9e]"
                              }`}
                            >
                              <div>
                                <span className="block text-sm font-semibold text-[#2a1c12]">{lang.label}</span>
                                <span className="block text-xs text-[#85725f]">{lang.sub}</span>
                              </div>
                              <span
                                className={`grid size-5 place-items-center rounded-full border ${
                                  selectedLanguage === lang.id
                                    ? "border-[#2a1c12] bg-[#2a1c12] text-[#fffaf2]"
                                    : "border-[#e2d5c1]"
                                }`}
                              >
                                {selectedLanguage === lang.id && <Check className="size-3" />}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Step 1: Legal Disclaimer */}
                    {onboardingStep === 1 && (
                      <div className="space-y-5">
                        <div className="space-y-1.5">
                          <Badge variant="stamp">Statutory Disclaimer</Badge>
                          <h1 className="font-serif text-[26px] sm:text-[30px] font-normal tracking-tight text-[#2a1c12] leading-tight">
                            Nature of Platform Services
                          </h1>
                          <p className="text-xs sm:text-[13.5px] text-[#5b4a3b] leading-relaxed">
                            Please review these essential legal boundaries before proceeding.
                          </p>
                        </div>

                        <div className="space-y-3 text-xs text-[#5b4a3b] leading-relaxed">
                          <div className="rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 p-3.5 space-y-1">
                            <p className="font-semibold text-[#2a1c12] uppercase tracking-[0.08em] text-[11px]">
                              1. Legal Information, Not Legal Advice
                            </p>
                            <p>
                              NyayaSetu provides automated statutory summaries and structured triage. Submitting an intake
                              does not create an advocate-client relationship.
                            </p>
                          </div>
                          <div className="rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 p-3.5 space-y-1">
                            <p className="font-semibold text-[#2a1c12] uppercase tracking-[0.08em] text-[11px]">
                              2. Bar Council of India Rule 36 Compliance
                            </p>
                            <p>
                              Advocate listings represent verified directories based on State Bar rolls. Consultations are
                              scheduled solely on citizen initiative without advertising or solicitation.
                            </p>
                          </div>
                        </div>

                        <label className="flex items-start gap-3 rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-3.5 cursor-pointer hover:border-[#cfbe9e]">
                          <input
                            type="checkbox"
                            checked={readDisclaimer}
                            onChange={(e) => setReadDisclaimer(e.target.checked)}
                            className="mt-0.5 size-4 rounded-[2px] border-[#e2d5c1] accent-[#9a6a35]"
                          />
                          <span className="text-xs leading-relaxed text-[#2a1c12] font-medium">
                            I understand that NyayaSetu provides legal information and triage, and does not replace qualified advocate representation.
                          </span>
                        </label>
                      </div>
                    )}

                    {/* Step 2: DPDP Privacy Choices */}
                    {onboardingStep === 2 && (
                      <div className="space-y-5">
                        <div className="space-y-1.5">
                          <Badge variant="stamp">Privacy & DPDP Act, 2023</Badge>
                          <h1 className="font-serif text-[26px] sm:text-[30px] font-normal tracking-tight text-[#2a1c12] leading-tight">
                            Data Processing Consent
                          </h1>
                          <p className="text-xs sm:text-[13.5px] text-[#5b4a3b] leading-relaxed">
                            Under the Digital Personal Data Protection Act, you maintain full control of your facts and documents.
                          </p>
                        </div>

                        <div className="space-y-3">
                          <label className="flex items-start gap-3 rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-3.5 cursor-pointer hover:border-[#cfbe9e]">
                            <input
                              type="checkbox"
                              checked={consents.dpdp}
                              onChange={(e) => setConsents({ ...consents, dpdp: e.target.checked })}
                              className="mt-0.5 size-4 rounded-[2px] border-[#e2d5c1] accent-[#9a6a35]"
                            />
                            <div className="text-xs">
                              <span className="block font-semibold text-[#2a1c12]">Consent to Processing Case Facts</span>
                              <span className="block text-[#5b4a3b] mt-0.5 leading-relaxed">
                                Used strictly to compute limitation periods, match jurisdiction, and draft preliminary briefs.
                              </span>
                            </div>
                          </label>

                          <label className="flex items-start gap-3 rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-3.5 cursor-pointer hover:border-[#cfbe9e]">
                            <input
                              type="checkbox"
                              checked={consents.information}
                              onChange={(e) => setConsents({ ...consents, information: e.target.checked })}
                              className="mt-0.5 size-4 rounded-[2px] border-[#e2d5c1] accent-[#9a6a35]"
                            />
                            <div className="text-xs">
                              <span className="block font-semibold text-[#2a1c12]">Accuracy Confirmation</span>
                              <span className="block text-[#5b4a3b] mt-0.5 leading-relaxed">
                                I confirm the information provided is accurate for assessment and timeline computations.
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Step Navigation Buttons */}
                    <div className="mt-7 pt-4 border-t border-[#e2d5c1] flex items-center justify-between gap-3">
                      {onboardingStep > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setOnboardingStep((s) => s - 1)}
                        >
                          <ArrowLeft className="size-3.5 mr-1" /> Back
                        </Button>
                      ) : (
                        <div />
                      )}
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          if (onboardingStep < 2) {
                            setOnboardingStep((s) => s + 1);
                          } else {
                            finishCitizenOnboarding();
                          }
                        }}
                        disabled={
                          (onboardingStep === 1 && !readDisclaimer) ||
                          (onboardingStep === 2 && (!consents.dpdp || !consents.information))
                        }
                      >
                        {onboardingStep === 2 ? "Complete Setup & Enter" : "Proceed"}
                        <ArrowRight className="size-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ADVOCATE FLOW */}
            {activeRole === "advocate" && (
              <div>
                <div className="space-y-1.5 mb-6">
                  <Badge variant="stamp">Advocate Portal</Badge>
                  <h1 className="font-serif text-[28px] sm:text-[32px] font-normal tracking-tight text-[#2a1c12] leading-tight">
                    Advocate Sign In
                  </h1>
                  <p className="text-xs sm:text-[13.5px] text-[#5b4a3b] leading-relaxed">
                    Verified access for advocates enrolled with State Bar Councils across India.
                  </p>
                </div>

                {!advocateOtpStep ? (
                  <form onSubmit={handleAdvocateSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-sans uppercase tracking-[0.12em] font-medium text-[#5b4a3b]">
                        State Bar Council Enrolment Number
                      </label>
                      <input
                        placeholder="e.g. KAR/1482/2014 or D/4521/2018"
                        value={barEnrolment}
                        onChange={(e) => setBarEnrolment(e.target.value.toUpperCase())}
                        className="flex h-11 w-full rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] px-3.5 py-2 text-sm font-mono text-[#2a1c12] placeholder:text-[#85725f]/60 transition-colors focus:border-[#9a6a35] focus:outline-none focus:ring-1 focus:ring-[#9a6a35]"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-sans uppercase tracking-[0.12em] font-medium text-[#5b4a3b]">
                        Registered Mobile Number
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-semibold text-[#5b4a3b] font-mono">
                          +91
                        </span>
                        <input
                          placeholder="98450 12345"
                          value={advocatePhone}
                          onChange={(e) => setAdvocatePhone(e.target.value.replace(/[^\d\s]/g, ""))}
                          className="flex h-11 w-full rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] pl-12 pr-4 py-2 text-sm text-[#2a1c12] placeholder:text-[#85725f]/60 transition-colors focus:border-[#9a6a35] focus:outline-none focus:ring-1 focus:ring-[#9a6a35]"
                          required
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="rounded-[2px] border border-[#c0392b]/30 bg-[#fdf2f0] p-3 text-xs text-[#c0392b] font-medium">
                        {error}
                      </div>
                    )}

                    <Button
                      type="submit"
                      variant="compound"
                      size="md"
                      fullWidth
                      isLoading={loading}
                    >
                      Authenticate Credentials
                    </Button>

                    <div className="mt-4 rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 p-3 text-xs text-[#5b4a3b] space-y-1">
                      <p className="font-semibold text-[#2a1c12] uppercase tracking-[0.08em] text-[11px]">
                        Bar Council of India Rule 36 Compliance
                      </p>
                      <p className="text-[11.5px] leading-relaxed">
                        Advocate listings are informative directories based on verified State Bar rolls and do not constitute advertising or solicitation.
                      </p>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleAdvocateOtpSubmit} className="space-y-5">
                    <p className="text-xs sm:text-[13.5px] text-[#5b4a3b]">
                      Enter the 6-digit verification code sent to your registered mobile.
                    </p>
                    <div className="flex justify-between gap-2">
                      {advocateDigits.map((digit, i) => (
                        <input
                          key={i}
                          ref={(el) => {
                            advocateDigitRefs.current[i] = el;
                          }}
                          value={digit}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            const next = [...advocateDigits];
                            next[i] = val.slice(-1);
                            setAdvocateDigits(next);
                            if (val && i < 5) advocateDigitRefs.current[i + 1]?.focus();
                          }}
                          maxLength={1}
                          className="h-12 w-11 rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] text-center font-mono text-[20px] font-bold text-[#2a1c12] focus:border-[#9a6a35] focus:outline-none focus:ring-1 focus:ring-[#9a6a35]"
                        />
                      ))}
                    </div>

                    {error && (
                      <div className="rounded-[2px] border border-[#c0392b]/30 bg-[#fdf2f0] p-3 text-xs text-[#c0392b]">
                        {error}
                      </div>
                    )}

                    <Button
                      type="submit"
                      variant="compound"
                      size="md"
                      fullWidth
                      isLoading={loading}
                    >
                      Enter Advocate Workspace
                    </Button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Statutory Helplines Strip */}
          <div className="mt-6 grid grid-cols-3 gap-2.5 text-center text-xs">
            <div className="border border-[#e2d5c1] bg-[#fffaf2] p-2.5 rounded-[2px]">
              <p className="font-mono font-bold text-[#2a1c12] text-sm">112</p>
              <p className="text-[10.5px] text-[#85725f] uppercase tracking-[0.06em]">Emergency</p>
            </div>
            <div className="border border-[#e2d5c1] bg-[#fffaf2] p-2.5 rounded-[2px]">
              <p className="font-mono font-bold text-[#2a1c12] text-sm">181</p>
              <p className="text-[10.5px] text-[#85725f] uppercase tracking-[0.06em]">Women Helpline</p>
            </div>
            <div className="border border-[#e2d5c1] bg-[#fffaf2] p-2.5 rounded-[2px]">
              <p className="font-mono font-bold text-[#2a1c12] text-sm">15100</p>
              <p className="text-[10.5px] text-[#85725f] uppercase tracking-[0.06em]">Free Legal Aid</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Strip */}
      <footer className="w-full border-t border-[#e2d5c1] py-4 text-center text-xs text-[#85725f]">
        NyayaSetu (न्यायसेतु) Bharat · Established 2026 · Bar Council of India Rule 36 Compliant
      </footer>

      {/* TERMS & PRIVACY MODAL */}
      <Modal
        isOpen={termsOpen}
        onClose={() => setTermsOpen(false)}
        title="Terms of Use and Statutory Privacy Policy"
        description="Plain-language summary of your legal rights on NyayaSetu."
        size="md"
        footer={
          <Button variant="primary" size="sm" onClick={() => setTermsOpen(false)}>
            Acknowledge & Close
          </Button>
        }
      >
        <div className="space-y-4 text-xs sm:text-[13px] leading-relaxed text-[#5b4a3b]">
          <section className="space-y-1">
            <h4 className="font-semibold text-[#2a1c12] uppercase tracking-[0.08em] text-[11px]">
              1. Legal Information, Not Legal Advice
            </h4>
            <p>
              NyayaSetu explains Indian statutes and helps you organize next steps. It does not act as your advocate,
              does not create an advocate–client relationship, and does not guarantee an outcome. For formal advice on your
              specific matter, speak to a verified advocate or free legal aid.
            </p>
          </section>

          <section className="space-y-1">
            <h4 className="font-semibold text-[#2a1c12] uppercase tracking-[0.08em] text-[11px]">
              2. Data Protection & DPDP Act, 2023
            </h4>
            <p>
              Your mobile number for sign-in, the facts you choose to share, documents you upload and messages you
              send are stored securely. Document and brief sharing is always explicit, time-limited, and revocable.
            </p>
          </section>

          <section className="space-y-1">
            <h4 className="font-semibold text-[#2a1c12] uppercase tracking-[0.08em] text-[11px]">
              3. Emergency Situations
            </h4>
            <p>
              If someone is in immediate physical danger, call 112 directly. Do not wait for an automated online assessment.
            </p>
          </section>
        </div>
      </Modal>
    </div>
  );
}
