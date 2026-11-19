/**
 * NyayaSetu Unified Backend API Client
 *
 * Connects frontend services to the FastAPI backend (/api/v1).
 * Handles authentication headers, JSON/multipart serialization,
 * error normalization, and connection health diagnostics.
 */

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const getBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    // Client-side: use relative path so Next.js rewrites proxy to backend
    return "";
  }
  // Server-side: direct connection to backend
  return process.env.BACKEND_API_URL || "http://127.0.0.1:8000";
};

export const getStoredToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("nyayasetu_access_token") ||
    localStorage.getItem("nyayasetu_token") ||
    null
  );
};

export const setStoredTokens = (accessToken: string, refreshToken?: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem("nyayasetu_access_token", accessToken);
  localStorage.setItem("nyayasetu_token", accessToken);
  if (refreshToken) {
    localStorage.setItem("nyayasetu_refresh_token", refreshToken);
  }
  if (typeof document !== "undefined") {
    document.cookie = `nyayasetu_token=${accessToken}; path=/; max-age=86400; SameSite=Lax`;
  }
};

export const clearStoredTokens = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("nyayasetu_access_token");
  localStorage.removeItem("nyayasetu_refresh_token");
  localStorage.removeItem("nyayasetu_token");
  if (typeof document !== "undefined") {
    document.cookie = "nyayasetu_token=; path=/; max-age=0; SameSite=Lax";
  }
};

interface RequestOptions extends RequestInit {
  token?: string | null;
  params?: Record<string, string | number | boolean | undefined | null>;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const baseUrl = getBaseUrl();
  let url = `${baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  if (options.params) {
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(options.params)) {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const token = options.token !== undefined ? options.token : getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  let data: unknown;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: Request failed`;
    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      if (typeof obj.detail === "string") {
        errorMessage = obj.detail;
      } else if (Array.isArray(obj.detail) && obj.detail.length > 0) {
        // FastAPI validation errors
        errorMessage = obj.detail
          .map((d: { msg?: string; loc?: string[] }) => d.msg || "Invalid field")
          .join(", ");
      } else if (obj.error && typeof obj.error === "object") {
        const errObj = obj.error as Record<string, unknown>;
        if (typeof errObj.message === "string") {
          errorMessage = errObj.message;
        }
      } else if (typeof obj.message === "string") {
        errorMessage = obj.message;
      }
    } else if (typeof data === "string" && data.length > 0) {
      errorMessage = data;
    }
    throw new ApiError(errorMessage, response.status, data);
  }

  return data as T;
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions): Promise<T> =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestOptions): Promise<T> =>
    request<T>(endpoint, { ...options, method: "DELETE" }),

  upload: <T>(endpoint: string, formData: FormData, options?: RequestOptions): Promise<T> =>
    request<T>(endpoint, {
      ...options,
      method: "POST",
      body: formData,
    }),

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${getBaseUrl()}/api/v1/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
