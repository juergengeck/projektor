export const EMAIL_KEY = "amway.email";
export const REMEMBER_KEY = "amway.remember";
export const DEPT_KEY = "amway.department";
export const LANG_KEY = "amway.lang";
export const THEME_KEY = "amway.theme";

export async function request(path: string, params: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const result = await response.json();
  if (!response.ok || result.error) {
    const message = typeof result.error === "string" ? result.error : result.error?.message;
    const error = new Error(message || "The operation failed.") as Error & { status?: number; code?: string };
    error.status = response.status;
    if (result.code) error.code = result.code;
    throw error;
  }
  return result;
}

export async function operation<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const result = await request(`/api/amway/${method}`, params);
  return result.product as T;
}

export async function unlockSession(email: string, password: string) {
  return request("/session", { email, password });
}

export function currentDepartment(): string {
  return localStorage.getItem(DEPT_KEY) || "";
}

export function setDepartment(department: string) {
  if (department) localStorage.setItem(DEPT_KEY, department);
  else localStorage.removeItem(DEPT_KEY);
}
