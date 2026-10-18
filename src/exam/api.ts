import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import type {
  BoardState,
  ExamConfigDoc,
  SessionDoc,
  SessionSummary,
  SessionTaskDoc,
  TaskDoc,
} from "../firebase/types";
import { EXAM_CONFIG } from "./config";
import { getExam, isExamAccepting, type ExamEvent } from "./examsApi";
import { gradeSessionTasks } from "./grade";
import { pickQuestionsFromSet } from "./pickFromSet";
import { pickExamTasks } from "./pickTasks";
import { normalizePoints, type SetQuestion } from "./questionTypes";
import { listSetQuestionsWithAnswers } from "./taskSetsApi";
import { saveLocalExamSession } from "./sessionStorage";

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function fetchExamConfig(): Promise<ExamConfigDoc> {
  const snap = await getDoc(doc(db, "examConfig", "default"));
  if (!snap.exists()) {
    return {
      durationMinutes: EXAM_CONFIG.durationMinutes,
      emailDomain: null,
    };
  }
  const data = snap.data() as ExamConfigDoc;
  return {
    durationMinutes: data.durationMinutes ?? EXAM_CONFIG.durationMinutes,
    emailDomain: data.emailDomain ?? null,
  };
}

export async function fetchActiveTasks(): Promise<Array<{ id: string; task: TaskDoc }>> {
  const q = query(collection(db, "tasks"), where("active", "==", true));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, task: d.data() as TaskDoc }));
}

/** Pobiera tylko wskazane zadania (pula kolokwium) — szybciej niż cały bank. */
export async function fetchTasksByIds(ids: string[]): Promise<Array<{ id: string; task: TaskDoc }>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const snaps = await Promise.all(unique.map((id) => getDoc(doc(db, "tasks", id))));
  return snaps
    .filter((snap) => snap.exists())
    .map((snap) => ({ id: snap.id, task: snap.data() as TaskDoc }))
    .filter((item) => item.task.active);
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export interface StartSessionInput {
  firstName: string;
  lastName: string;
  email: string;
  studentIndex: string;
  examId: string;
}

export interface StartedSession {
  sessionId: string;
  sessionToken: string;
  endsAt: string;
  tasks: Array<{ id: string; order: number; number: string; prompt: string }>;
}

export async function resolveExamForStart(examId: string): Promise<ExamEvent> {
  const exam = await getExam(examId);
  if (!exam) {
    throw new Error("Nie znaleziono testu.");
  }
  if (!isExamAccepting(exam)) {
    throw new Error("Ten test nie przyjmuje teraz nowych podejść.");
  }
  return exam;
}

export async function startExamSession(input: StartSessionInput): Promise<StartedSession> {
  return withTimeout(startExamSessionInner(input), 20_000, "Start sesji trwa zbyt długo. Odśwież stronę i spróbuj ponownie.");
}

function emptyBoard(): SessionTaskDoc["board"] {
  return { opened: [], entries: [], log: [], resultMode: "nature" };
}

function sessionPayloadFromSetQuestion(item: SetQuestion, order: number): SessionTaskDoc {
  const points = normalizePoints(item.points);
  const base = {
    order,
    sourceQuestionId: item.id,
    sourceTaskId: item.sourceTaskId ?? null,
    number: item.number || String(order),
    prompt: item.prompt,
    points,
    board: emptyBoard(),
    summary: null,
    studentAnswer: null as string | string[] | null,
  };
  if (item.kind === "ledger") {
    return { ...base, kind: "ledger" };
  }
  if (item.kind === "open") {
    return { ...base, kind: "open" };
  }
  return {
    ...base,
    kind: item.kind,
    options: item.options ?? [],
    correctOptionIds: item.correctOptionIds ?? [],
  };
}

async function startExamSessionInner(input: StartSessionInput): Promise<StartedSession> {
  const exam = await resolveExamForStart(input.examId);
  const config: ExamConfigDoc = {
    durationMinutes: exam.durationMinutes,
    emailDomain: null,
  };

  const sessionRef = doc(collection(db, "sessions"));
  const sessionToken = randomToken();
  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + config.durationMinutes * 60_000);

  const session: SessionDoc = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    studentIndex: input.studentIndex.trim(),
    status: "in_progress",
    startedAt: startedAt.toISOString(),
    endsAt: endsAt.toISOString(),
    submittedAt: null,
    configSnapshot: config,
    sessionToken,
    examId: exam.id,
    examTitle: exam.title,
  };

  const batch = writeBatch(db);
  batch.set(sessionRef, session);

  const taskSummaries: StartedSession["tasks"] = [];

  if (exam.taskSetId) {
    const questions = await listSetQuestionsWithAnswers(exam.taskSetId);
    const picked = pickQuestionsFromSet(questions, exam.questionCount ?? 5);
    picked.forEach((item, index) => {
      const taskId = `t${index + 1}`;
      const payload = sessionPayloadFromSetQuestion(item, index + 1);
      batch.set(doc(db, "sessions", sessionRef.id, "tasks", taskId), payload);
      taskSummaries.push({
        id: taskId,
        order: index + 1,
        number: payload.number,
        prompt: payload.prompt,
      });
    });
  } else {
    const bank = await fetchTasksByIds(exam.taskIds ?? []);
    if (bank.length === 0) {
      throw new Error("Pula zadań tego testu jest pusta.");
    }
    const picked = pickExamTasks(bank, exam.questionCount ?? EXAM_CONFIG.questionCount);
    picked.forEach((item, index) => {
      const taskId = `t${index + 1}`;
      const payload: SessionTaskDoc = {
        order: index + 1,
        sourceTaskId: item.id,
        number: item.task.number,
        prompt: item.task.prompt,
        kind: item.task.kind,
        points: 1,
        ...(item.task.quiz ? { quiz: item.task.quiz } : {}),
        board: emptyBoard(),
        summary: null,
      };
      batch.set(doc(db, "sessions", sessionRef.id, "tasks", taskId), payload);
      taskSummaries.push({
        id: taskId,
        order: index + 1,
        number: item.task.number,
        prompt: item.task.prompt,
      });
    });
  }

  await batch.commit();

  saveLocalExamSession({ sessionId: sessionRef.id, sessionToken });

  return {
    sessionId: sessionRef.id,
    sessionToken,
    endsAt: endsAt.toISOString(),
    tasks: taskSummaries,
  };
}

export async function fetchSession(sessionId: string): Promise<(SessionDoc & { id: string }) | null> {
  const snap = await getDoc(doc(db, "sessions", sessionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as SessionDoc) };
}

export async function fetchSessionTasks(
  sessionId: string,
): Promise<Array<SessionTaskDoc & { id: string }>> {
  const snap = await getDocs(collection(db, "sessions", sessionId, "tasks"));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as SessionTaskDoc) }))
    .sort((a, b) => a.order - b.order);
}

export async function listSessions(): Promise<Array<SessionDoc & { id: string }>> {
  const q = query(collection(db, "sessions"), orderBy("startedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as SessionDoc) }));
}

export async function saveSessionTaskBoard(
  sessionId: string,
  taskId: string,
  board: BoardState,
  summary?: SessionSummary | null,
  studentAnswer?: string | string[] | null,
): Promise<void> {
  const ref = doc(db, "sessions", sessionId, "tasks", taskId);
  await updateDoc(ref, {
    board,
    ...(summary !== undefined ? { summary } : {}),
    ...(studentAnswer !== undefined ? { studentAnswer } : {}),
  });
}

export async function submitExamSession(
  sessionId: string,
  sessionToken: string,
  taskSnapshots: Array<{
    id: string;
    board: BoardState;
    summary: SessionSummary;
    studentAnswer?: string | string[] | null;
  }>,
): Promise<void> {
  const ref = doc(db, "sessions", sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Sesja nie istnieje.");
  const data = snap.data() as SessionDoc;
  if (data.sessionToken !== sessionToken) throw new Error("Nieprawidłowy token sesji.");
  if (data.status !== "in_progress") throw new Error("Sesja jest już zakończona.");

  const existingTasks = await fetchSessionTasks(sessionId);
  const byId = new Map(existingTasks.map((t) => [t.id, t]));
  const forGrading: Array<SessionTaskDoc & { id: string }> = taskSnapshots.map((item) => {
    const prev = byId.get(item.id);
    if (!prev) throw new Error("Brak zadania sesji.");
    return {
      ...prev,
      board: item.board,
      summary: item.summary,
      studentAnswer: item.studentAnswer !== undefined ? item.studentAnswer : prev.studentAnswer,
    };
  });
  const grade = gradeSessionTasks(forGrading);
  const gradeByTask = new Map(grade.tasks.map((t) => [t.taskId, t]));

  const batch = writeBatch(db);
  for (const item of taskSnapshots) {
    const g = gradeByTask.get(item.id);
    batch.update(doc(db, "sessions", sessionId, "tasks", item.id), {
      board: item.board,
      summary: item.summary,
      ...(item.studentAnswer !== undefined ? { studentAnswer: item.studentAnswer } : {}),
      autoScore: g?.autoScore ?? 0,
      isCorrect: g?.isCorrect ?? null,
    });
  }
  batch.update(ref, {
    status: "submitted",
    submittedAt: new Date().toISOString(),
    scoreAuto: grade.scoreAuto,
    scoreMax: grade.scoreMax,
    needsManualReview: grade.needsManualReview,
    scoreManual: grade.needsManualReview ? null : 0,
  });
  await batch.commit();
}

/** Zapis punktów przyznanych przez prowadzącego dla jednego zadania. */
export async function saveSessionTaskManualScore(
  sessionId: string,
  taskId: string,
  manualScore: number,
): Promise<void> {
  await updateDoc(doc(db, "sessions", sessionId, "tasks", taskId), { manualScore });
}

/** Kończy ręczne sprawdzanie — sumuje punkty i zamyka ocenę. */
export async function finishSessionGrading(
  sessionId: string,
  taskScores: Array<{ id: string; manualScore: number }>,
): Promise<void> {
  const ref = doc(db, "sessions", sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Sesja nie istnieje.");
  const session = snap.data() as SessionDoc;
  if (session.status === "in_progress") {
    throw new Error("Sesja nie jest jeszcze oddana.");
  }

  const tasks = await fetchSessionTasks(sessionId);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  let scoreManual = 0;
  let scoreAuto = 0;
  let scoreMax = 0;

  const batch = writeBatch(db);
  for (const item of taskScores) {
    const task = byId.get(item.id);
    if (!task) continue;
    const points = typeof task.points === "number" && task.points > 0 ? task.points : 1;
    scoreMax += points;
    const awarded = Math.max(0, Math.min(points, item.manualScore));
    batch.update(doc(db, "sessions", sessionId, "tasks", item.id), { manualScore: awarded });

    if (task.kind === "single" || task.kind === "multiple") {
      scoreAuto += awarded;
    } else {
      scoreManual += awarded;
    }
  }

  batch.update(ref, {
    scoreAuto,
    scoreManual,
    scoreMax: scoreMax || session.scoreMax || null,
    needsManualReview: false,
  });
  await batch.commit();
}
