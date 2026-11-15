# C.A.S.C.L.E. – Junior Astronaut Mission Trainer

**Cosmics And Space Capacities Learning Experience** – NASA Space Apps Challenge 2026

Gioca online / Play online: **https://nottolaspaziale.github.io/CASCLE/**

---

## Italiano

### Cos'è
Un gioco educativo per browser pensato per ragazzi: sei il comandante di una base lunare e devi mantenere al sicuro un equipaggio di quattro astronaute per **28 Sol** (giorni lunari). Lungo la missione affronterai tre pericoli:
- **Serra**: le piante restano senza acqua; annaffiale o manda Maya (la biologa) a occuparsene.
- **Tempeste solari**: hai 30 secondi per evacuare nel bunker o attivare gli scudi magnetici.
- **Notte lunare**: niente luce solare per giorni, bisogna risparmiare energia.

Se Power, Oxygen, Water, Shield, la salute delle piante o quella di un'astronauta arrivano a zero, la missione fallisce. Arriva al Sol 28 con energia residua per vincere.

### Come si gioca
1. Dalla schermata titolo scegli la difficoltà (**EASY**: un solo interruttore per l'energia; **HARD**: regoli ogni stanza) e premi **START MISSION**.
2. Clicca il **viso di un'astronauta** sulla mappa, scegli una **stanza** e poi un'**azione**: l'astronauta ci va e la esegue.
3. Clicca la pillola **SOL** per cambiare velocità (1x, 2x, 4x, 10x) o mettere in pausa.
4. Apri il **tablet** in alto a destra per statistiche, compiti, badge e salute dell'equipaggio.

### Comandi
| Tasto | Azione |
|---|---|
| Mouse / touch | seleziona astronaute, stanze, azioni e pulsanti |
| Spazio | pausa / riprendi |
| 1 – 4 | velocità 1x / 2x / 4x / 10x |
| M | audio on/off (anche dal pulsante altoparlante in top bar) |
| Esc | chiude menu e schermate |
| Invio | conferma la finestra aperta / START MISSION |

### Parametro `?sol=N`
Aggiungendo `?sol=N` all'indirizzo (es. `index.html?sol=13`) si salta la schermata titolo e si parte direttamente dal Sol N, con risorse coerenti. Utile per test e giudici (es. `?sol=14` notte lunare, `?sol=27` finale).

### Avvio in locale
Il gioco è HTML/CSS/JavaScript puro (moduli ES), senza build né dipendenze. Va servito da un server statico (i moduli ES non funzionano aprendo il file direttamente):

```
npx serve .
# oppure
python -m http.server 8000
```
Poi apri `http://localhost:3000` (serve) o `http://localhost:8000` (Python).

### Pubblicazione su GitHub Pages
Settings → Pages → Source: *Deploy from a branch* → branch `main`, cartella `/ (root)`. Il file `.nojekyll` evita l'elaborazione Jekyll. Tutti i percorsi sono relativi e rispettano maiuscole/minuscole.

---

## English

### What it is
A kid-friendly educational browser game: you command a lunar base and must keep a crew of four astronauts safe for **28 Sol** (Moon days), facing three dangers: **greenhouse** failures, **solar storms** (30 seconds to evacuate or raise the shields) and the long **lunar night** (save energy!). If a vital resource or an astronaut's health reaches zero the mission fails; reach Sol 28 with power left to win.

### How to play
Pick **EASY** or **HARD** on the title screen and press **START MISSION**. Click an **astronaut's face** → choose a **room** → choose an **action**. Click the **SOL** pill to change speed or pause; open the **tablet** for stats, tasks, badges and crew health.

**Controls:** mouse/touch · Space = pause · 1–4 = speed · M = sound on/off · Esc = close · Enter = confirm.

**`?sol=N`** skips the title screen and starts at Sol N (for testing and judges).

### Run locally
```
npx serve .
# or
python -m http.server 8000
```
No build, no dependencies, no database. Published from `main` / root on GitHub Pages (`.nojekyll` included).

---

Team: Elena, Camila, Carlota, Sara, Ludovica, Aurora – NASA Space Apps Challenge 2026.
Crew avatars and character designs are fictional.
