
CZITERKI BOT V10 - OD NOWA

Ta wersja zostala zrobiona od zera, z uproszczona rejestracja komend slash.

NAJPIERW:
1. W config.json wpisz ID rang administracyjnych do staffRoleIds.
2. Lokalnie utworz .env na podstawie .env.example.
3. Na Railway ustaw zmienne:
   BOT_TOKEN
   CLIENT_ID
   GUILD_ID

CLIENT_ID:
1556737585110319154

GUILD_ID:
1555668994990547116

BOT MUSI BYC NA TYM SERWERZE.

W Discord Developer Portal przy zapraszaniu bota musza byc zakresy:
- bot
- applications.commands

Bot powinien miec na start Administrator, albo co najmniej:
- Manage Channels
- Manage Messages
- Moderate Members
- View Channel
- Send Messages
- Read Message History
- Attach Files
- Embed Links

URUCHOMIENIE LOKALNE:
npm install
npm start

POPRAWNY LOG:
Bot uruchomiony jako CZITERKI | BOT#....
Znaleziono serwer: ...
Komendy slash zostaly zarejestrowane na serwerze.

RAILWAY:
- wrzuc pliki do GitHuba
- nie wrzucaj .env
- Start Command: npm start
- ustaw Variables
- po deployu sprawdz View logs

KOMENDY:
- /setup
- /panel
- /warn
- /warny
- /unwarn
- /clearwarns
- /clear
- /ogloszenie
- /zamknij

FUNKCJE:
- tickety z emoji
- 1 ticket na osobe
- cooldown
- status ticketu
- HTML transcript
- podania: wiek, FM, godziny FiveM, SS KD
- przyjmij/odrzuc podanie
- warny z licznikiem
- 3 warny = timeout 7 dni
- DM po warnie
- unwarn i clearwarns
- logi moderacyjne
- ogloszenia
- przyloty z avatar-em
- Made By : Krvsnall


V12:
- bot nie tworzy kanalow ogloszenia ani przyloty
- korzysta z juz istniejacych kanalow o nazwach: ogloszenia i przyloty
- /ogloszenie obsluguje pingi uzytkownikow, rol, @everyone i @here
- poprawiony wyglad warnow


V13 - NAPRAWA PRZYLOTOW

Przyloty sa teraz znajdowane:
1. po welcomeChannelId z config.json
2. jesli ID jest puste, po nazwie kanalu "przyloty"

Najpewniejsza konfiguracja:
"welcomeChannelId": "ID_KANALU_PRZYLOTY"

Bot loguje w konsoli:
[PRZYLOTY] Nowy uzytkownik...
[PRZYLOTY] Powitanie wyslane...
albo dokladny blad.

W Discord Developer Portal musi byc wlaczone:
SERVER MEMBERS INTENT

Bot musi miec na kanale przyloty:
- View Channel
- Send Messages
- Embed Links


V14:
- /ogloszenie wysyla tresc tylko w embedzie
- tresc nie pojawia sie juz drugi raz nad embedem


V15:
- usunieto kanal "logi"
- usunieto kanal "logi-moderacyjne"
- bot nie tworzy tych kanalow
- usunieto ogolne logowanie wejsc/wyjsc, edycji/usuniec wiadomosci, banow i zmian nickow
- zostaja ticket-logi, ostrzezenia-organizacyjne i podania-organizacja
- naprawiono przyloty:
  - kanal pobierany po ID przez API, nie tylko z cache
  - fallback po nazwie "przyloty"
  - fallback dla nazw z ozdobnikami/emotkami
  - dokladne sprawdzanie uprawnien
  - czytelne logi [PRZYLOTY] w Railway
- dodano /testprzyloty do szybkiego sprawdzenia systemu

W config.json ustaw:
"welcomeChannelId": "ID_KANALU_PRZYLOTY"

W Discord Developer Portal -> Bot musi byc wlaczone:
SERVER MEMBERS INTENT
