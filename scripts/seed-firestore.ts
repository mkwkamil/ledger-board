/**
 * Seed examConfig + bank zadań do Firestore.
 *
 *   cp .env.seed.example .env.seed   # uzupełnij email/hasło admina
 *   npx tsx scripts/seed-firestore.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, writeBatch } from "firebase/firestore";
import { LESSONS } from "../src/data/lessons";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile(resolve(root, ".env"));
loadEnvFile(resolve(root, ".env.seed"));

const adminEmail = (process.env.VITE_ADMIN_EMAIL ?? "").trim();
const email = (process.env.SEED_ADMIN_EMAIL ?? "").trim();
const password = process.env.SEED_ADMIN_PASSWORD;
if (!adminEmail) {
  console.error("Ustaw VITE_ADMIN_EMAIL w .env");
  process.exit(1);
}
if (!email || !password) {
  console.error("Ustaw SEED_ADMIN_EMAIL i SEED_ADMIN_PASSWORD w .env.seed");
  process.exit(1);
}
if (email.toLowerCase() !== adminEmail.toLowerCase()) {
  console.error(`Seed admin musi być ${adminEmail} (dostałem: ${email})`);
  process.exit(1);
}

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
});

const auth = getAuth(app);
const db = getFirestore(app);

try {
  await signInWithEmailAndPassword(auth, email, password);
  console.log("Zalogowano admina:", email);
} catch (err) {
  console.error(
    "Nie udało się zalogować admina. Rejestracja jest wyłączona — konto musi już istnieć w Firebase Auth:",
    adminEmail,
  );
  console.error(err);
  process.exit(1);
}

await setDoc(doc(db, "examConfig", "default"), {
  durationMinutes: 60,
  emailDomain: null,
});
console.log("Zapisano examConfig/default");

const batchSize = 400;
let batch = writeBatch(db);
let count = 0;
let ops = 0;

for (const lesson of LESSONS) {
  batch.set(doc(db, "tasks", lesson.id), {
    number: lesson.number,
    prompt: lesson.prompt,
    active: true,
    kind: lesson.kind,
    ...(lesson.quiz ? { quiz: lesson.quiz } : {}),
  });
  ops += 1;
  count += 1;
  if (ops >= batchSize) {
    await batch.commit();
    batch = writeBatch(db);
    ops = 0;
  }
}
if (ops > 0) await batch.commit();
console.log(`Zapisano ${count} zadań w tasks/`);
process.exit(0);
