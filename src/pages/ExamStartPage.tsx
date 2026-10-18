import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { startExamSession } from "../exam/api";
import { getExam, isExamAccepting, isExamWindowOpen, type ExamEvent } from "../exam/examsApi";

export default function ExamStartPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<ExamEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [studentIndex, setStudentIndex] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;
    (async () => {
      try {
        const found = await getExam(examId);
        if (cancelled) return;
        setExam(found);
        if (!found) setError("Nie znaleziono testu.");
        else if (!isExamAccepting(found)) {
          if (found.acceptingSubmissions === false) {
            setError("Prowadzący wstrzymał nowe podejścia do tego testu.");
          } else if (!isExamWindowOpen(found)) {
            const now = Date.now();
            if (now < new Date(found.opensAt).getTime()) {
              setError(`Test otworzy się ${new Date(found.opensAt).toLocaleString("pl-PL")}.`);
            } else {
              setError("Termin testu już minął.");
            }
          } else {
            setError("Ten test nie jest teraz dostępny.");
          }
        }
      } catch {
        if (!cancelled) setError("Nie udało się wczytać testu.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!examId || !exam || !isExamAccepting(exam)) return;
    setError(null);
    setBusy(true);
    try {
      const started = await startExamSession({ firstName, lastName, email, studentIndex, examId });
      navigate(`/exams/sesja/${started.sessionId}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Nie udało się rozpocząć testu.");
    } finally {
      setBusy(false);
    }
  }

  const canStart = Boolean(exam && isExamAccepting(exam));

  return (
    <div className="page-shell narrow">
      <header className="page-shell-header">
        <div>
          <p className="eyebrow">Sesja testowa</p>
          <h1>{exam?.title ?? "Test"}</h1>
        </div>
      </header>
      <div className="page-shell-body">
        {loading ? <p className="muted">Sprawdzanie dostępności…</p> : null}
        {!loading && exam && canStart ? (
          <>
            <p className="exam-start-meta">
              Czas na rozwiązanie: <strong>{exam.durationMinutes} min</strong>
              <span className="muted">
                {" "}
                · otwarte do {new Date(exam.closesAt).toLocaleString("pl-PL")}
              </span>
            </p>
            <p className="muted">Podaj dane i rozpocznij. Po starcie nie będzie można wrócić do tego formularza.</p>
            <form className="stack-form" onSubmit={onSubmit}>
              <label>
                Imię
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" />
              </label>
              <label>
                Nazwisko
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" />
              </label>
              <label>
                Email uczelniany
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </label>
              <label>
                Numer indeksu
                <input value={studentIndex} onChange={(e) => setStudentIndex(e.target.value)} required autoComplete="off" />
              </label>
              {error ? <p className="form-error">{error}</p> : null}
              <button type="submit" className="primary" disabled={busy}>
                {busy ? "Tworzenie sesji…" : "Rozpocznij test"}
              </button>
            </form>
          </>
        ) : null}
        {!loading && !canStart ? (
          <p className={error ? "form-error" : "empty-exam-message"}>{error ?? "Test niedostępny."}</p>
        ) : null}
      </div>
    </div>
  );
}
