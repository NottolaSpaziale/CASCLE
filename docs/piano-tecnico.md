# Piano Tecnico – C.A.S.C.L.E. (simulazione completa)

Riferimenti: `docs/CASCLE_Full_Game_Documentation.md` (regole), `docs/ui-spec.md` + `docs/figma/*.png` (UI).
Stack: HTML + CSS + JS vanilla (ES modules), DOM per UI e mappa (niente Canvas), audio Web Audio sintetico. Nessuna build. Percorsi **relativi** (GitHub Pages).
Struttura: `index.html`, `css/`, `js/`, `assets/` (img/, badges/).

## Decisioni sui punti aperti (doc §11)
1. Unità: "units" ovunque, etichetta "kW" solo in top bar. Luce solare: +100 units/Sol (fino a 1000).
2. Notte lunare: Sol 14 = primo giorno di notte; vittoria all'inizio di Sol 28 con power > 0.
3. Comms MAX = 4. Bunker&Airlock fisso ECO. "Tutto OFF" = Mission Failed immediato ("The entire base has been shut down").
   **Switch difficoltà EASY / HARD** (in schermata titolo e nel pannello energia):
   - EASY: solo i tre pulsanti globali TUTTO MAX / TUTTO ECO / TUTTO OFF (slider visibili ma bloccati).
   - HARD: ogni modulo/stanza ha il suo slider OFF / ECO / MAX; gruppo "Crew safety" min ECO.
4. Timer tempesta: **30 s reali**. Allo scadere **nessuna** opzione viene applicata: la salute di tutti gli astronauti cala drasticamente fino a 0 → **MISSION FAILED** (messaggio: la crew è stata esposta alla tempesta senza protezione).
5. Serra – ripresa **graduale**, non a scatti:
   - Ogni pianta ha un livello acqua che cala nel tempo; plant health sale lentamente se l'acqua è nel range giusto, scende se è bassa.
   - Annaffiatura manuale: riempie le barre acqua (−2 % acqua base, −5 units power); cooldown 1/4 di Sol (bottone grigio).
   - In alternativa si manda **Maya (biologa)** con l'azione "Manage greenhouse": irrigazione automatica finché resta lì, ma la sua **fatigue** sale; il giocatore bilancia lavoro della crew vs intervento manuale.
6. Luci serra: sfondo serra = colore luce (rosso/verde/blu, come prototipo); blu = crescita (×1.15), rosso = bonus cibo (riduce la fame della crew), **verde = ripresa della pianta** (accelera il recupero di salute delle piante malate/sotto il 50 %).
6b. Scudi magnetici: consumano units/day solo se il sistema "Radiation Shield" nel pannello energia è su ECO o MAX. Se è OFF (possibile in HARD) non consuma nulla, ma durante una tempesta ACTIVATE SHIELDS è disabilitato con la nota "Radiation Shield is OFF in the power panel": resta solo EVACUATE (o il timer).
7. Eventi: serra triggerata al Sol 4 (± random 3–5), tempesta SEP al Sol 8 (± 7–9); FLR/CME casuali a basso rischio negli altri Sol (solo avviso).
8. Plant health in top bar solo nella schermata serra. Tab tablet: "Badges". Titolo salute: "CREW HEALTH".
9. Debug/demo: parametro URL `?sol=N` per saltare al Sol N; velocità 10x per i giudici (28 Sol ≈ 14 min).

## Moduli

### 1. Engine, stato e HUD
- Obiettivo: `config.js` (tutti i numeri della doc: tabella power, rate, eventi, badge, testi verbatim), `state.js` (variabili §4), loop a tick 100 ms con velocità 1/2/4/10x (300/150/75/30 s per Sol), pausa/slow-down su alert, aggiornamento giornaliero risorse (§12.2), condizioni di sconfitta (§9.2) → schermata MISSION FAILED (grayscale) con START AGAIN; schermata vittoria Sol 28.
- File: `index.html`, `css/base.css`, `js/main.js`, `js/config.js`, `js/state.js`, `js/loop.js`, `js/hud.js`, `js/screens/endgame.js`.
- Fatto quando: top bar mostra Power/Oxygen/Water/Shield + pillola SOL; click SOL apre menu 1x/2x/4x/10x; il Sol avanza; le risorse calano; forzando oxygen=0 compare MISSION FAILED e START AGAIN riparte da Sol 1; nessun errore console.

### 2. Mappa ed equipaggio (Sol 1)
- Obiettivo: mappa della base (raster estratto da `docs/C.A.S.C.L.E. - prototype (1).svg` → `assets/img/map.png`), 13 aree stanza cliccabili, 4 icone-viso astronauti (ritagliate dallo stesso SVG, vedi ui-spec "Sol 1") che si spostano scivolando sulla mappa (nessun corpo/gambe); click icona → menu radiale stanze → lista azioni (tabella §5.1) → l'astronauta va nella stanza ed esegue l'azione. Bisogni per astronauta (§4.4) che decadono nel tempo e vengono ripristinati dalle azioni; bonus di ruolo; social time se 2+ astronauti in Galley.
- File: `js/map.js`, `js/crew.js`, `js/actions.js`, `css/map.css`, `assets/img/*`.
- Fatto quando: si seleziona ogni astronauta, si apre il menu radiale, si sceglie un'azione, l'icona si muove alla stanza e i suoi valori cambiano; se health arriva a 0 → Mission Failed.

### 3. Eventi, Serra (Flusso 1) e Tempesta solare (Flusso 2)
- Obiettivo: coda eventi (§12.4) con icona "!" sulla stanza; modali WARNING + SOLVE; schermata serra (6 piante sane/malate, 6 barre acqua, semaforo luci, WATER THE PLANTS con cooldown, BACK); tempesta DONKI livelli 1–3, schermata scelta con barra timer, EVACUATE (bunker: crew nel bunker, labs in pausa con orologio, salto 1 Sol) / ACTIVATE SHIELDS (−30 power, +15 radiazione a ciascuno); modali badge (Greenhouse, Solar) con CONTINUE MISSION. Velocità → 1x a ogni alert.
- File: `js/events.js`, `js/screens/greenhouse.js`, `js/screens/storm.js`, `js/screens/modal.js`, `js/badges.js`, `css/screens.css`, `assets/badges/*.svg`.
- Fatto quando: con `?sol=4` compare "!" sui labs → warning → serra → annaffiando (o mandando Maya) plant health risale gradualmente → badge Greenhouse; con `?sol=8` warning → scelta con timer 30 s → entrambe le opzioni producono gli effetti descritti; timer scaduto → salute crew crolla → MISSION FAILED.

### 4. Notte lunare e pannello energia (Flusso 3)
- Obiettivo: a Sol 14 "!" su Life Support → modale "The 14-Day Lunar Night begins!" → MANAGE ENERGY → pannello a 2 pagine (Crew Safety and basics / Lunar base rooms) con slider a 3 stop, pulsanti tutto MAX/ECO/OFF, card info live (battery, consumo giornaliero/orario, solare 0 %, O2, H2O); consumo reale per stanza (ECO solo se occupata dove applicabile); badge Power + 28 Sol a fine notte con power > 0; Power badge applica −10 % consumi.
- File: `js/screens/powerpanel.js`, `js/power.js`, `css/powerpanel.css`.
- Fatto quando: in EASY solo i 3 pulsanti globali funzionano; in HARD ogni slider cambia il consumo; tutto ECO → 56/giorno; tutto MAX → 112; tutto OFF → Mission Failed "The entire base has been shut down"; con `?sol=27` a ECO si arriva a Sol 28 e si vedono i due badge e la vittoria.

### 5. Tablet (Flusso 4)
- Obiettivo: pulsante tablet sempre visibile; pannello con 4 tab: STATS (6 righe live con trend), TASKS (routine giornaliera per astronauta, frecce tra i 4), BADGES (4 badge bloccati/sbloccati con SVG ACHIVED/NOT ACHIVED, click → dettaglio), CREW HEALTH (per astronauta, 3 blocchi metriche con barre, Fix/Ignore: Fix invia l'astronauta nella stanza giusta).
- File: `js/screens/tablet.js`, `css/tablet.css`.
- Fatto quando: tutte le 4 tab si aprono, i valori corrispondono allo stato live, Fix sposta l'astronauta, il gioco è in pausa mentre il tablet è aperto.

### 6. Audio, rifinitura e pubblicazione
- Obiettivo: effetti Web Audio (click, allarme, successo, fallimento) con pulsante mute; scaling 16:9 su qualunque finestra; schermata titolo con START; `README.md` (come giocare/avviare), `.nojekyll`, pubblicazione GitHub Pages da `main` / root.
- File: `js/audio.js`, `README.md`, `.nojekyll`.
- Fatto quando: partita completa giocabile da Sol 1 a Sol 28 senza errori console, audio silenziabile, sito raggiungibile su GitHub Pages.
