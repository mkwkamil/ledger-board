import { fetchSessionTasks } from "./api";
import { formatSessionResult } from "./grade";
import { normalizePoints, questionKindLabel } from "./questionTypes";

function protocolKindLabel(kind: string): string {
  if (kind === "ledger" || kind === "single" || kind === "multiple" || kind === "open") {
    return questionKindLabel(kind);
  }
  if (kind === "quiz") return "Quiz";
  if (kind === "principles") return "Zasady";
  return kind;
}
import type { ExamEvent } from "./examsApi";
import type { SessionDoc, SessionTaskDoc } from "../firebase/types";

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function statusLabel(status: SessionDoc["status"]): string {
  if (status === "in_progress") return "W trakcie";
  if (status === "submitted") return "Oddane";
  if (status === "expired") return "Wygasłe";
  return status;
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "test";
}

function taskAwarded(task: SessionTaskDoc): number | null {
  if (task.manualScore != null) return task.manualScore;
  if (task.kind === "single" || task.kind === "multiple") {
    return task.autoScore ?? null;
  }
  return null;
}

function taskScoreLabel(task: SessionTaskDoc): string {
  const max = normalizePoints(task.points);
  const earned = taskAwarded(task);
  if (earned == null) return `—/${max}`;
  return `${earned}/${max}`;
}

export interface ProtocolSessionRow {
  session: SessionDoc & { id: string };
  tasks: Array<SessionTaskDoc & { id: string }>;
}

export async function loadProtocolData(
  sessions: Array<SessionDoc & { id: string }>,
): Promise<ProtocolSessionRow[]> {
  const sorted = [...sessions].sort((a, b) => {
    const byLast = a.lastName.localeCompare(b.lastName, "pl");
    if (byLast !== 0) return byLast;
    return a.firstName.localeCompare(b.firstName, "pl");
  });
  const rows = await Promise.all(
    sorted.map(async (session) => ({
      session,
      tasks: await fetchSessionTasks(session.id),
    })),
  );
  return rows;
}

function buildProtocolHtml(
  exam: ExamEvent,
  setName: string | null,
  rows: ProtocolSessionRow[],
): string {
  const generatedAt = new Date().toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const submitted = rows.filter((r) => r.session.status === "submitted" || r.session.status === "expired");
  const inProgress = rows.filter((r) => r.session.status === "in_progress");
  const withScore = submitted.filter((r) => r.session.scoreMax != null && r.session.scoreMax > 0);
  const avg =
    withScore.length > 0
      ? (
          withScore.reduce((sum, r) => {
            const auto = r.session.scoreAuto ?? 0;
            const manual = r.session.scoreManual ?? 0;
            const max = r.session.scoreMax || 1;
            return sum + ((auto + manual) / max) * 100;
          }, 0) / withScore.length
        ).toFixed(1)
      : "—";

  const summaryRows = rows
    .map((row, index) => {
      const s = row.session;
      const result = formatSessionResult(s);
      const note =
        s.status !== "in_progress" && s.needsManualReview && s.scoreManual == null
          ? " (do sprawdzenia)"
          : "";
      return `<tr>
        <td class="num">${index + 1}</td>
        <td>${esc(s.lastName)} ${esc(s.firstName)}</td>
        <td>${esc(s.studentIndex)}</td>
        <td>${esc(statusLabel(s.status))}</td>
        <td>${esc(fmtDateTime(s.startedAt))}</td>
        <td>${esc(fmtDateTime(s.submittedAt))}</td>
        <td class="score">${esc(result)}${esc(note)}</td>
      </tr>`;
    })
    .join("\n");

  const detailBlocks = rows
    .map((row, index) => {
      const s = row.session;
      const taskCells = row.tasks
        .map((task, ti) => {
          return `<tr>
            <td>Z${ti + 1}</td>
            <td class="muted">${esc(task.number || String(ti + 1))}</td>
            <td>${esc(protocolKindLabel(task.kind))}</td>
            <td class="score">${esc(taskScoreLabel(task))}</td>
          </tr>`;
        })
        .join("\n");

      const total = formatSessionResult(s);
      return `<section class="student-block">
        <h3>${index + 1}. ${esc(s.lastName)} ${esc(s.firstName)} <span class="muted">· ${esc(s.studentIndex)}</span></h3>
        <p class="meta">${esc(s.email)} · ${esc(statusLabel(s.status))} · wynik <strong>${esc(total)}</strong></p>
        <table>
          <thead>
            <tr><th>Zadanie</th><th>Nr</th><th>Typ</th><th>Punkty</th></tr>
          </thead>
          <tbody>
            ${taskCells || `<tr><td colspan="4" class="muted">Brak zadań w sesji</td></tr>`}
          </tbody>
        </table>
      </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>Protokół — ${esc(exam.title)}</title>
  <style>
    @page { size: A4; margin: 16mm 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #1c1915;
      font: 11pt/1.45 "Source Sans 3", "Segoe UI", Arial, sans-serif;
    }
    h1 { font: 560 18pt Literata, Georgia, serif; margin: 0 0 4px; }
    h2 { font: 560 13pt Literata, Georgia, serif; margin: 22px 0 10px; border-bottom: 1px solid #d9cdb8; padding-bottom: 4px; }
    h3 { font: 600 11.5pt "Source Sans 3", Arial, sans-serif; margin: 0 0 4px; }
    .eyebrow { text-transform: uppercase; letter-spacing: 0.06em; font-size: 9pt; color: #6b6358; margin: 0 0 6px; }
    .meta { margin: 0 0 8px; color: #5f584f; font-size: 9.5pt; }
    .muted { color: #6b6358; font-weight: 500; }
    .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 12px 0 18px; font-size: 10pt; }
    .header-grid div span { display: block; color: #6b6358; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; }
    .stats { display: flex; flex-wrap: wrap; gap: 10px 18px; margin: 0 0 16px; font-size: 10pt; }
    .stats strong { font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    th, td { border: 1px solid #d9cdb8; padding: 5px 7px; text-align: left; vertical-align: top; }
    th { background: #f3eee6; font-weight: 650; }
    td.num, td.score { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .student-block { break-inside: avoid; margin: 0 0 16px; page-break-inside: avoid; }
    .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #d9cdb8; font-size: 9pt; color: #6b6358; display: grid; gap: 18px; }
    .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 28px; }
    .sign p { margin: 0 0 36px; font-size: 9.5pt; color: #6b6358; }
    .sign .line { border-bottom: 1px solid #1c1915; height: 1px; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    .toolbar {
      position: sticky; top: 0; z-index: 2;
      display: flex; gap: 10px; align-items: center; justify-content: flex-end;
      padding: 10px 0 14px; background: #fff;
    }
    .toolbar button {
      font: inherit; border-radius: 8px; border: 1px solid #c9bba6;
      background: #1d4a38; color: #fff; padding: 8px 14px; cursor: pointer; font-weight: 650;
    }
    .toolbar button.secondary { background: #fff; color: #1c1915; }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" class="secondary" onclick="window.close()">Zamknij</button>
    <button type="button" onclick="window.print()">Zapisz jako PDF / drukuj</button>
  </div>

  <p class="eyebrow">Protokół podejść testowych</p>
  <h1>${esc(exam.title)}</h1>
  <p class="meta">Dokument wygenerowany ${esc(generatedAt)}</p>

  <div class="header-grid">
    <div><span>Okno testu</span>${esc(fmtDateTime(exam.opensAt))} — ${esc(fmtDateTime(exam.closesAt))}</div>
    <div><span>Czas na rozwiązanie</span>${exam.durationMinutes} min</div>
    <div><span>Liczba pytań</span>${exam.questionCount ?? "—"}</div>
    <div><span>Zestaw</span>${esc(setName ?? "—")}</div>
  </div>

  <div class="stats">
    <div>Podejścia: <strong>${rows.length}</strong></div>
    <div>Oddane / wygasłe: <strong>${submitted.length}</strong></div>
    <div>W trakcie: <strong>${inProgress.length}</strong></div>
    <div>Średni wynik (%): <strong>${avg}</strong></div>
  </div>

  <h2>1. Zestawienie wyników</h2>
  <table>
    <thead>
      <tr>
        <th>Lp.</th>
        <th>Student</th>
        <th>Indeks</th>
        <th>Status</th>
        <th>Start</th>
        <th>Oddanie</th>
        <th>Wynik</th>
      </tr>
    </thead>
    <tbody>
      ${summaryRows || `<tr><td colspan="7" class="muted">Brak podejść</td></tr>`}
    </tbody>
  </table>

  <h2>2. Rozkład punktów per zadanie</h2>
  ${detailBlocks || `<p class="muted">Brak danych do rozkładu.</p>`}

  <div class="footer">
    <p>Dokument wygenerowany automatycznie z systemu ledger-board. Zawiera zestawienie podejść oraz przyznane punkty za poszczególne zadania sesji.</p>
    <div class="sign">
      <div>
        <p>Podpis prowadzącego</p>
        <div class="line"></div>
      </div>
      <div>
        <p>Data</p>
        <div class="line"></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/** Otwiera protokół w nowym oknie (drukuj / Zapisz jako PDF). */
export async function exportExamProtocolPdf(
  exam: ExamEvent,
  setName: string | null,
  sessions: Array<SessionDoc & { id: string }>,
): Promise<void> {
  if (sessions.length === 0) {
    throw new Error("Brak podejść do wyeksportowania.");
  }
  const rows = await loadProtocolData(sessions);
  const html = buildProtocolHtml(exam, setName, rows);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `protokol-${slugify(exam.title)}-${stamp}`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    // Fallback: bezpośrednie pobranie HTML, jeśli przeglądarka blokuje popup
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.html`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    throw new Error("Przeglądarka zablokowała okno. Pobrano plik HTML — otwórz go i wybierz Drukuj → Zapisz jako PDF.");
  }
  win.document.title = filename;
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
