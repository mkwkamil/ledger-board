import { createAccount, type AccountDef, type AccountKind } from "../domain/accounts";

export interface AccountPreset extends AccountDef {
  id: string;
  team: string;
}

function preset(id: string, code: string, name: string, kind: AccountKind, team: string): AccountPreset {
  return { id, ...createAccount(code, name, kind), team };
}

export const PRESETS: AccountPreset[] = [
  preset("010", "010", "Środki trwałe", "fixedAsset", "0"),
  preset("070", "070", "Umorzenie środków trwałych", "depreciation", "0"),
  preset("100", "100", "Kasa", "cash", "1"),
  preset("130", "130", "Rachunek bankowy", "cash", "1"),
  preset("131", "131", "Rachunek bankowy", "cash", "1"),
  preset("201", "201", "Rozrachunki z odbiorcami", "asset", "2"),
  preset("202", "202", "Rozrachunki z dostawcami", "liability", "2"),
  preset("221-nalezny", "221", "VAT należny", "vatOutput", "2"),
  preset("221-naliczony", "221", "VAT naliczony", "vatInput", "2"),
  preset("222", "222", "VAT należny", "vatOutput", "2"),
  preset("223", "223", "VAT naliczony", "vatInput", "2"),
  preset("229", "229", "Pozostałe rozrachunki publicznoprawne", "liability", "2"),
  preset("231", "231", "Rozrachunki z tytułu wynagrodzeń", "liability", "2"),
  preset("290", "290", "Odpisy aktualizujące należności", "contraAsset", "2"),
  preset("300", "300", "Rozliczenie zakupu", "asset", "3"),
  preset("310", "310", "Materiały", "inventory", "3"),
  preset("330", "330", "Towary", "inventory", "3"),
  preset("400", "400", "Amortyzacja", "nature", "4"),
  preset("401", "401", "Zużycie materiałów i energii", "nature", "4"),
  preset("402", "402", "Usługi obce", "nature", "4"),
  preset("403", "403", "Podatki i opłaty", "nature", "4"),
  preset("404", "404", "Wynagrodzenia", "nature", "4"),
  preset("405", "405", "Ubezpieczenia społeczne i inne świadczenia", "nature", "4"),
  preset("409", "409", "Pozostałe koszty rodzajowe", "nature", "4"),
  preset("490", "490", "Rozliczenie kosztów", "clearing", "4"),
  preset("501", "501", "Koszty działalności podstawowej", "function", "5"),
  preset("501-A", "501-A", "Koszty produktu A", "function", "5"),
  preset("501-B", "501-B", "Koszty produktu B", "function", "5"),
  preset("521", "521", "Koszty wydziałowe", "function", "5"),
  preset("527", "527", "Koszty sprzedaży", "function", "5"),
  preset("550", "550", "Koszty zarządu", "function", "5"),
  preset("601", "601", "Wyroby gotowe", "inventory", "6"),
  preset("640", "640", "Rozliczenia międzyokresowe kosztów", "rmk", "6"),
  preset("700", "700", "Przychody ze sprzedaży produktów i usług", "revenue", "7"),
  preset("701", "701", "Koszt własny sprzedanych produktów", "cogs", "7"),
  preset("730", "730", "Przychody ze sprzedaży towarów", "revenue", "7"),
  preset("731", "731", "Wartość sprzedanych towarów w cenie zakupu", "cogs", "7"),
  preset("761", "761", "Pozostałe koszty operacyjne", "cogs", "7"),
  preset("800", "800", "Bilans otwarcia", "clearing", "8"),
  preset("860", "860", "Wynik finansowy", "result", "8"),
];

export function p(id: string): AccountDef {
  const found = PRESETS.find((account) => account.id === id);
  if (!found) throw new Error(`Brak konta ${id}`);
  return { code: found.code, name: found.name, kind: found.kind };
}

export function accountsMatch(left: AccountDef, right: AccountDef): boolean {
  return left.code === right.code && left.name === right.name && left.kind === right.kind;
}
