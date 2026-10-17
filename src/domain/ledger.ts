import type { AccountDef, AccountKind, Side } from "./accounts";

export interface JournalLine {
  accountCode: string;
  side: Side;
  amount: number;
}

export interface JournalEntry {
  id: string;
  description: string;
  period: string;
  lines: JournalLine[];
  /** Saldo początkowe nie wchodzi do przychodu, kosztu, wpływu ani wydatku. */
  opening: boolean;
}

export type ResultMode = "nature" | "function";

export interface AccountPicture {
  account: AccountDef;
  openingWn: number;
  openingMa: number;
  turnoverWn: number;
  turnoverMa: number;
  balance: number;
  balanceSide: Side | null;
  lines: Array<{
    entryId: string;
    index: number;
    side: Side;
    amount: number;
    opening: boolean;
    period: string;
  }>;
}

export interface BoardSummary {
  revenue: number;
  cost: number;
  result: number;
  inflow: number;
  outflow: number;
  cashChange: number;
  vatOutput: number;
  vatInput: number;
  vatToPay: number;
  inventory: number;
  fixedAssetNet: number;
  rmk: number;
  receivableGross: number;
  allowance: number;
  receivableNet: number;
  costSource: "nature" | "function";
  parallelWarning: boolean;
  hasOperations: boolean;
  hasInventory: boolean;
  hasFixedAsset: boolean;
  hasRmk: boolean;
  hasReceivable: boolean;
  hasVat: boolean;
  clearingBalance: number;
}

export function isBalanced(lines: JournalLine[], opening: boolean): boolean {
  if (lines.length === 0 || lines.some((line) => line.amount <= 0 || !Number.isInteger(line.amount))) {
    return false;
  }
  if (opening) return lines.length === 1;
  const wn = lines.filter((line) => line.side === "Wn").reduce((sum, line) => sum + line.amount, 0);
  const ma = lines.filter((line) => line.side === "Ma").reduce((sum, line) => sum + line.amount, 0);
  return wn > 0 && wn === ma;
}

export function pictureAccount(account: AccountDef, entries: JournalEntry[]): AccountPicture {
  let openingWn = 0;
  let openingMa = 0;
  let turnoverWn = 0;
  let turnoverMa = 0;
  const lines: AccountPicture["lines"] = [];

  entries.forEach((entry, index) => {
    for (const line of entry.lines) {
      if (line.accountCode !== account.code) continue;
      if (entry.opening) {
        if (line.side === "Wn") openingWn += line.amount;
        else openingMa += line.amount;
      } else if (line.side === "Wn") turnoverWn += line.amount;
      else turnoverMa += line.amount;
      lines.push({
        entryId: entry.id,
        index: index + 1,
        side: line.side,
        amount: line.amount,
        opening: entry.opening,
        period: entry.period,
      });
    }
  });

  const balance = openingWn + turnoverWn - (openingMa + turnoverMa);
  return {
    account,
    openingWn,
    openingMa,
    turnoverWn,
    turnoverMa,
    balance,
    balanceSide: balance === 0 ? null : balance > 0 ? "Wn" : "Ma",
    lines,
  };
}

function debitBalance(picture: AccountPicture): number {
  return Math.max(picture.balance, 0);
}

function creditBalance(picture: AccountPicture): number {
  return Math.max(-picture.balance, 0);
}

function sumKind(
  pictures: AccountPicture[],
  kind: AccountKind,
  side: "debit" | "credit",
  operationsOnly: boolean,
): number {
  return pictures
    .filter((picture) => picture.account.kind === kind)
    .reduce((sum, picture) => {
      if (!operationsOnly) {
        return sum + (side === "debit" ? debitBalance(picture) : creditBalance(picture));
      }
      const net =
        side === "debit"
          ? picture.turnoverWn - picture.turnoverMa
          : picture.turnoverMa - picture.turnoverWn;
      return sum + Math.max(net, 0);
    }, 0);
}

export function summarize(
  opened: AccountDef[],
  entries: JournalEntry[],
  mode: ResultMode,
): BoardSummary {
  const pictures = opened.map((account) => pictureAccount(account, entries));
  const revenue = sumKind(pictures, "revenue", "credit", true);
  const natureCost = sumKind(pictures, "nature", "debit", true);
  const functionCost = sumKind(pictures, "function", "debit", true);
  const cogs = sumKind(pictures, "cogs", "debit", true);
  const resultCredit = sumKind(pictures, "result", "credit", true);
  const resultDebit = sumKind(pictures, "result", "debit", true);

  const costSource: "nature" | "function" = mode === "function" ? "function" : "nature";
  const parallelWarning = natureCost > 0 && functionCost > 0;
  const cost = (costSource === "nature" ? natureCost : functionCost) + cogs;
  const result = revenue - cost + resultCredit - resultDebit;

  const inflow = pictures.filter((picture) => picture.account.kind === "cash").reduce((sum, picture) => sum + picture.turnoverWn, 0);
  const outflow = pictures.filter((picture) => picture.account.kind === "cash").reduce((sum, picture) => sum + picture.turnoverMa, 0);
  const vatOutput = sumKind(pictures, "vatOutput", "credit", true);
  const vatInput = sumKind(pictures, "vatInput", "debit", true);

  const inventory = pictures
    .filter((picture) => picture.account.kind === "inventory")
    .reduce((sum, picture) => sum + picture.balance, 0);
  const fixedAssetGross = pictures
    .filter((picture) => picture.account.kind === "fixedAsset")
    .reduce((sum, picture) => sum + picture.balance, 0);
  const accumulated = pictures
    .filter((picture) => picture.account.kind === "depreciation")
    .reduce((sum, picture) => sum + -picture.balance, 0);
  const rmk = pictures.filter((picture) => picture.account.kind === "rmk").reduce((sum, picture) => sum + picture.balance, 0);
  const receivableGross = pictures
    .filter((picture) => picture.account.code === "201")
    .reduce((sum, picture) => sum + picture.balance, 0);
  const allowance = pictures
    .filter((picture) => picture.account.kind === "contraAsset")
    .reduce((sum, picture) => sum + -picture.balance, 0);
  const clearingBalance = pictures
    .filter((picture) => picture.account.kind === "clearing")
    .reduce((sum, picture) => sum + picture.balance, 0);

  return {
    revenue,
    cost,
    result,
    inflow,
    outflow,
    cashChange: inflow - outflow,
    vatOutput,
    vatInput,
    vatToPay: vatOutput - vatInput,
    inventory,
    fixedAssetNet: fixedAssetGross - accumulated,
    rmk,
    receivableGross,
    allowance,
    receivableNet: receivableGross - allowance,
    costSource,
    parallelWarning,
    hasOperations: entries.some((entry) => !entry.opening),
    hasInventory: pictures.some((picture) => picture.account.kind === "inventory"),
    hasFixedAsset: pictures.some(
      (picture) => picture.account.kind === "fixedAsset" || picture.account.kind === "depreciation",
    ),
    hasRmk: pictures.some((picture) => picture.account.kind === "rmk"),
    hasReceivable: pictures.some((picture) => picture.account.code === "201" || picture.account.kind === "contraAsset"),
    hasVat: pictures.some((picture) => picture.account.kind === "vatOutput" || picture.account.kind === "vatInput"),
    clearingBalance,
  };
}

export function buildClosingEntries(
  opened: AccountDef[],
  entries: JournalEntry[],
  mode: ResultMode,
): Array<Omit<JournalEntry, "id">> {
  const summary = summarize(opened, entries, mode);
  const pictures = opened.map((account) => pictureAccount(account, entries));
  const costKinds = new Set<AccountKind>(summary.costSource === "nature" ? ["nature", "cogs"] : ["function", "cogs"]);
  const drafts: Array<Omit<JournalEntry, "id">> = [];

  for (const picture of pictures) {
    if (picture.account.kind === "revenue" && picture.balance < 0) {
      drafts.push({
        description: `Przeniesienie przychodu ${picture.account.code}`,
        period: "zamknięcie",
        opening: false,
        lines: [
          { accountCode: picture.account.code, side: "Wn", amount: -picture.balance },
          { accountCode: "860", side: "Ma", amount: -picture.balance },
        ],
      });
    }
    if (costKinds.has(picture.account.kind) && picture.balance > 0) {
      drafts.push({
        description: `Przeniesienie kosztu ${picture.account.code}`,
        period: "zamknięcie",
        opening: false,
        lines: [
          { accountCode: "860", side: "Wn", amount: picture.balance },
          { accountCode: picture.account.code, side: "Ma", amount: picture.balance },
        ],
      });
    }
  }
  return drafts;
}

export function contraText(entry: JournalEntry, line: JournalLine): string {
  return entry.lines
    .filter((other) => other !== line)
    .map((other) => `${other.side} ${other.accountCode}`)
    .join(", ");
}
