# ledger-board

Lokalna tablica księgowa do ćwiczeń z rachunkowości finansowej.

Zadania podają tylko treść polecenia. Konta T, dekretację i wynik układasz ręcznie — bez automatycznego dopisywania Wn/Ma.

## Co potrafi

- lista zadań (materiały cz. 1 i 2) + własne zadania
- otwieranie kont, ręczne operacje, salda początkowe
- konta T z obrotami i saldem Wn/Ma
- podsumowanie (przychód, wpływ, koszt, wydatek, wynik, VAT, zapas…)
- przełącznik źródła kosztów: zespół 4 / zespół 5
- undo / redo, reset zadania, log operacji
- zapis lokalny w przeglądarce (`localStorage`)

## Wymagania

- [Node.js](https://nodejs.org) LTS (18+)

## Uruchomienie

```bash
npm install
npm run dev
```

Aplikacja otworzy się pod adresem podanym przez Vite (zwykle `http://localhost:5173`).

### Build produkcyjny

```bash
npm run build
npm run preview
```

Albo serwuj folder `dist` dowolnym serwerem statycznym, np.:

```bash
npx --yes serve dist -l 4173
```

### Testy

```bash
npm test
```

## Windows (bez „środowiska deweloperskiego”)

1. Zainstaluj Node.js LTS.
2. Skopiuj projekt (albo sam folder `dist` po `npm run build`).
3. W katalogu projektu:

```bat
npm install
npm run preview
```

Albo tylko `dist`:

```bat
npx --yes serve dist -l 4173
```

Dane zapisują się w przeglądarce na tym komputerze — nie synchronizują się między urządzeniami.

## Stack

- React + TypeScript
- Vite
- Vitest
