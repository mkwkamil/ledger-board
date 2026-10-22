import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { KIND_LABELS, createAccount, type AccountDef, type AccountKind, type Side } from "../domain/accounts";
import type { JournalLine } from "../domain/ledger";
import { formatMoney, moneyInputValue, parseMoney, parseMoneyAllowZero } from "../domain/money";
import { PRESETS } from "../data/chart";
import type { ActivityItem } from "../storage";
import { IconChevronDown, IconTrash } from "./Icons";

function useEscapeClose(onClose: () => void) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
}

function DialogBackdrop({
  onClose,
  prompt,
  wide,
  children,
}: {
  onClose: () => void;
  prompt?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const [promptOpen, setPromptOpen] = useState(true);
  const promptText = prompt?.trim() ?? "";

  return (
    <div className="backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className={`backdrop-stack${wide ? " is-wide" : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {promptText ? (
          <section className={`dialog-prompt${promptOpen ? " is-open" : ""}`} aria-label="Polecenie zadania">
            <button
              type="button"
              className="dialog-prompt-toggle"
              onClick={() => setPromptOpen((open) => !open)}
              aria-expanded={promptOpen}
              aria-controls="dialog-prompt-body"
            >
              <span className="dialog-prompt-label">Polecenie</span>
              <span className="dialog-prompt-chevron" aria-hidden="true">
                <IconChevronDown />
              </span>
            </button>
            {promptOpen ? (
              <p id="dialog-prompt-body" className="dialog-prompt-body">
                {promptText}
              </p>
            ) : null}
          </section>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function AccountDialog({
  onClose,
  onOpen,
  prompt,
}: {
  onClose: () => void;
  onOpen: (account: AccountDef) => void;
  prompt?: string;
}) {
  const [query, setQuery] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("asset");
  const needle = query.trim().toLowerCase();
  const presets = PRESETS.filter((account) => `${account.code} ${account.name}`.toLowerCase().includes(needle));
  useEscapeClose(onClose);

  return (
    <DialogBackdrop onClose={onClose} prompt={prompt}>
      <div
        className="dialog account-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="open-account-title"
      >
        <header className="dialog-head">
          <div>
            <h2 id="open-account-title">Otwórz konto</h2>
            <p className="dialog-sub">Wybierz konto z planu kont. Program nie otworzy kont za Ciebie przy księgowaniu.</p>
          </div>
          <button type="button" className="icon-button ghost dialog-close" onClick={onClose} aria-label="Zamknij" title="Zamknij">
            ×
          </button>
        </header>

        {!customOpen ? (
          <>
            <label className="account-search">
              <span>Szukaj</span>
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Numer albo nazwa konta"
                aria-label="Szukaj konta"
              />
            </label>
            <div className="account-list-block">
              <ul className="preset-list">
                {presets.length === 0 ? (
                  <li className="preset-empty">
                    <p className="quiet">Brak kont pasujących do wyszukiwania.</p>
                  </li>
                ) : (
                  presets.map((account) => (
                    <li key={account.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onOpen({ code: account.code, name: account.name, kind: account.kind });
                          onClose();
                        }}
                      >
                        <b>{account.code}</b>
                        <span>{account.name}</span>
                        <small>zespół {account.team}</small>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="entry-actions account-dialog-actions">
              <button type="button" className="text-button" onClick={() => setCustomOpen(true)}>
                + Własne konto
              </button>
            </div>
          </>
        ) : (
          <form
            className="custom-account-panel"
            onSubmit={(event) => {
              event.preventDefault();
              if (!/^[0-9A-Za-z][0-9A-Za-z./-]{0,14}$/.test(code.trim()) || name.trim().length < 2) return;
              onOpen(createAccount(code, name, kind));
              onClose();
            }}
          >
            <p className="quiet custom-account-note">Używaj tylko gdy konta nie ma na liście.</p>
            <div className="form-grid meta-grid">
              <label>
                Numer
                <input autoFocus value={code} onChange={(event) => setCode(event.target.value)} required placeholder="np. 249" />
              </label>
              <label>
                Nazwa
                <input value={name} onChange={(event) => setName(event.target.value)} required placeholder="np. Rozrachunki inne" />
              </label>
            </div>
            <div className="kind-field">
              <span>Znaczenie</span>
              <KindPicker value={kind} onChange={setKind} />
            </div>
            <div className="entry-actions">
              <button type="button" className="secondary" onClick={() => setCustomOpen(false)}>
                Wróć do listy
              </button>
              <button type="submit" className="primary">
                Otwórz konto
              </button>
            </div>
          </form>
        )}
      </div>
    </DialogBackdrop>
  );
}

interface DraftLine {
  accountCode: string;
  side: Side | "";
  amount: string;
}

function emptyLine(): DraftLine {
  return { accountCode: "", side: "", amount: "" };
}

export function EntryDialog({
  opened,
  presetAccountCode = "",
  onClose,
  onPost,
  prompt,
}: {
  opened: AccountDef[];
  presetAccountCode?: string;
  onClose: () => void;
  onPost: (entry: { description: string; period: string; opening: boolean; lines: JournalLine[] }) => void;
  prompt?: string;
}) {
  const [tab, setTab] = useState<"entry" | "opening">("entry");
  useEscapeClose(onClose);
  return (
    <DialogBackdrop onClose={onClose} prompt={prompt} wide>
      <div className="dialog wide entry-dialog" role="dialog" aria-modal="true" aria-labelledby="entry-title">
        <header className="dialog-head">
          <div>
            <h2 id="entry-title">Nowa operacja</h2>
            <p className="dialog-sub">
              {tab === "opening"
                ? "Saldo początkowe nie wchodzi do przychodu, kosztu, wpływu ani wydatku."
                : "Wybierz konta, stronę Wn/Ma i kwoty."}
            </p>
          </div>
          <button type="button" className="icon-button ghost dialog-close" onClick={onClose} aria-label="Zamknij" title="Zamknij">
            ×
          </button>
        </header>
        <div className="segment-tabs" role="tablist">
          <button type="button" className={tab === "entry" ? "is-current" : ""} onClick={() => setTab("entry")}>
            Dekret
          </button>
          <button type="button" className={tab === "opening" ? "is-current" : ""} onClick={() => setTab("opening")}>
            Saldo początkowe
          </button>
        </div>
        <ManualForm
          key={`${tab}-${presetAccountCode}`}
          opened={opened}
          opening={tab === "opening"}
          presetAccountCode={presetAccountCode}
          onClose={onClose}
          onPost={onPost}
        />
      </div>
    </DialogBackdrop>
  );
}

function ManualForm({
  opened,
  opening,
  presetAccountCode,
  onClose,
  onPost,
}: {
  opened: AccountDef[];
  opening: boolean;
  presetAccountCode: string;
  onClose: () => void;
  onPost: (entry: { description: string; period: string; opening: boolean; lines: JournalLine[] }) => void;
}) {
  const [description, setDescription] = useState("");
  const [period, setPeriod] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ accountCode: presetAccountCode, side: "", amount: "" }]);
  const journalLines: JournalLine[] = lines
    .filter((line): line is DraftLine & { side: Side } => line.accountCode !== "" && line.side !== "" && parseMoney(line.amount) !== null)
    .map((line) => ({ accountCode: line.accountCode, side: line.side, amount: parseMoney(line.amount)! }));
  const canPost = journalLines.length > 0;

  if (opened.length === 0) {
    return (
      <div className="empty-entry">
        <p>Najpierw otwórz konta na tablicy przyciskiem „Otwórz konto”. Dopiero potem wybierzesz je tutaj i wskażesz Wn albo Ma.</p>
      </div>
    );
  }

  return (
    <form
      className="entry-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canPost) return;
        onPost({ description: description.trim(), period: period.trim(), opening, lines: journalLines });
        onClose();
      }}
    >
      <div className="form-grid meta-grid">
        <label>
          Opis
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="np. sprzedaż usługi" />
        </label>
        <label>
          Okres
          <input value={period} onChange={(event) => setPeriod(event.target.value)} placeholder="np. grudzień" />
        </label>
      </div>
      <div className="lines-block">
        <div className="lines-head">
          <span>Pozycje</span>
          <button type="button" className="text-button" onClick={() => setLines([...lines, emptyLine()])}>
            + Dodaj pozycję
          </button>
        </div>
        <div className="lines-list">
          {lines.map((line, index) => (
            <div className="line-edit" key={index}>
              <div className="line-account">
                <span>Konto</span>
                <AccountPicker
                  accounts={opened}
                  value={line.accountCode}
                  label={`Konto pozycji ${index + 1}`}
                  onChange={(code) => setLines(lines.map((item, itemIndex) => (itemIndex === index ? { ...item, accountCode: code } : item)))}
                />
              </div>
              <div className="line-side">
                <span>Strona</span>
                <div className="side-toggle" role="group" aria-label={`Strona pozycji ${index + 1}`}>
                  {(["Wn", "Ma"] as Side[]).map((side) => (
                    <button
                      key={side}
                      type="button"
                      className={line.side === side ? "is-current" : ""}
                      onClick={() => setLines(lines.map((item, itemIndex) => (itemIndex === index ? { ...item, side } : item)))}
                    >
                      {side}
                    </button>
                  ))}
                </div>
              </div>
              <div className="line-amount">
                <span>Kwota</span>
                <div className="line-amount-row">
                  <input
                    inputMode="decimal"
                    value={line.amount}
                    onChange={(event) => setLines(lines.map((item, itemIndex) => (itemIndex === index ? { ...item, amount: event.target.value } : item)))}
                    placeholder="0,00"
                    aria-label={`Kwota pozycji ${index + 1}`}
                  />
                  {lines.length > 1 ? (
                    <button
                      type="button"
                      className="icon-button danger line-remove"
                      onClick={() => setLines(lines.filter((_, itemIndex) => itemIndex !== index))}
                      aria-label={`Usuń pozycję ${index + 1}`}
                      title="Usuń pozycję"
                    >
                      <IconTrash />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="entry-actions">
        <button type="button" className="secondary" onClick={onClose}>
          Anuluj
        </button>
        <button type="submit" className="primary" disabled={!canPost}>
          Zaksięguj
        </button>
      </div>
    </form>
  );
}

/** Edycja kwoty pojedynczego wpisu na koncie T. Kwota 0 = usunięcie operacji. */
export function EditLineDialog({
  accountCode,
  side,
  mark,
  amount,
  onClose,
  onSave,
  onDelete,
}: {
  accountCode: string;
  side: Side;
  mark: string;
  amount: number;
  onClose: () => void;
  onSave: (amount: number) => void;
  onDelete: () => void;
}) {
  const [value, setValue] = useState(moneyInputValue(amount));
  const parsed = parseMoneyAllowZero(value);
  const canSubmit = parsed !== null;
  useEscapeClose(onClose);

  return (
    <div className="backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="dialog edit-line-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-line-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-head">
          <div>
            <h2 id="edit-line-title">Edytuj wpis {mark}</h2>
            <p className="dialog-sub">
              Konto {accountCode} · {side}. Ustaw 0, aby usunąć operację.
            </p>
          </div>
          <button type="button" className="icon-button ghost dialog-close" onClick={onClose} aria-label="Zamknij" title="Zamknij">
            ×
          </button>
        </header>
        <form
          className="entry-form edit-line-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (parsed === null) return;
            if (parsed === 0) {
              onClose();
              onDelete();
              return;
            }
            onSave(parsed);
            onClose();
          }}
        >
          <label>
            Kwota
            <input
              autoFocus
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="0,00"
              aria-label="Kwota wpisu"
            />
          </label>
          <div className="entry-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Anuluj
            </button>
            <button type="submit" className="primary" disabled={!canSubmit}>
              Zapisz
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type MenuBox = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
};

function useFloatingMenu(open: boolean, rootRef: React.RefObject<HTMLDivElement | null>) {
  const [menuBox, setMenuBox] = useState<MenuBox | null>(null);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setMenuBox(null);
      return;
    }
    function place() {
      const trigger = rootRef.current?.querySelector<HTMLElement>(".account-picker-trigger");
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const gap = 4;
      const spaceBelow = window.innerHeight - rect.bottom - gap - 12;
      const spaceAbove = rect.top - gap - 12;
      const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(120, Math.min(280, openUp ? spaceAbove : spaceBelow));
      setMenuBox(
        openUp
          ? { bottom: window.innerHeight - rect.top + gap, left: rect.left, width: rect.width, maxHeight }
          : { top: rect.bottom + gap, left: rect.left, width: rect.width, maxHeight },
      );
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, rootRef]);

  return menuBox;
}

function KindPicker({ value, onChange }: { value: AccountKind; onChange: (kind: AccountKind) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const menuBox = useFloatingMenu(open, rootRef);
  const options = Object.entries(KIND_LABELS) as Array<[AccountKind, string]>;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const menu =
    open && menuBox
      ? createPortal(
          <ul
            className="account-picker-menu is-plain"
            id={listId}
            role="listbox"
            aria-label="Znaczenie konta"
            ref={menuRef}
            style={{
              top: menuBox.top,
              bottom: menuBox.bottom,
              left: menuBox.left,
              width: menuBox.width,
              maxHeight: menuBox.maxHeight,
            }}
          >
            {options.map(([option, label]) => (
              <li key={option} role="option" aria-selected={value === option}>
                <button
                  type="button"
                  className={value === option ? "is-current" : ""}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  <span>{label}</span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div className={`account-picker ${open ? "is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="account-picker-trigger"
        aria-label="Znaczenie konta"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="account-picker-value is-plain">
          <span>{KIND_LABELS[value]}</span>
        </span>
        <IconChevronDown />
      </button>
      {menu}
    </div>
  );
}

function AccountPicker({
  accounts,
  value,
  label,
  onChange,
}: {
  accounts: AccountDef[];
  value: string;
  label: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const menuBox = useFloatingMenu(open, rootRef);
  const selected = accounts.find((account) => account.code === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const menu =
    open && menuBox
      ? createPortal(
          <ul
            className="account-picker-menu"
            id={listId}
            role="listbox"
            aria-label={label}
            ref={menuRef}
            style={{
              top: menuBox.top,
              bottom: menuBox.bottom,
              left: menuBox.left,
              width: menuBox.width,
              maxHeight: menuBox.maxHeight,
            }}
          >
            <li role="option" aria-selected={!value}>
              <button
                type="button"
                className={!value ? "is-current" : ""}
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <span className="account-picker-placeholder">Wybierz konto…</span>
              </button>
            </li>
            {accounts.map((account) => (
              <li key={account.code} role="option" aria-selected={value === account.code}>
                <button
                  type="button"
                  className={value === account.code ? "is-current" : ""}
                  onClick={() => {
                    onChange(account.code);
                    setOpen(false);
                  }}
                >
                  <b>{account.code}</b>
                  <span>{account.name}</span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div className={`account-picker ${open ? "is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="account-picker-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        {selected ? (
          <span className="account-picker-value">
            <b>{selected.code}</b>
            <span>{selected.name}</span>
          </span>
        ) : (
          <span className="account-picker-placeholder">Wybierz konto…</span>
        )}
        <IconChevronDown />
      </button>
      {menu}
    </div>
  );
}

export function TaskDialog({
  mode,
  initialNumber,
  initialPrompt,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  initialNumber: string;
  initialPrompt: string;
  onClose: () => void;
  onSubmit: (values: { number: string; prompt: string }) => void;
}) {
  const [number, setNumber] = useState(initialNumber);
  const [prompt, setPrompt] = useState(initialPrompt);
  useEscapeClose(onClose);
  return (
    <div className="backdrop" role="presentation" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2 id="task-dialog-title">{mode === "create" ? "Nowe zadanie" : "Edytuj zadanie"}</h2>
          <button type="button" className="text-button" onClick={onClose}>
            Zamknij
          </button>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!number.trim()) return;
            onSubmit({ number: number.trim(), prompt });
            onClose();
          }}
        >
          <label>
            Numer lub nazwa
            <input
              autoFocus
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              placeholder="np. 1 albo zakup materiałów"
              required
            />
          </label>
          <label>
            Treść zadania
            <textarea
              className="prompt-input"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Treść polecenia — bez podpowiedzi"
              rows={6}
            />
          </label>
          <div className="entry-actions">
            <button type="submit" className="primary">
              {mode === "create" ? "Utwórz" : "Zapisz"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function LogDialog({
  log,
  activeEntryId,
  liveEntryIds,
  onSelect,
  onClose,
}: {
  log: ActivityItem[];
  activeEntryId: string | null;
  liveEntryIds: Set<string>;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  useEscapeClose(onClose);
  return (
    <div className="backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="dialog wide log-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-head">
          <div>
            <h2 id="log-title">Log operacji</h2>
            <p className="dialog-sub">Operacje w kolejności wykonania na tym zadaniu.</p>
          </div>
          <button type="button" className="icon-button ghost dialog-close" onClick={onClose} aria-label="Zamknij" title="Zamknij">
            ×
          </button>
        </header>
        {log.length === 0 ? (
          <p className="quiet">Nie wykonano jeszcze żadnej operacji.</p>
        ) : (
          <ol className="log-list">
            {log.map((item, index) => {
              const selectable =
                (item.kind === "post-entry" || item.kind === "update-entry") &&
                !!item.entryId &&
                liveEntryIds.has(item.entryId);
              const mark =
                (item.kind === "post-entry" || item.kind === "update-entry") && item.opening
                  ? "BO"
                  : `(${index + 1})`;
              const note = [item.description?.trim(), item.period?.trim()].filter(Boolean).join(" · ");
              const content = (
                <>
                  <span className="log-mark">{mark}</span>
                  <span className="log-body">
                    {item.kind === "open-account" ? (
                      <span className="log-event">
                        Otwarto konto <b>{item.accountCode}</b> {item.accountName}
                      </span>
                    ) : null}
                    {item.kind === "close-account" ? (
                      <span className="log-event">
                        Usunięto konto <b>{item.accountCode}</b> {item.accountName}
                      </span>
                    ) : null}
                    {item.kind === "delete-entry" ? (
                      <span className="log-row">
                        <span className="log-event">Usunięto operację</span>
                        <span className="log-lines">
                          {(item.lines ?? []).map((line, lineIndex) => (
                            <em key={`${item.id}-${lineIndex}`}>
                              {line.side} {line.accountCode} {formatMoney(line.amount)}
                            </em>
                          ))}
                        </span>
                        {note ? <span className="log-note">{note}</span> : null}
                      </span>
                    ) : null}
                    {item.kind === "update-entry" ? (
                      <span className="log-row">
                        <span className="log-event">Zmieniono operację</span>
                        <span className="log-lines">
                          {(item.lines ?? []).map((line, lineIndex) => (
                            <em key={`${item.id}-${lineIndex}`}>
                              {line.side} {line.accountCode} {formatMoney(line.amount)}
                            </em>
                          ))}
                        </span>
                        {note ? <span className="log-note">{note}</span> : null}
                      </span>
                    ) : null}
                    {item.kind === "post-entry" ? (
                      <span className="log-row">
                        <span className="log-event">{item.opening ? "Dodano saldo początkowe" : "Dodano operację"}</span>
                        <span className="log-lines">
                          {(item.lines ?? []).map((line, lineIndex) => (
                            <em key={`${item.id}-${lineIndex}`}>
                              {line.side} {line.accountCode} {formatMoney(line.amount)}
                            </em>
                          ))}
                        </span>
                        {note ? <span className="log-note">{note}</span> : null}
                      </span>
                    ) : null}
                  </span>
                </>
              );
              return (
                <li key={item.id}>
                  {selectable ? (
                    <button
                      type="button"
                      className={activeEntryId === item.entryId ? "is-current" : ""}
                      onClick={() => onSelect(item.entryId!)}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="log-static">{content}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Potwierdź",
  cancelLabel = "Anuluj",
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEscapeClose(onClose);
  return (
    <div className="backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="dialog confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="confirm-head">
          <h2 id="confirm-title">{title}</h2>
          <p className="dialog-sub">{message}</p>
        </header>
        <div className="entry-actions confirm-actions">
          <button type="button" className="secondary" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? "primary danger" : "primary"}
            autoFocus
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
