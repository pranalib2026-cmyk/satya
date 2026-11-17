"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe2,
  Lock,
  Phone,
  RotateCcw,
  Scale,
  ShieldCheck,
  Sparkles,
  User,
  Briefcase,
  X,
} from "lucide-react";
import { useAuth, DEMO_OTP } from "@/lib/auth-context";
import type { Language } from "@/types/citizen";

export default function LoginPage() {
  const router = useRouter();
  const { loginCitizen, loginAdvocate, completeOnboarding } = useAuth();

  // Role selector: citizen vs advocate
  const [activeRole, setActiveRole] = useState<"citizen" | "advocate">("citizen");

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
    <div className="grid h-dvh overflow-hidden bg-[#fffaf2] lg:grid-cols-[1.05fr_1fr]">
      {/* LEFT COLUMN: Legal-1 Brand Showcase (NyayaSetu Theme) */}
      <div className="relative hidden overflow-hidden bg-[#24180f] p-8 text-[#fffaf2] lg:flex lg:flex-col lg:justify-between xl:p-10">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-white/5" aria-hidden="true" />
        <div className="absolute -bottom-32 -left-16 size-80 rounded-full bg-white/5" aria-hidden="true" />

        <div className="relative z-10 flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-[#9a6a35] text-[#fffaf2] shadow-[0_2px_8px_rgba(154,106,53,0.35)]">
            <Scale className="size-5" strokeWidth={2.4} aria-hidden="true" />
          </span>
          <span className="font-serif text-xl font-bold tracking-tight text-[#fffaf2]">
            NyayaSetu <span className="font-sans text-xs font-normal text-[#d1a46a] ml-1">न्यायसेतु</span>
          </span>
        </div>

        <div className="relative z-10 max-w-md">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold tracking-[0.12em] uppercase text-[#d1a46a]">
            <span className="size-1.5 rounded-full bg-[#82b380]" aria-hidden="true" /> India · 3 languages
          </p>
          <h2 className="font-serif text-[40px] leading-[1.08] font-normal tracking-tight text-[#fffaf2]">
            Understand your rights. Find the right next step.
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-white/80">
            Clear legal information, honest triage, and verified advocates — matched by court, language and budget.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-3 text-[12px]">
          {[
            ["112", "Emergency"],
            ["181", "Women helpline"],
            ["15100", "Free legal aid"],
          ].map(([num, label]) => (
            <div key={num} className="rounded-2xl bg-white/10 px-3 py-3 backdrop-blur-sm border border-white/10">
              <p className="text-[18px] font-extrabold text-[#fffaf2] font-mono">{num}</p>
              <p className="mt-0.5 text-white/70 text-[11px]">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT COLUMN: Auth Container */}
      <div className="flex h-full min-h-0 flex-col bg-[#f3ece1]">
        {/* Mobile Header Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#e2d5c1] bg-[#fffaf2] px-5 py-2.5 lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-[#9a6a35] text-white">
              <Scale className="size-4" strokeWidth={2.2} aria-hidden="true" />
            </span>
            <span className="font-serif text-lg font-bold tracking-tight text-[#2a1c12]">NyayaSetu</span>
          </Link>
          <span className="text-[11px] font-semibold text-[#85725f]">Legal information only</span>
        </div>

        <main
          id="main-content"
          tabIndex={-1}
          className="flex flex-1 items-center justify-center overflow-y-auto px-5 py-6 sm:px-10 lg:px-14 xl:px-18"
        >
          <div className="w-full max-w-[420px]">
            {/* Dual Role Selector Tabs */}
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-[#e2d5c1] bg-[#ebe1d1] p-1">
              <button
                type="button"
                onClick={() => {
                  setActiveRole("citizen");
                  setError("");
                }}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 px-3 text-xs font-semibold transition cursor-pointer ${
                  activeRole === "citizen"
                    ? "bg-[#2a1c12] text-[#fffaf2] shadow-sm"
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
                className={`flex items-center justify-center gap-2 rounded-lg py-2 px-3 text-xs font-semibold transition cursor-pointer ${
                  activeRole === "advocate"
                    ? "bg-[#2a1c12] text-[#fffaf2] shadow-sm"
                    : "text-[#5b4a3b] hover:text-[#2a1c12]"
                }`}
              >
                <Briefcase className="size-3.5" />
                <span>Advocate · अधिवक्ता</span>
              </button>
            </div>

            {/* CITIZEN FLOW */}
            {activeRole === "citizen" && (
              <>
                {/* 1. Phone stage */}
                {stage === "phone" && (
                  <div className="animate-in-up">
                    <h1 className="text-[24px] leading-[1.2] font-extrabold sm:text-[28px] text-[#2a1c12]">
                      Sign in to NyayaSetu
                    </h1>
                    <p className="mt-1.5 text-[13.5px] leading-[22px] text-[#5b4a3b]">
                      Enter your mobile number to continue
                    </p>

                    <form onSubmit={handlePhoneSubmit} className="mt-5 space-y-3">
                      <div>
                        <label htmlFor="phone" className="block text-[13px] font-semibold text-[#2a1c12] mb-1.5">
                          Enter your mobile number
                        </label>
                        <p className="text-[12px] text-[#85725f] mb-1.5">
                          We will send a one-time password to verify it is you.
                        </p>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[14px] font-semibold text-[#5b4a3b]">
                            +91
                          </span>
                          <input
                            id="phone"
                            inputMode="numeric"
                            autoComplete="tel"
                            placeholder="98450 12345"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, "").slice(0, 12))}
                            className="w-full rounded-xl border border-[#e2d5c1] bg-[#fffaf2] pl-12 pr-3.5 py-2.5 text-[15px] text-[#2a1c12] placeholder:text-[#85725f]/70 focus:border-[#9a6a35] focus:ring-4 focus:ring-[#9a6a35]/10 focus:outline-none"
                            autoFocus
                          />
                        </div>
                      </div>

                      {error && (
                        <p className="rounded-lg bg-[#fdf2f0] px-3 py-2 text-[13px] font-medium text-[#c0392b] border border-[#f5c6cb]">
                          {error}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#9a6a35] hover:bg-[#7c5226] text-[#fffaf2] h-12 text-[15px] font-semibold transition cursor-pointer disabled:opacity-50"
                      >
                        {loading ? "Sending OTP…" : "Continue"}
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </button>

                      <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-[#85725f]">
                        <Lock className="size-3.5" aria-hidden="true" />
                        Your number is used only to sign you in.
                      </p>
                    </form>

                    <div className="mt-5 rounded-2xl border border-[#e2d5c1] bg-[#fffaf2] p-3 shadow-xs">
                      <p className="text-[11.5px] font-bold text-[#2a1c12]">Demo access</p>
                      <p className="mt-1 text-[12px] leading-[19px] text-[#5b4a3b]">
                        Use any valid mobile number. When asked for the OTP, enter <strong>{DEMO_OTP}</strong>.
                      </p>
                      <p className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-[#85725f]">
                        <Phone className="size-3.5" aria-hidden="true" /> SMS delivery is mocked for this build.
                      </p>
                    </div>

                    <p className="mt-4 text-center text-[11px] leading-5 text-[#85725f]">
                      By continuing you agree to our Terms of Use and Privacy Policy.{" "}
                      <button
                        type="button"
                        onClick={() => setTermsOpen(true)}
                        className="font-semibold text-[#9a6a35] hover:underline cursor-pointer"
                      >
                        Read more
                      </button>
                    </p>
                  </div>
                )}

                {/* 2. OTP stage */}
                {stage === "otp" && (
                  <div className="animate-in-up">
                    <button
                      type="button"
                      onClick={() => setStage("phone")}
                      className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#5b4a3b] hover:text-[#2a1c12] cursor-pointer"
                    >
                      <ArrowLeft className="size-4" aria-hidden="true" /> Change number
                    </button>

                    <h1 className="text-[28px] leading-tight font-extrabold text-[#2a1c12]">
                      Enter the OTP
                    </h1>
                    <p className="mt-2 text-[14.5px] leading-6 text-[#5b4a3b]">
                      We sent a 6-digit code to +91 {phone || "98450 12345"}.
                    </p>

                    <form onSubmit={handleOtpSubmit} className="mt-7 space-y-5">
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
                            className="h-12 w-11 sm:w-12 rounded-xl border border-[#e2d5c1] bg-[#fffaf2] text-center text-[22px] font-extrabold text-[#2a1c12] transition focus:border-[#9a6a35] focus:ring-4 focus:ring-[#9a6a35]/10 focus:outline-none"
                          />
                        ))}
                      </div>

                      {error && (
                        <p className="rounded-lg bg-[#fdf2f0] px-3 py-2 text-[13px] font-medium text-[#c0392b] border border-[#f5c6cb]">
                          {error}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#9a6a35] hover:bg-[#7c5226] text-[#fffaf2] h-12 text-[15px] font-semibold transition cursor-pointer disabled:opacity-50"
                      >
                        {loading ? "Verifying…" : "Verify and continue"}
                      </button>

                      <div className="flex items-center justify-between text-[12px] text-[#5b4a3b]">
                        <span>Didn&apos;t get the code?</span>
                        {seconds > 0 ? (
                          <span className="font-semibold text-[#85725f]">Resend in {seconds}s</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSeconds(30);
                              setDigits(["", "", "", "", "", ""]);
                            }}
                            className="inline-flex items-center gap-1 font-bold text-[#9a6a35] hover:underline cursor-pointer"
                          >
                            <RotateCcw className="size-3.5" aria-hidden="true" /> Resend code
                          </button>
                        )}
                      </div>
                    </form>

                    <div className="mt-7 flex items-center justify-center gap-2 rounded-xl bg-[#fffaf2] border border-[#e2d5c1] px-3 py-2.5 text-[12px] text-[#85725f]">
                      <ShieldCheck className="size-4 text-[#9a6a35]" aria-hidden="true" />
                      Demo build: enter <strong>123456</strong>
                    </div>
                  </div>
                )}

                {/* 3. Onboarding stage */}
                {stage === "onboarding" && (
                  <div className="animate-in-up">
                    <div className="mb-6 flex items-center justify-between">
                      {/* Step Dots */}
                      <div className="flex items-center gap-1.5" aria-label={`Step ${onboardingStep + 1} of 3`}>
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className={`h-1.5 rounded-full transition-all ${
                              i === onboardingStep
                                ? "w-6 bg-[#9a6a35]"
                                : i < onboardingStep
                                ? "w-1.5 bg-[#2e7d32]"
                                : "w-1.5 bg-[#e2d5c1]"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-[12px] font-semibold text-[#85725f]">Step {onboardingStep + 1} of 3</p>
                    </div>

                    {/* Step 0: Language */}
                    {onboardingStep === 0 && (
                      <div>
                        <span className="mb-3 inline-grid size-10 place-items-center rounded-xl bg-[#f4ecdf] text-[#9a6a35]">
                          <Globe2 className="size-5" aria-hidden="true" />
                        </span>
                        <h1 className="text-[26px] leading-tight font-extrabold text-[#2a1c12]">
                          Choose your language
                        </h1>
                        <p className="mt-2 text-[14px] leading-6 text-[#5b4a3b]">
                          You can change this any time from the header. Navigation and core screens are translated;
                          some deeper screens stay in English for now.
                        </p>

                        <div className="mt-6 space-y-2.5">
                          {[
                            { id: "en", label: "English", sub: "English" },
                            { id: "hi", label: "हिन्दी", sub: "Hindi" },
                            { id: "kn", label: "ಕನ್ನಡ", sub: "Kannada" },
                          ].map((lang) => (
                            <button
                              key={lang.id}
                              type="button"
                              onClick={() => setSelectedLanguage(lang.id as Language)}
                              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left transition cursor-pointer ${
                                selectedLanguage === lang.id
                                  ? "border-[#9a6a35] bg-[#faf6f0] ring-4 ring-[#9a6a35]/10"
                                  : "border-[#e2d5c1] bg-[#fffaf2] hover:border-[#9a6a35]/40"
                              }`}
                            >
                              <span>
                                <span className="block text-[15px] font-bold text-[#2a1c12]">{lang.label}</span>
                                <span className="block text-[12px] text-[#5b4a3b]">{lang.sub}</span>
                              </span>
                              <span
                                className={`grid size-5 place-items-center rounded-full border ${
                                  selectedLanguage === lang.id
                                    ? "border-[#9a6a35] bg-[#9a6a35] text-white"
                                    : "border-[#e2d5c1]"
                                }`}
                              >
                                {selectedLanguage === lang.id && <Check className="size-3" aria-hidden="true" />}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Step 1: Legal Disclaimer */}
                    {onboardingStep === 1 && (
                      <div>
                        <span className="mb-3 inline-grid size-10 place-items-center rounded-xl bg-[#f4ecdf] text-[#9a6a35]">
                          <ShieldCheck className="size-5" aria-hidden="true" />
                        </span>
                        <h1 className="text-[26px] leading-tight font-extrabold text-[#2a1c12]">
                          What this platform is and is not
                        </h1>
                        <p className="mt-2 text-[14px] leading-6 text-[#5b4a3b]">
                          Before using NyayaSetu, understand what we do and do not provide.
                        </p>

                        <div className="mt-6 space-y-3 text-[13px] leading-6">
                          <div className="rounded-xl border border-[#e2d5c1] bg-[#fffaf2] p-3.5">
                            <p className="font-bold text-[#2a1c12]">1. Legal information, not legal advice</p>
                            <p className="mt-1 text-[#5b4a3b]">
                              We explain Indian statutes, court rules, and procedural steps. We do not act as your advocate or represent you in court.
                            </p>
                          </div>
                          <div className="rounded-xl border border-[#e2d5c1] bg-[#fffaf2] p-3.5">
                            <p className="font-bold text-[#2a1c12]">2. Your data stays with you</p>
                            <p className="mt-1 text-[#5b4a3b]">
                              Documents and cases stay in your browser in this demo. When you share with an advocate, access is explicit and time-limited.
                            </p>
                          </div>
                          <div className="rounded-xl border border-[#e2d5c1] bg-[#fffaf2] p-3.5">
                            <p className="font-bold text-[#2a1c12]">3. Emergencies</p>
                            <p className="mt-1 text-[#5b4a3b]">
                              If in immediate physical danger, call 112 directly. Do not wait for an online assessment.
                            </p>
                          </div>
                        </div>

                        <label className="mt-5 flex items-start gap-3 rounded-xl border border-[#e2d5c1] bg-[#fffaf2] p-3.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={readDisclaimer}
                            onChange={(e) => setReadDisclaimer(e.target.checked)}
                            className="mt-0.5 size-4.5 rounded border-[#e2d5c1] accent-[#9a6a35]"
                          />
                          <span className="text-[13px] leading-5 text-[#2a1c12] font-medium">
                            I understand NyayaSetu provides legal information and does not act as my advocate.
                          </span>
                        </label>
                      </div>
                    )}

                    {/* Step 2: DPDP Privacy Choices */}
                    {onboardingStep === 2 && (
                      <div>
                        <span className="mb-3 inline-grid size-10 place-items-center rounded-xl bg-[#f4ecdf] text-[#9a6a35]">
                          <Sparkles className="size-5" aria-hidden="true" />
                        </span>
                        <h1 className="text-[26px] leading-tight font-extrabold text-[#2a1c12]">
                          Your privacy choices
                        </h1>
                        <p className="mt-2 text-[14px] leading-6 text-[#5b4a3b]">
                          Under the Digital Personal Data Protection Act, 2023, you decide how your facts are used.
                        </p>

                        <div className="mt-6 space-y-3">
                          <label className="flex items-start gap-3 rounded-xl border border-[#e2d5c1] bg-[#fffaf2] p-4 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={consents.dpdp}
                              onChange={(e) => setConsents({ ...consents, dpdp: e.target.checked })}
                              className="mt-0.5 size-4.5 rounded border-[#e2d5c1] accent-[#9a6a35]"
                            />
                            <div>
                              <span className="block text-[14px] font-bold text-[#2a1c12]">
                                I consent to processing my information
                              </span>
                              <span className="mt-0.5 block text-[12.5px] leading-5 text-[#5b4a3b]">
                                Used solely to provide case guidance, limitation calculations, and document tools.
                              </span>
                            </div>
                          </label>
                          <label className="flex items-start gap-3 rounded-xl border border-[#e2d5c1] bg-[#fffaf2] p-4 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={consents.information}
                              onChange={(e) => setConsents({ ...consents, information: e.target.checked })}
                              className="mt-0.5 size-4.5 rounded border-[#e2d5c1] accent-[#9a6a35]"
                            />
                            <div>
                              <span className="block text-[14px] font-bold text-[#2a1c12]">
                                I confirm the facts I share are accurate
                              </span>
                              <span className="mt-0.5 block text-[12.5px] leading-5 text-[#5b4a3b]">
                                Accurate facts ensure correct statutory timelines and court jurisdiction matching.
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Step Navigation Buttons */}
                    <div className="mt-7 flex items-center justify-between gap-3">
                      {onboardingStep > 0 ? (
                        <button
                          type="button"
                          onClick={() => setOnboardingStep((s) => s - 1)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#e2d5c1] bg-[#fffaf2] px-4 py-2.5 text-[13px] font-semibold text-[#2a1c12] hover:bg-[#faf6f0] cursor-pointer"
                        >
                          <ArrowLeft className="size-4" /> Back
                        </button>
                      ) : (
                        <div />
                      )}
                      <button
                        type="button"
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
                        className="inline-flex items-center gap-2 rounded-xl bg-[#9a6a35] hover:bg-[#7c5226] text-[#fffaf2] px-5 py-2.5 text-[14px] font-semibold transition cursor-pointer disabled:opacity-50"
                      >
                        {onboardingStep === 2 ? "Finish and enter NyayaSetu" : "Continue"}
                        <ArrowRight className="size-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ADVOCATE FLOW */}
            {activeRole === "advocate" && (
              <div className="animate-in-up">
                <h1 className="text-[24px] leading-[1.2] font-extrabold sm:text-[28px] text-[#2a1c12]">
                  Advocate Portal Sign In
                </h1>
                <p className="mt-1.5 text-[13.5px] leading-[22px] text-[#5b4a3b]">
                  State Bar Council verified practitioner login
                </p>

                {!advocateOtpStep ? (
                  <form onSubmit={handleAdvocateSubmit} className="mt-5 space-y-4">
                    <div>
                      <label className="block text-[13px] font-semibold text-[#2a1c12] mb-1.5">
                        State Bar Council Enrolment Number
                      </label>
                      <input
                        placeholder="e.g. KAR/1482/2014"
                        value={barEnrolment}
                        onChange={(e) => setBarEnrolment(e.target.value.toUpperCase())}
                        className="w-full rounded-xl border border-[#e2d5c1] bg-[#fffaf2] px-3.5 py-2.5 text-[15px] text-[#2a1c12] placeholder:text-[#85725f]/70 focus:border-[#9a6a35] focus:ring-4 focus:ring-[#9a6a35]/10 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[13px] font-semibold text-[#2a1c12] mb-1.5">
                        Registered Mobile Number
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[14px] font-semibold text-[#5b4a3b]">
                          +91
                        </span>
                        <input
                          placeholder="98450 12345"
                          value={advocatePhone}
                          onChange={(e) => setAdvocatePhone(e.target.value.replace(/[^\d\s]/g, ""))}
                          className="w-full rounded-xl border border-[#e2d5c1] bg-[#fffaf2] pl-12 pr-3.5 py-2.5 text-[15px] text-[#2a1c12] placeholder:text-[#85725f]/70 focus:border-[#9a6a35] focus:ring-4 focus:ring-[#9a6a35]/10 focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    {error && (
                      <p className="rounded-lg bg-[#fdf2f0] px-3 py-2 text-[13px] font-medium text-[#c0392b] border border-[#f5c6cb]">
                        {error}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#9a6a35] hover:bg-[#7c5226] text-[#fffaf2] h-12 text-[15px] font-semibold transition cursor-pointer disabled:opacity-50"
                    >
                      {loading ? "Verifying Enrolment…" : "Send Verification OTP"}
                      <ArrowRight className="size-4" />
                    </button>

                    <div className="rounded-xl border border-[#e2d5c1] bg-[#fffaf2] p-3 text-[12px] text-[#5b4a3b]">
                      <p className="font-semibold text-[#2a1c12]">Bar Council of India Rule 36 Compliance</p>
                      <p className="mt-1 text-[11px] text-[#85725f]">
                        Advocate listings are informative directories based on verified State Bar rolls and do not constitute advertising or solicitation.
                      </p>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleAdvocateOtpSubmit} className="mt-5 space-y-4">
                    <p className="text-[13.5px] text-[#5b4a3b]">
                      Enter the 6-digit code sent to your registered phone.
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
                          className="h-12 w-11 rounded-xl border border-[#e2d5c1] bg-[#fffaf2] text-center text-[20px] font-bold text-[#2a1c12] focus:border-[#9a6a35] focus:outline-none"
                        />
                      ))}
                    </div>

                    {error && (
                      <p className="rounded-lg bg-[#fdf2f0] px-3 py-2 text-[13px] font-medium text-[#c0392b]">
                        {error}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#9a6a35] hover:bg-[#7c5226] text-[#fffaf2] h-12 text-[15px] font-semibold transition cursor-pointer"
                    >
                      {loading ? "Signing in…" : "Access Advocate Workspace"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* TERMS & PRIVACY MODAL (Exact from Legal-1) */}
      {termsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-[#e2d5c1] bg-[#fffaf2] p-6 shadow-xl animate-in-up max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#e2d5c1] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#2a1c12]">Terms and privacy</h3>
                <p className="text-xs text-[#85725f]">Plain-language summary for NyayaSetu.</p>
              </div>
              <button
                type="button"
                onClick={() => setTermsOpen(false)}
                className="grid size-8 place-items-center rounded-lg text-[#85725f] hover:bg-[#ebe1d1] cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-[13px] leading-6 text-[#5b4a3b]">
              <section>
                <h4 className="font-bold text-[#2a1c12]">Legal information, not legal advice</h4>
                <p className="mt-1">
                  NyayaSetu explains Indian statutes and helps you organize next steps. It does not act as your lawyer,
                  does not create an advocate–client relationship, and does not guarantee an outcome. For advice on your
                  specific matter, speak to a verified advocate or free legal aid.
                </p>
              </section>
              <section>
                <h4 className="font-bold text-[#2a1c12]">What we collect</h4>
                <p className="mt-1">
                  Your mobile number for sign-in, the facts you choose to share, documents you upload and messages you
                  send. Data is stored securely in compliance with the DPDP Act, 2023.
                </p>
              </section>
              <section>
                <h4 className="font-bold text-[#2a1c12]">Your choices</h4>
                <p className="mt-1">
                  You can review consent history, export your data and delete your account from Profile. Document and
                  brief sharing is always explicit, time-limited and revocable.
                </p>
              </section>
              <section>
                <h4 className="font-bold text-[#2a1c12]">Emergencies</h4>
                <p className="mt-1">
                  If someone is in immediate danger, call 112. The Emergency screen works without AI and lists 112, 181
                  and 15100 DLSA.
                </p>
              </section>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setTermsOpen(false)}
                className="rounded-xl bg-[#9a6a35] hover:bg-[#7c5226] text-white px-5 py-2 text-sm font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
