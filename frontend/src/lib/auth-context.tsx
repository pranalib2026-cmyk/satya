"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Role, Language } from "@/types/citizen";
import { demoUser } from "@/data/mock-citizen-data";
import { api, getStoredToken, setStoredTokens, clearStoredTokens } from "./api-client";

interface AuthContextType {
  user: User | null;
  role: Role;
  token: string | null;
  onboarded: boolean;
  language: Language;
  backendOnline: boolean | null;
  loginCitizen: (phone: string, otp: string) => Promise<boolean>;
  loginAdvocate: (barEnrolment: string, phone: string, otp: string) => Promise<boolean>;
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  registerCitizen: (data: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    preferredLanguage?: string;
  }) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  logout: () => void;
  completeOnboarding: (selectedLanguage: Language) => void;
  updateUser: (updates: Partial<User>) => void;
  setLanguage: (lang: Language) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const DEMO_OTP = "123456";

interface BackendUserResponse {
  id: string;
  email: string;
  phone: string;
  full_name: string;
  role: string;
  is_verified: boolean;
  is_active: boolean;
  preferred_language: string;
  city?: string | null;
  state?: string | null;
  created_at: string;
}

interface BackendTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: BackendUserResponse;
}

function mapBackendUserToFrontend(bu: BackendUserResponse): User {
  const normRole = (bu.role.toLowerCase() === "advocate" ? "advocate" : "citizen") as Role;
  const lang = (["en", "hi", "kn"].includes(bu.preferred_language)
    ? bu.preferred_language
    : "en") as Language;

  return {
    id: bu.id,
    name: bu.full_name,
    email: bu.email,
    phone: bu.phone,
    role: normRole,
    language: lang,
    city: bu.city || "Bengaluru",
    state: bu.state || "Karnataka",
    createdAt: bu.created_at,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("citizen");
  const [onboarded, setOnboarded] = useState(false);
  const [language, setLanguageState] = useState<Language>("en");
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const syncBackendProfile = useCallback(async (jwtToken: string) => {
    try {
      const liveUser = await api.get<BackendUserResponse>("/api/v1/users/me", {
        token: jwtToken,
      });
      const mapped = mapBackendUserToFrontend(liveUser);
      setUser(mapped);
      setRole(mapped.role);
      setBackendOnline(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("nyayasetu_user", JSON.stringify(mapped));
      }
    } catch {
      // Backend unavailable or token expired
      setBackendOnline(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const storedToken = getStoredToken();
        const storedUser = localStorage.getItem("nyayasetu_user");
        const parsedUser = storedUser ? (JSON.parse(storedUser) as User) : null;

        if (storedToken) {
          setToken(storedToken);
          // Sync with live backend profile if token exists
          void syncBackendProfile(storedToken);
        }

        if (parsedUser) {
          setUser(parsedUser);
          setRole(parsedUser.role ?? "citizen");
        }

        setOnboarded(localStorage.getItem("nyayasetu_onboarded") === "true");
        const storedLanguage = localStorage.getItem("nyayasetu_lang") as Language | null;
        if (storedLanguage && ["en", "hi", "kn"].includes(storedLanguage)) {
          setLanguageState(storedLanguage);
        }
      } catch {
        // Fallback to defaults
      }
    });
  }, [syncBackendProfile]);

  const loginWithEmail = async (email: string, password: string): Promise<boolean> => {
    const res = await api.post<BackendTokenResponse>("/api/v1/auth/login", {
      email: email.trim(),
      password,
    });

    setStoredTokens(res.access_token, res.refresh_token);
    const mapped = mapBackendUserToFrontend(res.user);

    setUser(mapped);
    setRole(mapped.role);
    setToken(res.access_token);
    setBackendOnline(true);

    try {
      localStorage.setItem("nyayasetu_user", JSON.stringify(mapped));
    } catch {}

    return true;
  };

  const registerCitizen = async (data: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    preferredLanguage?: string;
  }): Promise<boolean> => {
    const cleanPhone = data.phone.trim().replace(/\s+/g, "");
    await api.post<BackendUserResponse>("/api/v1/auth/register", {
      account_type: "CITIZEN",
      full_name: data.fullName.trim(),
      email: data.email.trim(),
      phone: cleanPhone.startsWith("+") ? cleanPhone : `+91${cleanPhone.slice(-10)}`,
      password: data.password,
      preferred_language: data.preferredLanguage || "en",
    });

    // Automatically log in after registration
    return loginWithEmail(data.email, data.password);
  };

  const loginCitizen = async (phone: string, otp: string): Promise<boolean> => {
    if (otp !== DEMO_OTP && otp !== "000000") {
      throw new Error("Invalid verification code. Please enter the 6-digit OTP 123456.");
    }

    const cleanPhone = phone.trim().replace(/\s+/g, "");
    if (cleanPhone.length < 10) {
      throw new Error("Please enter a valid 10-digit Indian mobile number.");
    }

    // Try connecting to live backend with standard demo citizen credentials
    try {
      const res = await api.post<BackendTokenResponse>("/api/v1/auth/login", {
        email: "citizen@nyayasetu.in",
        password: "CitizenPassword2026",
      });
      setStoredTokens(res.access_token, res.refresh_token);
      const mapped = mapBackendUserToFrontend(res.user);
      mapped.phone = `+91 ${cleanPhone.slice(-10)}`;
      setUser(mapped);
      setRole("citizen");
      setToken(res.access_token);
      setBackendOnline(true);
      try {
        localStorage.setItem("nyayasetu_user", JSON.stringify(mapped));
      } catch {}
      return true;
    } catch {
      // Backend not running or demo credentials not seeded: graceful demo session fallback
      setBackendOnline(false);
      const citizenUser: User = {
        ...demoUser,
        phone: `+91 ${cleanPhone.slice(-10)}`,
        role: "citizen",
      };

      const mockToken = "jwt_mock_citizen_" + Date.now();
      setUser(citizenUser);
      setRole("citizen");
      setToken(mockToken);
      setStoredTokens(mockToken);

      try {
        localStorage.setItem("nyayasetu_user", JSON.stringify(citizenUser));
      } catch {}

      return true;
    }
  };

  const loginAdvocate = async (
    barEnrolment: string,
    phone: string,
    otp: string
  ): Promise<boolean> => {
    if (otp !== DEMO_OTP && otp !== "000000") {
      throw new Error("Invalid verification code. Please enter the 6-digit OTP 123456.");
    }
    if (!barEnrolment.trim()) {
      throw new Error("Please enter your State Bar Council Enrolment Number.");
    }

    // Try connecting to live backend with standard demo advocate credentials
    try {
      const res = await api.post<BackendTokenResponse>("/api/v1/auth/login", {
        email: "advocate@nyayasetu.in",
        password: "AdvocatePassword2026",
      });
      setStoredTokens(res.access_token, res.refresh_token);
      const mapped = mapBackendUserToFrontend(res.user);
      mapped.barEnrolment = barEnrolment.trim().toUpperCase();
      setUser(mapped);
      setRole("advocate");
      setToken(res.access_token);
      setOnboarded(true);
      setBackendOnline(true);
      try {
        localStorage.setItem("nyayasetu_user", JSON.stringify(mapped));
        localStorage.setItem("nyayasetu_onboarded", "true");
      } catch {}
      return true;
    } catch {
      // Backend not running or credentials not seeded: graceful demo session fallback
      setBackendOnline(false);
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
      setStoredTokens(mockToken);

      try {
        localStorage.setItem("nyayasetu_user", JSON.stringify(advocateUser));
        localStorage.setItem("nyayasetu_onboarded", "true");
      } catch {}

      return true;
    }
  };

  const refreshProfile = async () => {
    const curToken = token || getStoredToken();
    if (!curToken) return;
    await syncBackendProfile(curToken);
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
    const curToken = token || getStoredToken();
    if (curToken && !curToken.startsWith("jwt_mock_")) {
      api.post("/api/v1/auth/logout", {}, { token: curToken }).catch(() => {});
    }
    setUser(null);
    setToken(null);
    clearStoredTokens();
    try {
      localStorage.removeItem("nyayasetu_user");
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
        backendOnline,
        loginCitizen,
        loginAdvocate,
        loginWithEmail,
        registerCitizen,
        refreshProfile,
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
