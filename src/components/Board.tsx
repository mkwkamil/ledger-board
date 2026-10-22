import { useState } from "react";
import { pictureAccount, type JournalEntry } from "../domain/ledger";
import { formatMoney } from "../domain/money";
import type { AccountDef, Side } from "../domain/accounts";
import { ConfirmDialog, EditLineDialog } from "./Dialogs";
import { IconEdit, IconTrash } from "./Icons";

interface BoardProps {
  opened: AccountDef[];
  entries: JournalEntry[];
  activeEntryId: string | null;
  onClose: (code: string) => void;
  onDeleteEntry: (id: string) => void;
  onUpdateEntryLine: (entryId: string, lineIndex: number, amount: number) => void;
  onOpen: () => void;
  onAccountClick: (code: string) => void;
  readOnly?: boolean;
}

interface PendingConfirm {
  title: string;
  message: string;
  confirmLabel: string;
  action: () => void;
}

interface PendingEdit {
  accountCode: string;
  side: Side;
  mark: string;
  entryId: string;
  lineIndex: number;
  amount: number;
}

export function Board({
  opened,
  entries,
  activeEntryId,
  onClose,
  onDeleteEntry,
  onUpdateEntryLine,
  onOpen,
  onAccountClick,
  readOnly = false,
}: BoardProps) {
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [editLine, setEditLine] = useState<PendingEdit | null>(null);

  function askDeleteEntry(entryId: string, mark: string) {
    setConfirm({
      title: "Usuń operację",
      message: `Usunąć operację ${mark} z tablicy?`,
      confirmLabel: "Usuń operację",
      action: () => onDeleteEntry(entryId),
    });
  }

  if (opened.length === 0) {
    return (
      <section className="empty-board">
        <h2>Pusta tablica</h2>
        {readOnly ? (
          <p>Brak otwartych kont w tym zadaniu.</p>
        ) : (
          <>
            <p>Najpierw otwórz konta przyciskiem „Otwórz konto”. Potem kliknij konto albo użyj „Nowa operacja”.</p>
            <button type="button" className="primary" onClick={onOpen}>
              Otwórz pierwsze konto
            </button>
          </>
        )}
      </section>
    );
  }

  return (
    <>
      <section className="board" aria-label="Konta T">
        {opened.map((account) => {
          const picture = pictureAccount(account, entries);
          const wn = picture.lines.filter((line) => line.side === "Wn");
          const ma = picture.lines.filter((line) => line.side === "Ma");
          const editing = editingCode === account.code;
          return (
            <article
              key={account.code}
              className={`t-account ${readOnly ? "" : "is-clickable"} ${editing ? "is-editing" : ""}`}
              role={readOnly ? undefined : "button"}
              tabIndex={readOnly ? undefined : 0}
              onClick={() => {
                if (readOnly || editing) return;
                onAccountClick(account.code);
              }}
              onKeyDown={(event) => {
                if (readOnly || editing) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onAccountClick(account.code);
                }
              }}
            >
              <header>
                <div>
                  <span className="code">{account.code}</span>
                  <h3>{account.name}</h3>
                </div>
                {readOnly ? null : (
                  <div className="t-account-actions">
                    <button
                      type="button"
                      className={`icon-button ghost t-action ${editing ? "is-active" : ""}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingCode(editing ? null : account.code);
                      }}
                      aria-label={editing ? `Zakończ edycję konta ${account.code}` : `Edytuj zapisy konta ${account.code}`}
                      title={editing ? "Zakończ edycję" : "Edytuj zapisy"}
                      aria-pressed={editing}
                    >
                      <IconEdit />
                    </button>
                    <button
                      type="button"
                      className="icon-button ghost danger t-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        setConfirm({
                          title: "Usuń konto",
                          message: `Usunąć konto ${account.code} z tablicy? Zapisy dotyczące tego konta też zostaną usunięte.`,
                          confirmLabel: "Usuń konto",
                          action: () => {
                            if (editingCode === account.code) setEditingCode(null);
                            onClose(account.code);
                          },
                        });
                      }}
                      aria-label={`Usuń konto ${account.code}`}
                      title="Usuń konto"
                    >
                      <IconTrash />
                    </button>
                  </div>
                )}
              </header>
              <div className="t-grid">
                <Column
                  title="Wn"
                  accountCode={account.code}
                  lines={wn}
                  activeEntryId={activeEntryId}
                  editing={editing}
                  onAskDelete={askDeleteEntry}
                  onAskEdit={(line, mark) =>
                    setEditLine({
                      accountCode: account.code,
                      side: line.side,
                      mark,
                      entryId: line.entryId,
                      lineIndex: line.lineIndex,
                      amount: line.amount,
                    })
                  }
                />
                <Column
                  title="Ma"
                  accountCode={account.code}
                  lines={ma}
                  activeEntryId={activeEntryId}
                  editing={editing}
                  onAskDelete={askDeleteEntry}
                  onAskEdit={(line, mark) =>
                    setEditLine({
                      accountCode: account.code,
                      side: line.side,
                      mark,
                      entryId: line.entryId,
                      lineIndex: line.lineIndex,
                      amount: line.amount,
                    })
                  }
                />
              </div>
              <footer>
                <span>Obroty {formatMoney(picture.turnoverWn)}</span>
                <span>Obroty {formatMoney(picture.turnoverMa)}</span>
                <strong>
                  {picture.balanceSide
                    ? `Saldo ${picture.balanceSide} ${formatMoney(Math.abs(picture.balance))}`
                    : picture.lines.length > 0
                      ? "Saldo 0"
                      : "Brak zapisów"}
                </strong>
              </footer>
            </article>
          );
        })}
      </section>
      {editLine ? (
        <EditLineDialog
          accountCode={editLine.accountCode}
          side={editLine.side}
          mark={editLine.mark}
          amount={editLine.amount}
          onClose={() => setEditLine(null)}
          onSave={(amount) => onUpdateEntryLine(editLine.entryId, editLine.lineIndex, amount)}
          onDelete={() => askDeleteEntry(editLine.entryId, editLine.mark)}
        />
      ) : null}
      {confirm ? (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger
          onConfirm={confirm.action}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </>
  );
}

function Column({
  title,
  accountCode,
  lines,
  activeEntryId,
  editing,
  onAskDelete,
  onAskEdit,
}: {
  title: "Wn" | "Ma";
  accountCode: string;
  lines: ReturnType<typeof pictureAccount>["lines"];
  activeEntryId: string | null;
  editing: boolean;
  onAskDelete: (entryId: string, mark: string) => void;
  onAskEdit: (line: ReturnType<typeof pictureAccount>["lines"][number], mark: string) => void;
}) {
  return (
    <div className={title === "Wn" ? "wn" : "ma"}>
      <p>{title}</p>
      {lines.length === 0 ? <span className="quiet">—</span> : null}
      <ul>
        {lines.map((line, index) => {
          const mark = line.opening ? "BO" : `(${line.index})`;
          return (
            <li key={`${line.entryId}-${line.lineIndex}-${index}`} className={line.entryId === activeEntryId ? "is-hot" : ""}>
              <span className="line-main">
                <b>{formatMoney(line.amount)}</b>
                <small>{mark}</small>
              </span>
              {editing ? (
                <span className="line-entry-actions">
                  <button
                    type="button"
                    className="icon-button ghost line-entry-edit"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAskEdit(line, mark);
                    }}
                    aria-label={`Edytuj wpis ${mark} na ${accountCode} ${title}`}
                    title="Edytuj kwotę"
                  >
                    <IconEdit />
                  </button>
                  <button
                    type="button"
                    className="icon-button ghost danger line-entry-remove"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAskDelete(line.entryId, mark);
                    }}
                    aria-label={`Usuń operację ${mark}`}
                    title="Usuń wpis"
                  >
                    <IconTrash />
                  </button>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
