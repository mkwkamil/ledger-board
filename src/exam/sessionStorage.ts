const KEY = "ledger-board.examSession";

export interface LocalExamSession {
  sessionId: string;
  sessionToken: string;
}

export function saveLocalExamSession(session: LocalExamSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function loadLocalExamSession(): LocalExamSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalExamSession;
    if (!parsed.sessionId || !parsed.sessionToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLocalExamSession() {
  localStorage.removeItem(KEY);
}
