import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import type { ExamEventDoc, SessionDoc } from "../firebase/types";

export type ExamEvent = ExamEventDoc & { id: string };

/** Losowe, trudne do odgadnięcia ID linku studenta `/exams/{id}`. */
function hardExamId(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isExamWindowOpen(exam: Pick<ExamEventDoc, "opensAt" | "closesAt">, now = Date.now()): boolean {
  const open = new Date(exam.opensAt).getTime();
  const close = new Date(exam.closesAt).getTime();
  return Number.isFinite(open) && Number.isFinite(close) && now >= open && now <= close;
}

export function isExamAccepting(exam: ExamEventDoc, now = Date.now()): boolean {
  const accepting = exam.acceptingSubmissions !== false;
  return accepting && isExamWindowOpen(exam, now);
}

/** @deprecated use isExamWindowOpen / isExamAccepting */
export function isExamOpen(
  exam: Pick<ExamEventDoc, "opensAt" | "closesAt"> & Partial<Pick<ExamEventDoc, "acceptingSubmissions">>,
  now = Date.now(),
): boolean {
  return isExamAccepting(exam as ExamEventDoc, now);
}

export async function listExams(): Promise<ExamEvent[]> {
  const q = query(collection(db, "exams"), orderBy("opensAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ExamEventDoc) }));
}

export async function getExam(examId: string): Promise<ExamEvent | null> {
  const snap = await getDoc(doc(db, "exams", examId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as ExamEventDoc) };
}

export async function listOpenExams(): Promise<ExamEvent[]> {
  const all = await listExams();
  return all.filter((exam) => isExamAccepting(exam));
}

export interface CreateExamInput {
  title: string;
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
  questionCount: number;
  taskSetId: string;
  createdBy: string;
}

export async function createExam(input: CreateExamInput): Promise<string> {
  const title = input.title.trim();
  if (!title) throw new Error("Podaj tytuł testu.");
  if (!input.taskSetId) throw new Error("Wybierz zestaw pytań.");
  if (input.questionCount < 1) throw new Error("Liczba pytań musi być co najmniej 1.");
  if (new Date(input.closesAt).getTime() <= new Date(input.opensAt).getTime()) {
    throw new Error("Data zamknięcia musi być po otwarciu.");
  }
  if (input.durationMinutes < 1) throw new Error("Czas rozwiązania musi być co najmniej 1 min.");

  const payload: ExamEventDoc = {
    title,
    opensAt: new Date(input.opensAt).toISOString(),
    closesAt: new Date(input.closesAt).toISOString(),
    durationMinutes: input.durationMinutes,
    questionCount: input.questionCount,
    taskSetId: input.taskSetId,
    acceptingSubmissions: true,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
  };

  const id = hardExamId();
  await setDoc(doc(db, "exams", id), {
    ...payload,
    _createdAt: serverTimestamp(),
  });
  return id;
}

export interface UpdateExamInput {
  title: string;
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
  questionCount: number;
  taskSetId: string;
}

async function writeExamFields(
  exam: ExamEvent,
  patch: Partial<ExamEventDoc> & { acceptingSubmissions?: boolean },
): Promise<void> {
  const questionCount = patch.questionCount ?? exam.questionCount ?? 5;
  const taskSetId = patch.taskSetId ?? exam.taskSetId ?? "";
  const payload: Record<string, unknown> = {
    title: patch.title ?? exam.title,
    opensAt: patch.opensAt ?? exam.opensAt,
    closesAt: patch.closesAt ?? exam.closesAt,
    durationMinutes: patch.durationMinutes ?? exam.durationMinutes,
    questionCount,
    createdAt: exam.createdAt,
    createdBy: exam.createdBy,
    acceptingSubmissions: patch.acceptingSubmissions ?? exam.acceptingSubmissions !== false,
  };
  if (taskSetId) payload.taskSetId = taskSetId;
  if (exam.taskIds?.length && !taskSetId) payload.taskIds = exam.taskIds;
  await updateDoc(doc(db, "exams", exam.id), payload);
}

export async function setExamAcceptingSubmissions(exam: ExamEvent, accepting: boolean): Promise<void> {
  await writeExamFields(exam, { acceptingSubmissions: accepting });
}

export async function updateExam(exam: ExamEvent, input: UpdateExamInput): Promise<void> {
  const title = input.title.trim();
  if (!title) throw new Error("Podaj tytuł testu.");
  if (!input.taskSetId) throw new Error("Wybierz zestaw pytań.");
  if (input.questionCount < 1) throw new Error("Liczba pytań musi być co najmniej 1.");
  if (new Date(input.closesAt).getTime() <= new Date(input.opensAt).getTime()) {
    throw new Error("Data zamknięcia musi być po otwarciu.");
  }
  if (input.durationMinutes < 1) throw new Error("Czas rozwiązania musi być co najmniej 1 min.");

  await writeExamFields(exam, {
    title,
    opensAt: new Date(input.opensAt).toISOString(),
    closesAt: new Date(input.closesAt).toISOString(),
    durationMinutes: input.durationMinutes,
    questionCount: input.questionCount,
    taskSetId: input.taskSetId,
  });
}

export async function deleteExam(examId: string): Promise<void> {
  await deleteDoc(doc(db, "exams", examId));
}

export async function listSessionsForExam(examId: string): Promise<Array<SessionDoc & { id: string }>> {
  const q = query(collection(db, "sessions"), where("examId", "==", examId), orderBy("startedAt", "desc"));
  try {
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as SessionDoc) }));
  } catch {
    const snap = await getDocs(query(collection(db, "sessions"), orderBy("startedAt", "desc")));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as SessionDoc) }))
      .filter((s) => s.examId === examId);
  }
}

export interface ExamSessionStats {
  total: number;
  inProgress: number;
  submitted: number;
  expired: number;
}

export function computeExamStats(sessions: Array<Pick<SessionDoc, "status">>): ExamSessionStats {
  const stats: ExamSessionStats = { total: 0, inProgress: 0, submitted: 0, expired: 0 };
  for (const s of sessions) {
    stats.total += 1;
    if (s.status === "in_progress") stats.inProgress += 1;
    else if (s.status === "submitted") stats.submitted += 1;
    else if (s.status === "expired") stats.expired += 1;
  }
  return stats;
}
