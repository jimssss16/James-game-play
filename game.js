// ============================================================
// Box Nester — recursive box-pushing puzzle engine
// ============================================================

const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

let nextBoxId = 1;
let gameState = null;
const STORAGE_KEY = "box-nester-progress";

// ---------- World / Box factories ----------

function makeInteriorWorld() {
  const iw = 5, ih = 5;
  const walls = new Set();
  for (let x = 0; x < iw; x++) {
    walls.add(x + ",0");
    walls.add(x + "," + (ih - 1));
  }
  for (let y = 0; y < ih; y++) {
    walls.add("0," + y);
    walls.add((iw - 1) + "," + y);
  }
  return { w: iw, h: ih, walls, boxes: [], entrance: { x: 2, y: 2 } };
}

function makeBox(color) {
  return { id: nextBoxId++, color, x: 0, y: 0, interior: makeInteriorWorld() };
}

function loadLevel(idx) {
  const data = LEVELS[idx];
  const h = data.map.length, w = data.map[0].length;
  const root = { w, h, walls: new Set(), boxes: [] };
  const player = { x: 0, y: 0, dir: "down" };
  const boxByDigit = {};

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = data.map[y][x];
      if (ch === "#") root.walls.add(x + "," + y);
      else if (ch === "P") { player.x = x; player.y = y; }
      else if (/[1-9]/.test(ch)) {
        const box = makeBox(data.boxColors[ch] || "#888");
        box.x = x; box.y = y;
        root.boxes.push(box);
        boxByDigit[ch] = box;
      }
    }
  }

  const nav = [];
  let currentWorld = root;

  if (data.startInside) {
    const box = boxByDigit[data.startInside];
    nav.push({ world: box.interior, box });
    currentWorld = box.interior;
    player.x = box.interior.entrance.x;
    player.y = box.interior.entrance.y;
  }

  gameState = {
    root, player, nav, currentWorld,
    levelIdx: idx,
    won: false,
    pullMode: false,
    moves: 0,
  };
}

// ---------- Grid helpers ----------

function isWall(world, x, y) {
  return world.walls.has(x + "," + y) || x < 0 || y < 0 || x >= world.w || y >= world.h;
}

function boxAt(world, x, y) {
  return world.boxes.find(b => b.x === x && b.y === y) || null;
}

function findFreeSpot(world) {
  for (let y = 1; y < world.h - 1; y++) {
    for (let x = 1; x < world.w - 1; x++) {
      if (!(x === world.entrance.x && y === world.entrance.y) && !boxAt(world, x, y)) {
        return { x, y };
      }
    }
  }
  if (!boxAt(world, world.entrance.x, world.entrance.y)) {
    return { x: world.entrance.x, y: world.entrance.y };
  }
  return null;
}

function mergeBoxes(world, containerBox, movingBox) {
  const idx = world.boxes.indexOf(movingBox);
  if (idx === -1) return false;
  const spot = findFreeSpot(containerBox.interior);
  if (!spot) return false;
  world.boxes.splice(idx, 1);
  movingBox.x = spot.x;
  movingBox.y = spot.y;
  containerBox.interior.boxes.push(movingBox);
  return true;
}

// ---------- Actions ----------

function tryMove(dir) {
  if (!gameState || gameState.won) return;
  const [dx, dy] = DIRS[dir];
  const p = gameState.player;
  p.dir = dir;
  const world = gameState.currentWorld;

  if (gameState.pullMode) {
    const bxh = p.x - dx, byh = p.y - dy;
    const pullBox = boxAt(world, bxh, byh);
    const nx = p.x + dx, ny = p.y + dy;
    if (pullBox && !isWall(world, nx, ny)) {
      const frontBox = boxAt(world, nx, ny);
      if (frontBox) {
        if (!mergeBoxes(world, frontBox, pullBox)) { render(); return; }
      } else {
        pullBox.x = p.x; pullBox.y = p.y;
      }
      p.x = nx; p.y = ny;
      gameState.moves++;
      checkWin();
    }
    render();
    return;
  }

  const nx = p.x + dx, ny = p.y + dy;
  if (isWall(world, nx, ny)) { render(); return; }

  const targetBox = boxAt(world, nx, ny);
  if (targetBox) {
    const bx = nx + dx, by = ny + dy;
    if (isWall(world, bx, by)) { render(); return; }
    const beyondBox = boxAt(world, bx, by);
    if (beyondBox) {
      if (!mergeBoxes(world, beyondBox, targetBox)) { render(); return; }
    } else {
      targetBox.x = bx; targetBox.y = by;
    }
    p.x = nx; p.y = ny;
    gameState.moves++;
    checkWin();
    render();
    return;
  }

  p.x = nx; p.y = ny;
  gameState.moves++;
  render();
}

function tryEnterExit() {
  if (!gameState || gameState.won) return;
  const world = gameState.currentWorld;
  const p = gameState.player;

  // Exit: standing on the entrance/exit tile of an interior world
  if (gameState.nav.length > 0 && p.x === world.entrance.x && p.y === world.entrance.y) {
    const top = gameState.nav.pop();
    const parentWorld = gameState.nav.length > 0
      ? gameState.nav[gameState.nav.length - 1].world
      : gameState.root;
    gameState.currentWorld = parentWorld;
    p.x = top.box.x;
    p.y = top.box.y;
    render();
    updateBreadcrumb();
    return;
  }

  // Enter: box directly in front of player
  const [dx, dy] = DIRS[p.dir];
  const fx = p.x + dx, fy = p.y + dy;
  const box = boxAt(world, fx, fy);
  if (box) {
    gameState.nav.push({ world: box.interior, box });
    gameState.currentWorld = box.interior;
    p.x = box.interior.entrance.x;
    p.y = box.interior.entrance.y;
    render();
    updateBreadcrumb();
  }
}

function checkWin() {
  if (gameState.root.boxes.length === 1 && !gameState.won) {
    gameState.won = true;
    saveProgress(gameState.levelIdx);
    document.getElementById("win-banner").classList.remove("hidden");
  }
}

// ---------- Progress persistence ----------

function saveProgress(idx) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const done = raw ? new Set(JSON.parse(raw)) : new Set();
    done.add(idx);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...done]));
  } catch (e) { /* localStorage unavailable, ignore */ }
}

function getProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) {
    return new Set();
  }
}

// ---------- Rendering ----------

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");

function render() {
  const world = gameState.currentWorld;
  const cell = Math.min(canvas.width / world.w, canvas.height / world.h);
  const offX = (canvas.width - cell * world.w) / 2;
  const offY = (canvas.height - cell * world.h) / 2;

  ctx.fillStyle = "#0a1830";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // floor + walls
  for (let y = 0; y < world.h; y++) {
    for (let x = 0; x < world.w; x++) {
      const px = offX + x * cell, py = offY + y * cell;
      if (isWall(world, x, y)) {
        ctx.fillStyle = "#1f7ae0";
        ctx.fillRect(px, py, cell, cell);
        ctx.fillStyle = "#0a1830";
        ctx.fillRect(px + cell * 0.12, py + cell * 0.12, cell * 0.76, cell * 0.76);
      } else {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#16305a" : "#142a4d";
        ctx.fillRect(px, py, cell, cell);
      }
    }
  }

  // entrance marker (only relevant if this world is some box's interior)
  if (gameState.nav.length > 0 && world === gameState.currentWorld) {
    const isInterior = gameState.nav[gameState.nav.length - 1].world === world;
    if (isInterior) {
      const ex = offX + world.entrance.x * cell, ey = offY + world.entrance.y * cell;
      ctx.strokeStyle = "#56b6ff";
      ctx.lineWidth = Math.max(2, cell * 0.06);
      ctx.setLineDash([cell * 0.12, cell * 0.08]);
      ctx.strokeRect(ex + cell * 0.08, ey + cell * 0.08, cell * 0.84, cell * 0.84);
      ctx.setLineDash([]);
    }
  }

  // boxes
  for (const box of world.boxes) {
    const px = offX + box.x * cell, py = offY + box.y * cell;
    const pad = cell * 0.08;
    ctx.fillStyle = box.color;
    roundRect(ctx, px + pad, py + pad, cell - pad * 2, cell - pad * 2, cell * 0.12);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = Math.max(2, cell * 0.05);
    roundRect(ctx, px + pad, py + pad, cell - pad * 2, cell - pad * 2, cell * 0.12);
    ctx.stroke();

    // small dot grid to indicate nested contents
    if (box.interior.boxes.length > 0) {
      const n = Math.min(box.interior.boxes.length, 4);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      const dotR = cell * 0.045;
      const cx = px + cell / 2, cy = py + cell / 2;
      const offsets = [[-1,-1],[1,-1],[-1,1],[1,1]];
      for (let i = 0; i < n; i++) {
        const [ox, oy] = offsets[i];
        ctx.beginPath();
        ctx.arc(cx + ox * cell * 0.15, cy + oy * cell * 0.15, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // player
  {
    const p = gameState.player;
    const px = offX + p.x * cell, py = offY + p.y * cell;
    const cx = px + cell / 2, cy = py + cell / 2;
    const r = cell * 0.32;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b1b33";
    ctx.beginPath();
    const [dx, dy] = DIRS[p.dir];
    const angle = Math.atan2(dy, dx);
    const tipLen = r * 1.15;
    ctx.moveTo(cx + Math.cos(angle) * tipLen, cy + Math.sin(angle) * tipLen);
    ctx.lineTo(cx + Math.cos(angle + 2.5) * r * 0.6, cy + Math.sin(angle + 2.5) * r * 0.6);
    ctx.lineTo(cx + Math.cos(angle - 2.5) * r * 0.6, cy + Math.sin(angle - 2.5) * r * 0.6);
    ctx.closePath();
    ctx.fill();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function updateBreadcrumb() {
  const el = document.getElementById("breadcrumb");
  if (gameState.nav.length === 0) {
    el.textContent = "";
    return;
  }
  const parts = gameState.nav.map(n => "●");
  el.textContent = "Inside box " + gameState.nav.length + (gameState.nav.length > 1 ? " layers deep" : "");
}

// ---------- UI wiring ----------

function restartLevel() {
  loadLevel(gameState.levelIdx);
  document.getElementById("win-banner").classList.add("hidden");
  document.getElementById("pull-btn").classList.remove("active");
  document.getElementById("pull-btn").textContent = "Pull: OFF";
  document.getElementById("level-title").textContent = LEVELS[gameState.levelIdx].name;
  updateBreadcrumb();
  render();
}

function goToLevel(idx) {
  if (idx < 0 || idx >= LEVELS.length) return;
  loadLevel(idx);
  document.getElementById("win-banner").classList.add("hidden");
  document.getElementById("pull-btn").classList.remove("active");
  document.getElementById("pull-btn").textContent = "Pull: OFF";
  document.getElementById("level-title").textContent = LEVELS[idx].name;
  updateBreadcrumb();
  render();
}

function togglePull() {
  gameState.pullMode = !gameState.pullMode;
  const btn = document.getElementById("pull-btn");
  btn.textContent = "Pull: " + (gameState.pullMode ? "ON" : "OFF");
  btn.classList.toggle("active", gameState.pullMode);
}

function buildLevelMenu() {
  const grid = document.getElementById("level-grid");
  grid.innerHTML = "";
  const done = getProgress();
  LEVELS.forEach((lvl, i) => {
    const btn = document.createElement("button");
    btn.className = "level-btn" + (done.has(i) ? " done" : "");
    btn.textContent = i + 1;
    btn.addEventListener("click", () => {
      goToLevel(i);
      document.getElementById("level-menu").classList.add("hidden");
    });
    grid.appendChild(btn);
  });
}

function init() {
  goToLevel(0);

  document.querySelectorAll(".dpad-btn").forEach(btn => {
    btn.addEventListener("click", () => tryMove(btn.dataset.dir));
  });
  document.getElementById("enter-btn").addEventListener("click", tryEnterExit);
  document.getElementById("pull-btn").addEventListener("click", togglePull);
  document.getElementById("restart-btn").addEventListener("click", restartLevel);
  document.getElementById("next-level-btn").addEventListener("click", () => {
    goToLevel(Math.min(gameState.levelIdx + 1, LEVELS.length - 1));
  });
  document.getElementById("menu-btn").addEventListener("click", () => {
    buildLevelMenu();
    document.getElementById("level-menu").classList.remove("hidden");
  });
  document.getElementById("close-menu-btn").addEventListener("click", () => {
    document.getElementById("level-menu").classList.add("hidden");
  });

  window.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowUp": case "w": case "W": tryMove("up"); e.preventDefault(); break;
      case "ArrowDown": case "s": case "S": tryMove("down"); e.preventDefault(); break;
      case "ArrowLeft": case "a": case "A": tryMove("left"); e.preventDefault(); break;
      case "ArrowRight": case "d": case "D": tryMove("right"); e.preventDefault(); break;
      case "e": case "E": tryEnterExit(); break;
      case "r": case "R": restartLevel(); break;
      case "Shift": togglePull(); break;
    }
  });

  // basic swipe support for mobile
  let touchStart = null;
  canvas.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  canvas.addEventListener("touchend", (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? "right" : "left");
    else tryMove(dy > 0 ? "down" : "up");
    touchStart = null;
  }, { passive: true });

  window.addEventListener("resize", render);
}

init();
