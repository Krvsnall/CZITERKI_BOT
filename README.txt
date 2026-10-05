
CLOWNS.COOL - BOT ORGANIZACJI FIVEM

Bot nie tworzy, nie usuwa i nie edytuje zadnych rang.

Funkcje:
- tickety: Do organizacji, Pomoc, Inne
- limit jednego otwartego ticketu na osobe
- cooldown na tworzenie ticketow
- status ticketu: Otwarty, Oczekuje, W trakcie, Zamkniety
- przejmowanie ticketow przez administracje
- transkrypty ticketow do HTML
- system podan do organizacji
- pytania w podaniu:
  - Wiek
  - FM
  - Ilosc godzin w FiveM
  - SS KD
- ostrzezenia organizacyjne
- kanal ostrzezenia-organizacyjne
- kanal podania-organizacja
- ticket-logi
- logi ogolne
- kategoria ADMIN
- kategoria TICKETY
- bez emotek

KONFIGURACJA RANG

Otworz config.json i wpisz ID rang administracyjnych:

{
  "staffRoleIds": [
    "ID_RANGI_1",
    "ID_RANGI_2",
    "ID_RANGI_3"
  ],
  "ticketCooldownSeconds": 60
}

Bot tylko sprawdza te role. Nie zmienia ich.

INSTALACJA

1. Zainstaluj Node.js 20 lub nowszy.
2. Rozpakuj folder.
3. Zmien .env.example na .env.
4. Uzupelnij BOT_TOKEN, CLIENT_ID i GUILD_ID.
5. W config.json wpisz ID rang administracyjnych.
6. W Discord Developer Portal wlacz:
   - Server Members Intent
   - Message Content Intent
7. W folderze bota wpisz:
   npm install
8. Potem:
   npm start
9. Na serwerze wpisz:
   /setup

KOMENDY

/setup
Tworzy potrzebne kategorie, kanaly i panel.

/panel
Wysyla panel ticketow.

/warn osoba powod
Dodaje ostrzezenie organizacyjne i zapisuje je na kanale ostrzezenia-organizacyjne.

/zamknij
Zamyka aktualny ticket.
