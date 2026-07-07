const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMessage = document.getElementById("overlayMessage");
const startBtn = document.getElementById("startBtn");
const resumeBtn = document.getElementById("resumeBtn");
const stopBtn = document.getElementById("stopBtn");
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const menuActions = document.getElementById("menuActions");
const backBtn = document.getElementById("backBtn");
const volumeDownBtn = document.getElementById("volumeDownBtn");
const volumeUpBtn = document.getElementById("volumeUpBtn");
const volumeValue = document.getElementById("volumeValue");
const menuBtn = document.getElementById("menuBtn");
const scoreEl = document.getElementById("score");
const healthEl = document.getElementById("health");
const waveEl = document.getElementById("wave");

const keys = {};
let audioCtx = null;
let masterGain = null;
const state = {
  running: false,
  score: 0,
  health: 100,
  wave: 1,
  mouseX: 0,
  mouseY: 0,
  touchMoveX: 0,
  touchMoveY: 0,
  touchFire: false,
  volume: 0.5,
  menuOpen: false,
  player: { x: 0, y: 0, speed: 4.2, radius: 18, cooldown: 0, fireRate: 0.16 },
  bullets: [],
  enemies: [],
  particles: [],
  stars: [],
  spawnTimer: 0,
  waveTimer: 0,
  flash: 0,
  shake: 0,
  lastTime: performance.now()
};

function resize() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  state.player.x = window.innerWidth / 2;
  state.player.y = window.innerHeight / 2;
  state.player.speed = window.innerWidth < 768 ? 3.4 : 4.2;
  if (state.stars.length === 0) {
    state.stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.8 + 0.4,
      speed: Math.random() * 0.8 + 0.2
    }));
  }
}

function openMenu(title, message, showResume = false) {
  state.menuOpen = true;
  overlay.classList.add("active");
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  menuActions.classList.remove("hidden");
  settingsPanel.classList.add("hidden");
  resumeBtn.classList.toggle("hidden", !showResume);
  startBtn.textContent = state.score > 0 ? "Restart Mission" : "Start Mission";
  startBtn.classList.toggle("hidden", false);
  stopBtn.classList.toggle("hidden", false);
  settingsBtn.classList.toggle("hidden", false);
}

function closeMenu() {
  state.menuOpen = false;
  overlay.classList.remove("active");
}

function resetGame() {
  state.running = true;
  state.score = 0;
  state.health = 100;
  state.wave = 1;
  state.bullets = [];
  state.enemies = [];
  state.particles = [];
  state.spawnTimer = 0;
  state.waveTimer = 0;
  state.flash = 0;
  state.shake = 0;
  state.player.x = window.innerWidth / 2;
  state.player.y = window.innerHeight / 2;
  overlay.classList.remove("active");
  updateHud();
}

function updateHud() {
  scoreEl.textContent = state.score;
  healthEl.textContent = Math.max(0, state.health).toFixed(0);
  waveEl.textContent = state.wave;
}

function startGame() {
  resetGame();
  closeMenu();
}

function pauseGame() {
  state.running = false;
  openMenu("Paused", "Take a breather. Resume when you are ready.", true);
}

function resumeGame() {
  if (state.score === 0 && state.health === 100 && state.wave === 1 && state.enemies.length === 0) {
    startGame();
  } else {
    state.running = true;
    closeMenu();
  }
}

function stopGame() {
  state.running = false;
  state.score = 0;
  state.health = 100;
  state.wave = 1;
  state.bullets = [];
  state.enemies = [];
  state.particles = [];
  state.spawnTimer = 0;
  state.waveTimer = 0;
  state.flash = 0;
  state.shake = 0;
  updateHud();
  openMenu("Game Stopped", "Start a fresh mission whenever you are ready.");
}

function showSettings() {
  menuActions.classList.add("hidden");
  settingsPanel.classList.remove("hidden");
}

function hideSettings() {
  settingsPanel.classList.add("hidden");
  menuActions.classList.remove("hidden");
}

function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = state.volume * 0.25;
  masterGain.connect(audioCtx.destination);
}

function playTone(frequency, duration, type = "square", gainValue = 0.03) {
  if (!audioCtx) ensureAudio();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gainNode.gain.value = gainValue;
  oscillator.connect(gainNode);
  gainNode.connect(masterGain);
  oscillator.start();
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  oscillator.stop(audioCtx.currentTime + duration);
}

function updateVolume(delta) {
  state.volume = Math.max(0, Math.min(1, state.volume + delta));
  volumeValue.textContent = `${Math.round(state.volume * 100)}%`;
  if (masterGain) {
    masterGain.gain.value = state.volume * 0.25;
  }
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  if (side === 0) {
    x = -40;
    y = Math.random() * window.innerHeight;
  } else if (side === 1) {
    x = window.innerWidth + 40;
    y = Math.random() * window.innerHeight;
  } else if (side === 2) {
    x = Math.random() * window.innerWidth;
    y = -40;
  } else {
    x = Math.random() * window.innerWidth;
    y = window.innerHeight + 40;
  }

  state.enemies.push({
    x,
    y,
    radius: 14 + Math.random() * 12,
    hp: 1 + state.wave,
    speed: 1.1 + Math.random() * 0.9 + state.wave * 0.05,
    hue: 180 + Math.random() * 60
  });
}

function fireBullet() {
  const angle = Math.atan2(state.mouseY - state.player.y, state.mouseX - state.player.x);
  playTone(980, 0.05, "square", 0.015);
  state.bullets.push({
    x: state.player.x,
    y: state.player.y,
    vx: Math.cos(angle) * 9,
    vy: Math.sin(angle) * 9,
    life: 1.2,
    radius: 3.5
  });
}

function createBurst(x, y, count, color) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * (Math.random() * 4 + 2),
      vy: (Math.random() - 0.5) * (Math.random() * 4 + 2),
      life: Math.random() * 0.5 + 0.25,
      radius: Math.random() * 2.5 + 0.7,
      color
    });
  }
}

function update(dt) {
  if (!state.running) return;

  state.flash = Math.max(0, state.flash - dt * 0.8);
  state.shake = Math.max(0, state.shake - dt * 0.8);

  const moveX = (keys["d"] || keys["arrowright"] ? 1 : 0) - (keys["a"] || keys["arrowleft"] ? 1 : 0) + state.touchMoveX;
  const moveY = (keys["s"] || keys["arrowdown"] ? 1 : 0) - (keys["w"] || keys["arrowup"] ? 1 : 0) + state.touchMoveY;
  const mag = Math.hypot(moveX, moveY) || 1;
  state.player.x += (moveX / mag) * state.player.speed * dt;
  state.player.y += (moveY / mag) * state.player.speed * dt;

  state.player.x = Math.max(25, Math.min(window.innerWidth - 25, state.player.x));
  state.player.y = Math.max(25, Math.min(window.innerHeight - 25, state.player.y));

  if (state.player.cooldown > 0) {
    state.player.cooldown -= dt * 0.016;
  }

  const firePressed = keys["click"] || mouseDown || state.touchFire || keys[" "] || keys["spacebar"] || keys["enter"];
  if (state.player.cooldown <= 0 && state.running && firePressed) {
    fireBullet();
    state.player.cooldown = state.player.fireRate;
  }

  state.bullets = state.bullets.filter((bullet) => {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt * 0.016;
    return bullet.life > 0 && bullet.x > -50 && bullet.x < window.innerWidth + 50 && bullet.y > -50 && bullet.y < window.innerHeight + 50;
  });

  state.spawnTimer += dt * 0.016;
  if (state.spawnTimer > Math.max(0.6, 1.4 - state.wave * 0.08)) {
    spawnEnemy();
    state.spawnTimer = 0;
  }

  state.waveTimer += dt * 0.016;
  if (state.waveTimer > 12) {
    state.wave += 1;
    state.waveTimer = 0;
    createBurst(window.innerWidth / 2, 80, 40, "#00f7ff");
    updateHud();
  }

  state.enemies.forEach((enemy) => {
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    enemy.x += (dx / dist) * enemy.speed * dt;
    enemy.y += (dy / dist) * enemy.speed * dt;
    if (dist < enemy.radius + state.player.radius) {
      state.health -= 0.5 * dt;
      state.shake = 18;
      createBurst(enemy.x, enemy.y, 8, "#ff4bd8");
      enemy.hp = 0;
    }
  });

  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);

  state.bullets.forEach((bullet) => {
    state.enemies.forEach((enemy) => {
      const dx = bullet.x - enemy.x;
      const dy = bullet.y - enemy.y;
      if (Math.hypot(dx, dy) < bullet.radius + enemy.radius) {
        enemy.hp -= 1;
        bullet.life = 0;
        state.score += 10;
        state.flash = 0.18;
        createBurst(enemy.x, enemy.y, 10, "#fff176");
      }
    });
  });

  state.bullets = state.bullets.filter((bullet) => bullet.life > 0);

  state.particles.forEach((particle) => {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt * 0.016;
    particle.vx *= 0.94;
    particle.vy *= 0.94;
  });
  state.particles = state.particles.filter((particle) => particle.life > 0);

  if (state.health <= 0) {
    state.running = false;
    playTone(180, 0.35, "sawtooth", 0.025);
    overlayTitle.textContent = "Mission Failed";
    overlayMessage.textContent = `You survived ${state.wave} waves and scored ${state.score} points. Press the button to try again.`;
    startBtn.textContent = "Restart Mission";
    overlay.classList.add("active");
    state.menuOpen = true;
  }

  updateHud();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, window.innerHeight);
  gradient.addColorStop(0, "#060b16");
  gradient.addColorStop(1, "#02040d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  for (const star of state.stars) {
    star.y += star.speed * 0.3;
    if (star.y > window.innerHeight) {
      star.y = -5;
      star.x = Math.random() * window.innerWidth;
    }
    ctx.beginPath();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(Math.sin(performance.now() * 0.0002) * 10, 0);
  ctx.strokeStyle = "rgba(0,247,255,0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i += 1) {
    ctx.beginPath();
    ctx.moveTo(0, (window.innerHeight / 12) * i);
    ctx.lineTo(window.innerWidth, (window.innerHeight / 12) * i);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer() {
  const angle = Math.atan2(state.mouseY - state.player.y, state.mouseX - state.player.x);
  ctx.save();
  ctx.translate(state.player.x, state.player.y);
  ctx.rotate(angle);

  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 38);
  glow.addColorStop(0, "rgba(0,247,255,0.85)");
  glow.addColorStop(1, "rgba(0,247,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f3f8ff";
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -10);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#00f7ff";
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBullets() {
  state.bullets.forEach((bullet) => {
    ctx.beginPath();
    ctx.fillStyle = "#fff176";
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawEnemies() {
  state.enemies.forEach((enemy) => {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, enemy.radius + 10);
    glow.addColorStop(0, `hsla(${enemy.hue}, 90%, 62%, 0.95)`);
    glow.addColorStop(1, `hsla(${enemy.hue}, 90%, 62%, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius + 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `hsl(${enemy.hue}, 90%, 62%)`;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawParticles() {
  state.particles.forEach((particle) => {
    ctx.beginPath();
    ctx.fillStyle = particle.color;
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function draw() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  drawBackground();
  if (state.running) {
    ctx.save();
    ctx.translate(Math.random() * state.shake - state.shake / 2, Math.random() * state.shake - state.shake / 2);
    drawEnemies();
    drawBullets();
    drawParticles();
    drawPlayer();
    ctx.restore();
  }

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${state.flash})`;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  }
}

function loop(now) {
  const dt = Math.min(1.8, (now - state.lastTime) / 16.6667);
  state.lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

const movePad = document.getElementById("movePad");
const moveKnob = document.getElementById("moveKnob");
const fireButton = document.getElementById("fireButton");

function resetTouchJoystick() {
  state.touchMoveX = 0;
  state.touchMoveY = 0;
  moveKnob.style.transform = "translate(-50%, -50%)";
}

function updateJoystick(event) {
  const rect = movePad.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const distance = Math.min(36, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const clampedX = Math.cos(angle) * distance;
  const clampedY = Math.sin(angle) * distance;
  moveKnob.style.left = `${50 + (clampedX / 36) * 50}%`;
  moveKnob.style.top = `${50 + (clampedY / 36) * 50}%`;
  state.touchMoveX = Math.max(-1, Math.min(1, clampedX / 36));
  state.touchMoveY = Math.max(-1, Math.min(1, clampedY / 36));
}

window.addEventListener("resize", resize);
window.addEventListener("mousemove", (event) => {
  state.mouseX = event.clientX;
  state.mouseY = event.clientY;
});
canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  ensureAudio();
  state.mouseX = event.clientX;
  state.mouseY = event.clientY;
  mouseDown = true;
  keys.click = true;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  state.mouseX = event.clientX;
  state.mouseY = event.clientY;
});
window.addEventListener("pointerup", () => {
  mouseDown = false;
  keys.click = false;
});
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;
  if (key === " " || key === "spacebar" || key === "enter") {
    event.preventDefault();
  }
  if (key === "escape") {
    event.preventDefault();
    if (state.running) {
      pauseGame();
    } else if (state.menuOpen) {
      closeMenu();
    }
  }
});
window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  keys[key] = false;
});

let mouseDown = false;
movePad.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  ensureAudio();
  movePad.setPointerCapture(event.pointerId);
  updateJoystick(event);
});
movePad.addEventListener("pointermove", (event) => {
  if (event.buttons === 0 && event.pointerType !== "touch") return;
  updateJoystick(event);
});
movePad.addEventListener("pointerup", resetTouchJoystick);
movePad.addEventListener("pointercancel", resetTouchJoystick);

fireButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  ensureAudio();
  state.touchFire = true;
});
fireButton.addEventListener("pointerup", () => {
  state.touchFire = false;
});
fireButton.addEventListener("pointerleave", () => {
  state.touchFire = false;
});

canvas.addEventListener("contextmenu", (event) => event.preventDefault());
startBtn.addEventListener("click", startGame);
resumeBtn.addEventListener("click", resumeGame);
stopBtn.addEventListener("click", stopGame);
settingsBtn.addEventListener("click", showSettings);
backBtn.addEventListener("click", hideSettings);
volumeDownBtn.addEventListener("click", () => updateVolume(-0.1));
volumeUpBtn.addEventListener("click", () => updateVolume(0.1));
menuBtn.addEventListener("click", () => {
  if (state.running) {
    pauseGame();
  } else {
    openMenu("Menu", "Choose an action to continue the mission.", state.score > 0 || state.health < 100 || state.wave > 1);
  }
});

resize();
updateHud();
updateVolume(0);
requestAnimationFrame(loop);