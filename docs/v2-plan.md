# ledger-board v2 — kolokwium i panel admina

Plan produktowy i techniczny. Branch roboczy: `v2/kolokwium`.  
`main` pozostaje stabilną **v1** (lokalna tablica bez konta / serwera).

## 1. Cel

Pod koniec semestru studenci wchodzą na `/kolokwium`, podają dane, dostają **5 wylosowanych zadań** (3 łatwe + 1 średnie + 1 ciężkie), mają **ustalony czas** i rozwiązują je na tej samej tablicy co dziś. Po zakończeniu wynik trafia na serwer. Nauczyciel na `/admin` widzi postęp i wyniki, potem eksportuje je do dokumentacji uczelni.

## 2. Zasady

- **Reuse UI v1** — silnik tablicy (konta T, operacje, podsumowanie, log) zostaje rdzeniem sesji.
- **v1 lokalna** — ścieżka bez logowania (obecny flow) może zostać na `/` lub `/cwiczenia`.
- **v2 wymaga backendu** — `localStorage` nie wystarczy do wielu studentów i admina.
- **Praca małymi krokami** — feature branche od `v2/kolokwium`, merge z powrotem; `main` dopiero przy release.

## 3. Role i ścieżki

| Ścieżka | Kto | Co |
|---------|-----|----|
| `/` lub `/cwiczenia` | student / prowadzący | v1 — swobodna tablica (opcjonalnie) |
| `/kolokwium` | student | start sesji: dane → timer → 5 zadań |
| `/kolokwium/sesja` | student | aktywne kolokwium (tablica + lista zadań sesji) |
| `/admin` | nauczyciel | logowanie, lista sesji, podgląd wyników |
| `/admin/sesje/:id` | nauczyciel | szczegóły jednego studenta (board + summary + log) |

## 4. Flow studenta

```
/kolokwium
  → formularz: imię, nazwisko, email uczelniany, nr indeksu
  → walidacja (email domeny uczelni — do ustalenia)
  → serwer tworzy Session + losuje 5 TaskSnapshot
  → /kolokwium/sesja
       • timer odlicza deadline
       • student przełącza się między 5 zadaniami (każde ma własną tablicę)
       • auto-save periodyczny + zapis przy zmianie zadania
  → koniec: „Oddaj” albo upływ czasu
  → snapshot finalny → status submitted
  → ekran podziękowania (bez edycji)
```

### Losowanie (3 / 1 / 1)

1. Zadania w bazie mają `difficulty: easy | medium | hard`.
2. Na start sesji:
   - 3× losowe z `easy` (bez powtórzeń),
   - 1× z `medium`,
   - 1× z `hard`.
3. Kolejność wyświetlania: losowa albo stała (łatwe → średnie → ciężkie) — **decyzja do potwierdzenia** (propozycja: stała kolejność trudności, żeby nie zaczynać od ciężkiego).
4. Do sesji zapisujemy **snapshot treści** (tytuł + prompt), żeby późniejsza edycja banku nie zmieniła już oddanego kolokwium.

### Czas

- Globalny limit na całą sesję (np. 90 min) — konfigurowalny w adminie / env.
- Timer widoczny w UI.
- Po deadline: auto-submit aktualnego stanu wszystkich 5 tablic.

## 5. Flow admina

```
/admin/login
  → hasło / magic link / OAuth (propozycja v2.0: jeden admin + hasło lub OTP)
/admin
  → lista sesji: student, status (in_progress | submitted | expired), czas start/koniec, wynik skrótowy
  → filtr: data, status, indeks
/admin/sesje/:id
  → dane studenta
  → 5 zadań: podgląd board + summary + log (read-only, ten sam renderer co v1)
  → eksport: JSON / PDF / CSV (metadane + wynik)
```

Ocena merytoryczna (punkty) w v2.0 może być **ręczna** albo tylko archiwum stanu — automatyczne sprawdzanie dekretów to osobny etap (v2.1+).

## 6. Model danych (propozycja)

### Task (bank zadań)

| Pole | Typ | Opis |
|------|-----|------|
| id | string | |
| number | string | np. `1.2`, `2.5` |
| prompt | string | treść polecenia |
| difficulty | enum | `easy` \| `medium` \| `hard` |
| active | bool | czy w puli losowania |
| kind | enum | jak dziś (`ledger` / `quiz` / …) |

Źródło początkowe: obecne `LESSONS` + ręczne oznaczenie trudności.

### ExamConfig

| Pole | Typ | Opis |
|------|-----|------|
| durationMinutes | number | np. 90 |
| easyCount | number | 3 |
| mediumCount | number | 1 |
| hardCount | number | 1 |
| emailDomain | string? | np. `@uczelnia.edu.pl` |

### Session

| Pole | Typ | Opis |
|------|-----|------|
| id | string | |
| firstName, lastName | string | |
| email | string | |
| studentIndex | string | nr indeksu |
| status | enum | `in_progress` \| `submitted` \| `expired` |
| startedAt, endsAt, submittedAt | datetime | |
| configSnapshot | object | limity w chwili startu |

### SessionTask

| Pole | Typ | Opis |
|------|-----|------|
| id | string | |
| sessionId | string | |
| order | number | 1…5 |
| difficulty | enum | |
| sourceTaskId | string? | oryginał z banku |
| number, prompt | string | snapshot |
| board | object | `{ opened, entries, log, resultMode }` — jak dziś na zadaniu |
| summary | object? | cache BoardSummary przy submit |

### AdminUser

Minimalnie: jeden rekord / env `ADMIN_PASSWORD_HASH`. Rozszerzenie: wielu prowadzących później.

## 7. API (szkic REST)

### Publiczne (student)

| Method | Path | Opis |
|--------|------|------|
| GET | `/api/exam/config` | czas, reguły (bez sekretów) |
| POST | `/api/exam/sessions` | body: dane studenta → tworzy sesję + losowanie |
| GET | `/api/exam/sessions/:id` | stan sesji (z tokenem sesji) |
| PATCH | `/api/exam/sessions/:id/tasks/:taskId` | auto-save board |
| POST | `/api/exam/sessions/:id/submit` | oddanie / finalizacja |

Autoryzacja studenta: **token sesji** (cookie HttpOnly lub bearer) wydany przy `POST /sessions`, bez hasła studenta.

### Admin

| Method | Path | Opis |
|--------|------|------|
| POST | `/api/admin/login` | |
| POST | `/api/admin/logout` | |
| GET | `/api/admin/sessions` | lista + filtry |
| GET | `/api/admin/sessions/:id` | pełny wynik |
| GET | `/api/admin/sessions/:id/export` | JSON/PDF |
| CRUD | `/api/admin/tasks` | bank zadań + difficulty |
| GET/PATCH | `/api/admin/exam-config` | czas, proporcje |

## 8. Stack — decyzja do potwierdzenia

Propozycja domyślna (szybki start, mało ops):

| Warstwa | Propozycja | Alternatywa |
|---------|------------|-------------|
| Frontend | React (obecny) + router (`/kolokwium`, `/admin`) | Next.js full-stack |
| Backend | Firebase (Auth admin + Firestore) **lub** prosty Nest/Express + Postgres | Supabase |
| Hosting | Firebase Hosting / Vercel | |

**Rekomendacja na v2.0:**  
- Frontend: Vite React + React Router (minimalna zmiana względem v1).  
- Backend: **Firebase** (Firestore + Auth dla admina) — bez własnego VPS, szybki deploy.  
Jeśli uczelnia wymaga self-host / RODO on-prem → Express + Postgres.

Decyzję zapisać tutaj po wyborze: `_do uzupełnienia_`.

## 9. Snapshot wyniku (to, co zapisujemy)

Na każde z 5 zadań w sesji:

```json
{
  "number": "1.2",
  "difficulty": "easy",
  "prompt": "...",
  "board": {
    "opened": [/* AccountDef */],
    "entries": [/* JournalEntry */],
    "log": [/* ActivityItem */],
    "resultMode": "nature"
  },
  "summary": {
    "revenue": 0,
    "cost": 0,
    "result": 0,
    "inflow": 0,
    "outflow": 0
  }
}
```

`summary` wyliczane przy submit (funkcja `summarize` z v1). Admin renderuje board read-only tymi samymi komponentami.

## 10. Bezpieczeństwo i uczciwość (minimum v2.0)

- Token sesji nieprzewidywalny; brak listowania cudzych sesji.
- Email: walidacja formatu (+ opcjonalnie domena uczelni).
- Po `submitted` / `expired` — brak dalszego zapisu boardu.
- Admin tylko po logowaniu; eksport tylko dla admina.
- Rate limit na `POST /sessions` (anty-spam).
- Ostrzeżenie w UI: wyjście ze strony / odświeżenie nie kasuje sesji (recovery po tokenie), ale drugi start z tym samym indeksem w tym samym „egzaminie” — polityka do ustalenia (blokada vs kontynuacja).

## 11. Etapy implementacji

| # | Etap | Wynik |
|---|------|--------|
| 0 | Ten dokument + branch `v2/kolokwium` | plan |
| 1 | Oznaczenie trudności w banku zadań + migracja LESSONS | dane |
| 2 | Backend: Session + Task bank + ExamConfig | API |
| 3 | `/kolokwium` — formularz + start sesji + timer | student MVP |
| 4 | Sesja: 5 zadań, reuse tablicy v1, auto-save | student MVP |
| 5 | Submit + zapis snapshotów | wynik |
| 6 | `/admin` — lista + podgląd | admin MVP |
| 7 | Eksport JSON/PDF/CSV | dokumentacja |
| 8 | Hardening, deploy, instrukcja dla prowadzącego | release v2.0 |

## 12. Otwarte decyzje

- [ ] Stack backendu (Firebase vs Postgres)
- [ ] Kolejność 5 zadań (stała trudność vs pełny shuffle)
- [ ] Limit czasu (domyślna wartość)
- [ ] Domeny email uczelnianych
- [ ] Czy v1 zostaje publicznie na `/cwiczenia` obok kolokwium
- [ ] Czy jeden student może mieć wiele podejść
- [ ] Format eksportu wymagany przez uczelnię (PDF vs Excel)

## 13. Kryteria sukcesu v2.0

- Student kończy kolokwium w limicie czasu; wynik jest w bazie.
- Admin widzi listę i pełny stan tablic (konta + podsumowanie + log).
- Eksport nadaje się do archiwum / dokumentacji.
- Awaria odświeżenia przeglądarki nie kasuje sesji w trakcie.
- `main` / v1 nadal działa lokalnie bez serwera.
