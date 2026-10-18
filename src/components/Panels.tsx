import { formatMoney } from "../domain/money";
import type { BoardSummary, ResultMode } from "../domain/ledger";
import type { Task } from "../state";

export function LessonPanel({ task }: { task: Task }) {
  return (
    <section className="story">
      <p className="prompt">{task.prompt || "Brak treści polecenia."}</p>
      {task.kind === "quiz" && task.quiz ? (
        <ol className="quiz">
          {task.quiz.map((item) => (
            <li key={item.question}>
              <p>{item.question}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

export function SummaryPanel({
  summary,
  mode,
  onMode,
}: {
  summary: BoardSummary;
  mode: ResultMode;
  onMode: (mode: ResultMode) => void;
  /** @deprecated tryb podglądu i tak pozwala przełączać źródło kosztów */
  readOnly?: boolean;
}) {
  return (
    <section className="summary-stack" aria-label="Skutki operacji">
      <Card label="Przychód" value={summary.revenue} />
      <Card label="Wpływ" value={summary.inflow} />
      <Card label="Koszt" value={summary.cost} />
      <Card label="Wydatek" value={summary.outflow} />
      <Card label="Wynik z kont" value={summary.result} emphasize />
      {summary.hasVat ? (
        <Card label="VAT do zapłaty" value={summary.vatToPay} hint={`należny ${formatMoney(summary.vatOutput)} · naliczony ${formatMoney(summary.vatInput)}`} />
      ) : null}
      {summary.hasInventory ? <Card label="Zapas" value={summary.inventory} /> : null}
      {summary.hasFixedAsset ? <Card label="Środki trwałe netto" value={summary.fixedAssetNet} /> : null}
      {summary.hasRmk ? <Card label="RMK" value={summary.rmk} /> : null}
      {summary.hasReceivable ? (
        <Card
          label="Należność po odpisie"
          value={summary.receivableNet}
          hint={`brutto ${formatMoney(summary.receivableGross)} · odpis ${formatMoney(summary.allowance)}`}
        />
      ) : null}
      <article className="metric note">
        <p>Źródło kosztów</p>
        <div className="mode-split" role="group" aria-label="Źródło kosztów wyniku">
          <button type="button" className={mode === "nature" ? "is-current" : ""} onClick={() => onMode("nature")}>
            Zespół 4
          </button>
          <button type="button" className={mode === "function" ? "is-current" : ""} onClick={() => onMode("function")}>
            Zespół 5
          </button>
        </div>
        <small>Zmiana kasy {formatMoney(summary.cashChange)}.</small>
        {summary.parallelWarning ? <small>Oba zespoły mają salda. Liczę tylko wybrane źródło, żeby nie podwoić kosztu.</small> : null}
        {summary.clearingBalance !== 0 ? <small>Konto rozliczeniowe ma saldo {formatMoney(summary.clearingBalance)}. To jeszcze nie wynik.</small> : null}
      </article>
    </section>
  );
}

function Card({ label, value, hint, emphasize = false }: { label: string; value: number; hint?: string; emphasize?: boolean }) {
  const tone = value < 0 ? "negative" : value > 0 ? "positive" : "";
  return (
    <article className={`metric ${emphasize ? "emphasize" : ""} ${tone}`}>
      <p>{label}</p>
      <strong>{formatMoney(value)}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}
