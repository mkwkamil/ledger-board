# ledger-board

Aplikacja do ćwiczeń i kolokwiów z rachunkowości finansowej: lokalna tablica księgowa (konta T, dekretacja, podsumowanie) oraz testy online na Firebase (losowanie pytań, auto-ocena, panel prowadzącego, protokół PDF).

## Funkcje

**Ćwiczenia (lokalnie)**  
Logowanie prowadzącego → tablica z materiałami i własnymi zadaniami, undo/redo, zapis w `localStorage`.

**Testy (Firebase)**  
- zestawy pytań (obliczeniowe, jednokrotny/wielokrotny wybór, otwarte)  
- tworzenie testów z oknem czasowym i limitem pytań  
- sesje studentów bez konta (dane + link do testu)  
- auto-ocena zamkniętych, ręczna ocena otwartych  
- eksport protokołu A4 z rozkładem punktów per zadanie  

## Wymagania

- [Node.js](https://nodejs.org) LTS (18+)
- projekt Firebase (Auth Email/Password, Firestore, Hosting) — opcjonalnie tylko do trybu testów

## Szybki start

```bash
cp .env.example .env
# uzupełnij VITE_* oraz VITE_ADMIN_EMAIL

npm install
npm run dev
```

Vite zwykle serwuje aplikację pod `http://localhost:5173`.

### Skrypty

| Komenda | Opis |
|---------|------|
| `npm run dev` | serwer deweloperski |
| `npm run build` | build produkcyjny (`dist/`) |
| `npm run preview` | podgląd builda |
| `npm test` | Vitest |
| `npm run seed` | seed banku zadań do Firestore (wymaga `.env.seed`) |

## Konfiguracja Firebase

1. Utwórz projekt w [Firebase Console](https://console.firebase.google.com/).
2. Włącz **Authentication → Email/Password** i załóż konto prowadzącego.
3. Utwórz bazę **Firestore** (np. region `europe-central2`).
4. Dodaj aplikację Web i skopiuj konfigurację do `.env` (wzór: `.env.example`).
5. Ustaw **ten sam** email admina w `.env` (`VITE_ADMIN_EMAIL`) i w `firestore.rules` (`isAdmin()`), oraz załóż to konto w Firebase Auth.
6. Podłącz projekt CLI i wdróż reguły:

```bash
firebase login
firebase use your-project-id
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

Hosting serwuje folder `dist` (najpierw `npm run build`).

### Seed (opcjonalnie)

```bash
cp .env.seed.example .env.seed
# SEED_ADMIN_EMAIL = ten sam co VITE_ADMIN_EMAIL
# SEED_ADMIN_PASSWORD = hasło z Firebase Auth
npm run seed
```

## Bezpieczeństwo — co nie trafia do Gita

| Plik / wzorzec | Status |
|----------------|--------|
| `.env`, `.env.seed` | **gitignored** — prawdziwe klucze i hasła |
| `*-firebase-adminsdk-*.json`, `serviceAccount*.json` | **gitignored** |
| `.env.example`, `.env.seed.example` | w repo — tylko placeholdery |
| `firestore.rules` | w repo — email w `isAdmin()` musi zgadzać się z `VITE_ADMIN_EMAIL` |

Klient Firebase (klucze `VITE_FIREBASE_*`) i tak trafia do bundla przeglądarki. Ochrona danych opiera się na **regułach Firestore** i koncie Auth prowadzącego — nie commituj haseł ani plików service account.

Przed pierwszym pushem sprawdź:

```bash
git status
git check-ignore -v .env .env.seed
```

`.env` i `.env.seed` nie powinny pojawić się na liście plików do commita.

## Stack

- React 19 + TypeScript + Vite
- Firebase Auth, Firestore, Hosting
- Vitest

## Licencja

Projekt edukacyjny — używaj i rozwijaj we własnym zakresie.
