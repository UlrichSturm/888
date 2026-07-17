# 888 Basketball

A polished mobile-first HTML5 basketball timing game. Score **888 points** with precise releases, perfect shots, and streaks.

## Quick Start

Serve the project locally (ES modules require HTTP, not `file://`):

```bash
# Option 1: Python
python3 -m http.server 8080

# Option 2: VS Code / Cursor Live Server
# Open index.html with Live Server extension

# Option 3: npx (if you add package.json later)
# npx serve .
```

Open [http://localhost:8080](http://localhost:8080)

## Stack

- HTML5 + CSS3 + Vanilla JavaScript
- Canvas API
- ES modules (no bundler for MVP)
- Mobile-first, portrait, touch input
- No backend, no frameworks, no TypeScript

## Core Mechanic

1. Tap and hold the ball button (bottom-right)
2. The power meter sweeps through red, orange, and green zones
3. Release in the green sweet spot
4. Good release = 2 points, perfect release = 3 points, miss = 0
5. Reach 888 points to win

Every attempt randomizes both the sweet-spot position and the ball's starting position on the court.

## Level Mode

- 10 levels, 24 seconds each — the basketball shot clock
- The timer starts with the first shot
- The accuracy zone gets smaller every level
- From level 4 onward the zone moves and accelerates each level
- Score multipliers increase on levels 4, 7, and 10
- 888 points is achievable during a strong run, but requires consistent accuracy

**Forbidden:** drawing shot arc with finger.

## Project Structure

```
888/
├── index.html
├── README.md
├── styles/main.css
├── docs/              # Product & technical documentation
├── cursor/            # Agent roles, skills, workflow
├── .cursor/rules/     # Cursor AI rules
└── src/
    ├── main.js
    ├── core/          # Game, GameState, GameLoop
    ├── config/        # GameConfig
    ├── entities/      # Player, Ball, Hoop, Court
    ├── input/         # BallButtonInput, PointerInput
    ├── ui/            # Score, arc, game over
    ├── gameplay/      # Spawn, shot flow, scoring
    ├── physics/       # Ball flight
    ├── render/        # Renderer, CanvasScaler
    └── utils/         # MathUtils, RandomUtils
```

## Documentation

| Doc | Description |
|-----|-------------|
| [product-vision.md](docs/product-vision.md) | Game goals and feel |
| [mechanics.md](docs/mechanics.md) | Tap & Hold Release Timing |
| [architecture.md](docs/architecture.md) | Module layout |
| [backlog.md](docs/backlog.md) | MVP stories (Epic 1–9) |
| [definition-of-done.md](docs/definition-of-done.md) | MVP completion criteria |

## MVP Backlog

See [docs/backlog.md](docs/backlog.md) for full epic/story breakdown.

## Start MVP Implementation

Gameplay is **implemented** with a modern visual and interaction pass:

- Tap & Hold Release Timing
- Score to 888, restart on victory
- Perfect-shot scoring and streak feedback
- Generated rooftop court artwork and premium ball sprite
- Per-shot randomized ball placement and accuracy zone
- Synthesized sound + haptic feedback
- Hit particles, glow, and screen shake
- Best score saved in localStorage

## License

Private project.
