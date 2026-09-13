# 📦 Box Nester

A recursive box-pushing puzzle game, inspired by *Patrick's Parabox* style mechanics — built with plain HTML5 Canvas + JavaScript, no build step, no dependencies. Works on desktop (keyboard) and mobile (touch/swipe + on-screen controls).

**[▶ Play it live](#)** *(enable GitHub Pages on this repo and paste the link here)*

## How to play

- **Move**: Arrow keys / WASD (desktop) or the D-pad / swipe (mobile).
- **Push**: Walk into a box to push it forward one tile.
- **Pull**: Toggle **Pull mode** (Shift key or the on-screen button), then move — any box directly behind you gets pulled along.
- **Merge**: Push or pull a box onto another box to nest it *inside* that box.
- **Enter a box**: Face a box and press **E** (or tap "Enter / Exit") to step inside and see what's nested there.
- **Exit a box**: Stand on the dashed tile inside and press **E** again to pop back out.
- **Goal**: Keep merging until only **one box** remains in the room — every box nested inside a single box.

## Project structure

```
box-nester/
├── index.html      # Page layout + on-screen controls
├── style.css        # Dark theme UI, responsive for mobile & desktop
├── js/
│   ├── levels.js    # 20 levels of increasing difficulty (data only)
│   └── game.js       # Game engine: recursive world model, input, rendering
└── README.md
```

## How the recursion works

Every box has its own small interior "room". When you push box **B** onto box **A**, B is removed from the current room and placed inside A's interior — so A now visually contains B. You can walk into A to see B sitting in there, or you can just keep playing outside; either way, the win condition is simply: **the room you started in has exactly one box left.**

Levels increase in difficulty by combining:
- more boxes to merge,
- dead-end alcoves that require **pulling** a box out,
- walls that require solving merges in a specific **order** to open a path,
- a few levels where you **start inside a box** and must exit before you can solve the room.

## Running locally

No build tools needed — it's static HTML/JS. Just open `index.html` in a browser, or serve the folder:

```bash
npx serve .
# or
python3 -m http.server
```

## Publishing to GitHub Pages

1. Push this folder to a GitHub repo.
2. Go to **Settings → Pages**.
3. Set the source to the `main` branch, root folder.
4. Your game will be live at `https://<username>.github.io/<repo-name>/`.

## Adding your own levels

Open `js/levels.js`. Each level is:

```js
{
  name: "My Level",
  map: [
    "##########",
    "#..P.....#",
    "#..1..2..#",
    "##########",
  ],
  boxColors: { "1": "#3ddc84", "2": "#e91e63" }
}
```

`#` = wall, `.` = floor, `P` = player start, `1`–`9` = boxes (matched to `boxColors`). Add `startInside: "1"` to make the player begin inside that box's interior.

## License

MIT — do whatever you like with it.
