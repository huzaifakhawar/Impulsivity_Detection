# Reflex Field

An interactive Three.js rocky-trail prototype for a response-inhibition and impulsivity assessment task.

## Run

Open `index.html` in a browser, or serve the folder with any static web server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Behavioral purpose

This game measures response inhibition, premature responding, timing control, and risk-taking under variable speed conditions. The participant must delay movement until the stimulus reaches the response window, while avoiding premature action and responding too late.

## Layered architecture

The current version was refactored to maintain a clear separation between task logic and presentation:

- Behavioral Task Engine: trial generation, response timing, correct/incorrect outcome, risk conditions
- Game Logic: score, streaks, penalties, speed progression, lockout state
- Visualization: Poly Haven mountain and vegetation GLTFs, PBR trail and ground textures, alpine HDRI lighting, GLB character posing, and response-zone visuals
- Telemetry: reaction time, premature responses, hit events, risk-trial records, session events

This preserves the assessment logic while allowing future visual or 3D upgrades without changing the underlying behavior measurement.

## Game loop

- Start at 50 points.
- Press `Space` or **Duck now** when the boulder reaches the marked response zone.
- A successful duck awards +10 points and builds a safe streak.
- A premature response costs 5 points.
- A hit costs 10 points and locks the game for 10 seconds in this prototype.
- Every 10 safe responses awards 25 field coins.
- The live readout estimates response inhibition, premature responding, consistency, and speed-accuracy from the current session.

## Difficulty structure

The game now includes a measurable 5-level progression in a consistent rocky-trail
environment, with challenge difficulty controlled by stimulus timing and speed:

1. Level 1 — Familiarization: slower approach and a wider response window
2. Level 2 — Basic assessment: normal speed and response timing
3. Level 3 — Increased difficulty: faster stone and shorter response window
4. Level 4 — Variable timing: controlled speed and timing uncertainty
5. Level 5 — Advanced assessment: combined task difficulty

The participant sees a short instruction screen before the first trial. During an
active trial, assessment summaries are hidden so they cannot become additional
performance cues. A final screen reports only high-level completion information;
it does not make diagnostic or impulsivity classifications.

Difficulty is defined using explicit parameters such as speed range, safe-window timing, risk probability, and uncertainty.

## Telemetry retained

Important behavioral variables are preserved and logged in structured form for later ML-ready processing, including:

- trial number
- level
- condition
- response type
- reaction time
- correctness
- premature response
- hit/impact event
- successful/failed inhibition
- premature, omission, and commission error flags
- risk trial flag
- score and penalty values

The structured telemetry is stored in `state.trialRecords` and the event stream is stored in `state.sessionEvents` for export or backend integration.
The browser integration can retrieve a defensive copy of both streams plus summary
features through `window.__reflexField.exportTelemetry()`.

## Environment assets and licensing

The boulder, rock clusters, fir saplings, shrubs, ferns, grass, terrain textures,
and alpine daylight HDRI are from [Poly Haven](https://polyhaven.com/).
Poly Haven assets are released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
The scene uses the `boulder_01`, `rock_moss_set_01`, `fir_sapling`, `shrub_03`,
`fern_02`, `grass_bermuda_01`, `rocky_trail`, `forest_ground_04`, and
`lago_disola` assets. Their local copies are stored under `assets/environment/`;
the adult male character remains in `assets/characters/`.
