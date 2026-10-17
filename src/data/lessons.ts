export interface QuizItem {
  question: string;
}

export interface Lesson {
  id: string;
  number: string;
  kind: "ledger" | "quiz" | "principles";
  prompt: string;
  quiz?: QuizItem[];
}

function task(id: string, number: string, prompt: string, kind: Lesson["kind"] = "ledger"): Lesson {
  return { id, number, kind, prompt };
}

/** Część 1 — „Rozwiązania do zadań 1.docx” (1.x); część 2 — „Zadania cz.2.docx” (2.x). */
export const LESSONS: Lesson[] = [
  task(
    "1.1",
    "1.1",
    "ALFA w grudniu sprzedała usługę za 18 000 zł netto + VAT 23%; zapłata klienta wpłynie w styczniu. W grudniu zapłaciła również 3 000 zł zobowiązania z faktury ujętej w kosztach w listopadzie. Polecenia: zaksięguj obie operacje i rozróżnij przychód, wpływ, koszt oraz wydatek.",
  ),
  task(
    "1.2",
    "1.2",
    "BETA kupiła materiały za 24 000 zł netto + VAT 23% i przyjęła do magazynu. Zużyła materiały o wartości 9 000 zł. Zaksięguj operacje, oblicz koszt i zapas.",
  ),
  task(
    "1.3",
    "1.3",
    "Firma otrzymała fakturę 14 400 zł netto + VAT za usługę od 1.11.2026 do 31.10.2027. Oblicz koszt miesięczny i koszt przypadający na 2026 i 2027 r.; pokaż dekretację.",
  ),
  task(
    "1.4",
    "1.4",
    "Omów koszty według rodzaju (zespół 4). Wskaż typowe konta (np. 400–409) i wyjaśnij, do czego służą. W tym zadaniu nie trzeba nic liczyć.",
  ),
  task(
    "1.5",
    "1.5",
    "Przyporządkuj konta: energia 8 000 zł; usługi prawne 6 000 zł; wynagrodzenia 70 000 zł; składki pracodawcy 13 300 zł; amortyzacja 4 500 zł; ubezpieczenie majątku 2 400 zł.",
  ),
  task(
    "1.6",
    "1.6",
    "Firma naliczyła wynagrodzenia brutto w wysokości 90 000 zł. Potrącenia z wynagrodzeń wynoszą 21 000 zł, a wynagrodzenie netto do wypłaty 69 000 zł. Dodatkowo składki finansowane przez pracodawcę wynoszą 16 200 zł.",
  ),
  task(
    "1.7",
    "1.7",
    "W grudniu faktura za usługę wyniosła 12 000 zł netto + VAT 23%. W styczniu wystawiono korektę zmniejszającą wartość usługi o 2 000 zł netto + VAT. Zaksięguj fakturę i korektę oraz ustal koszt po korekcie.",
  ),
  task(
    "1.8",
    "1.8",
    "Przyporządkuj poniższe koszty do odpowiednich kont zespołu 4 i zespołu 5: Drewno do zamówienia – 30 000 zł, Energia hali produkcyjnej – 12 000 zł, Wynagrodzenia pracowników produkcji – 25 000 zł, Reklama – 5 000 zł, Wynagrodzenie głównego księgowego – 9 000 zł.",
  ),
  task(
    "1.9",
    "1.9",
    "Zakład produkujący stoły i krzesła poniósł następujące koszty: Drewno do stołów – 24 000 zł, Drewno do krzeseł – 16 000 zł, Energia hali – 10 000 zł, Wynagrodzenia pracowników produkcyjnych – 30 000 zł. Podziel koszty na bezpośrednie i pośrednie oraz wskaż odpowiednie konta zespołu 5.",
  ),
  task(
    "1.10",
    "1.10",
    "Koszty wydziałowe wyniosły 18 000 zł. Produkt A pochłonął 120 roboczogodzin, a produkt B – 180 roboczogodzin. Oblicz stawkę kosztów wydziałowych na jedną roboczogodzinę i rozlicz koszty na oba produkty.",
  ),
  task(
    "1.11",
    "1.11",
    "Sprzedano 100 produktów po 800 zł netto za sztukę. Stawka VAT wynosi 23%. Koszt wytworzenia jednego produktu wynosi 500 zł. Klient zapłaci za produkty w kolejnym miesiącu. Oblicz wartość sprzedaży, VAT, należność od klienta, koszt własny sprzedaży oraz wynik finansowy.",
  ),
  task(
    "1.12",
    "1.12",
    "Firma kupiła maszynę za 120 000 zł. Przyjmujemy okres amortyzacji 60 miesięcy. Pomijamy VAT. Zaksięguj zakup maszyny oraz miesięczny odpis amortyzacyjny.",
  ),
  task(
    "1.13",
    "1.13",
    "Należność od odbiorcy wynosi 80 000 zł. Przewidywana kwota odzyskiwana to 60 000 zł. Oblicz wysokość odpisu aktualizującego, zaksięguj operację i wyjaśnij jej wpływ na wynik finansowy.",
  ),
  task(
    "1.14",
    "1.14",
    "Firma sprzedała towary za 70 000 zł netto + VAT. Koszt sprzedanych towarów wyniósł 42 000 zł. Firma opłaciła ubezpieczenie w wysokości 12 000 zł za 12 miesięcy, obejmujące również grudzień. Ponadto kupiła i opłaciła maszynę za 96 000 zł. Miesięczna amortyzacja maszyny wynosi 1 600 zł. Klient zapłaci za towary w styczniu. Oblicz wynik finansowy za grudzień.",
  ),
  task(
    "1.15",
    "1.15",
    "Koszty: materiały produkcyjne 40 000 zł; energia hali 12 000 zł; reklama 6 000 zł; wynagrodzenia produkcji 35 000 zł; administracji 15 000 zł; składki pracodawcy 9 000 zł; amortyzacja maszyny produkcyjnej 7 000 zł. Przypisz do zespołów 4 i 5.",
  ),
  {
    id: "1.16",
    number: "1.16",
    kind: "quiz",
    prompt: "Odpowiedz TAK albo NIE na poniższe pytania.",
    quiz: [
      { question: "Przychód może powstać przed zapłatą?" },
      { question: "Każda zapłata faktury tworzy koszt?" },
      { question: "Zespół 4 to koszty według rodzaju?" },
      { question: "Zespół 5 to funkcja albo miejsce powstania kosztu?" },
      { question: "Konto kosztowe zwiększa się po stronie Wn?" },
      { question: "Zakup maszyny jest od razu kosztem w pełnej kwocie?" },
      { question: "Rozliczenia międzyokresowe wynikają ze współmierności?" },
      { question: "Odpis aktualizujący może wynikać z ostrożności?" },
      { question: "Amortyzacja powoduje wypływ gotówki?" },
      { question: "Wynik finansowy to saldo banku?" },
    ],
  },
  task(
    "1.17",
    "1.17",
    "Firma kupiła towary za 30 000 zł netto + VAT 23%. Sprzedała część za 24 000 zł netto + VAT; cena zakupu sprzedanych towarów 15 000 zł. Klient zapłacił. Zaksięguj i oblicz wynik.",
  ),
  task(
    "1.18",
    "1.18",
    "Firma wykonała usługę za 15 000 zł netto + VAT 23% w październiku, płatność w listopadzie. Otrzymała fakturę za wynajem biura 4 000 zł netto + VAT. Zaksięguj sprzedaż, najem i późniejszą zapłatę.",
  ),
  task(
    "1.19",
    "1.19",
    "Kupiono materiały za 50 000 zł netto + VAT 23%; do produkcji wydano 32 000 zł. Wynagrodzenia produkcyjne 28 000 zł, składki pracodawcy 5 500 zł. Zaksięguj operacje i pokaż możliwe ujęcie w zespole 5.",
  ),
  task(
    "1.20",
    "1.20",
    "Restauracja kupiła żywność za 18 000 zł netto + VAT; zużyła 14 000 zł. Otrzymała fakturę za energię 6 000 zł netto + VAT. Zaksięguj i oblicz zapas.",
  ),
  task(
    "1.21",
    "1.21",
    "Firma kupiła paliwo za 12 000 zł netto + VAT, otrzymała fakturę za naprawę 8 000 zł netto + VAT, naliczyła wynagrodzenia kierowców 24 000 zł i składki pracodawcy 4 800 zł. Zaksięguj.",
  ),
  task(
    "1.22",
    "1.22",
    "Firma kupiła materiały za 60 000 zł netto + VAT, podwykonawca wystawił fakturę na 25 000 zł netto + VAT, wynagrodzenia budowy wyniosły 30 000 zł, reklama 3 000 zł netto + VAT. Zaksięguj i wskaż koszty bezpośrednie kontraktu.",
  ),
  task(
    "1.23",
    "1.23",
    "Biuro otrzymało fakturę za ubezpieczenie 12 000 zł za okres 1.10.2026–30.09.2027. Pomijamy VAT. Oblicz koszt miesięczny, koszt 2026 i RMK na 31.12.2026.",
  ),
  task(
    "1.24",
    "1.24",
    "Kupiono komputer za 12 000 zł netto + VAT 23%; okres amortyzacji 36 miesięcy. Zaksięguj zakup i pierwszy odpis.",
  ),
  task(
    "1.25",
    "1.25",
    "Zakup towarów 40 000 zł netto + VAT; zapłata dostawcy 20 000 zł; sprzedaż 55 000 zł netto + VAT; koszt zakupu sprzedanych towarów 34 000 zł; klient wpłacił 30 000 zł; energia 4 000 zł netto + VAT; wynagrodzenia 12 000 zł. Zaksięguj wszystkie operacje.",
  ),
  task(
    "1.26",
    "1.26",
    "W grudniu firma kupiła materiały 25 000 zł netto + VAT, zużyła 18 000 zł; otrzymała fakturę za usługę 6 000 zł netto + VAT; naliczyła wynagrodzenia 20 000 zł i składki pracodawcy 4 000 zł; sprzedała usługę 50 000 zł netto + VAT; klient nie zapłacił; zapłaciła dostawcy 10 000 zł; amortyzacja wyniosła 2 000 zł. Zaksięguj i oblicz wynik.",
  ),
  task(
    "1.27",
    "1.27",
    "PRZYCHÓD ≠ WPŁYW PIENIĘDZY, KOSZT ≠ WYDATEK, ZAKUP ZAPASU ≠ ZUŻYCIE ZAPASU, ZAKUP ŚRODKA TRWAŁEGO ≠ JEDNORAZOWY KOSZT, ZESPÓŁ 4 ≠ ZESPÓŁ 5, MEMORIAŁ, WSPÓŁMIERNOŚĆ, OSTROŻNOŚĆ. Dla każdej zasady objaśnij najpierw sens ekonomiczny, a następnie dekretację.",
    "principles",
  ),

  // Część 2
  task(
    "2.1",
    "2.1",
    "W miesiącu poniesiono: materiały produkcyjne 18 000, płace produkcyjne 12 000, energia hali 4 000, reklama 3 000, wynagrodzenia administracji 7 000. Przyporządkuj do rodzaju i funkcji; oblicz koszt wytworzenia przy założeniu, że energia hali jest kosztem wydziałowym.",
  ),
  task(
    "2.2",
    "2.2",
    "Stan początkowy materiałów 8 000. Zakup na kredyt 25 000 + VAT; do produkcji wydano materiały za 18 000. Zaksięguj zakup i zużycie, ustal zapas końcowy i pokaż konta T: 310, 401, 201.",
  ),
  task(
    "2.3",
    "2.3",
    "Zapłacono przelewem usługę remontową 6 000 + VAT; naliczono płace 15 000 (bez rozliczeń publicznoprawnych); naliczono amortyzację 2 500. Zaksięguj w zespole 4 i oblicz sumę kosztów rodzajowych.",
  ),
  task(
    "2.4",
    "2.4",
    "Koszty ujęte w zespole 4: materiały 20 000, usługi 5 000, płace 15 000. Rozlicz je przez 490 na: produkcję 28 000, sprzedaż 4 000, zarząd 8 000. Pokaż T kont 490, 500, 527 i 550.",
  ),
  task(
    "2.5",
    "2.5",
    "Produkcja w toku na początek 6 000; bieżące koszty produkcji 55 000; produkcja w toku na koniec 9 000. Ustal koszt wytworzonych produktów i zaksięguj przyjęcie do magazynu przez konto 580.",
  ),
  task(
    "2.6",
    "2.6",
    "Przychody ze sprzedaży produktów 100 000; koszty rodzajowe 78 000; stan produktów wzrósł o 12 000 (brak innych korekt). Koszt sprzedanych produktów 66 000. Oblicz wynik ze sprzedaży w obu wariantach i wyjaśnij rolę zmiany stanu produktów.",
  ),
  task(
    "2.7",
    "2.7",
    "Stan początkowy wyrobów 15 000; przyjęto produkcję 70 000; sprzedano wyroby o koszcie 58 000. Oblicz stan końcowy 600, zaksięguj przyjęcie i rozchód oraz pokaż T 600 i 701.",
  ),
  task(
    "2.8",
    "2.8",
    "Wystawiono fakturę za produkty 45 000 + VAT. Koszt sprzedanych produktów wyniósł 29 000. Zaksięguj sprzedaż i rozchód; oblicz marżę brutto na sprzedaży.",
  ),
  task(
    "2.9",
    "2.9",
    "Zakupiono towary na kredyt 20 000 + VAT, następnie sprzedano 60% zapasu za 19 000 + VAT. Ustal koszt sprzedanych towarów, zapas końcowy i wynik na sprzedaży.",
  ),
  task(
    "2.10",
    "2.10",
    "Sprzedano zbędne materiały za 5 000 + VAT. Ich wartość ewidencyjna wynosiła 3 600. Zaksięguj i oblicz wynik transakcji.",
  ),
  task(
    "2.11",
    "2.11",
    "Sprzedano towary za 30 000 + VAT; koszt ich nabycia 21 000. Następnie wystawiono fakturę korygującą zmniejszającą cenę netto o 2 000 (VAT 23%). Ustal skorygowane przychody, VAT i marżę.",
  ),
  task(
    "2.12",
    "2.12",
    "Sprzedano produkty za 24 000 + VAT, koszt własny 14 000. Klient zwrócił 25% dostawy; produkty nadają się do ponownej sprzedaży i wróciły do magazynu. Zaksięguj sprzedaż i zwrot, ustal przychód i koszt netto.",
  ),
  task(
    "2.13",
    "2.13",
    "Przychody netto: produkty 80 000, towary 25 000, materiały 6 000. Koszty własne odpowiednio 49 000, 19 000 i 4 500. Ustal wynik każdej kategorii i łączny wynik brutto na sprzedaży; wskaż konta zespołu 7.",
  ),
  task(
    "2.14",
    "2.14",
    "Faktura sprzedaży produktów 12 000 + VAT, koszt 7 000. Odbiorca zapłacił 50% kwoty brutto na rachunek bankowy. Zaksięguj i oblicz saldo należności oraz wynik na sprzedaży.",
  ),
  task(
    "2.15",
    "2.15",
    "Sprzedano maszynę za 18 000 + VAT. Wartość początkowa 50 000, dotychczasowe umorzenie 38 000. Zaksięguj sprzedaż i wyksięgowanie maszyny, ustal wynik operacji.",
  ),
  task(
    "2.16",
    "2.16",
    "Spółka przekazała z rachunku bankowego darowiznę 2 500 na organizację społeczną. Zaksięguj i określ wpływ na wynik finansowy.",
  ),
  task(
    "2.17",
    "2.17",
    "Uznano i otrzymano na rachunek bankowy odszkodowanie 8 000 za uszkodzenie wyposażenia. Zaksięguj wpływ; wskaż rodzaj przychodu.",
  ),
  task(
    "2.18",
    "2.18",
    "Należność od klienta wynosi 10 000. Ze względu na wysokie ryzyko nieściągalności utworzono odpis aktualizujący 70% kwoty (konto pomocnicze 280 Odpisy aktualizujące należności). Zaksięguj odpis i oblicz wartość bilansową należności.",
  ),
  task(
    "2.19",
    "2.19",
    "Bank naliczył i dopisał odsetki od lokaty 900; z rachunku pobrano odsetki od kredytu 1 400. Zaksięguj i oblicz wynik na operacjach finansowych.",
  ),
  task(
    "2.20",
    "2.20",
    "Spłacono zobowiązanie handlowe w EUR. Wartość księgowa zobowiązania 21 000, faktyczny wypływ z rachunku walutowego w przeliczeniu 21 800. W innym rozrachunku otrzymano 12 500 przy należności księgowej 12 000. Zaksięguj różnice kursowe i ich saldo wynikowe.",
  ),
  task(
    "2.21",
    "2.21",
    "Saldo przychodów 700: 150 000; 730: 40 000; 740: 10 000. Saldo kosztów 701: 95 000; 731: 31 000; 741: 7 000. Zamknij konta na 860 i oblicz wynik brutto na sprzedaży.",
  ),
  task(
    "2.22",
    "2.22",
    "Wynik brutto na sprzedaży 65 000; koszty sprzedaży 8 000; koszty zarządu 20 000; pozostałe przychody operacyjne 4 000; pozostałe koszty operacyjne 6 500. Oblicz wynik z działalności operacyjnej i przedstaw transfery na 860 (bez podwójnego przenoszenia wcześniej rozliczonych kosztów).",
  ),
  task(
    "2.23",
    "2.23",
    "Wynik operacyjny 34 500; przychody finansowe 3 200; koszty finansowe 7 600. Oblicz wynik brutto, zaksięguj zamknięcie kont 750 i 751 na 860.",
  ),
  task(
    "2.24",
    "2.24",
    "Przychody razem 220 000; koszty razem 178 000 (bez podatku dochodowego). Przyjmij dla ćwiczenia podatek dochodowy 19% dodatniego wyniku brutto, bez różnic podatkowych; konto 870 Podatek dochodowy. Oblicz podatek i wynik netto, pokaż 860 i 870.",
  ),
  task(
    "2.25",
    "2.25",
    "Stan początkowy: materiały 10 000, towary 15 000, produkty 8 000. Operacje: (a) zakup materiałów 20 000 + VAT na kredyt; (b) zużycie materiałów do produkcji 17 000; (c) naliczenie płac produkcyjnych 9 000; (d) przyjęcie wyrobów gotowych o koszcie 26 000; (e) sprzedaż produktów 40 000 + VAT, koszt wydanych produktów 24 000; (f) sprzedaż towarów 12 000 + VAT, koszt 8 000; (g) odsetki otrzymane 500; (h) darowizna przelewem 1 000. Zaksięguj operacje, oblicz zapasy końcowe, wynik na sprzedaży i wynik brutto, zamknij konta wynikowe na 860. Przyjmij uproszczoną ewidencję kosztów bez rozliczania kosztów pośrednich.",
  ),
];
