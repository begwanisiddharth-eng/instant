const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const hudEl = document.getElementById('hud');
const healthFillEl = document.getElementById('healthFill');
const healthValueEl = document.getElementById('healthValue');
const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');

const startScreenEl = document.getElementById('startScreen');
const startBtn = document.getElementById('startBtn');

const gameOverEl = document.getElementById('gameOver');
const finalScoreEl = document.getElementById('finalScore');
const finalKillsEl = document.getElementById('finalKills');
const finalTimeEl = document.getElementById('finalTime');
const restartBtn = document.getElementById('restartBtn');

let W = window.innerWidth;
let H = window.innerHeight;
let DPR = 1;

function resizeCanvas() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  buildStars();
}
window.addEventListener('resize', resizeCanvas);

const keys = {};
window.addEventListener('keydown', (e) => (keys[e.key.toLowerCase()] = true));
window.addEventListener('keyup', (e) => (keys[e.key.toLowerCase()] = false));

const mouse = { x: W / 2, y: H / 2, down: false };
canvas.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
canvas.addEventListener('mousedown', () => (mouse.down = true));
window.addEventListener('mouseup', () => (mouse.down = false));
window.addEventListener('blur', () => {
  mouse.down = false;
  for (const k in keys) keys[k] = false;
});

const COLORS = {
  player: '#3fe0ff',
  bullet: '#aef7ff',
};

const MAX_PARTICLES = 700;

let state = 'start';
let shakeTime = 0;
let shakeMag = 0;
let hitFlash = 0;
let muzzleFlash = 0;
let elapsedTime = 0;
let killCount = 0;
let time = 0;

class Particle {
  constructor(x, y, angle, speed, life, color, size, streak = false) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.size = size;
    this.streak = streak;
  }

  update(dt) {
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    this.vx *= 0.94;
    this.vy *= 0.94;
    this.life -= dt;
  }

  draw() {
    const t = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = t;
    if (this.streak) {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.size * t;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.vx * 3, this.y - this.vy * 3);
      ctx.stroke();
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * t, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

class Ring {
  constructor(x, y, color, maxRadius, life, width = 3) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.maxRadius = maxRadius;
    this.life = life;
    this.maxLife = life;
    this.width = width;
  }

  update(dt) {
    this.life -= dt;
  }

  draw() {
    const t = 1 - Math.max(0, this.life / this.maxLife);
    const eased = 1 - Math.pow(1 - t, 3);
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width * (1 - t) + 0.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.maxRadius * eased, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

class Popup {
  constructor(x, y, text, color) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.life = 0.8;
    this.maxLife = 0.8;
  }

  update(dt) {
    this.life -= dt;
    this.y -= dt * 40;
  }

  draw() {
    const t = Math.max(0, this.life / this.maxLife);
    const pop = t > 0.8 ? 1 + (t - 0.8) * 2.5 : 1;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 2);
    ctx.translate(this.x, this.y);
    ctx.scale(pop, pop);
    ctx.font = '800 14px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.text, 0, 0);
    ctx.restore();
  }
}

function burst(x, y, color, count, speed, life, size, streak = false) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    particles.push(new Particle(x, y, angle, speed * (0.4 + Math.random() * 0.6), life * (0.6 + Math.random() * 0.6), color, size, streak));
  }
}

function spray(x, y, angle, spread, color, count, speed, life, size) {
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    particles.push(new Particle(x, y, a, speed * (0.5 + Math.random() * 0.5), life * (0.6 + Math.random() * 0.6), color, size, true));
  }
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function shake(magnitude, duration) {
  if (reduceMotion) magnitude *= 0.3;
  shakeMag = Math.max(shakeMag, magnitude);
  shakeTime = Math.max(shakeTime, duration);
}

class Player {
  constructor() {
    this.x = W / 2;
    this.y = H / 2;
    this.radius = 15;
    this.speed = 4.2;
    this.health = 100;
    this.maxHealth = 100;
    this.fireCooldown = 0;
    this.angle = 0;
    this.moving = false;
    this.moveAngle = 0;
    this.recoil = 0;
  }

  update(dt) {
    let dx = 0;
    let dy = 0;
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;

    this.moving = dx !== 0 || dy !== 0;
    if (this.moving) {
      const len = Math.hypot(dx, dy);
      this.x += (dx / len) * this.speed;
      this.y += (dy / len) * this.speed;
      this.moveAngle = Math.atan2(dy, dx);
      if (Math.random() < 0.7) {
        const back = this.moveAngle + Math.PI;
        particles.push(new Particle(
          this.x + Math.cos(back) * 10, this.y + Math.sin(back) * 10,
          back + (Math.random() - 0.5) * 0.6, 1.5 + Math.random(), 0.3,
          Math.random() < 0.5 ? COLORS.player : '#8a7dff', 2.2
        ));
      }
    }

    this.x = Math.max(this.radius, Math.min(W - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(H - this.radius, this.y));

    this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
    this.recoil = Math.max(0, this.recoil - dt * 30);

    this.fireCooldown -= dt;
    if (mouse.down && this.fireCooldown <= 0) {
      const tipX = this.x + Math.cos(this.angle) * (this.radius + 10);
      const tipY = this.y + Math.sin(this.angle) * (this.radius + 10);
      bullets.push(new Bullet(tipX, tipY, this.angle));
      muzzleFlash = 0.06;
      this.recoil = 3;
      spray(tipX, tipY, this.angle, 0.7, COLORS.bullet, 3, 3, 0.15, 1.5);
      this.fireCooldown = 0.13;
    }
  }

  draw() {
    const r = this.radius;
    ctx.save();
    ctx.translate(this.x, this.y);

    // Soft under-glow.
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3);
    glow.addColorStop(0, 'rgba(63, 224, 255, 0.22)');
    glow.addColorStop(1, 'rgba(63, 224, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 3, 0, Math.PI * 2);
    ctx.fill();

    // Rotating segmented shield ring.
    ctx.save();
    ctx.rotate(time * 1.2);
    ctx.strokeStyle = 'rgba(63, 224, 255, 0.45)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, r + 7, (i * Math.PI * 2) / 3, (i * Math.PI * 2) / 3 + 1.4);
      ctx.stroke();
    }
    ctx.restore();

    ctx.rotate(this.angle);
    ctx.translate(-this.recoil, 0);

    // Engine flame.
    const flame = (this.moving ? 10 : 4) + Math.random() * 4;
    ctx.globalCompositeOperation = 'lighter';
    const fg = ctx.createLinearGradient(-r * 0.3, 0, -r * 0.3 - flame, 0);
    fg.addColorStop(0, 'rgba(160, 240, 255, 0.95)');
    fg.addColorStop(1, 'rgba(120, 90, 255, 0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -4);
    ctx.lineTo(-r * 0.3 - flame, 0);
    ctx.lineTo(-r * 0.3, 4);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Hull.
    ctx.shadowColor = COLORS.player;
    ctx.shadowBlur = 16;
    const hull = ctx.createLinearGradient(-r, 0, r, 0);
    hull.addColorStop(0, '#0a1626');
    hull.addColorStop(1, '#14324a');
    ctx.fillStyle = hull;
    ctx.strokeStyle = COLORS.player;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(r + 7, 0);
    ctx.lineTo(-r * 0.2, r * 0.45);
    ctx.lineTo(-r * 0.7, r * 0.95);
    ctx.lineTo(-r * 0.4, 0);
    ctx.lineTo(-r * 0.7, -r * 0.95);
    ctx.lineTo(-r * 0.2, -r * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Cockpit.
    ctx.fillStyle = '#eaffff';
    ctx.beginPath();
    ctx.ellipse(r * 0.25, 0, 3.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.radius = 3;
    this.speed = 12;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.dead = false;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) {
      this.dead = true;
    }
  }

  draw() {
    const tx = this.x - this.vx * 1.6;
    const ty = this.y - this.vy * 1.6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(63, 224, 255, 0.35)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
    ctx.strokeStyle = '#eaffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
  }
}

// Enemy look shifts with wave: red drones, then magenta, then amber.
const ENEMY_PALETTES = [
  { edge: '#ff3f5e', core: '#ff8a3f', fill: '#1c0910' },
  { edge: '#ff4fd8', core: '#ffd1f4', fill: '#1a0818' },
  { edge: '#ffa63f', core: '#fff06a', fill: '#1d1206' },
];

// Pre-rendered radial glow sprites, cached per colour, so enemies need no shadowBlur.
const glowCache = new Map();

function glowSprite(color, radius) {
  const key = color + radius;
  let c = glowCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = radius * 2;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
    grad.addColorStop(0, color + '55');
    grad.addColorStop(0.4, color + '22');
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, radius * 2, radius * 2);
    glowCache.set(key, c);
  }
  return c;
}

function polygonPath(sides, r) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = ((Math.PI * 2) / sides) * i;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

class Enemy {
  constructor(tier) {
    const edge = Math.floor(Math.random() * 4);
    if (edge === 0) { this.x = Math.random() * W; this.y = -20; }
    else if (edge === 1) { this.x = W + 20; this.y = Math.random() * H; }
    else if (edge === 2) { this.x = Math.random() * W; this.y = H + 20; }
    else { this.x = -20; this.y = Math.random() * H; }

    this.radius = 13;
    this.speed = 1.3 + Math.random() * 0.7 + tier * 0.15;
    this.maxHealth = 30 + tier * 6;
    this.health = this.maxHealth;
    this.dead = false;
    this.spin = Math.random() * Math.PI * 2;
    this.sides = [4, 3, 6][Math.floor(Math.random() * Math.min(3, tier))];
    this.palette = ENEMY_PALETTES[Math.floor((tier - 1) / 3) % ENEMY_PALETTES.length];
    this.flash = 0;
    this.age = 0;
  }

  update(player, dt) {
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    this.x += Math.cos(angle) * this.speed;
    this.y += Math.sin(angle) * this.speed;
    this.spin += dt * 2;
    this.age += dt;
    this.flash = Math.max(0, this.flash - dt);

    if (Math.hypot(player.x - this.x, player.y - this.y) < this.radius + player.radius) {
      player.health -= 0.6;
      hitFlash = Math.max(hitFlash, 0.25);
      shake(4, 0.15);
    }
  }

  draw() {
    const p = this.palette;
    const pulse = 1 + Math.sin(this.spin * 2) * 0.08;
    const spawn = Math.min(1, this.age / 0.25);
    const scale = pulse * (0.4 + 0.6 * spawn) * (this.flash > 0 ? 1.15 : 1);
    const r = this.radius;
    const edge = this.flash > 0 ? '#ffffff' : p.edge;
    ctx.save();
    ctx.translate(this.x, this.y);

    const glow = glowSprite(p.edge, 34);
    ctx.drawImage(glow, -34, -34);

    ctx.rotate(this.spin);
    ctx.scale(scale, scale);
    ctx.lineJoin = 'round';

    // Halo stroke + crisp stroke stands in for an expensive shadowBlur.
    polygonPath(this.sides, r);
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : p.fill;
    ctx.fill();
    ctx.strokeStyle = p.edge + '55';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner counter-rotating frame.
    ctx.rotate(-this.spin * 2);
    polygonPath(this.sides, r * 0.55);
    ctx.strokeStyle = p.edge + '99';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = p.core + '55';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.core;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    const pct = this.health / this.maxHealth;
    if (pct < 1) {
      const bw = 28;
      const bx = this.x - bw / 2;
      const by = this.y - r - 14;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
      ctx.fillStyle = p.edge;
      ctx.fillRect(bx, by, bw * pct, 3);
    }
  }
}

let player = new Player();
let bullets = [];
let enemies = [];
let particles = [];
let effects = [];
let chainCount = 0;
let chainTimer = 0;
let score = 0;
let wave = 1;
let spawnTimer = 0;
let spawnInterval = 1.5;
let lastTime = performance.now();

function spawnEnemy() {
  enemies.push(new Enemy(wave));
}

function checkBulletEnemyCollisions() {
  for (const bullet of bullets) {
    for (const enemy of enemies) {
      if (enemy.dead || bullet.dead) continue;
      if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < bullet.radius + enemy.radius) {
        bullet.dead = true;
        enemy.health -= 15;
        enemy.flash = 0.07;
        const back = Math.atan2(-bullet.vy, -bullet.vx);
        spray(bullet.x, bullet.y, back, 1.2, enemy.palette.edge, 5, 4, 0.25, 2);
        if (enemy.health <= 0) {
          enemy.dead = true;
          score += 10;
          killCount += 1;
          chainCount = chainTimer > 0 ? chainCount + 1 : 1;
          chainTimer = 1.5;
          burst(enemy.x, enemy.y, enemy.palette.edge, 16, 5, 0.5, 2.5, true);
          burst(enemy.x, enemy.y, enemy.palette.core, 10, 2.5, 0.6, 3);
          effects.push(new Ring(enemy.x, enemy.y, enemy.palette.edge, 46, 0.4, 3));
          effects.push(new Ring(enemy.x, enemy.y, '#ffffff', 22, 0.2, 2));
          effects.push(new Popup(enemy.x, enemy.y - 18, '+10', enemy.palette.edge));
          shake(5, 0.12);
          if (killCount % 10 === 0) {
            wave += 1;
          }
        }
      }
    }
  }
}

let stars = [];

function buildStars() {
  stars = [];
  const count = Math.round((W * H) / 2600);
  for (let i = 0; i < count; i++) {
    const depth = Math.random();
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      depth,
      size: 0.4 + depth * 1.4,
      twinkle: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.15 ? 'rgba(200, 160, 255,' : 'rgba(190, 235, 255,',
    });
  }
}

function drawBackground() {
  ctx.fillStyle = '#04050b';
  ctx.fillRect(0, 0, W, H);

  // Nebula light — two slow-drifting coloured glows.
  const n1x = W * (0.25 + Math.sin(time * 0.05) * 0.08);
  const n1y = H * (0.3 + Math.cos(time * 0.04) * 0.06);
  const g1 = ctx.createRadialGradient(n1x, n1y, 0, n1x, n1y, Math.max(W, H) * 0.55);
  g1.addColorStop(0, 'rgba(40, 120, 255, 0.16)');
  g1.addColorStop(0.5, 'rgba(30, 60, 160, 0.06)');
  g1.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);

  const n2x = W * (0.78 + Math.cos(time * 0.035) * 0.07);
  const n2y = H * (0.72 + Math.sin(time * 0.045) * 0.06);
  const g2 = ctx.createRadialGradient(n2x, n2y, 0, n2x, n2y, Math.max(W, H) * 0.5);
  g2.addColorStop(0, 'rgba(170, 60, 255, 0.13)');
  g2.addColorStop(0.5, 'rgba(110, 30, 180, 0.05)');
  g2.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);

  // Parallax starfield, shifted opposite the player for depth.
  const px = state === 'playing' ? (player.x - W / 2) : Math.sin(time * 0.2) * 60;
  const py = state === 'playing' ? (player.y - H / 2) : Math.cos(time * 0.15) * 40;
  for (const s of stars) {
    const drift = time * (4 + s.depth * 14);
    let x = (s.x - px * s.depth * 0.06 + drift) % W;
    let y = (s.y - py * s.depth * 0.06) % H;
    if (x < 0) x += W;
    if (y < 0) y += H;
    const a = 0.25 + s.depth * 0.55 + Math.sin(time * 2 + s.twinkle) * 0.15;
    ctx.fillStyle = s.hue + a.toFixed(3) + ')';
    ctx.fillRect(x, y, s.size, s.size);
  }

  // Grid: faint minor lines, brighter major lines with node dots.
  const spacing = 48;
  const offset = (time * 10) % spacing;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(63, 224, 255, 0.035)';
  ctx.beginPath();
  for (let x = -spacing + offset; x < W + spacing; x += spacing) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, H);
  }
  for (let y = -spacing + offset; y < H + spacing; y += spacing) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(W, Math.round(y) + 0.5);
  }
  ctx.stroke();

  const major = spacing * 4;
  const mOffset = (time * 10) % major;
  ctx.fillStyle = 'rgba(63, 224, 255, 0.22)';
  for (let x = -major + mOffset; x < W + major; x += major) {
    for (let y = -major + mOffset; y < H + major; y += major) {
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    }
  }

  const vignette = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.35,
    W / 2, H / 2, Math.max(W, H) * 0.75
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

function drawCrosshair() {
  const spread = muzzleFlash > 0 ? 5 : 0;
  ctx.save();
  ctx.translate(mouse.x, mouse.y);
  ctx.strokeStyle = COLORS.player;
  ctx.shadowColor = COLORS.player;
  ctx.shadowBlur = 8;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  // Four rotating corner brackets.
  ctx.save();
  ctx.rotate(time * 0.8);
  const d = 9 + spread;
  const arm = 5;
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(d, d - arm);
    ctx.lineTo(d, d);
    ctx.lineTo(d - arm, d);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const chainEl = document.getElementById('chain');
const hudPanels = Array.from(document.querySelectorAll('#hud .panel'));
let lastScore = -1;
let lastWave = -1;

function bump(el) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

const waveBannerEl = document.getElementById('waveBanner');
const waveBannerTextEl = document.getElementById('waveBannerText');

function announceWave(n) {
  waveBannerTextEl.textContent = `WAVE ${n}`;
  waveBannerEl.classList.add('hidden');
  void waveBannerEl.offsetWidth;
  waveBannerEl.classList.remove('hidden');
}

waveBannerEl.addEventListener('animationend', () => waveBannerEl.classList.add('hidden'));

function updateHud() {
  const pct = Math.max(0, player.health / player.maxHealth);
  healthFillEl.style.width = `${pct * 100}%`;
  healthValueEl.textContent = Math.max(0, Math.round(player.health));
  if (pct < 0.25) {
    healthFillEl.style.background = 'linear-gradient(90deg, #ff3f5e, #ff7a3f)';
  } else if (pct < 0.5) {
    healthFillEl.style.background = 'linear-gradient(90deg, #ffcc4d, #ff9a3f)';
  } else {
    healthFillEl.style.background = 'linear-gradient(90deg, #3fe0ff, #4dffb0)';
  }

  if (score !== lastScore) {
    scoreEl.textContent = score;
    if (lastScore >= 0) bump(scoreEl);
    lastScore = score;
  }
  if (wave !== lastWave) {
    waveEl.textContent = wave;
    if (lastWave >= 0) bump(waveEl);
    announceWave(wave);
    lastWave = wave;
  }

  const chainActive = chainTimer > 0 && chainCount >= 2;
  if (chainActive) chainEl.textContent = `x${chainCount} Chain`;
  chainEl.classList.toggle('show', chainActive);

  // Fade HUD panels when the ship flies underneath them.
  for (const panel of hudPanels) {
    const r = panel.getBoundingClientRect();
    const near = player.x > r.left - 30 && player.x < r.right + 30 && player.y > r.top - 30 && player.y < r.bottom + 30;
    panel.classList.toggle('dim', near);
  }
}

function update(dt) {
  time += dt;
  elapsedTime += dt;
  player.update(dt);
  bullets.forEach((b) => b.update());
  enemies.forEach((e) => e.update(player, dt));
  particles.forEach((p) => p.update(dt));
  effects.forEach((f) => f.update(dt));
  checkBulletEnemyCollisions();

  bullets = bullets.filter((b) => !b.dead);
  enemies = enemies.filter((e) => !e.dead);
  particles = particles.filter((p) => p.life > 0);
  if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);
  effects = effects.filter((f) => f.life > 0);

  spawnTimer += dt;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnEnemy();
    spawnInterval = Math.max(0.4, spawnInterval - 0.015);
  }

  if (shakeTime > 0) shakeTime -= dt;
  if (hitFlash > 0) hitFlash -= dt;
  if (muzzleFlash > 0) muzzleFlash -= dt;
  if (chainTimer > 0) chainTimer -= dt;

  updateHud();

  if (player.health <= 0) {
    killPlayer();
  }
}

let dyingTime = 0;

function killPlayer() {
  state = 'dying';
  dyingTime = 0;
  const { x, y } = player;
  burst(x, y, COLORS.player, 40, 9, 0.9, 3, true);
  burst(x, y, '#ffffff', 20, 4, 0.7, 3);
  burst(x, y, '#8a7dff', 24, 6, 1.1, 2.5);
  effects.push(new Ring(x, y, COLORS.player, 220, 0.9, 5));
  effects.push(new Ring(x, y, '#ffffff', 110, 0.5, 3));
  effects.push(new Ring(x, y, '#8a7dff', 340, 1.3, 2));
  shake(16, 0.5);
  hitFlash = 0.4;
  hudEl.classList.add('hidden');
  waveBannerEl.classList.add('hidden');
}

// Debris and stragglers keep moving behind the menus.
function updateAftermath(dt) {
  time += dt;
  for (const e of enemies) {
    const a = Math.atan2(e.y - player.y, e.x - player.x);
    e.x += Math.cos(a) * 1.2;
    e.y += Math.sin(a) * 1.2;
    e.spin += dt * 2;
    e.flash = Math.max(0, e.flash - dt);
  }
  bullets.forEach((b) => b.update());
  particles.forEach((p) => p.update(dt));
  effects.forEach((f) => f.update(dt));
  bullets = bullets.filter((b) => !b.dead);
  particles = particles.filter((p) => p.life > 0);
  effects = effects.filter((f) => f.life > 0);
  enemies = enemies.filter((e) => e.x > -60 && e.x < W + 60 && e.y > -60 && e.y < H + 60);
  if (shakeTime > 0) shakeTime -= dt;
  if (hitFlash > 0) hitFlash -= dt;
}

function drawDamageVignette() {
  const low = state === 'playing' && player.health / player.maxHealth < 0.3 ? 0.18 + Math.sin(time * 6) * 0.08 : 0;
  const a = Math.max(Math.min(0.55, hitFlash * 2), low);
  if (a <= 0) return;
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.72);
  g.addColorStop(0, 'rgba(255, 30, 60, 0)');
  g.addColorStop(1, `rgba(255, 30, 60, ${a.toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function draw(dt) {
  drawBackground();

  ctx.save();
  if (shakeTime > 0) {
    const mag = shakeMag * (shakeTime / 0.2);
    ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
  } else {
    shakeMag = 0;
  }

  enemies.forEach((e) => e.draw());

  ctx.globalCompositeOperation = 'lighter';
  particles.forEach((p) => p.draw());
  bullets.forEach((b) => b.draw());
  effects.forEach((f) => f.draw());
  ctx.globalCompositeOperation = 'source-over';

  if (state === 'playing' || state === 'paused') player.draw();

  ctx.restore();

  drawDamageVignette();

  if (state === 'playing') drawCrosshair();
}

function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (state === 'playing') {
    update(dt);
    draw(dt);
  } else if (state === 'dying') {
    // Slow motion that eases back to full speed.
    dyingTime += dt;
    const scale = 0.25 + Math.min(1, dyingTime / 1.4) * 0.75;
    updateAftermath(dt * scale);
    draw(dt);
    if (dyingTime > 1.2) endGame();
  } else if (state === 'paused') {
    draw(0);
  } else if (state === 'gameover') {
    updateAftermath(dt);
    draw(dt);
  } else {
    time += dt;
    drawBackground();
    updateAmbient(dt);
    drawAmbient();
  }

  requestAnimationFrame(loop);
}

// Start-screen attract mode: enemy formations drift across behind the title.
let ambient = [];
let ambientTimer = 0;

function updateAmbient(dt) {
  ambientTimer -= dt;
  if (ambientTimer <= 0) {
    ambientTimer = 1.6 + Math.random() * 1.4;
    const fromLeft = Math.random() < 0.5;
    const y = H * (0.1 + Math.random() * 0.8);
    const dir = fromLeft ? 1 : -1;
    const tier = 1 + Math.floor(Math.random() * 9);
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const e = new Enemy(tier);
      e.x = fromLeft ? -30 - i * 34 : W + 30 + i * 34;
      e.y = y + Math.sin(i) * 14;
      e.vx = dir * (0.6 + Math.random() * 0.15);
      e.wobble = Math.random() * Math.PI * 2;
      e.age = 1;
      ambient.push(e);
    }
  }
  for (const e of ambient) {
    e.x += e.vx * dt * 60;
    e.y += Math.sin(time * 1.5 + e.wobble) * 0.3;
    e.spin += dt * 1.5;
  }
  ambient = ambient.filter((e) => e.x > -300 && e.x < W + 300);
}

function drawAmbient() {
  ctx.globalAlpha = 0.55;
  ambient.forEach((e) => e.draw());
  ctx.globalAlpha = 1;
}

const BEST_KEY = 'neon-strike-best';

function loadBest() {
  try {
    return parseInt(localStorage.getItem(BEST_KEY), 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage unavailable; best score just won't persist.
  }
}

const bestLineEl = document.getElementById('bestLine');
const bestScoreEl = document.getElementById('bestScore');
const finalBestEl = document.getElementById('finalBest');
const newBestEl = document.getElementById('newBest');

function showStartBest() {
  const best = loadBest();
  bestScoreEl.textContent = best;
  bestLineEl.classList.toggle('hidden', best <= 0);
}

function formatTime(seconds) {
  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function endGame() {
  state = 'gameover';
  hudEl.classList.add('hidden');
  waveBannerEl.classList.add('hidden');
  const prevBest = loadBest();
  const isBest = score > prevBest;
  if (isBest) saveBest(score);
  finalBestEl.textContent = Math.max(score, prevBest);
  newBestEl.classList.toggle('hidden', !(isBest && score > 0));
  finalScoreEl.textContent = score;
  finalKillsEl.textContent = killCount;
  finalTimeEl.textContent = formatTime(elapsedTime);
  gameOverEl.classList.remove('hidden');
}

function startGame() {
  player = new Player();
  bullets = [];
  enemies = [];
  particles = [];
  effects = [];
  score = 0;
  wave = 1;
  killCount = 0;
  elapsedTime = 0;
  spawnTimer = 0;
  spawnInterval = 1.5;
  shakeTime = 0;
  hitFlash = 0;
  lastScore = -1;
  lastWave = -1;
  chainCount = 0;
  chainTimer = 0;

  mouse.down = false;
  ambient = [];

  startScreenEl.classList.add('hidden');
  gameOverEl.classList.add('hidden');
  hudEl.classList.remove('hidden');

  state = 'playing';
  lastTime = performance.now();
}

const pauseScreenEl = document.getElementById('pauseScreen');
const resumeBtn = document.getElementById('resumeBtn');

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  mouse.down = false;
  shakeTime = 0;
  waveBannerEl.classList.add('hidden');
  pauseScreenEl.classList.remove('hidden');
}

function resumeGame() {
  if (state !== 'paused') return;
  pauseScreenEl.classList.add('hidden');
  state = 'playing';
}

resumeBtn.addEventListener('click', resumeGame);
window.addEventListener('blur', pauseGame);
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'escape' || k === 'p') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
window.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && (state === 'start' || state === 'gameover')) {
    e.preventDefault();
    startGame();
  }
});

resizeCanvas();
showStartBest();
requestAnimationFrame(loop);
