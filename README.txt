
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

UWAGA:
W tej wersji komendy slash sa rejestrowane globalnie, wiec blad Missing Access
przy rejestracji komend na konkretnym serwerze nie powinien juz wystepowac.

Po podmianie plikow uruchom:
npm install
npm start

Globalne komendy moga pojawic sie na Discordzie z opoznieniem.


NOWA WERSJA - WARNY I TRANSKRYPTY

- Transkrypty zamknietych ticketow sa wysylane jako pliki HTML na kanal ticket-logi.
- /warn osoba powod nadaje ostrzezenie.
- Bot sam liczy ostrzezenia na podstawie kanalu ostrzezenia-organizacyjne.
- Przy 3 ostrzezeniu bot automatycznie daje timeout na 7 dni.
- /warny osoba pokazuje aktualna liczbe ostrzezen.
- Ostrzezenia maja nowy, czytelniejszy embed.
- Wszystko pozostaje bez emotek.

WAZNE:
Bot musi miec uprawnienie "Moderowanie czlonkow", a jego rola musi byc wyzej
niz rola osoby, ktora ma zostac automatycznie wyciszona.


KOMENDA CLEAR

/clear ilosc
Usuwa podana liczbe ostatnich wiadomosci z aktualnego kanalu.

/clear ilosc osoba
Usuwa podana liczbe ostatnich wiadomosci wskazanej osoby z aktualnego kanalu.

Przyklady:
/clear ilosc:20
/clear ilosc:15 osoba:@Uzytkownik

Limit jednego uzycia: 1-100 wiadomosci.
Discord nie pozwala botom hurtowo usuwac wiadomosci starszych niz 14 dni.
Uzycie komendy jest zapisywane w kanale logi.


WERSJA V5 - EMOTKI W TICKETACH

Emotki zostaly dodane tylko do systemu ticketow:
- panel ticketow
- opcje Do organizacji, Pomoc, Inne
- przyciski Przejmij, Oczekuje, W trakcie, Zamknij
- komunikaty statusu
- przycisk Wypelnij podanie

Pozostale kanaly i komendy pozostaja bez emotek.


WERSJA V7

Dodano:
- /unwarn osoba numer
- /clearwarns osoba
- osobny kanal logi-moderacyjne
- logi warnow, timeoutow, clear, banow, unbanow i zmian nickow
- automatyczne DM po warnie
- system akceptacji/odrzucania podan
- /ogloszenie tresc -> bot wysyla embed na kanal ogloszenia
- kanal przyloty
- powitanie dla nowych osob z avatar-em po prawej stronie
- kanal ✅・zweryfikuj-sie
- przycisk Zweryfikuj sie
- rola weryfikacyjna jest ustawiana przez verifiedRoleId w config.json
- Made By : Krvsnall w stopkach i statusie bota

W config.json ustaw:
"verifiedRoleId": "ID_RANGI_PO_WERYFIKACJI"

Bot NIE tworzy i NIE zmienia rang sam z siebie. Nadaje tylko role po kliknieciu weryfikacji, jesli wpiszesz jej ID.


WERSJA V8 - BEZ WERYFIKACJI

Usunieto:
- kanal zweryfikuj-sie
- przycisk weryfikacji
- verifiedRoleId z config.json
- cala logike nadawania rangi po weryfikacji

Kanal przyloty zostaje.
Powitanie na kanale przyloty nie wspomina o weryfikacji.
