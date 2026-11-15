# C.A.S.C.L.E. – Complete Game Documentation

**C.A.S.C.L.E.** = Cosmics And Space Capacities Learning Experience
**Working title:** Junior Astronaut Mission Trainer
**Team:** Elena (team leader, game coder), Camila and Carlota (space data), Sara (presentation), Ludovica (art and design), Aurora (story and texts)
**Audience:** children aged 7–12
**Built for:** NASA Space Apps Challenge

This document explains the whole game from zero. A developer who has never seen the project should be able to understand what to build by reading this file alone. Everything written here comes from the Figma prototype (five pages), the team's data files, and Aurora's texts.

---

## 0. How to read this document

- **Section 1** explains what the game is and what is built so far.
- **Sections 2–4** explain the core ideas: the base, the time system, and the variables.
- **Section 5** describes every screen one by one.
- **Sections 6–9** describe the systems: events, crew health, power, and the win and lose rules.
- **Section 10** lists the inspiration and the scientific sources.
- **Section 11** lists the open questions and contradictions to resolve before coding.
- **Section 12** gives implementation notes for the developer.

Words in **bold** are important names used in the game. Numbers marked **[to confirm]** are not yet decided.

---

## 1. What the game is

### 1.1 The idea in one paragraph
The player runs a small **lunar base** with **four astronauts**. The base needs power, oxygen, water, and radiation shielding to survive. Each day (called a **Sol**) the player must keep the crew healthy, grow food in the greenhouse, and make safe choices when the Sun sends dangerous storms. Every choice has a real cost, based on NASA data. If a key resource reaches zero, the mission fails. If the player reaches **Sol 28** with power left, the mission succeeds.

### 1.2 What the game teaches
- Space life support is a balance. Oxygen, water, power, and food are limited.
- Plants need the right water and light. In low gravity, water behaves differently.
- The Moon has 14 days of sunlight and 14 days of darkness.
- Solar storms are real. The bunker keeps people safe but stops work. Shields let work continue but expose the crew to radiation.
- Exercise and rest keep astronauts healthy in space.

### 1.3 Current status (important for developers)
The game is currently a set of **linked Figma prototype screens**. It is **not** yet one playable game. The prototype shows the main screens and their buttons, but:
- Time does **not** move in the prototype.
- Resource numbers are fixed examples.
- Most buttons only link to the next screen.

The goal is to turn the prototype into a **real playable browser game** where time moves, values change, and events trigger.

### 1.4 The five prototype pages in Figma
| Figma page | Purpose | Status |
|---|---|---|
| **Sol 1 – Astronaut Management** | Base map, crew portraits, room and action menus | Static screens with menus |
| **Sol 4 – Greenhouse Problem** | Plant irrigation problem and the greenhouse screen | Working sequence of screens |
| **Sol 8 – Solar Emergency** | Storm warning, timed choice, bunker and shields | Working sequence of screens |
| **Sol 14 – Lunar Night** | Power panel for the 14-day night | Screens with ECO / MAX / OFF settings |
| **Tablet** | Badges, stats, tasks, and crew health menu | Screens with examples |

---

## 2. Core concepts (glossary)

| Term | Meaning |
|---|---|
| **Base** | The lunar outpost. It has rooms connected by corridors. |
| **Room** | A part of the base the player can click, such as the Gym or the Greenhouse. |
| **Astronaut / crew member** | One of the four people the player manages. Each has a name, a role, and health stats. |
| **Sol** | One in-game day. The main unit of time in the game. |
| **Speed** | How fast Sols pass: 1x, 2x, 4x, or 10x. |
| **Resource** | A value the base needs: power, oxygen, water, shielding, and plant health. |
| **Alert** | A message that stops the game flow and asks the player to read or act. |
| **Event** | Something that happens in the base, such as a plant problem or a solar storm. |
| **Badge** | A reward the player earns. Each badge honours a real woman in science or spaceflight. |
| **Power mode** | The setting for a room: **OFF**, **ECO**, or **MAX**. |
| **Bunker** | An underground shelter. Used during a solar storm. |
| **Lunar night** | The 14-day period of darkness. Solar panels make no power. |

---

## 3. How time works

### 3.1 The Sol
- One **Sol** is one in-game day.
- At **1x speed**, one Sol lasts **5 real minutes** (300 seconds).
- Real time for one full mission to Sol 28 at 1x: about **140 minutes** (2 hours 20 minutes).

### 3.2 Speed control
- The **Sol button** on the top bar opens a speed choice like the time control in *The Sims*.
- Speeds: **1x** (normal), **2x**, **4x**, **10x**.
- Seconds per Sol at each speed:

| Speed | Real seconds per Sol |
|---|---|
| 1x | 300 |
| 2x | 150 |
| 4x | 75 |
| 10x | 30 |

- **Future idea (not in prototype):** a faster "x1" option. Do not build it yet.

### 3.3 Automatic slow-down (very important)
- When **any alert or emergency** appears, the speed **automatically returns to 1x**.
- The game stays at 1x while the player reads and decides.
- This lets children read the text without the game moving too fast.

### 3.4 Pausing
- The game should **pause** while the player is choosing an action in a decision screen (for example the solar storm choice).
- The **solar storm choice** has a **timer** ("Time left to make a choice"). When the timer runs out, the game must choose a safe default **[to confirm: which default?]**.
- In the Figma prototype, time does not run at all. In the real game, the timer should run.

---

## 4. The variables (the numbers the game tracks)

This table lists every value the game needs to store. "Start" means the value at the beginning of the game.

### 4.1 Base resources
| Variable | Unit | Start | Range | What changes it |
|---|---|---|---|---|
| `power` (battery reserve) | units | 1000 | 0–1000 | Daily consumption of each room; solar panels during daylight |
| `oxygen` | % | 100 | 0–100 | Crew breathing, life support recycling, greenhouse |
| `co2` | % | 0.08 | 0–? | Crew breathing; drops when filters (CDRA) work; rises when filters are overloaded |
| `water` | % | 100 | 0–100 | Crew use, water recycling, watering plants |
| `shield` | % | 100 | 0–100 | Drops during solar storms (CME or SEP) if the shield has no power |
| `plantHealth` | % | 100 | 0–100 | Water level, light colour, irrigation problem, shields during a storm |
| `solarOutput` | kW per hour | 100 in daylight | 0 at night | Sun and time of the lunar cycle |

### 4.2 Rates (how fast things change)
| Rate | Value | Source |
|---|---|---|
| Oxygen use | about −0.14 % per hour for 4 crew members | Figma, Sol 4 stats |
| CO₂ rise | +0.08 % (shown as a level) | Figma, Sol 4 stats |
| Water use | about −0.63 litres per hour (15.2 litres per day) | Figma and ISS data |
| Water recycled | 98 % from urine | ECLSS processor |
| Crew oxygen need | 3.32 kg per day for 4 people | Team data |

### 4.3 Power variables
| Variable | Value |
|---|---|
| Battery capacity | 1000 units |
| Daylight production | 100 kW per hour **[to confirm: units or kW?]** |
| Night production | 0 |
| Lunar night | Sol 14 to Sol 28 |

### 4.4 Crew variables (one set per astronaut)
| Variable | Range | Notes |
|---|---|---|
| `health` | 0–100 | If it reaches 0, the astronaut dies and the mission fails |
| `radiation` | 0–100 | Rises during solar storms. High values are dangerous. |
| `boneMass` | 0–100 % | Drops about 1 to 1.5 % per month without exercise |
| `muscleMass` | 0–100 % | Drops 10 to 15 % on long missions without exercise |
| `sleep` | 0–100 | Restored by sleeping in a cabin |
| `fatigue` | 0–100 | Rises during heavy work, falls with rest |
| `hunger` | 0–100 | Warning before 0; restored by eating in the galley |
| `hydration` | 0–100 | Linked to the base water level; restored by drinking in the galley |
| `mood` | 0–100 | Rises with social time; falls with isolation and during the lunar night |
| `stress` | 0–100 | Rises with isolation and night; falls with social time |
| `location` | room id | Where the astronaut is |
| `task` | task id | What the astronaut is doing now |

### 4.5 Progress variables
| Variable | Notes |
|---|---|
| `sol` | Current day, starts at 1, ends at 28 for the win |
| `speed` | 1, 2, 4, or 10 |
| `badges` | List of unlocked badges |
| `roomPower[room]` | OFF, ECO, or MAX for each room |
| `events` | List of active events and their state |

---

## 5. Screen by screen

### 5.1 Sol 1 – Base Map and Crew Management

**Purpose:** the first screen. The player sees the base and the four astronauts, and learns how to send astronauts to rooms.

**What the player sees**
- The top bar: Power (1000 / 1000 kW), Oxygen (100 %), Water (100 %), and the **SOL 1** button.
- The **base map**: a top view of the lunar base with these rooms:
  - Life Support System
  - Cabin 1, Cabin 2, Cabin 3, Cabin 4
  - Galley and Kitchen
  - Medical Bay
  - Geology and Biology Labs
  - Gym
  - Restroom
  - Airlock
  - Bunker
  - Communications Center
- Four **crew portraits** on the map:
  - **Hannah Becker**, Flight Surgeon
  - **Maya Brooks**, Space Biologist
  - **Luana Santos**, Lunar Geologist
  - **Astrid Lindqvist**, Systems and Power Engineer
- A note at the bottom: "Crew avatars and character designs are fictional."

**What the player does**
1. Click an astronaut's portrait. The portrait becomes selected.
2. A **radial menu** opens around the portrait. It shows room buttons:
   - Cabin, Galley and Kitchen, Gym, Medical Bay, Restroom, Life Support System, Greenhouse, Communications Center.
3. Click a room button. A **room action list** opens with the actions for that room (see below).
4. Click **Go to [room]**. The astronaut character walks from its current position (point A) to the room (point B).

**Room action lists (from the Figma prototype)**

| Room | Actions |
|---|---|
| Cabin | Go to Cabin, Sleep 8h, Relax / Read |
| Galley and Kitchen | Go to Galley, Eat Meal, Drink Water, Socialize with Crew |
| Gym | Go to Gym, Lift Weights (ARED), Run on Treadmill (T2), Ride Exercise Bike (CEVIS) |
| Medical Bay | Go to Medical Bay, Get Medical Check-up, Treat Injury / Illness |
| Labs (Geology and Biology) | Go to Labs, Manage Greenhouse, Analyze Lunar Samples |
| Greenhouse | Manage the plants (see Sol 4) |
| Life Support System | Go to Life Support Room, Check Power Panel, Clean Air Filters (CDRA), Inspect Water Recycler (UPA) |
| Communications Center | Go to Comms Center, Call Earth, Check DONKI Space Weather |
| Bunker, Airlock and EVA Suits | Go to Airlock, Put on EVA Spacesuit and Exit Base, Clean Lunar Dust, Evacuate to Bunker |
| Restroom | Go to Restroom, Restroom and Sanitation |

**Role-based specialisation (who does what best)**
All four astronauts can eat, sleep, and exercise. Each role also has special tasks:
- **Space Biologist (Maya):** greenhouse, crop hydration, LED light schedules, food harvests.
- **Systems and Power Engineer (Astrid):** life support, O₂ and CO₂ filters, water recycling, base power sliders.
- **Lunar Geologist (Luana):** Geology Lab, regolith sample analysis, surface work outside the base.
- **Flight Surgeon (Hannah):** Medical Bay, vital signs, radiation checks, fitness monitoring.

**What this screen does NOT do**
- It does not start the game timer. Time only moves after the player presses a speed button. **[to confirm]**
- Sending an astronaut does not yet use up time in the prototype. In the real game, a walk should take a few seconds of game time.

**Inspiration:** *The Sims*. Click a character, choose a place, the character walks there.

---

### 5.2 Sol 4 – Greenhouse Problem

**Purpose:** teach how plants grow in space, and how water and light change plant health.

**Trigger:** a random event on or around Sol 4. The speed returns to 1x. A warning icon "!" appears on the map.

**Step 1 – The warning**
- The player taps the "!" icon. Astronauts cannot be sent to fix this problem.
- A full-screen message appears:
  - Title: **WARNING!**
  - Text: NASA's Veggie system sensors detect low water levels in our Lunar Greenhouse!
  - Explanation: "Plant Dehydration (Low Humidity): In reduced gravity, water does not flow like it does on Earth, and roots can dry out quickly. Without the right moisture in their special 'Plant Pillows,' our crops will wilt and stop producing fresh food and oxygen for the crew."
  - Button: **SOLVE**

**Step 2 – The greenhouse screen**
- The top bar shows: Power, **Water** (about 87 %), **Plant Health** (about 50 %), and the Sol counter.
- A row of **water bars**, one per plant pillow (six plants). Each bar shows that plant's water level.
- The **plants** are drawn on a red background. Their look changes with their health:
  - Healthy plants: full, green-yellow leaves.
  - Sick plants: drooping leaves, fewer green parts.
- On the right side is a **traffic-light style panel** with three round buttons:
  - **Red** light
  - **Green** light
  - **Blue** light
- At the bottom is the **WATER THE PLANTS** button.
- A **BACK** button returns to the map.

**Light colours**
- **Red light:** triggers flowers and fruit.
- **Green light:** supports the lower leaves. *[to confirm wording]*
- **Blue light:** helps leaves and stems grow.

**Watering the plants**
- Pressing **WATER THE PLANTS**:
  - Uses some **energy** and some **water** from the base.
  - Raises **plant health** (the plants recover).
  - Should be limited so the player cannot spam it **[to confirm: cooldown or water per press]**.
- Changing the light colour also changes which part of the plant grows, and can be done at any time.

**Plant health variable**
- Plant health must move up when watered with the right amount, and down when water is too low.
- In the prototype, the "bad" state shows plant health at **9 %** and water at **88 %**. The "good" state shows plant health at **50 %** and water at **87.2 %**.

**What this screen does NOT do**
- It does not send astronauts to fix the plants.
- It does not stop the game. The game returns to normal after the problem is solved or after a set time.

**Inspiration:** NASA's **Veggie** experiment on the International Space Station (ISS), and the **VEG-05** hydration study.

---

### 5.3 Sol 8 – Solar Emergency

**Purpose:** teach what a solar storm is, and make a decision with real trade-offs.

**Trigger:** a random solar storm. The speed returns to 1x. The game uses **NASA DONKI** data to decide the storm level (see Section 7.3).

**Step 1 – The warning screen**
- Title: **WARNING!**
- Text: "NASA's DONKI satellite system detects a Solar Flare heading towards our Lunar Outpost!"
- Explanation: "Solar Energetic Particles (SEPs): These are particles (especially protons) launched at crazy speeds. They are the greatest danger for astronauts because they can pass through materials, damage human DNA, and ruin equipment."
- Button: **SOLVE** (moves to the choice screen).

**Step 2 – The choice screen**
- Top bar: Power 970 / 1000 kW, Oxygen 89 %, Water 84.7 %, SOL 8.
- A **timer bar** at the top: "Time left to make a choice."
- Two options side by side:

**Option A – EVACUATE TO BUNKER** (button: **EVACUATE**)
- Text: "Directs all crew members to stop work and take shelter in the underground bunker immediately."
- Effect: crew shielding and safety stay at **100 %**, with **zero health risk**.
- Cost: all scientific research and greenhouse food production **pause for 24 hours** (= **1 Sol** in game time).
- Result: the game shows the **bunker screen** where all four astronauts are inside the bunker.
- The time jumps forward **1 Sol**.
- Result: the astronauts are back. The Judith Love Cohen badge is unlocked.

**Option B – ACTIVATE MAGNETIC SHIELDS** (button: **ACTIVATE SHIELDS**)
- Text: "Keeps astronauts inside the lab modules to continue working while powering high-intensity electronic magnetic shielding."
- Effect: "Keeps work going without interruption; science research finishes on time with zero lost hours."
- Cost: "Consumes heavy battery power **-30 kW** and increases crew radiation exposure risk **+15 %**."
- Result: the game **does not end**. The crew stays in the lab modules and keeps working. The plants keep growing. Each astronaut's radiation level rises. The battery drops by the cost.

**What this screen does NOT do**
- It does not fail the mission. The shields option does not end the game.
- It does not send the crew into the bunker automatically.

**Inspiration:** NASA DONKI space weather database and NOAA space weather scales.

---

### 5.4 Sol 14 – Lunar Night and Power Panel

**Purpose:** teach that the Moon has day and night, and that power must be shared carefully.

**Trigger:** fixed. The lunar night starts at **Sol 14** and ends at **Sol 28**.

**Step 1 – The alert**
- An "!" icon appears on the **Life Support System** room on the map.
- Tapping it shows the message:
  - Title: **CHANGE OF PHASE – The lunar night begins!**
  - Text: "The base has entered a period of darkness of approximately 14 days. The solar panels have stopped receiving light and the supply becomes dependent on energy reserves."
  - Status: **Battery backup activated.**

**Step 2 – The power reserve**
- A reservoir shows the battery:
  - **POWER RESERVE: 1000 / 1000 units**
  - Text: "Reserve available to face the 14 days of darkness."
- Other values on the screen:
  - **Daily Energy Consumption:** 56 units per day (at ECO).
  - **Hourly Energy Consumption:** about 2.5 units per hour.
  - **Solar Panel Efficiency:** 0 % (no sunlight).
  - **Solar Production:** +0 kW per hour.
  - **Oxygen:** about 84.5 %, using about 3.32 kg per day.
  - **Water:** about 79.7 %, using about 15.2 litres per day.

**Step 3 – The Base Power Control Panel**
Power is shared between **rooms** (see the Power Panel table in Section 8).

Each room has a **slider** with three stops:
- **0 % = OFF**: the room gets no power.
- **50 % = ECO**: the room uses reduced power. It turns on only when an astronaut is inside (for rooms where this applies).
- **100 % = MAX**: the room gets full power all the time, even if nobody is inside.

Two groups are shown:
1. **Crew safety and basics:** these must stay at **at least 50 %** to keep the crew safe. The player cannot turn them fully OFF.
2. **Lunar base rooms:** these can be set to OFF, ECO, or MAX.

Top buttons: **Set all to ON (MAX)**, **Set all to ECO**, and **Set all to OFF**.

**Step 4 – Consequences**
- At ECO on every system, the base uses about **56 units per day**. Over 14 days that is **784 units**, which fits the 1000-unit battery.
- At MAX on every system, the base uses about **112 units per day**. The battery would run out around **Sol 9** of the night.
- Setting **everything OFF** ends the game immediately (the crew cannot survive).

**Goal of the screen:** reach **Sol 28** with the battery **above 0 %**.

**What this screen does NOT do**
- It does not let the player set each individual piece of equipment. It only sets each room.
- The prototype only shows ECO and OFF plus MAX. The real game should keep all three.

**Inspiration:** the NASA lunar day–night cycle and the real need for energy saving in space habitats.

---

### 5.5 Tablet – Central Menu

**Purpose:** a single menu for overview information. In the Figma prototype, it is shown as a separate page. In the real game, it should open from a button that is always on screen.

**How it opens:** a **tablet button** on the map screens (planned position: always visible). The prototype does not link it to the other pages to keep the flow simple.

**The four tabs on the left side**

**1. Stats**
Shows base-wide resources:
- Oxygen
- Carbon dioxide (CO₂)
- Water
- Solar panel output
- Battery
- Shields

For each one: current level, and how much it changes per hour.

Example at Sol 4:
- **Oxygen:** 92 %, −0.14 % per hour, for 4 crew members. Made by electrolysis plus CO₂ scrubbers.
- **Carbon dioxide:** 0.08 %, rises if the CDRA filters are overloaded. Crew performance drops when CO₂ is high.
- **Water:** 88 %, −0.63 litres per hour. About 98 % is recycled from urine.
- **Solar panels:** 100 %, +100 kWh in full sunlight.
- **Battery:** 1000 / 1000 kW (100 %). Drains during the lunar night.
- **Shields:** 100 %. Drop during solar storms (CME or SEP) if they have no power.

**2. Tasks**
Shows the daily routine, split by hour. On the right, a character shows which astronaut does each task. The routine for one day:
1. Wake up and breakfast
2. Mandatory physical exercise (2 hours)
3. Morning science and lab work
4. Lunch and social time
5. Afternoon duties
6. Maintenance
7. Dinner
8. Rest and sleep (8 hours)

Daily time budget: 8 h sleep, 10 h work and science, 2 h meals, 2 h exercise.

**3. Goals (Badges)**
Shows the badges and the progress toward each one. In the prototype, all badges are shown as unlocked, for demonstration only.
*[to confirm: the earlier design called this tab "Badges"]*

**4. Health (Crew Health)**
Shows all four astronauts. Arrows move between them. For each astronaut, three blocks:

*Physical status*
- **Radiation:** rises after solar storms (CME or SEP). Becomes a critical threat if too high. Fix: Medical Bay.
- **Bone mass:** loses about 1 to 1.5 % per month without exercise. Fix: Gym.
- **Muscle mass:** drops 10 to 15 % on long missions without exercise. Fix: Gym.

*Energy and fatigue*
- **Sleep:** cabin sleep restores performance. Fix: go to a cabin and sleep.
- **Fatigue:** rises during heavy work, falls with rest. Fix: rest in a cabin.
- **Hunger:** the game warns before it reaches 0. Fix: eat in the Galley.
- **Hydration:** linked to the base water level and recycling. Fix: drink in the Galley.

*Mental state*
- **Mood and stress:** rise with isolation and during the lunar night, fall with social time. Fix: put two astronauts in the same room (Galley or Kitchen) for social time.

Each row has an **Ignore** or **Fix** button. If the player ignores a problem, it gets worse.

**Badges page (Tablet, badge view)**
- Each badge has: a title, a locked or unlocked icon, the unlock condition, a short story, and the bonus.
- Shown in the prototype: Greenhouse badge, Power badge, Sun (Solar Radiation) badge, and the 28 Sol badge. The "Solar" badge is shown with the role model Judith Love Cohen.

---

## 6. The crew

| Name | Role | Focus in the game |
|---|---|---|
| **Luana Santos** | Lunar Geologist | Geology Lab, regolith samples, surface work (EVA) |
| **Maya Brooks** | Space Biologist | Greenhouse (Veggie / APH), watering, LED lights, harvests |
| **Astrid Lindqvist** | Systems and Power Engineer | Life support, O₂ and CO₂ filters, water recycling, power panel |
| **Hannah Becker** | Flight Surgeon | Medical Bay, check-ups, radiation checks, fitness |

- Names were generated with AI for this project.
- All four can eat, sleep, exercise, and socialise.
- Only the Systems engineer can change power settings in the real design **[to confirm]**. In the prototype the power panel is a general base screen.

---

## 7. Events

### 7.1 Fixed event: the lunar night
- **When:** Sol 14 to Sol 28.
- **What:** solar panels stop. The battery is the only power source.
- **Player choice:** set each room to OFF, ECO, or MAX, or use the all-room buttons.
- **End:** solar panels return at Sol 28. Win if the battery is above 0 %.

### 7.2 Random event: the greenhouse problem
- **When:** random, around Sol 4 in the prototype.
- **What:** a water problem in the hydroponic system.
- **Why:** plants grow food for the crew. Low gravity changes how water moves.
- **Player action:** water the plants, choose the right light colour.
- **End:** plant health recovers, or the problem stays and plant health keeps dropping.

### 7.3 Random event: solar storm (DONKI)
- **When:** random. Not tied to one Sol.
- **Data source:** NASA **DONKI** (Database Of Notifications, Knowledge, Information), a space weather database.
- **Three levels:**

| Alarm | Phenomenon | Message | Action required |
|---|---|---|---|
| 1 | **FLR** (solar flare) | Watch. "No immediate danger that requires entering the shelter." | Keep watching the systems |
| 2 | **CME** (coronal mass ejection) | Caution. Radiation may rise in space. | Return astronauts to the habitat |
| 3 | **SEP** (solar energetic particles) | Mandatory shelter. "IMMEDIATE SHELTER IS ORDERED." | Choose: Evacuate to Bunker, or Activate Shields |

- Each alert opens with a short, kid-friendly explanation written by Aurora.
- Level 3 (SEP) opens the choice screen in Section 5.3.

**Choice results (level 3)**
- **Evacuate to bunker:** crew safe (100 % shielding), research and greenhouse stop for 1 Sol. Judith Love Cohen badge is unlocked.
- **Activate shields:** game continues. Battery −30 kW. Crew radiation +15 %. Plants keep growing (they may grow deformed).

### 7.4 Speed reset on alert
Every alert or event sets speed to 1x (see Section 3.3).

---

## 8. Power system (detailed rules)

### 8.1 Battery
- Capacity: **1000 units**.
- Charges from solar panels during daylight.
- Does not charge during the lunar night.

### 8.2 Power consumption per room (units per day)

These are the numbers in the Figma prototype and the team's data. Values are **per day**.

| System | ECO | MAX | Notes |
|---|---|---|---|
| Life Support System | 15 | 30 | Must stay at least 50 % (ECO) |
| Warmth (temperature) | 7 | 15 | Must stay at least 50 % (ECO) keeps the base cold but safe |
| Water Recycling | 5 | 10 | Must stay at least 50 % (ECO) |
| Communications | 2 | 4 (prototype shows 5) | **[to confirm]**; must stay at least 50 % (ECO) |
| Radiation Shield | 5 | 10 | "Standby, raise it during solar storms" |
| Hydroponic Greenhouse | 10 | 20 | Controls plant growth |
| Labs (Geology and Biology) | 3 | 5 | Research |
| Medical Bay | 2 | 4 | Treatment |
| Gym | 1 | 3 | Exercise |
| Galley and Kitchen | 2 | 4 | Meals |
| Crew Cabins | 2 | 4 | Sleep |
| Bunker and Airlock | 1 | 1 | Always on ECO |
| Restroom | 1 | 2 | Sanitation |
| **Total** | **56** | **112** | |

Example from the team's data (older example, 90 units per day): life support 30, temperature 25, water pumps 10, greenhouse lighting 20, computers and communications 5. This older example is **not** used in the prototype. See Section 11.

### 8.3 Simple rules
- **OFF:** no power. Nothing in the room works.
- **ECO:** the room uses the ECO number. For some rooms it turns on only when an astronaut is inside.
- **MAX:** the room always uses the MAX number, even when empty.
- Crew safety rooms cannot go below 50 % (ECO).
- The Bunker is on ECO. **[to confirm]**
- Medical Bay and Communications cannot be fully turned OFF. **[to confirm: which rooms can be OFF]**

### 8.4 Future difficulty levels
- **Easy:** the all-room buttons are enough.
- **Medium:** the player controls each room.
- **Hard:** the player controls each individual system in the table above.

---

## 9. Win, lose, and badges

### 9.1 Win
- Reach **Sol 28** with the battery **above 0 %**.
- The solar panels return at Sol 28.

### 9.2 Lose: the Mission Failed screen
The mission fails if any of these reach **0**:
1. **Power** (the battery runs out during the lunar night)
2. **Oxygen**
3. **Water**
4. **Shields**
5. **Plant health** (all crops die)
6. **Any astronaut's health**

When the mission fails:
- The screen turns **black and white** and cannot be clicked.
- The title **MISSION FAILED** appears.
- A short explanation of the cause appears (one message per cause).
- The **START AGAIN** button restarts the game from Sol 1.

> Note: the team's notes say that power loss should be shown as a mission failure, not an instant death. The text on the failure screen should say the base lost power and the crew could not survive.

### 9.3 Badges

| Badge | How to unlock | Role model | Bonus |
|---|---|---|---|
| **Greenhouse** | Manage the greenhouse, adjust LED lights, solve the plant water problem, produce food | **Dr. Gioia Massa**, Lead NASA Scientist (space crops, Veggie, VEG-05) | +10 % crop growth efficiency |
| **Power** | Solve energy warnings, manage the power reserve, switch off non-essential equipment | **Christina Koch**, NASA astronaut, physicist and electrical engineer (Veg-PONDS-02, 328 days in space) | −10 % energy consumption |
| **Sun Radiation (Solar)** | Protect the crew during a solar storm by choosing the bunker | **Judith Love Cohen**, aerospace engineer (Apollo 13 Abort Guidance System) | No bonus |
| **28 Sol** | Survive the 14-day lunar night and reach Sol 28 with power left | **Peggy Whitson**, record-breaking NASA astronaut and ISS commander | No bonus |

- The Power badge and the 28 Sol badge are unlocked **together** when the player reaches Sol 28 with power left.
- More badges will be added for more lunar cycles in future versions.

---

## 10. Inspiration and scientific sources

### 10.1 Game inspiration
- ***The Sims*** – the character moves to a room, the time speed control, the room action menus, the needs bars.

### 10.2 Real NASA data used
- **ISS ECLSS (Environmental Control and Life Support System):** oxygen, CO₂, water recycling (98 % recycled).
- **DONKI:** NASA's space weather database. Solar flares (FLR), coronal mass ejections (CME), and solar energetic particles (SEP).
- **OSDR (Open Science Data Repository):** astronaut health and bone and muscle loss data.
- **Veggie and APH (Advanced Plant Habitat):** plant experiments on the ISS. PONDS (Passive Orbital Nutrient Delivery System) for root watering.
- **Exercise equipment:** ARED (resistive exercise), T2 treadmill, CEVIS cycle ergometer.
- **Lunar cycle:** about 14 days of light and 14 days of darkness.

### 10.3 Key facts shown to the player
- A solar flare's radiation reaches Earth's distance in about 8 minutes 20 seconds.
- CMEs can travel at hundreds or thousands of kilometres per second.
- SEPs can pass through materials and damage DNA and electronics.
- In September 1859, a solar storm damaged telegraph networks (fun fact in the FLR alert).
- CMEs can cause auroras on Earth (fun fact in the CME alert).

### 10.4 Aurora's educational texts
Aurora's texts appear as in-game pop-ups and briefings. They are kept word for word. They are included in the report (section 4.3) and in the team's Plants and CAUTIONS files.

---

## 11. Open questions and contradictions to resolve

These points must be decided before the developer builds the final game.

1. **Shields outcome (Sol 8):** the prototype shows no failure. Earlier notes said failure. **Decision in this document: the shields do not end the game.**
2. **Bunker length:** the prototype says "24 hours". The team's notes say "1 Sol". This document treats **24 hours = 1 Sol** in game time.
3. **Power unit:** the top bar says **kW**, the consumption says **units**. Pick one. Suggestion: use **units** everywhere and show "kW" only in the top bar label.
4. **Daylight output:** the Stats screen says **+100 kWh** in full sunlight. The Sol 14 screen says **+0 kW per hour** at night. Pick one unit.
5. **MAX communications:** the Figma night panel shows **−5** at MAX. The team's table says **4**. This document uses 4 **[to confirm]**.
6. **Labs ECO:** the team's table says 3 and the Figma says −3. Consistent.
7. **Life Support ECO and MAX:** the Figma shows −15 and −30. Consistent with the team's table.
8. **Sol 14 start:** the night starts on Sol 14. Does Sol 14 count as the first night day, or the last day of light? This document uses "Sol 14 is the first night day".
9. **Menu label names:** the prototype names the top bar slots differently on each screen (for example, the middle slot says "WATER" on the greenhouse page but "OXYGEN" on the Sol 1 page). **The developer should use fixed labels: Power, Oxygen, Water, Shield.**
10. **Plant health:** it only appears on the greenhouse screen. Should it also appear in the top bar? **[to confirm]**
11. **Tab name:** "Goals" or "Badges" for the third tab of the tablet. **[to confirm]**
12. **Consumption example:** the team's CAUTIONS file uses 90 units per day. The prototype uses 56 units per day at ECO. This document uses the prototype.
13. **The "Crew Health" overhaul:** the tablet's crew health page mentions "Overhaul Health" as a title. Decide the exact title.
14. **Crew name source:** the names were generated with AI. Decide whether to keep them in the final version.
15. **Timer default:** if the player does not choose in the solar storm timer, what happens? **[to confirm]**
16. **Greenhouse water cooldown:** how often can the plants be watered? **[to confirm]**

---

## 12. Implementation notes for the developer

This section explains how to turn the prototype into a playable game. It is a suggestion, not a fixed design.

### 12.1 Main loop
- Run a **tick** (a small time step, for example every 100 milliseconds of real time).
- On each tick, add `deltaRealSeconds * speedFactor / 300` Sols to the clock, where 300 is the number of real seconds in one Sol at 1x.
- Pause the tick while any alert is open.
- Reset `speed` to 1 when an alert opens.

### 12.2 Daily update (once per Sol)
- Subtract each room's daily power use from `power` (ECO or MAX, depending on the room's setting, and the room is occupied or not).
- During daylight, add solar production to `power`, up to 1000.
- Update oxygen, CO₂, water, and crew needs from the rates in Section 4.2.
- Check the fail conditions (Section 9.2).
- Check whether an event should start (Sections 7.2, 7.3, 7.1).

### 12.3 Astronaut movement
- Store each astronaut's `location` and `destination`.
- Move the character from its current position to the destination over a few seconds of game time.
- When the astronaut arrives, apply the room's effects (for example, eating in the Galley reduces hunger).

### 12.4 Events
- Use an **event queue**. Each event has: an id, a start Sol or random trigger, a message, a list of choices, and an effect function.
- When an event starts: set speed to 1, show the alert, wait for the player's choice.

### 12.5 Screens to build
1. Map screen (with rooms, crew portraits, radial menu, room action list).
2. Top bar (Power, Oxygen, Water, Shield, Sol button with speed choice).
3. Greenhouse screen (plant health, water bars, light buttons, water button).
4. Solar warning screen and choice screen (with a timer bar).
5. Bunker screen (all four astronauts inside) and the "Continue mission" overlay with badge.
6. Lunar night screen (power reserve, power panel with sliders, all-room buttons).
7. Tablet (Stats, Tasks, Goals or Badges, Crew Health).
8. Mission Failed screen (black and white, message, Start Again).

### 12.6 Data files
Keep numbers in a single data file (for example `config.json`) so they can be changed without editing the code:
- Power table (ECO and MAX values per room).
- Rates (oxygen, water, CO₂).
- Event schedule (lunar night Sol 14, greenhouse trigger, solar storm chance).
- Badge definitions (title, unlock rule, role model, bonus).
- Aurora's text strings (copy them exactly).

### 12.7 Suggested first milestone
1. Map screen with the four astronauts and room menus.
2. Time running at 1x, 2x, 4x, 10x, with the reset on alert.
3. Power panel with ECO, MAX, OFF, and the 56 / 112 numbers.
4. Lunar night from Sol 14 to Sol 28, with win and fail.
5. Greenhouse event.
6. Solar storm event with the bunker and shields choices.
7. Tablet and badges.

---

## Appendix A – Quick reference

| Question | Answer |
|---|---|
| How long is one Sol? | 5 real minutes at 1x |
| What are the speeds? | 1x, 2x, 4x, 10x |
| When does speed reset? | When any alert appears |
| How much battery? | 1000 units |
| ECO total per day? | 56 units |
| MAX total per day? | 112 units |
| When is the lunar night? | Sol 14 to Sol 28 |
| How do I win? | Reach Sol 28 with battery above 0 % |
| What causes Mission Failed? | Power, Oxygen, Water, or Shield at 0; plant health at 0; any astronaut's health at 0 |
| What does the bunker do? | Keeps crew at 100 % safety, pauses research and greenhouse for 1 Sol, unlocks the Sun badge |
| What do the shields do? | Crew keeps working, −30 kW, +15 % radiation, the game continues |
| What colours do the plant lights do? | Red: flowers and fruit. Green: lower leaves. Blue: leaves and stems. |
