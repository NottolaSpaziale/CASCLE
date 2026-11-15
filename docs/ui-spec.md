# UI Spec – C.A.S.C.L.E. (dal prototipo Figma)

Fonte: Figma `Cbdn0l0h6McCZpVDjdEB80`. Screenshot in `docs/figma/` (1280×720, frame originali 3840×2160 = 16:9).
I subagenti usano SOLO questo file e gli screenshot, mai Figma.
Colori ricavati a occhio dagli screenshot (limite chiamate Figma raggiunto): valori indicativi.

## Stile globale
- Formato: 16:9, layout fisso scalato alla finestra (riferimento 1280×720).
- Font: sans-serif geometrico tipo **Inter** (Google Fonts), pesi 400/600/800. Titoli in MAIUSCOLO bold.
- Sfondo app: blu notte `#1A1B33`.
- Pannelli/modali: cornice lilla `#CFC3F0` con bordo `#4B3C9E`, angoli arrotondati ~16px.
- Bottone primario viola `#4A3A9E` testo bianco; bottone BACK/NEXT lilla `#B9A3F5` testo `#1A1B33` con freccia.
- Rosso emergenza: bottoni `#B81F24`, fondo pannello `#F7D6D6`, testo costi `#C0272D`, testo benefici `#2E7D32`.
- Verde badge: fondo `#E8F5D0`, bordo `#6B8E23`, titolo `#2E5E0E`, bottone `#6B8A2E`.
- Mission Failed: tutta la scena in scala di grigi (CSS `filter: grayscale(1)`), modale lilla sopra, non cliccabile tranne START AGAIN.

## Top bar (sempre visibile)
4 slot fissi: POWER `x / 1000 kW` (barra pesca `#FFC98A`), OXYGEN `%` (barra ciano `#9BF3F7`), WATER `%` (barra blu `#3A7BD5`), pillola **SOL N** (`#45406B`, cliccabile → velocità 1x/2x/4x/10x). Track barre `#3B2A7A`.
Nella schermata serra gli slot diventano: POWER, WATER, PLANT HEALTH (barra verde `#3DDC6B`), SOL.

## Mappa base (schermata principale)
Vista dall'alto, 2 file di stanze esagonali collegate da un corridoio centrale.
- Fila alta: Life Support System, Cabin 1, Cabin 2, Galley and kitchen, Medical bay, Geology and biology labs.
- Fila bassa: Restroom, Cabin 3, Cabin 4, Gym, Bunker (con Airlock sotto), Communications Center.
- Etichette bianche bold piccole sopra/sotto ogni stanza.
- Icona alert: cerchio arancio `#F2A65A` con "!" posizionata sulla stanza interessata (labs per serra, Life Support per notte lunare).
- Stanza "in pausa" (bunker attivo): stanza sbiancata con icona orologio.
- Asset: `docs/figma/f2-05-mappa-attiva.png` mostra la mappa pulita (con top bar).

## Sol 1 – Gestione astronauti  [f0-sol1-pagina.png]
Sorgente vettoriale: `docs/C.A.S.C.L.E. - prototype (1).svg` (7038×5757). Contiene un'immagine raster incorporata 3840×2160 (mappa base, da estrarre dal base64 `image0_0_1` → `assets/img/map.png`) e le 4 icone-viso vettoriali (da ritagliare in SVG separati `assets/img/crew-*.svg`).
- Astronauti = **icone-viso circolari** (bordo viola, sfondo lilla), senza corpo: si spostano scivolando da stanza a stanza.
- Posizioni iniziali (Sol 1): Astrid (bionda) in Life Support; Hannah in Medical bay; Maya e Luana nei Labs.
- Menu radiale: attorno all'icona selezionata, pillole viola `#7E6BC4` testo bianco: Restroom, Cabin, Life Support System, Galley & Kitchen, Communications Center, Greenhouse, Medical Bay, Gym.
- Lista azioni: pillola stanza (lilla `#8C7FD0`) a sinistra + colonna di pillole azioni (viola scuro `#4A3A9E`) a destra; testi come §5.1 della doc.
- Nota in basso a sinistra: "Crew avatars, and character designs are fictional."

## Flusso 1 – Serra (Sol 4)  [f1-*]
1. `f1-01` Mappa con "!" sui labs.
2. `f1-02` Modale WARNING: titolo "WARNING! NASA's Veggie system sensors detect low water levels in our Lunar Greenhouse!" + testo Plant Dehydration + bottone **SOLVE**.
3. `f1-03` Serra (piante male): sfondo = colore della luce attiva (rosso `#E03A3A`, verde `#A6F06A`, blu `#3B4FE0`), piante beige se malate / verdi se sane; dopo l'uso il bottone WATER THE PLANTS diventa grigio (cooldown). Elementi: 6 piante beige appassite, semaforo luci in alto a destra (rosso/verde/blu, cerchi in box grigio `#A9A9A9`, quello attivo bordato scuro), pannello inferiore grigio-lilla con 6 barre "WATER H2O" (una per pianta), bottone azzurro **WATER THE PLANTS** (`#6CB4EE`, bordo scuro), bottone **BACK**.
4. `f1-04` Serra (piante bene): piante verdi, barre acqua piene, PLANT HEALTH 50%.
5. `f1-05` Mappa + modale badge verde: "Amazing job! You saved the lunar greenhouse from disaster!", testo sblocco, badge circolare, "+10% Crop Growth Efficiency…", testo Dr. Gioia Massa, bottone **CONTINUE MISSION**. SOL passa a 5.

## Flusso 2 – Emergenza solare (Sol 8)  [f2-*]
1. `f2-01` Modale WARNING DONKI (Solar Flare / SEPs) + **SOLVE**.
2. `f2-02` Scelta: barra timer "Time left to make a choice" in alto; due colonne EVACUATE TO BUNKER / ACTIVATE MAGNETIC SHIELDS con testi (benefici verdi, costi rossi) e bottoni **EVACUATE** / **ACTIVATE SHIELDS**.
3. `f2-04` Evacuate → mappa con labs in pausa (orologio), crew nel bunker; passa 1 Sol.
4. `f2-03` Modale badge Judith Love Cohen ("Amazing job! You kept the crew safe from solar radiation!") + **CONTINUE MISSION**.
5. `f2-05` Shields → mappa attiva, POWER 970/1000.

## Flusso 3 – Notte lunare (Sol 14)  [f3-*]
1. `f3-01` Mappa Sol 14 con "!" su Life Support.
2. `f3-02` Modale "The 14-Day Lunar Night begins!" + testo Battery Backup Activated + bottone **MANAGE ENERGY**.
3. `f3-03` Pannello pagina 1 "Crew Safety and basics" (fondo `#1E1F3B`, titolo verde acqua `#8FE3C8`): 5 slider (Life Support -15, Warmth -7, Water Recycling -5, Communications -2, Radiation Shield -5 units/day a ECO) con tacche 0% OFF / 50% ECO / 100% MAX, fill viola `#B9A3F5`. Colonna destra card info: Battery reserve, Solar Panel Efficiency 0 %, Daily Energy Consumption 56 units/day, O2 Level 84,5 %, Water Reserve 79,7 % (valori verdi `#6EE08A`, rossi `#F06B6B`, gialli `#F5C451`). Bottoni BACK, NEXT PAGE.
4. `f3-04` Pagina 2 "Lunar base rooms – Slide each room to choose how much power it gets": Hydroponic greenhouse, Labs, Medical bay, Gym, Galley and kitchen, Crew cabins, Bunker and Airlock, Restroom and cleaning; ognuno OFF/ECO/MAX. Pulsanti globali tutto MAX / ECO / OFF.
5. Esito: badge Power (Christina Koch, "-10% Energy Consumption") con CONTINUE MISSION.
6. `f3-05` Tutto OFF → MISSION FAILED "The entire base has been shut down" + **START AGAIN**.
7. `f3-06` START AGAIN → mappa Sol 1 (valori 100%).

## Flusso 4 – Tablet  [f4-*]
Pannello lilla con fondo menta `#D5F5EE`, colonna sinistra di 4 icone-tab (Stats grafico, Tasks checklist, Badges coppa, Crew Health croce), tab attiva con bordo nero.
- `f4-01` STATS: righe bianche (nome | valore | nota): O2, CO2, H2O, Solar panels, Battery, Shield.
- `f4-02` TASKS – per astronauta (titolo "TASKS - <ruolo>"), 7 righe orario/titolo/descrizione, avatar a destra, nota "Crew avatars, and character designs are fictional".
- BADGES: griglia 4 badge (Greenhouse, Solar, Power, 28 Sol) bloccati/sbloccati; click → dettaglio come le modali badge.
- CREW HEALTH: per astronauta con frecce, 3 colonne (Physical status: Radiation, Bone mass, Muscle mass; Energy & fatigue: Sleep, Fatigue, Hunger, Hydration; Mental state: Mood/stress), ogni metrica con barra + nota.
(Screenshot di BADGES e CREW HEALTH non scaricati: limite Figma. Seguire lo stile di f4-01.)

## Testi badge (verbatim)
- Power: "Amazing job! You mastered the base energy grid!" / "Unlocked by solving energy warnings, managing power reserves, and turning off non-essential room equipment to prevent dangerous power drains" / "-10% Energy Consumption across the base!" / "Meet your inspiration: Christina Koch, NASA Astronaut, Physicist, and Electrical Engineer! Just like you optimized power and balanced electrical systems during crunches, Christina Koch initiated the Veg-PONDS-02 experiment to save station power and spent 328 continuous days in space!"
- 28 Sol: "Amazing job! You survived the 14-day lunar night!" / "Unlocked by budgeting battery power through the brutal 14-day lunar night darkness and maintaining life support for the 4-member crew" / "Meet your inspiration: Peggy Whitson, record-breaking NASA astronaut and Space Station Commander! Just as you kept equipment and life support running through tough lunar cycles, she spent months commanding the ISS, managing complex operations, upkeep, and research in extreme space conditions."
- Greenhouse e Solar: vedi screenshot f1-05 e f2-03 (testi completi anche in `CASCLE_Full_Game_Documentation.md`).
