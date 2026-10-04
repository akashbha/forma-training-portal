export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly fields?: Record<string, string[]>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem('forma_access_token');
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem('forma_access_token', token);
    } else {
      localStorage.removeItem('forma_access_token');
    }
  } catch {
    // Ignore storage restrictions
  }
}

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('/') ? endpoint : `/api/${endpoint}`;

  const token = getStoredToken();
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Sends httpOnly cookies
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  let data: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    // If unauthorized on protected routes (except login), clear token
    if (response.status === 401 && !url.includes('/auth/login')) {
      setStoredToken(null);
    }

    const errorObj = data?.error || {};
    throw new ApiError(
      response.status,
      errorObj.code || (response.status === 401 ? 'UNAUTHORIZED' : 'API_ERROR'),
      errorObj.message || (response.status === 401 ? 'Invalid email or password' : `Request failed with status ${response.status}`),
      errorObj.fields
    );
  }

  return data as T;
}

// REST Resource helpers
export const api = {
  get: <T>(url: string) => apiClient<T>(url, { method: 'GET' }),
  post: <T>(url: string, body?: any) =>
    apiClient<T>(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(url: string, body?: any) =>
    apiClient<T>(url, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(url: string) => apiClient<T>(url, { method: 'DELETE' }),
};
