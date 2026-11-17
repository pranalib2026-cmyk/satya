"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Role, Language } from "@/types/citizen";
import { demoUser } from "@/data/mock-citizen-data";

interface AuthContextType {
  user: User | null;
  role: Role;
  token: string | null;
  onboarded: boolean;
  language: Language;
  loginCitizen: (phone: string, otp: string) => Promise<boolean>;
  loginAdvocate: (barEnrolment: string, phone: string, otp: string) => Promise<boolean>;
  logout: () => void;
  completeOnboarding: (selectedLanguage: Language) => void;
  updateUser: (updates: Partial<User>) => void;
  setLanguage: (lang: Language) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const DEMO_OTP = "123456";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // SSR and the first client render must agree. Persisted demo auth is
  // restored after mount so localStorage never changes the initial markup.
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("citizen");
  const [onboarded, setOnboarded] = useState(false);
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const storedUser = localStorage.getItem("nyayasetu_user");
        const parsedUser = storedUser ? (JSON.parse(storedUser) as User) : null;
        setUser(parsedUser);
        setToken(localStorage.getItem("nyayasetu_token"));
        setRole(parsedUser?.role ?? "citizen");
        setOnboarded(localStorage.getItem("nyayasetu_onboarded") === "true");
        const storedLanguage = localStorage.getItem("nyayasetu_lang") as Language | null;
        if (storedLanguage && ["en", "hi", "kn"].includes(storedLanguage)) {
          setLanguageState(storedLanguage);
        }
      } catch {
        // Corrupt demo storage falls back to the deterministic defaults.
      }
    });
  }, []);

  const loginCitizen = async (phone: string, otp: string): Promise<boolean> => {
    if (otp !== DEMO_OTP && otp !== "000000") {
      throw new Error("Invalid verification code. Please enter the 6-digit OTP 123456.");
    }

    const cleanPhone = phone.trim().replace(/\s+/g, "");
    if (cleanPhone.length < 10) {
      throw new Error("Please enter a valid 10-digit Indian mobile number.");
    }

    const citizenUser: User = {
      ...demoUser,
      phone: `+91 ${cleanPhone.slice(-10)}`,
      role: "citizen",
    };

    const mockToken = "jwt_mock_citizen_" + Date.now();
    setUser(citizenUser);
    setRole("citizen");
    setToken(mockToken);

    try {
      localStorage.setItem("nyayasetu_token", mockToken);
      localStorage.setItem("nyayasetu_user", JSON.stringify(citizenUser));
      if (typeof document !== "undefined") {
        document.cookie = `nyayasetu_token=${mockToken}; path=/; max-age=86400; SameSite=Lax`;
      }
    } catch {}

    return true;
  };

  const loginAdvocate = async (barEnrolment: string, phone: string, otp: string): Promise<boolean> => {
    if (otp !== DEMO_OTP && otp !== "000000") {
      throw new Error("Invalid verification code. Please enter the 6-digit OTP 123456.");
    }
    if (!barEnrolment.trim()) {
      throw new Error("Please enter your State Bar Council Enrolment Number.");
    }

    const advocateUser: User = {
      id: "adv_user_1",
      name: "Adv. Ananya Rao",
      phone: phone ? `+91 ${phone.replace(/\D/g, "").slice(-10)}` : "+91 98450 12345",
      email: "advocate.ananya@nyayasetu.in",
      language: "en",
      city: "Bengaluru",
      state: "Karnataka",
      role: "advocate",
      barEnrolment: barEnrolment.trim().toUpperCase(),
      createdAt: new Date().toISOString(),
    };

    const mockToken = "jwt_mock_advocate_" + Date.now();
    setUser(advocateUser);
    setRole("advocate");
    setToken(mockToken);
    setOnboarded(true);

    try {
      localStorage.setItem("nyayasetu_token", mockToken);
      localStorage.setItem("nyayasetu_user", JSON.stringify(advocateUser));
      localStorage.setItem("nyayasetu_onboarded", "true");
      if (typeof document !== "undefined") {
        document.cookie = `nyayasetu_token=${mockToken}; path=/; max-age=86400; SameSite=Lax`;
      }
    } catch {}

    return true;
  };

  const completeOnboarding = (selectedLanguage: Language) => {
    setOnboarded(true);
    setLanguageState(selectedLanguage);
    try {
      localStorage.setItem("nyayasetu_onboarded", "true");
      localStorage.setItem("nyayasetu_lang", selectedLanguage);
    } catch {}
  };

  const updateUser = (updates: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    try {
      localStorage.setItem("nyayasetu_user", JSON.stringify(updated));
    } catch {}
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("nyayasetu_lang", lang);
    } catch {}
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    try {
      localStorage.removeItem("nyayasetu_token");
      localStorage.removeItem("nyayasetu_user");
      if (typeof document !== "undefined") {
        document.cookie = "nyayasetu_token=; path=/; max-age=0; SameSite=Lax";
      }
    } catch {}
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        onboarded,
        language,
        loginCitizen,
        loginAdvocate,
        logout,
        completeOnboarding,
        updateUser,
        setLanguage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
