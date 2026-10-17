export type Side = "Wn" | "Ma";

export type AccountKind =
  | "asset"
  | "liability"
  | "cash"
  | "inventory"
  | "fixedAsset"
  | "depreciation"
  | "vatOutput"
  | "vatInput"
  | "rmk"
  | "nature"
  | "function"
  | "cogs"
  | "revenue"
  | "clearing"
  | "result"
  | "contraAsset";

export interface AccountDef {
  code: string;
  name: string;
  kind: AccountKind;
}

export const KIND_LABELS: Record<AccountKind, string> = {
  asset: "Aktywo lub należność",
  liability: "Zobowiązanie",
  cash: "Środki pieniężne",
  inventory: "Zapas",
  fixedAsset: "Środek trwały",
  depreciation: "Umorzenie",
  vatOutput: "VAT należny",
  vatInput: "VAT naliczony",
  rmk: "Rozliczenia międzyokresowe",
  nature: "Koszt zespołu 4",
  function: "Koszt zespołu 5",
  cogs: "Koszt obciążający wynik",
  revenue: "Przychód",
  clearing: "Konto rozliczeniowe",
  result: "Wynik finansowy",
  contraAsset: "Odpis aktualizujący",
};

export function createAccount(code: string, name: string, kind: AccountKind): AccountDef {
  return { code: code.trim(), name: name.trim(), kind };
}

export function isNatureCost(kind: AccountKind): boolean {
  return kind === "nature";
}

export function isFunctionCost(kind: AccountKind): boolean {
  return kind === "function";
}
