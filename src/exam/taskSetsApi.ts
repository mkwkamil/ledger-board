import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import type { TaskDoc } from "../firebase/types";
import { normalizePoints, type SetQuestion, type SetQuestionDoc, type TaskSet, type TaskSetDoc } from "./questionTypes";

const DEFAULT_SET_NAME = "Zestaw podstawowy";

export async function listTaskSets(): Promise<TaskSet[]> {
  const snap = await getDocs(query(collection(db, "taskSets"), orderBy("updatedAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as TaskSetDoc) }));
}

export async function getTaskSet(setId: string): Promise<TaskSet | null> {
  const snap = await getDoc(doc(db, "taskSets", setId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as TaskSetDoc) };
}

function mapQuestionDoc(id: string, data: SetQuestionDoc, correctOptionIds?: string[]): SetQuestion {
  return {
    id,
    ...data,
    points: normalizePoints(data.points),
    ...(correctOptionIds !== undefined ? { correctOptionIds } : {}),
  };
}

/** Publiczne pytania (bez kluczy odpowiedzi). */
export async function listSetQuestions(setId: string): Promise<SetQuestion[]> {
  const snap = await getDocs(query(collection(db, "taskSets", setId, "questions"), orderBy("order", "asc")));
  return snap.docs.map((d) => {
    const data = d.data() as SetQuestionDoc;
    const { correctOptionIds: _, ...rest } = data;
    void _;
    return mapQuestionDoc(d.id, rest as SetQuestionDoc);
  });
}

/**
 * Pytania z kluczami odpowiedzi — start sesji (snapshot do auto-oceny)
 * oraz panel admina.
 */
export async function listSetQuestionsWithAnswers(setId: string): Promise<SetQuestion[]> {
  const [questionsSnap, keysSnap] = await Promise.all([
    getDocs(query(collection(db, "taskSets", setId, "questions"), orderBy("order", "asc"))),
    getDocs(collection(db, "taskSets", setId, "answerKeys")),
  ]);
  const keys = new Map(
    keysSnap.docs.map((d) => [d.id, (d.data() as { correctOptionIds?: string[] }).correctOptionIds ?? []]),
  );
  return questionsSnap.docs.map((d) => {
    const data = d.data() as SetQuestionDoc;
    const fromKey = keys.get(d.id);
    return mapQuestionDoc(d.id, data, fromKey ?? data.correctOptionIds ?? []);
  });
}

export async function createTaskSet(name: string, createdBy: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Podaj nazwę zestawu.");
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, "taskSets"), {
    name: trimmed,
    createdAt: now,
    createdBy,
    updatedAt: now,
  } satisfies TaskSetDoc);
  return ref.id;
}

export async function renameTaskSet(setId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Podaj nazwę zestawu.");
  await updateDoc(doc(db, "taskSets", setId), {
    name: trimmed,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteTaskSet(setId: string): Promise<void> {
  const questions = await listSetQuestions(setId);
  const keysSnap = await getDocs(collection(db, "taskSets", setId, "answerKeys"));
  const batch = writeBatch(db);
  for (const q of questions) {
    batch.delete(doc(db, "taskSets", setId, "questions", q.id));
  }
  for (const k of keysSnap.docs) {
    batch.delete(doc(db, "taskSets", setId, "answerKeys", k.id));
  }
  batch.delete(doc(db, "taskSets", setId));
  await batch.commit();
}

export async function upsertSetQuestion(setId: string, question: SetQuestionDoc & { id?: string }): Promise<string> {
  const { id, ...data } = question;
  const correctOptionIds = data.correctOptionIds ?? [];
  const payload: SetQuestionDoc = {
    order: data.order,
    kind: data.kind,
    prompt: data.prompt.trim(),
    number: data.number.trim() || String(data.order),
    points: normalizePoints(data.points),
    ...(data.options ? { options: data.options } : {}),
    ...(data.sourceTaskId !== undefined ? { sourceTaskId: data.sourceTaskId } : {}),
  };
  if (!payload.prompt) throw new Error("Podaj treść pytania.");
  if (payload.kind === "single" || payload.kind === "multiple") {
    const opts = payload.options ?? [];
    if (opts.length < 2) throw new Error("Dodaj co najmniej 2 opcje odpowiedzi.");
    if (payload.kind === "single" && correctOptionIds.length !== 1) {
      throw new Error("Zaznacz dokładnie jedną poprawną odpowiedź.");
    }
    if (payload.kind === "multiple" && correctOptionIds.length < 1) {
      throw new Error("Zaznacz co najmniej jedną poprawną odpowiedź.");
    }
  }

  const questionId = id ?? doc(collection(db, "taskSets", setId, "questions")).id;
  await setDoc(doc(db, "taskSets", setId, "questions", questionId), payload, { merge: false });
  if (payload.kind === "single" || payload.kind === "multiple") {
    await setDoc(doc(db, "taskSets", setId, "answerKeys", questionId), { correctOptionIds });
  } else {
    await deleteDoc(doc(db, "taskSets", setId, "answerKeys", questionId)).catch(() => undefined);
  }
  await updateDoc(doc(db, "taskSets", setId), { updatedAt: new Date().toISOString() });
  return questionId;
}

export async function deleteSetQuestion(setId: string, questionId: string): Promise<void> {
  await deleteDoc(doc(db, "taskSets", setId, "questions", questionId));
  await deleteDoc(doc(db, "taskSets", setId, "answerKeys", questionId)).catch(() => undefined);
  await updateDoc(doc(db, "taskSets", setId), { updatedAt: new Date().toISOString() });
}

/** Dodaje wiele pytań naraz (np. import JSON). */
export async function importSetQuestions(setId: string, questions: SetQuestionDoc[]): Promise<number> {
  if (questions.length === 0) throw new Error("Brak pytań do importu.");
  const batch = writeBatch(db);
  let ops = 0;
  for (const data of questions) {
    const questionId = doc(collection(db, "taskSets", setId, "questions")).id;
    const correctOptionIds = data.correctOptionIds ?? [];
    const payload: SetQuestionDoc = {
      order: data.order,
      kind: data.kind,
      prompt: data.prompt.trim(),
      number: data.number.trim() || String(data.order),
      points: normalizePoints(data.points),
      ...(data.options ? { options: data.options } : {}),
      ...(data.sourceTaskId !== undefined ? { sourceTaskId: data.sourceTaskId } : {}),
    };
    if (!payload.prompt) throw new Error("Każde pytanie musi mieć treść.");
    if (payload.kind === "single" || payload.kind === "multiple") {
      const opts = payload.options ?? [];
      if (opts.length < 2) throw new Error("Pytanie zamknięte wymaga co najmniej 2 opcji.");
      if (payload.kind === "single" && correctOptionIds.length !== 1) {
        throw new Error("Jednokrotny wybór: dokładnie jedna poprawna odpowiedź.");
      }
      if (payload.kind === "multiple" && correctOptionIds.length < 1) {
        throw new Error("Wielokrotny wybór: co najmniej jedna poprawna odpowiedź.");
      }
      batch.set(doc(db, "taskSets", setId, "answerKeys", questionId), { correctOptionIds });
      ops += 1;
    }
    batch.set(doc(db, "taskSets", setId, "questions", questionId), payload);
    ops += 1;
    if (ops >= 400) {
      throw new Error("Za dużo pytań naraz — wklej mniejszą partię (max ok. 150).");
    }
  }
  batch.update(doc(db, "taskSets", setId), { updatedAt: new Date().toISOString() });
  await batch.commit();
  return questions.length;
}

/**
 * Jeśli nie ma żadnego zestawu — tworzy „Zestaw podstawowy” z aktywnych zadań ledger.
 */
export async function ensureDefaultTaskSet(createdBy: string): Promise<TaskSet[]> {
  let sets = await listTaskSets();
  if (sets.length > 0) return sets;

  const setId = await createTaskSet(DEFAULT_SET_NAME, createdBy);
  const bankSnap = await getDocs(query(collection(db, "tasks"), where("active", "==", true)));
  const bank = bankSnap.docs.map((d) => ({ id: d.id, task: d.data() as TaskDoc }));
  const batch = writeBatch(db);
  let ops = 0;
  bank
    .sort((a, b) => a.task.number.localeCompare(b.task.number, "pl", { numeric: true }))
    .forEach(({ id, task }, index) => {
      const qRef = doc(collection(db, "taskSets", setId, "questions"));
      const payload: SetQuestionDoc = {
        order: index + 1,
        kind: "ledger",
        prompt: task.prompt,
        number: task.number,
        points: 1,
        sourceTaskId: id,
      };
      batch.set(qRef, payload);
      ops += 1;
    });
  if (ops > 0) await batch.commit();
  sets = await listTaskSets();
  return sets;
}
