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

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const keys = {};
window.addEventListener('keydown', (e) => (keys[e.key.toLowerCase()] = true));
window.addEventListener('keyup', (e) => (keys[e.key.toLowerCase()] = false));

const mouse = { x: canvas.width / 2, y: canvas.height / 2, down: false };
canvas.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
canvas.addEventListener('mousedown', () => (mouse.down = true));
canvas.addEventListener('mouseup', () => (mouse.down = false));

const COLORS = {
  player: '#3fe0ff',
  bullet: '#aef7ff',
  enemy: '#ff3f5e',
  enemyCore: '#ff8a3f',
};

let state = 'start';
let shakeTime = 0;
let shakeMag = 0;
let hitFlash = 0;
let muzzleFlash = 0;
let elapsedTime = 0;
let killCount = 0;
let time = 0;

class Particle {
  constructor(x, y, angle, speed, life, color, size) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.size = size;
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
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * t, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function burst(x, y, color, count, speed, life, size) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    particles.push(new Particle(x, y, angle, speed * (0.4 + Math.random() * 0.6), life * (0.6 + Math.random() * 0.6), color, size));
  }
}

function shake(magnitude, duration) {
  shakeMag = Math.max(shakeMag, magnitude);
  shakeTime = Math.max(shakeTime, duration);
}

class Player {
  constructor() {
    this.x = canvas.width / 2;
    this.y = canvas.height / 2;
    this.radius = 15;
    this.speed = 4.2;
    this.health = 100;
    this.maxHealth = 100;
    this.fireCooldown = 0;
    this.angle = 0;
  }

  update(dt) {
    let dx = 0;
    let dy = 0;
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      this.x += (dx / len) * this.speed;
      this.y += (dy / len) * this.speed;
      if (Math.random() < 0.5) {
        burst(this.x, this.y, COLORS.player, 1, 0.5, 0.25, 2);
      }
    }

    this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

    this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);

    this.fireCooldown -= dt;
    if (mouse.down && this.fireCooldown <= 0) {
      const tipX = this.x + Math.cos(this.angle) * (this.radius + 10);
      const tipY = this.y + Math.sin(this.angle) * (this.radius + 10);
      bullets.push(new Bullet(tipX, tipY, this.angle));
      muzzleFlash = 0.06;
      burst(tipX, tipY, COLORS.bullet, 4, 2.5, 0.2, 2);
      this.fireCooldown = 0.13;
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.shadowColor = COLORS.player;
    ctx.shadowBlur = 18;

    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(63, 224, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.rotate(this.angle);
    ctx.fillStyle = '#0b1420';
    ctx.strokeStyle = COLORS.player;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.radius + 6, 0);
    ctx.lineTo(-this.radius * 0.6, this.radius * 0.8);
    ctx.lineTo(-this.radius * 0.2, 0);
    ctx.lineTo(-this.radius * 0.6, -this.radius * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.radius = 3;
    this.speed = 12;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.dead = false;
  }

  update() {
    this.prevX = this.x;
    this.prevY = this.y;
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
      this.dead = true;
    }
  }

  draw() {
    ctx.save();
    ctx.shadowColor = COLORS.bullet;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = COLORS.bullet;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.prevX, this.prevY);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
    ctx.restore();
  }
}

class Enemy {
  constructor(tier) {
    const edge = Math.floor(Math.random() * 4);
    if (edge === 0) { this.x = Math.random() * canvas.width; this.y = -20; }
    else if (edge === 1) { this.x = canvas.width + 20; this.y = Math.random() * canvas.height; }
    else if (edge === 2) { this.x = Math.random() * canvas.width; this.y = canvas.height + 20; }
    else { this.x = -20; this.y = Math.random() * canvas.height; }

    this.radius = 13;
    this.speed = 1.3 + Math.random() * 0.7 + tier * 0.15;
    this.maxHealth = 30 + tier * 6;
    this.health = this.maxHealth;
    this.dead = false;
    this.spin = Math.random() * Math.PI * 2;
  }

  update(player, dt) {
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    this.x += Math.cos(angle) * this.speed;
    this.y += Math.sin(angle) * this.speed;
    this.spin += dt * 2;

    if (Math.hypot(player.x - this.x, player.y - this.y) < this.radius + player.radius) {
      player.health -= 0.6;
      hitFlash = Math.max(hitFlash, 0.25);
      shake(4, 0.15);
    }
  }

  draw() {
    const pulse = 1 + Math.sin(this.spin * 2) * 0.08;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.spin);
    ctx.scale(pulse, pulse);

    ctx.shadowColor = COLORS.enemy;
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#1a0a10';
    ctx.strokeStyle = COLORS.enemy;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i;
      const r = this.radius;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLORS.enemyCore;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();

    const pct = this.health / this.maxHealth;
    if (pct < 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(this.x - 16, this.y - this.radius - 12, 32, 4);
      ctx.fillStyle = COLORS.enemy;
      ctx.fillRect(this.x - 16, this.y - this.radius - 12, 32 * pct, 4);
    }
  }
}

let player = new Player();
let bullets = [];
let enemies = [];
let particles = [];
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
        burst(bullet.x, bullet.y, COLORS.enemy, 6, 2.5, 0.25, 2.5);
        if (enemy.health <= 0) {
          enemy.dead = true;
          score += 10;
          killCount += 1;
          burst(enemy.x, enemy.y, COLORS.enemy, 18, 3.5, 0.5, 3);
          shake(5, 0.12);
          if (killCount % 10 === 0) {
            wave += 1;
          }
        }
      }
    }
  }
}

function drawBackground(dt) {
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const spacing = 60;
  const offset = (time * 12) % spacing;
  ctx.strokeStyle = 'rgba(63, 224, 255, 0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -spacing; x < canvas.width + spacing; x += spacing) {
    ctx.moveTo(x + offset, 0);
    ctx.lineTo(x + offset, canvas.height);
  }
  for (let y = -spacing; y < canvas.height + spacing; y += spacing) {
    ctx.moveTo(0, y + offset);
    ctx.lineTo(canvas.width, y + offset);
  }
  ctx.stroke();

  const vignette = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, canvas.height * 0.3,
    canvas.width / 2, canvas.height / 2, canvas.height * 0.75
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawCrosshair() {
  ctx.save();
  ctx.translate(mouse.x, mouse.y);
  const spread = muzzleFlash > 0 ? 6 : 0;
  ctx.strokeStyle = COLORS.player;
  ctx.shadowColor = COLORS.player;
  ctx.shadowBlur = 8;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.arc(0, 0, 10 + spread, 0, Math.PI * 2);
  ctx.stroke();

  const gap = 4 + spread;
  const len = 7;
  ctx.beginPath();
  ctx.moveTo(gap, 0); ctx.lineTo(gap + len, 0);
  ctx.moveTo(-gap, 0); ctx.lineTo(-gap - len, 0);
  ctx.moveTo(0, gap); ctx.lineTo(0, gap + len);
  ctx.moveTo(0, -gap); ctx.lineTo(0, -gap - len);
  ctx.stroke();
  ctx.restore();
}

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
  scoreEl.textContent = score;
  waveEl.textContent = wave;
}

function update(dt) {
  time += dt;
  elapsedTime += dt;
  player.update(dt);
  bullets.forEach((b) => b.update());
  enemies.forEach((e) => e.update(player, dt));
  particles.forEach((p) => p.update(dt));
  checkBulletEnemyCollisions();

  bullets = bullets.filter((b) => !b.dead);
  enemies = enemies.filter((e) => !e.dead);
  particles = particles.filter((p) => p.life > 0);

  spawnTimer += dt;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnEnemy();
    spawnInterval = Math.max(0.4, spawnInterval - 0.015);
  }

  if (shakeTime > 0) shakeTime -= dt;
  if (hitFlash > 0) hitFlash -= dt;
  if (muzzleFlash > 0) muzzleFlash -= dt;

  updateHud();

  if (player.health <= 0) {
    endGame();
  }
}

function draw(dt) {
  drawBackground(dt);

  ctx.save();
  if (shakeTime > 0) {
    const mag = shakeMag * (shakeTime / 0.2);
    ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
  } else {
    shakeMag = 0;
  }

  particles.forEach((p) => p.draw());
  enemies.forEach((e) => e.draw());
  bullets.forEach((b) => b.draw());
  player.draw();

  ctx.restore();

  if (hitFlash > 0) {
    ctx.fillStyle = `rgba(255, 30, 60, ${Math.min(0.35, hitFlash)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawCrosshair();
}

function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (state === 'playing') {
    update(dt);
    draw(dt);
  } else {
    time += dt;
    drawBackground(dt);
    drawCrosshair();
  }

  requestAnimationFrame(loop);
}

function endGame() {
  state = 'gameover';
  hudEl.classList.add('hidden');
  finalScoreEl.textContent = score;
  finalKillsEl.textContent = killCount;
  finalTimeEl.textContent = `${Math.round(elapsedTime)}s`;
  gameOverEl.classList.remove('hidden');
}

function startGame() {
  player = new Player();
  bullets = [];
  enemies = [];
  particles = [];
  score = 0;
  wave = 1;
  killCount = 0;
  elapsedTime = 0;
  spawnTimer = 0;
  spawnInterval = 1.5;
  shakeTime = 0;
  hitFlash = 0;

  startScreenEl.classList.add('hidden');
  gameOverEl.classList.add('hidden');
  hudEl.classList.remove('hidden');

  state = 'playing';
  lastTime = performance.now();
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
window.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && state !== 'playing') {
    e.preventDefault();
    startGame();
  }
});

requestAnimationFrame(loop);
