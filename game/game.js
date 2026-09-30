const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
let W = 0,
  H = 0;
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  W = canvas.width;
  H = canvas.height;
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

const input = { keys: {} };
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  input.keys[k] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k))
    e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  input.keys[e.key.toLowerCase()] = false;
});

const WORLD = {
  decorations: [],
  init() {
    this.decorations = [];
    for (let i = 0; i < 90; i++) {
      const x = Utils.rand(-3500, 3500);
      const y = Utils.rand(-3500, 3500);
      if (Math.hypot(x, y) < 250) continue;
      const r = Math.random();
      const kind = r < 0.35 ? 'tree' : r < 0.65 ? 'grave' : 'bush';
      this.decorations.push({ x, y, kind });
    }
  },
};
WORLD.init();

const MAX_ENEMIES = 120;
const DESPAWN_RADIUS = 1800;
const CULL_RADIUS = 1500;

const game = {
  state: 'menu',
  selectedChar: null,
  player: null,
  enemies: [],
  projectiles: [],
  particles: [],
  orbs: [],
  hpPickups: [],
  dmgNumbers: [],
  chainEffects: [],
  slashEffects: [],
  time: 0,
  kills: 0,
  bossKills: 0,
  spawnTimer: 0,
  spawnInterval: 0.9,
  nextBossWave: 1,
  nextBossTime: 90,
  banner: null, // { text, sub, life, maxLife, color }
  camera: { x: 0, y: 0, shake: 0, shakeX: 0, shakeY: 0 },
  flash: 0,
  hitStop: 0,

  reset() {
    const c = CHARACTERS[this.selectedChar] || CHARACTERS.hunter;
    this.player = new Player(0, 0, c);
    this.player.weapons.push(makeWeapon(c.startWeapon));
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.orbs = [];
    this.hpPickups = [];
    this.dmgNumbers = [];
    this.chainEffects = [];
    this.slashEffects = [];
    this.time = 0;
    this.kills = 0;
    this.bossKills = 0;
    this.spawnTimer = 0.5;
    this.spawnInterval = 0.9;
    this.nextBossWave = 1;
    this.nextBossTime = 90;
    this.banner = null;
    this._lastSoundHurt = 0;
    this.chests = [];
    this.pendingLevelUps = 0;
    this.camera.shake = 0;
    this.camera.shakeX = 0;
    this.camera.shakeY = 0;
    this.flash = 0;
    this.hitStop = 0;
  },

  nearestEnemy(x, y, maxR = 900) {
    let best = null,
      bestD = maxR * maxR;
    for (const e of this.enemies) {
      if (!e.active) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  },

  spawnProjectile(opts) {
    if (window.Sound) Sound.shoot();
    const life = opts.life ?? 2.0;
    const pr = new Projectile(
      opts.x,
      opts.y,
      opts.vx,
      opts.vy,
      opts.damage,
      opts.r,
      opts.pierce,
      opts.color,
      life,
      {
        homing: opts.homing,
        explodeRadius: opts.explodeRadius,
        explodeDamage: opts.explodeDamage,
        spin: opts.spin,
      },
    );
    pr.healOnHit = opts.healOnHit || 0;
    pr.dotDamage = opts.dotDamage || 0;
    pr.dotTime = opts.dotTime || 0;
    pr.areaDot = opts.areaDot || 0;
    this.projectiles.push(pr);
  },

  spawnParticles(x, y, color, count = 5) {
    if (this.particles.length > 250) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = Utils.rand(80, 240);
      this.particles.push(
        new Particle(
          x,
          y,
          Math.cos(a) * sp,
          Math.sin(a) * sp,
          color,
          Utils.rand(0.25, 0.55),
          Utils.rand(2, 3.5),
        ),
      );
    }
  },

  spawnDamageNumber(x, y, value, color) {
    if (this.dmgNumbers.length > 60) return;
    this.dmgNumbers.push(new DamageNumber(x, y, value, color));
  },

  showBanner(text, sub, color = '#c2323e') {
    this.banner = { text, sub, life: 2.6, maxLife: 2.6, color };
  },
};

function update(dt) {
  if (game.hitStop > 0) {
    game.hitStop -= dt;
    dt *= 0.15;
  }
  game.time += dt;
  const p = game.player;

  p.update(dt, input, game);
  for (const w of p.weapons) w.update(dt, game);

  // Спавн
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    spawnWave();
    game.spawnInterval = Math.max(0.28, 0.9 - game.time / 130);
    game.spawnTimer = game.spawnInterval;
  }

  // Боссы — бесконечные, каждые 90с
  if (game.time >= game.nextBossTime) {
    spawnBoss(game.nextBossWave);
    game.nextBossWave++;
    game.nextBossTime += 90;
  }

  // Враги
  for (const e of game.enemies) {
    e.update(dt, p);
    const dist = Math.hypot(e.x - p.x, e.y - p.y);
    if (!e.isBoss && dist > DESPAWN_RADIUS) {
      e.silent = true;
      e.hp = 0;
    }
  }

  // Контакт
  if (p.invuln <= 0) {
    for (const e of game.enemies) {
      if (!e.active) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r) {
        if (p.hurt(e.damage)) {
          game.camera.shake = 16;
          game.flash = 0.6;
          game.hitStop = 0.08;
          game.spawnParticles(p.x, p.y, '#ff5d6c', 10);
          Sound.hurt();
        }
        break;
      }
    }
  }

  // Снаряды
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    const pr = game.projectiles[i];
    pr.update(dt, game);
    let dead = pr.life <= 0;

    if (!dead) {
      for (const e of game.enemies) {
        if (!e.active || pr.hitSet.has(e)) continue;
        if (Math.hypot(e.x - pr.x, e.y - pr.y) < e.r + pr.r) {
          e.hurt(pr.damage, pr.vx, pr.vy);
          pr.hitSet.add(e);
          game.spawnDamageNumber(
            e.x + Utils.rand(-6, 6),
            e.y - e.r - 4,
            Math.round(pr.damage),
            pr.color,
          );
          game.spawnParticles(pr.x, pr.y, pr.color, 2);
          if (window.Sound) Sound.hit();

          // Лечение при попадании (Drain)
          if (pr.healOnHit > 0) {
            const p = game.player;
            const before = p.hp;
            p.hp = Math.min(p.maxHp, p.hp + pr.healOnHit);
            if (p.hp > before) {
              game.spawnDamageNumber(
                p.x,
                p.y - 24,
                `+${Math.round(p.hp - before)}`,
                '#22c55e',
              );
            }
          }

          // DoT по площади (Poison)
          if (pr.areaDot > 0 && pr.dotDamage > 0) {
            for (const other of game.enemies) {
              if (!other.active) continue;
              if (
                Math.hypot(other.x - pr.x, other.y - pr.y) <
                pr.areaDot + other.r
              ) {
                other.dots.push({
                  damage: pr.dotDamage,
                  time: pr.dotTime,
                  interval: 0.4,
                  tick: 0.4,
                });
              }
            }
            // Визуальный эффект облака
            for (let k = 0; k < 14; k++) {
              const ang = Math.random() * Math.PI * 2;
              const sp = Utils.rand(30, 100);
              game.particles.push(
                new Particle(
                  pr.x,
                  pr.y,
                  Math.cos(ang) * sp,
                  Math.sin(ang) * sp,
                  '#7dd050',
                  Utils.rand(0.4, 0.9),
                  Utils.rand(4, 7),
                ),
              );
            }
          }

          if (pr.explodeRadius) {
            explode(pr.x, pr.y, pr.explodeRadius, pr.explodeDamage, pr.hitSet);
          }

          pr.pierce--;
          if (pr.pierce <= 0) {
            dead = true;
            break;
          }
        }
      }
    }
    if (dead && pr.explodeRadius && !pr.exploded) {
      explode(pr.x, pr.y, pr.explodeRadius, pr.explodeDamage, pr.hitSet);
    }
    if (dead) game.projectiles.splice(i, 1);
  }

  // Смерти
  for (let i = game.enemies.length - 1; i >= 0; i--) {
    const e = game.enemies[i];
    if (e.hp <= 0) {
      if (!e.silent) {
        game.kills++;
        if (e.isBoss) Sound.bossDown();
        else Sound.kill();
        game.spawnParticles(
          e.x,
          e.y,
          e.isBoss ? '#ff3050' : '#c04050',
          e.isBoss ? 30 : 6,
        );
        const orbCount = e.isBoss ? 30 : Math.min(3, Math.ceil(e.xp / 1));
        for (let k = 0; k < orbCount; k++) {
          game.orbs.push(
            new XPOrb(
              e.x + Utils.rand(-15, 15),
              e.y + Utils.rand(-15, 15),
              e.isBoss ? 2 : e.xp,
            ),
          );
        }
        if (Math.random() < (e.isBoss ? 1 : 0.05)) {
          game.hpPickups.push(new HPPickup(e.x, e.y, e.isBoss ? 60 : 15));
        }
        if (e.isBoss) {
          game.bossKills++;
          game.showBanner('БОСС ПОВЕРЖЕН!', `Сундук выпал!`, '#fbbf24');
          game.camera.shake = 24;
          game.flash = 0.5;
          game.chests.push(new Chest(e.x, e.y));
        }
      }
      game.enemies.splice(i, 1);
    }
  }

  // Кристаллы
  for (let i = game.orbs.length - 1; i >= 0; i--) {
    const o = game.orbs[i];
    const picked = o.update(dt, p);
    if (picked) {
      p.xp += o.value;
      Sound.pickup();
      game.orbs.splice(i, 1);
    } else if (o.dead()) {
      game.orbs.splice(i, 1); // исчез по времени
    }
  }
  // Сундуки
  for (let i = game.chests.length - 1; i >= 0; i--) {
    const c = game.chests[i];
    c.update(dt, p);
    if (Math.hypot(c.x - p.x, c.y - p.y) < p.r + c.r + 6) {
      // Открываем: +2 уровня, +100 XP, лечение
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);
      p.xp += 100;
      game.pendingLevelUps += 2;
      game.showBanner('СУНДУК ОТКРЫТ!', '+2 уровня, +30% HP', '#fbbf24');
      for (let k = 0; k < 30; k++) {
        const a = Math.random() * Math.PI * 2;
        const sp = Utils.rand(100, 350);
        game.particles.push(
          new Particle(
            c.x,
            c.y,
            Math.cos(a) * sp,
            Math.sin(a) * sp,
            '#fbbf24',
            Utils.rand(0.4, 0.9),
            Utils.rand(3, 6),
          ),
        );
      }
      Sound.heal();
      game.chests.splice(i, 1);
    } else if (c.life <= 0) {
      game.chests.splice(i, 1);
    }
  }

  // HP
  for (let i = game.hpPickups.length - 1; i >= 0; i--) {
    const hp = game.hpPickups[i];
    const r = hp.update(dt, p);
    if (r.picked) {
      p.hp = Math.min(p.maxHp, p.hp + hp.heal);
      Sound.heal();
      game.spawnDamageNumber(p.x, p.y - 20, `+${hp.heal}`, '#22c55e');
      game.hpPickups.splice(i, 1);
    } else if (r.dead) game.hpPickups.splice(i, 1);
  }

  // Левел-ап
  if (game.pendingLevelUps > 0 && game.state === 'playing') {
    game.pendingLevelUps--;
    triggerLevelUp();
  }
  while (p.xp >= p.xpToNext && game.state === 'playing') {
    p.xp -= p.xpToNext;
    p.level++;
    p.xpToNext = Math.floor(p.xpToNext * 1.5 + 3);
    triggerLevelUp();
    break;
  }

  // Частицы / цифры
  for (let i = game.particles.length - 1; i >= 0; i--) {
    game.particles[i].update(dt);
    if (game.particles[i].life <= 0) game.particles.splice(i, 1);
  }
  for (let i = game.dmgNumbers.length - 1; i >= 0; i--) {
    game.dmgNumbers[i].update(dt);
    if (game.dmgNumbers[i].life <= 0) game.dmgNumbers.splice(i, 1);
  }
  for (let i = game.chainEffects.length - 1; i >= 0; i--) {
    game.chainEffects[i].life -= dt;
    if (game.chainEffects[i].life <= 0) game.chainEffects.splice(i, 1);
  }
  for (let i = game.slashEffects.length - 1; i >= 0; i--) {
    game.slashEffects[i].life -= dt;
    if (game.slashEffects[i].life <= 0) game.slashEffects.splice(i, 1);
  }

  // Камера
  game.camera.x = p.x;
  game.camera.y = p.y;
  if (game.camera.shake > 0) {
    game.camera.shake = Math.max(0, game.camera.shake - dt * 55);
    game.camera.shakeX = (Math.random() - 0.5) * game.camera.shake;
    game.camera.shakeY = (Math.random() - 0.5) * game.camera.shake;
  } else {
    game.camera.shakeX = 0;
    game.camera.shakeY = 0;
  }
  if (game.flash > 0) game.flash -= dt * 2.2;
  if (game.banner) {
    game.banner.life -= dt;
    if (game.banner.life <= 0) game.banner = null;
  }

  if (p.hp <= 0 && game.state === 'playing') {
    game.state = 'gameover';
    showGameOver();
  }
}

function explode(x, y, radius, damage, alreadyHit) {
  for (const e of game.enemies) {
    if (!e.active) continue;
    if (alreadyHit && alreadyHit.has(e)) continue;
    if (Math.hypot(e.x - x, e.y - y) < radius + e.r) {
      e.hurt(damage, 0, 0);
      game.spawnDamageNumber(e.x, e.y - e.r, Math.round(damage), '#f97316');
    }
  }
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = Utils.rand(100, 320);
    game.particles.push(
      new Particle(
        x,
        y,
        Math.cos(a) * sp,
        Math.sin(a) * sp,
        i % 3 === 0 ? '#fde047' : '#f97316',
        Utils.rand(0.3, 0.7),
        Utils.rand(3, 6),
      ),
    );
  }
  game.camera.shake = Math.max(game.camera.shake, 10);
}

function spawnWave() {
  if (game.enemies.length >= MAX_ENEMIES) return;
  const t = game.time;
  const count = Math.min(7, 2 + Math.floor(t / 22));
  const hpScale = 1 + t / 60;
  const dmgScale = 1 + t / 150;

  for (let i = 0; i < count; i++) {
    let type = 'zombie';
    const r = Math.random();
    if (t < 20) type = r < 0.55 ? 'zombie' : 'bat';
    else if (t < 50) type = r < 0.4 ? 'zombie' : r < 0.75 ? 'bat' : 'ghost';
    else if (t < 100)
      type =
        r < 0.3 ? 'zombie' : r < 0.55 ? 'bat' : r < 0.85 ? 'ghost' : 'wolf';
    else
      type =
        r < 0.25 ? 'zombie' : r < 0.45 ? 'bat' : r < 0.75 ? 'ghost' : 'wolf';

    const angle = Math.random() * Math.PI * 2;
    const dist = Math.hypot(W, H) * 0.55 + 100;
    const x = game.player.x + Math.cos(angle) * dist;
    const y = game.player.y + Math.sin(angle) * dist;
    const e = new Enemy(x, y, type, hpScale, dmgScale);

    // Элитный после 3 минут
    if (t > 180 && Math.random() < 0.08) {
      e.hp *= 3;
      e.maxHp = e.hp;
      e.damage *= 1.6;
      e.r *= 1.35;
      e.xp *= 4;
      e.isElite = true;
    }
    game.enemies.push(e);
  }
}

function spawnBoss(wave) {
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.hypot(W, H) * 0.6;
  const x = game.player.x + Math.cos(angle) * dist;
  const y = game.player.y + Math.sin(angle) * dist;
  game.enemies.push(new Boss(x, y, wave));
  game.showBanner(
    `ВОЛНА БОССА ${wave}`,
    `HP ${Math.round(3000 * (1 + wave * 1.2))}`,
    '#c2323e',
  );
  game.camera.shake = 28;
  game.flash = 1.0;
  game.hitStop = 0.15;
  Sound.boss();
}

function triggerLevelUp() {
  Sound.levelup();
  if (game.state !== 'playing') return;
  game.state = 'levelup';
  showLevelUp(buildUpgradeChoices(game.player, 3));
}

function showLevelUp(choices) {
  const el = document.getElementById('levelup');
  document.getElementById('luLevel').textContent = game.player.level;
  const row = document.getElementById('cardRow');
  row.innerHTML = '';
  for (const c of choices) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="icon">${c.icon}</div><div class="title">${c.title}</div><div class="desc">${c.desc}</div>`;
    card.onclick = () => {
      c.apply();
      el.classList.add('hidden');
      if (game.pendingLevelUps > 0) {
        game.pendingLevelUps--;
        showLevelUp(buildUpgradeChoices(game.player, 3));
      } else {
        game.state = 'playing';
        lastTime = performance.now();
      }
    };
    row.appendChild(card);
  }
  el.classList.remove('hidden');
}

function showGameOver() {
  Sound.gameover();
  const best = parseFloat(localStorage.getItem('wraith_best_time') || '0');
  const myTime = game.time;
  if (myTime > best) {
    localStorage.setItem('wraith_best_time', myTime.toFixed(2));
    game.newRecord = true;
  } else {
    game.newRecord = false;
  }

  // Разблокировка персонажей по рекорду
  const bestNow = parseFloat(localStorage.getItem('wraith_best_time') || '0');
  const unlocked = JSON.parse(
    localStorage.getItem('wraith_unlocked') || '["hunter","mage"]',
  );
  const UNLOCK = { knight: 240, paladin: 360, warlock: 480 };
  const newlyUnlocked = [];
  for (const id in UNLOCK) {
    if (!unlocked.includes(id) && bestNow >= UNLOCK[id]) {
      unlocked.push(id);
      newlyUnlocked.push(CHARACTERS[id].name);
    }
  }
  if (newlyUnlocked.length > 0) {
    localStorage.setItem('wraith_unlocked', JSON.stringify(unlocked));
  }
  game.newlyUnlocked = newlyUnlocked;
  const t = Math.floor(game.time);
  document.getElementById('goTime').textContent =
    `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`;
  document.getElementById('goKills').textContent = game.kills;
  document.getElementById('goLevel').textContent = game.player.level;
  document.getElementById('goBosses').textContent = game.bossKills;
  const statsEl = document.querySelector('#gameover .stats');
  const oldBest = statsEl.querySelector('.best-record');
  if (oldBest) oldBest.remove();
  const best2 = parseFloat(localStorage.getItem('wraith_best_time') || '0');
  const bestStr = `${Math.floor(best2 / 60)}:${Math.floor(best2 % 60)
    .toString()
    .padStart(2, '0')}`;
  const bestDiv = document.createElement('div');
  bestDiv.className = 'best-record';
  bestDiv.innerHTML = `<span style="${game.newRecord ? 'color:#fbbf24;text-shadow:0 0 14px rgba(251,191,36,0.9);' : ''}">${bestStr}${game.newRecord ? ' 🏆' : ''}</span><label>рекорд</label>`;
  statsEl.appendChild(bestDiv);
  if (newlyUnlocked.length > 0) {
    const unlockDiv = document.createElement('div');
    unlockDiv.className = 'best-record';
    unlockDiv.style.marginTop = '10px';
    unlockDiv.innerHTML = `<span style="color:#fbbf24;font-size:18px;text-shadow:0 0 14px rgba(251,191,36,0.9);">🔓 ${newlyUnlocked.join(', ')}</span><label>открыт</label>`;
    statsEl.appendChild(unlockDiv);
  }
  document.getElementById('gameover').classList.remove('hidden');
}

// ==================== RENDER ====================
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const bg = ctx.createRadialGradient(
    W / 2,
    H / 2,
    60,
    W / 2,
    H / 2,
    Math.max(W, H) * 0.75,
  );
  bg.addColorStop(0, '#14101a');
  bg.addColorStop(0.55, '#0a0710');
  bg.addColorStop(1, '#030206');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (!game.player) return;
  const cx = game.camera.x + game.camera.shakeX;
  const cy = game.camera.y + game.camera.shakeY;
  const offX = W / 2 - cx,
    offY = H / 2 - cy;

  drawGround(offX, offY);

  ctx.save();
  ctx.translate(offX, offY);

  drawDecorations(cx, cy);

  // Аура
  const auraW = game.player.weapons.find((w) => w.id === 'aura');
  if (auraW && auraW.radius > 0) {
    const g = ctx.createRadialGradient(
      game.player.x,
      game.player.y,
      0,
      game.player.x,
      game.player.y,
      auraW.radius,
    );
    g.addColorStop(0, 'rgba(200,80,140,0.18)');
    g.addColorStop(0.7, 'rgba(200,80,140,0.05)');
    g.addColorStop(1, 'rgba(200,80,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(game.player.x, game.player.y, auraW.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,100,160,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(game.player.x, game.player.y, auraW.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Кристаллы
  for (const o of game.orbs) {
    if (Math.abs(o.x - cx) > W / 2 + 40 || Math.abs(o.y - cy) > H / 2 + 40)
      continue;
    const pulse = 1 + Math.sin(o.pulse) * 0.15;
    ctx.save();
    ctx.globalAlpha = o.alpha();
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 14;
    drawSprite(ctx, SPRITES.crystal, o.x, o.y, 28 * pulse, 28 * pulse);
    ctx.restore();
  }
  // Сундуки
  for (const c of game.chests) {
    if (Math.abs(c.x - cx) > W / 2 + 60 || Math.abs(c.y - cy) > H / 2 + 60)
      continue;
    const pulse = 1 + Math.sin(c.pulse) * 0.12;
    ctx.save();
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 30;
    drawSprite(ctx, SPRITES.chest, c.x, c.y, 56 * pulse, 56 * pulse);
    ctx.restore();
    // Мигающий круг внимания
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(performance.now() / 200) * 0.2;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  for (const hp of game.hpPickups) {
    if (Math.abs(hp.x - cx) > W / 2 + 40 || Math.abs(hp.y - cy) > H / 2 + 40)
      continue;
    const pulse = 1 + Math.sin(hp.pulse) * 0.15;
    ctx.save();
    ctx.shadowColor = '#ff3050';
    ctx.shadowBlur = 16;
    drawSprite(ctx, SPRITES.heart, hp.x, hp.y, 24 * pulse, 24 * pulse);
    ctx.restore();
  }

  // Снаряды
  for (const pr of game.projectiles) drawProjectile(pr);

  // Враги (cull по экрану)
  const halfW = W / 2 + 80,
    halfH = H / 2 + 80;
  for (const e of game.enemies) {
    if (Math.abs(e.x - cx) > halfW || Math.abs(e.y - cy) > halfH) continue;
    drawEnemy(e);
  }

  // Игрок
  drawPlayerWithInvuln(game.player);

  // Орбита
  const orbitW = game.player.weapons.find((w) => w.id === 'orbit');
  if (orbitW)
    for (const pos of orbitW.positions) {
      ctx.save();
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

  // Молнии
  for (const ce of game.chainEffects) {
    const a = ce.life / ce.maxLife;
    ctx.strokeStyle = `rgba(253,224,71,${a})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = 22;
    for (const l of ce.lines) {
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      // зигзаг
      const segs = 4;
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const nx = Utils.lerp(l.x1, l.x2, t) + Utils.rand(-8, 8);
        const ny = Utils.lerp(l.y1, l.y2, t) + Utils.rand(-8, 8);
        ctx.lineTo(nx, ny);
      }
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  // Слэши (меч)
  for (const sl of game.slashEffects) {
    const a = sl.life / sl.maxLife;
    const color = sl.color || '#fbbf24';
    ctx.save();
    ctx.translate(sl.x, sl.y);
    ctx.rotate(sl.angle);
    ctx.strokeStyle = color;
    ctx.globalAlpha = a * 0.9;
    ctx.lineWidth = sl.full ? 6 : 8;
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    if (sl.full) {
      // Молот — полный круг, расширяется
      ctx.arc(0, 0, sl.radius * (0.6 + (1 - a) * 0.5), 0, Math.PI * 2);
    } else {
      ctx.arc(0, 0, sl.radius * (1.1 - a * 0.3), -sl.arc / 2, sl.arc / 2);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Вихрь
  const whirlW = game.player.weapons.find((w) => w.id === 'whirlwind');
  if (whirlW && whirlW.radius > 0) {
    const pulse = 0.55 + Math.sin(performance.now() / 90) * 0.15;
    ctx.strokeStyle = `rgba(165,243,252,${pulse})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.arc(
      game.player.x,
      game.player.y,
      whirlW.radius,
      performance.now() / 200,
      performance.now() / 200 + Math.PI * 2,
    );
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const pa of game.particles) drawParticle(pa);
  for (const d of game.dmgNumbers) drawDamageNumber(d);

  ctx.restore();

  // Виньетка
  const vg = ctx.createRadialGradient(
    W / 2,
    H / 2,
    Math.min(W, H) * 0.3,
    W / 2,
    H / 2,
    Math.max(W, H) * 0.72,
  );
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.82)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  if (game.flash > 0) {
    ctx.fillStyle = `rgba(180, 20, 40, ${Utils.clamp(game.flash * 0.45, 0, 0.45)})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (game.state !== 'menu') drawHUD();
  drawBanner();
}

function drawGround(offX, offY) {
  const grid = 64;
  const startX = Math.floor(-offX / grid) * grid + offX;
  const startY = Math.floor(-offY / grid) * grid + offY;
  for (let x = startX; x < W + grid; x += grid) {
    for (let y = startY; y < H + grid; y += grid) {
      const cx = Math.floor((x - offX) / grid);
      const cy = Math.floor((y - offY) / grid);
      const h = (((cx * 73 + cy * 37) * 9301 + 49297) % 233280) / 233280;
      if (h < 0.5) continue;
      ctx.fillStyle = 'rgba(40,30,50,0.35)';
      ctx.fillRect(x + 20, y + 20, 4, 4);
      ctx.fillStyle = 'rgba(20,15,25,0.4)';
      ctx.fillRect(x + 36, y + 40, 3, 3);
    }
  }
}

function drawDecorations(cx, cy) {
  const R = Math.max(W, H) * 0.7;
  for (const d of WORLD.decorations) {
    if (Math.abs(d.x - cx) > R || Math.abs(d.y - cy) > R) continue;
    const spr = SPRITES[d.kind];
    if (!spr) continue;
    const size = d.kind === 'tree' ? 120 : d.kind === 'grave' ? 60 : 50;
    drawSprite(ctx, spr, d.x, d.y, size, size);
  }
}

function drawPlayerWithInvuln(p) {
  const spr = SPRITES[p.charDef.sprite];
  const pulse = 1 + Math.sin(performance.now() / 300) * 0.08;
  ctx.save();
  ctx.shadowColor =
    p.charDef.id === 'mage'
      ? '#c084fc'
      : p.charDef.id === 'knight'
        ? '#fbbf24'
        : '#c04060';
  ctx.shadowBlur = 30;
  ctx.globalAlpha =
    p.invuln > 0 ? (Math.sin(performance.now() / 60) > 0 ? 0.4 : 1) : 1;
  drawSprite(ctx, spr, p.x, p.y, 52 * pulse, 52 * pulse, p.facing.x < 0);
  ctx.restore();

  if (p.dashActive > 0) {
    ctx.save();
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.35 / i;
      drawSprite(
        ctx,
        spr,
        p.x - p.dashDir.x * i * 14,
        p.y - p.dashDir.y * i * 14,
        42,
        42,
        p.facing.x < 0,
      );
    }
    ctx.restore();
  }
}

function drawEnemy(e) {
  const spr = SPRITES[e.spriteKey];
  if (!spr) return;
  const bob = Math.sin(e.wobble) * 2;
  const size = e.r * 3.2 + (e.isBoss ? 20 : 0);

  ctx.save();
  let glowColor = e.isBoss ? '#ff3050' : e.isElite ? '#fbbf24' : '#7a3040';
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = e.isBoss ? 30 : e.isElite ? 24 : 12;
  ctx.globalAlpha = e.hitFlash > 0 ? 0.6 : 1;
  drawSprite(ctx, spr, e.x, e.y + bob, size, size, e.flip);

  if (e.hitFlash > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(e.x - size / 2, e.y - size / 2 + bob, size, size);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();

  if (e.dots && e.dots.length > 0) {
    let dotColor = '#7dd050';
    if (e.dots.some((d) => d.damage < 10)) dotColor = '#a040ff'; // проклятие
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(performance.now() / 120) * 0.2;
    ctx.strokeStyle = dotColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Elite корона
  if (e.isElite) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('★', e.x, e.y - e.r - 8);
  }

  if (e.maxHp > 25 || e.isBoss) {
    const w = e.isBoss ? 100 : e.r * 2.6;
    const h = e.isBoss ? 6 : 3;
    const x = e.x - w / 2;
    const y = e.y - e.r - (e.isBoss ? 30 : 10);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = e.isBoss ? '#ff3050' : '#c03040';
    ctx.fillRect(x, y, w * (e.hp / e.maxHp), h);
  }
}

function drawProjectile(pr) {
  ctx.save();
  ctx.shadowColor = pr.color;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = pr.color;
  ctx.lineWidth = pr.r * 1.6;
  ctx.lineCap = 'round';
  if (pr.trail.length > 1) {
    ctx.beginPath();
    ctx.moveTo(pr.trail[0].x, pr.trail[0].y);
    for (let i = 1; i < pr.trail.length; i++)
      ctx.lineTo(pr.trail[i].x, pr.trail[i].y);
    ctx.lineTo(pr.x, pr.y);
    ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  if (pr.spin) {
    ctx.translate(pr.x, pr.y);
    ctx.rotate(pr.angle);
    ctx.fillRect(-pr.r, -pr.r * 0.35, pr.r * 2, pr.r * 0.7);
  } else {
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, pr.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawParticle(pa) {
  const a = Utils.clamp(pa.life / pa.maxLife, 0, 1);
  ctx.globalAlpha = a;
  ctx.fillStyle = pa.color;
  ctx.beginPath();
  ctx.arc(pa.x, pa.y, pa.size * a, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawDamageNumber(d) {
  const a = Utils.clamp(d.life / d.maxLife, 0, 1);
  ctx.globalAlpha = a;
  ctx.font = 'bold 14px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = 3;
  ctx.strokeText(d.value, d.x, d.y);
  ctx.fillStyle = d.color;
  ctx.fillText(d.value, d.x, d.y);
  ctx.globalAlpha = 1;
}

function drawHUD() {
  const p = game.player;
  const barH = 10;
  const xpRatio = Utils.clamp(p.xp / p.xpToNext, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, W, barH);
  ctx.save();
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(0, 0, W * xpRatio, barH);
  ctx.restore();

  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#c8b8d8';
  ctx.fillText(`LV ${p.level}`, 20, 22);

  const t = Math.floor(game.time);
  const mm = Math.floor(t / 60);
  const ss = (t % 60).toString().padStart(2, '0');
  ctx.font = 'bold 34px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f0e0d8';
  ctx.shadowColor = 'rgba(200,60,80,0.9)';
  ctx.shadowBlur = 20;
  ctx.fillText(`${mm}:${ss}`, W / 2, 18);
  ctx.shadowBlur = 0;

  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffb8c8';
  ctx.fillText(`☠ ${game.kills}`, W - 20, 22);

  const hpW = 320,
    hpH = 20;
  const hpX = 22,
    hpY = H - hpH - 26;
  const hpRatio = Math.max(0, p.hp / p.maxHp);
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(hpX - 3, hpY - 3, hpW + 6, hpH + 6);
  ctx.fillStyle = '#1a0c10';
  ctx.fillRect(hpX, hpY, hpW, hpH);
  const hpColor =
    hpRatio > 0.5 ? '#c03040' : hpRatio > 0.25 ? '#e0a020' : '#e03030';
  ctx.save();
  ctx.shadowColor = hpColor;
  ctx.shadowBlur = 16;
  ctx.fillStyle = hpColor;
  ctx.fillRect(hpX, hpY, hpW * hpRatio, hpH);
  ctx.restore();
  ctx.fillStyle = '#f0d8d8';
  ctx.font = 'bold 13px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `${Math.ceil(p.hp)} / ${p.maxHp}`,
    hpX + hpW / 2,
    hpY + hpH / 2 + 1,
  );

  let wx = W - 20;
  for (let i = p.weapons.length - 1; i >= 0; i--) {
    const w = p.weapons[i];
    ctx.fillStyle = 'rgba(10,6,16,0.85)';
    ctx.strokeStyle = 'rgba(160,50,80,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(wx - 48, H - 72, 48, 48, 6);
    else ctx.rect(wx - 48, H - 72, 48, 48);
    ctx.fill();
    ctx.stroke();
    ctx.font = '24px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(w.icon, wx - 24, H - 52);
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText(`L${w.level}`, wx - 24, H - 32);
    wx -= 56;
  }
  // === Индикаторы абилок Q/E ===
  const abY = H - 90;
  const abStartX = 96;
  const p_ = game.player;
  for (let i = 0; i < p_.abilities.length; i++) {
    const ab = p_.abilities[i];
    const bx = abStartX + i * 68;
    const ready = ab.cd <= 0;
    ctx.fillStyle = 'rgba(10,6,16,0.85)';
    ctx.strokeStyle = ready ? ab.def.color : 'rgba(80,60,80,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, abY, 60, 26, 4);
    else ctx.rect(bx, abY, 60, 26);
    ctx.fill();
    ctx.stroke();

    // Иконка и название
    ctx.font = '14px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(ab.def.icon, bx + 5, abY + 13);

    // Ключ (Q/E) и название или cd
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = ready ? ab.def.color : '#5a5060';
    const key = i === 0 ? 'Q' : 'E';
    ctx.fillText(key, bx + 24, abY + 13);

    // CD прогресс
    if (!ready) {
      ctx.fillStyle = 'rgba(160,80,120,0.35)';
      const ratio = 1 - ab.cd / ab.def.cd;
      ctx.fillRect(bx, abY + 22, 60 * ratio, 4);
    }
  }

  const dashX = 22,
    dashY = H - 90;
  const dashReady = p.dashCd <= 0;
  ctx.fillStyle = 'rgba(10,6,16,0.85)';
  ctx.strokeStyle = dashReady ? 'rgba(125,211,252,0.9)' : 'rgba(80,60,80,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(dashX, dashY, 60, 26, 4);
  else ctx.rect(dashX, dashY, 60, 26);
  ctx.fill();
  ctx.stroke();
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = dashReady ? '#7dd3fc' : '#5a5060';
  ctx.fillText(
    dashReady ? 'DASH' : `${Math.max(0, p.dashCd).toFixed(1)}s`,
    dashX + 30,
    dashY + 14,
  );
  // === Таймер до следующего босса ===
  const tNext = Math.max(0, game.nextBossTime - game.time);
  const mmB = Math.floor(tNext / 60);
  const ssB = Math.floor(tNext % 60)
    .toString()
    .padStart(2, '0');
  ctx.font = 'bold 13px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c88a98';
  ctx.fillText(`☠ БОСС ЧЕРЕЗ ${mmB}:${ssB}`, W / 2, 60);

  // === Полоса HP босса, если он близко ===
  let activeBoss = null,
    bossDist = Infinity;
  for (const e of game.enemies) {
    if (e.isBoss) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < 900 && d < bossDist) {
        bossDist = d;
        activeBoss = e;
      }
    }
  }
  if (activeBoss) {
    const bw = Math.min(560, W * 0.65);
    const bh = 16;
    const bx = W / 2 - bw / 2;
    const by = 82;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
    ctx.fillStyle = '#2a0812';
    ctx.fillRect(bx, by, bw, bh);
    ctx.save();
    ctx.shadowColor = '#ff3050';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#c03040';
    ctx.fillRect(bx, by, bw * (activeBoss.hp / activeBoss.maxHp), bh);
    ctx.restore();
    ctx.fillStyle = '#f0d8d8';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`БОСС ВОЛНЫ ${activeBoss.wave}`, W / 2, by + bh / 2 + 1);
    ctx.textBaseline = 'top';
  }

  // === Мини-карта (правый верхний угол, под кнопкой mute) ===
  const mmW = 180,
    mmH = 120;
  const mmX = W - mmW - 20,
    mmY = 76;
  const scale = 0.045; // 1 px карты ≈ 22 px мира
  const maxR = 1400; // радиус отображения

  ctx.save();
  ctx.fillStyle = 'rgba(10,6,16,0.7)';
  ctx.strokeStyle = 'rgba(160,50,80,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(mmX, mmY, mmW, mmH, 6);
  else ctx.rect(mmX, mmY, mmW, mmH);
  ctx.fill();
  ctx.stroke();

  // Клип — не рисовать за пределами карты
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(mmX + 2, mmY + 2, mmW - 4, mmH - 4, 4);
  else ctx.rect(mmX + 2, mmY + 2, mmW - 4, mmH - 4);
  ctx.clip();

  const mcx = mmX + mmW / 2;
  const mcy = mmY + mmH / 2;

  // Враги
  for (const e of game.enemies) {
    const dx = e.x - p.x,
      dy = e.y - p.y;
    if (Math.abs(dx) > maxR || Math.abs(dy) > maxR) continue;
    const mx = mcx + dx * scale;
    const my = mcy + dy * scale;
    if (e.isBoss) {
      ctx.fillStyle = '#ff3050';
      ctx.beginPath();
      ctx.arc(mx, my, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.isElite) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(220,80,80,0.65)';
      ctx.fillRect(mx - 1, my - 1, 2, 2);
    }
  }

  // Игрок
  ctx.fillStyle = '#7dd3fc';
  ctx.beginPath();
  ctx.arc(mcx, mcy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

function drawBanner() {
  if (!game.banner) return;
  const b = game.banner;
  const t = b.life / b.maxLife;
  const appear = Utils.clamp((1 - t) * 4, 0, 1);
  const fade = Utils.clamp(t * 2.5, 0, 1);
  const alpha = Math.min(appear, fade);
  const slide = (1 - appear) * 40;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.font = 'bold 42px "Courier New", monospace';
  ctx.fillStyle = b.color;
  ctx.shadowColor = b.color;
  ctx.shadowBlur = 30;
  ctx.fillText(b.text, W / 2, H / 2 - 40 + slide);
  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.fillStyle = '#c8b8d8';
  ctx.shadowBlur = 12;
  ctx.fillText(b.sub, W / 2, H / 2 + 5 + slide);
  ctx.restore();
}

// ==================== LOOP ====================
let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (game.state === 'playing') update(dt);
  render();
  requestAnimationFrame(loop);
}

// ==================== CHAR SELECT ====================
function buildCharCards() {
  const row = document.getElementById('charRow');
  row.innerHTML = '';
  const unlocked = JSON.parse(
    localStorage.getItem('wraith_unlocked') || '["hunter","mage"]',
  );
  const UNLOCK = { knight: 240, paladin: 360, warlock: 480 };

  for (const id in CHARACTERS) {
    const c = CHARACTERS[id];
    const isLocked = !unlocked.includes(id);
    const card = document.createElement('div');
    card.className = 'char-card' + (isLocked ? ' locked' : '');
    card.dataset.id = id;

    const sprCanvas = document.createElement('canvas');
    sprCanvas.className = 'avatar';
    sprCanvas.width = 64;
    sprCanvas.height = 64;
    const g = sprCanvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    const spr = SPRITES[c.sprite];
    g.drawImage(spr, 0, 0, 64, 64);
    card.appendChild(sprCanvas);

    const nameEl = document.createElement('div');
    nameEl.className = 'name';
    nameEl.textContent = `${c.icon} ${c.name}`;
    card.appendChild(nameEl);

    const descEl = document.createElement('div');
    descEl.className = 'desc';
    descEl.textContent = c.desc;
    card.appendChild(descEl);

    const statsEl = document.createElement('div');
    statsEl.className = 'stats';
    statsEl.innerHTML = `HP <span>${c.baseHp}</span> · DMG <span>${c.dmgMult.toFixed(1)}×</span>`;
    card.appendChild(statsEl);

    if (isLocked) {
      const reqTime = UNLOCK[id];
      const reqStr = `${Math.floor(reqTime / 60)}:${(reqTime % 60).toString().padStart(2, '0')}`;
      const hint = document.createElement('div');
      hint.className = 'unlock-hint';
      hint.textContent = `🔒 Рекорд ${reqStr}`;
      card.appendChild(hint);
    } else {
      card.onclick = () => {
        document
          .querySelectorAll('.char-card')
          .forEach((el) => el.classList.remove('selected'));
        card.classList.add('selected');
        game.selectedChar = id;
        const btn = document.getElementById('startBtn');
        btn.disabled = false;
        btn.textContent = `Играть за ${c.name}`;
      };
    }
    row.appendChild(card);
  }
}

buildCharCards();

document.getElementById('startBtn').onclick = () => {
  if (!game.selectedChar) return;
  Sound.resume();
  document.getElementById('menu').classList.add('hidden');
  game.reset();
  game.state = 'playing';
  lastTime = performance.now();
};
document.getElementById('restartBtn').onclick = () => {
  document.getElementById('gameover').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
  game.state = 'menu';
};

requestAnimationFrame(loop);
// ==================== MUTE ====================
const muteBtn = document.getElementById('muteBtn');
muteBtn.onclick = () => {
  const on = Sound.toggle();
  muteBtn.textContent = on ? '🔊' : '🔇';
};
// Разблокировать аудио-контекст при первом клике
window.addEventListener('pointerdown', () => Sound.resume(), { once: true });
