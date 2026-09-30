class Weapon {
  constructor(id, name, icon, maxLevel = 5) {
    this.id = id;
    this.name = name;
    this.icon = icon;
    this.level = 1;
    this.maxLevel = maxLevel;
    this.timer = 0;
  }
  upgrade() {
    this.level++;
  }
  getUpgradeDesc() {
    return '';
  }
  update(dt, game) {}
}

// ===== ПИСТОЛЕТ =====
class Pistol extends Weapon {
  constructor() {
    super('pistol', 'Пистолет', '🔫');
  }
  getUpgradeDesc() {
    return this.level === 3 ? '+1 снаряд' : '+урон и скорость';
  }
  update(dt, game) {
    this.timer -= dt;
    if (this.timer > 0) return;
    const t = game.nearestEnemy(game.player.x, game.player.y);
    if (!t) {
      this.timer = 0.08;
      return;
    }
    const lv = this.level;
    const dmg = (16 + (lv - 1) * 8) * game.player.damageMult;
    const cd = Math.max(
      0.08,
      (0.42 * Math.pow(0.85, lv - 1)) / game.player.fireRateMult,
    );
    const count = lv >= 5 ? 3 : lv >= 3 ? 2 : 1;
    const ang = Math.atan2(t.y - game.player.y, t.x - game.player.x);
    for (let i = 0; i < count; i++) {
      const a = ang + (count === 1 ? 0 : (i - (count - 1) / 2) * 0.14);
      game.spawnProjectile({
        x: game.player.x,
        y: game.player.y,
        vx: Math.cos(a) * 700,
        vy: Math.sin(a) * 700,
        damage: dmg,
        r: 6,
        pierce: 1,
        color: '#7dd3fc',
        life: 1.5,
      });
    }
    this.timer = cd;
  }
}

// ===== ДРОБОВИК =====
class Shotgun extends Weapon {
  constructor() {
    super('shotgun', 'Дробовик', '💥');
  }
  getUpgradeDesc() {
    return '+1 дробинка, +урон';
  }
  update(dt, game) {
    this.timer -= dt;
    if (this.timer > 0) return;
    const t = game.nearestEnemy(game.player.x, game.player.y);
    if (!t) {
      this.timer = 0.1;
      return;
    }
    const lv = this.level;
    const pellets = 4 + (lv - 1);
    const dmg = (10 + (lv - 1) * 5) * game.player.damageMult;
    const cd = Math.max(
      0.4,
      (1.4 - (lv - 1) * 0.15) / game.player.fireRateMult,
    );
    const ang = Math.atan2(t.y - game.player.y, t.x - game.player.x);
    for (let i = 0; i < pellets; i++) {
      const a =
        ang + (i - (pellets - 1) / 2) * (0.6 / Math.max(1, pellets - 1));
      game.spawnProjectile({
        x: game.player.x,
        y: game.player.y,
        vx: Math.cos(a) * 620,
        vy: Math.sin(a) * 620,
        damage: dmg,
        r: 5,
        pierce: 1,
        color: '#fbbf24',
        life: 0.5,
      });
    }
    this.timer = cd;
  }
}

// ===== НОЖИ =====
class Knives extends Weapon {
  constructor() {
    super('knives', 'Ножи', '🗡');
  }
  getUpgradeDesc() {
    return '+1 нож, +пробитие';
  }
  update(dt, game) {
    this.timer -= dt;
    if (this.timer > 0) return;
    const t = game.nearestEnemy(game.player.x, game.player.y);
    if (!t) {
      this.timer = 0.1;
      return;
    }
    const lv = this.level;
    const count = 1 + lv;
    const dmg = (18 + (lv - 1) * 8) * game.player.damageMult;
    const pierce = 2 + lv;
    const cd = Math.max(
      0.3,
      (1.1 - (lv - 1) * 0.12) / game.player.fireRateMult,
    );
    const baseAng = Math.atan2(t.y - game.player.y, t.x - game.player.x);
    for (let i = 0; i < count; i++) {
      const a = baseAng + (i - (count - 1) / 2) * 0.28;
      game.spawnProjectile({
        x: game.player.x,
        y: game.player.y,
        vx: Math.cos(a) * 820,
        vy: Math.sin(a) * 820,
        damage: dmg,
        r: 5,
        pierce,
        color: '#c0c8d0',
        life: 0.9,
      });
    }
    this.timer = cd;
  }
}

// ===== ОРБИТА =====
class Orbit extends Weapon {
  constructor() {
    super('orbit', 'Орбита', '🛡');
    this.angle = 0;
    this.positions = [];
  }
  getUpgradeDesc() {
    return '+1 щит, +урон и радиус';
  }
  update(dt, game) {
    const lv = this.level;
    const count = Math.min(6, 1 + (lv - 1));
    const radius = 85 + (lv - 1) * 12;
    const dmg = (22 + (lv - 1) * 12) * game.player.damageMult;
    const speed = 3.2 + (lv - 1) * 0.4;
    this.angle += dt * speed;
    const px = game.player.x,
      py = game.player.y;
    this.positions.length = 0;
    for (let i = 0; i < count; i++) {
      const a = this.angle + (i / count) * Math.PI * 2;
      const ox = px + Math.cos(a) * radius,
        oy = py + Math.sin(a) * radius;
      this.positions.push({ x: ox, y: oy });
      for (const e of game.enemies) {
        if (!e.active || e.orbitCd > 0) continue;
        const dx = e.x - ox,
          dy = e.y - oy;
        if (Math.hypot(dx, dy) < e.r + 14) {
          e.hurt(dmg, dx, dy);
          e.orbitCd = 0.4;
          game.spawnDamageNumber(e.x, e.y - e.r, Math.round(dmg), '#a5f3fc');
        }
      }
    }
  }
}

// ===== АУРА =====
class Aura extends Weapon {
  constructor() {
    super('aura', 'Аура', '🌀');
    this.radius = 0;
  }
  getUpgradeDesc() {
    return '+урон и радиус';
  }
  update(dt, game) {
    const lv = this.level;
    this.radius = 110 + (lv - 1) * 20;
    const dmg = (10 + (lv - 1) * 6) * game.player.damageMult;
    for (const e of game.enemies) {
      if (!e.active || e.auraCd > 0) continue;
      const dx = e.x - game.player.x,
        dy = e.y - game.player.y;
      if (Math.hypot(dx, dy) < this.radius + e.r) {
        e.hurt(dmg, 0, 0);
        e.auraCd = 0.45;
        game.spawnDamageNumber(e.x, e.y - e.r, Math.round(dmg), '#f472b6');
      }
    }
  }
}

// ===== МАГИЯ =====
class MagicMissile extends Weapon {
  constructor() {
    super('magicMissile', 'Магия', '✨');
  }
  getUpgradeDesc() {
    return this.level === 2 ? '+1 снаряд' : '+урон и снаряды';
  }
  update(dt, game) {
    this.timer -= dt;
    if (this.timer > 0) return;
    const t = game.nearestEnemy(game.player.x, game.player.y);
    if (!t) {
      this.timer = 0.1;
      return;
    }
    const lv = this.level;
    const count = 1 + Math.floor(lv / 2);
    const dmg = (14 + (lv - 1) * 7) * game.player.damageMult;
    const cd = Math.max(
      0.3,
      (0.7 - (lv - 1) * 0.06) / game.player.fireRateMult,
    );
    const baseAng = Math.atan2(t.y - game.player.y, t.x - game.player.x);
    for (let i = 0; i < count; i++) {
      const a = baseAng + (count === 1 ? 0 : (i - (count - 1) / 2) * 0.55);
      game.spawnProjectile({
        x: game.player.x,
        y: game.player.y,
        vx: Math.cos(a) * 380,
        vy: Math.sin(a) * 380,
        damage: dmg,
        r: 8,
        pierce: 1,
        color: '#c084fc',
        life: 3.0,
        homing: true,
      });
    }
    this.timer = cd;
  }
}

// ===== ОГНЕННЫЙ ШАР =====
class Fireball extends Weapon {
  constructor() {
    super('fireball', 'Огненный шар', '🔥');
  }
  getUpgradeDesc() {
    return '+урон и радиус взрыва';
  }
  update(dt, game) {
    this.timer -= dt;
    if (this.timer > 0) return;
    const t = game.nearestEnemy(game.player.x, game.player.y);
    if (!t) {
      this.timer = 0.15;
      return;
    }
    const lv = this.level;
    const dmg = (28 + (lv - 1) * 14) * game.player.damageMult;
    const radius = 80 + (lv - 1) * 14;
    const cd = Math.max(0.7, (1.8 - (lv - 1) * 0.2) / game.player.fireRateMult);
    const a = Math.atan2(t.y - game.player.y, t.x - game.player.x);
    game.spawnProjectile({
      x: game.player.x,
      y: game.player.y,
      vx: Math.cos(a) * 440,
      vy: Math.sin(a) * 440,
      damage: dmg,
      r: 11,
      pierce: 1,
      color: '#f97316',
      life: 2.0,
      explodeRadius: radius,
      explodeDamage: dmg * 1.6,
    });
    this.timer = cd;
  }
}

// ===== ЦЕПНАЯ МОЛНИЯ =====
class ChainLightning extends Weapon {
  constructor() {
    super('chainLightning', 'Молния', '⚡');
  }
  getUpgradeDesc() {
    return '+1 цель, +урон';
  }
  update(dt, game) {
    this.timer -= dt;
    if (this.timer > 0) return;
    const t = game.nearestEnemy(game.player.x, game.player.y, 600);
    if (!t) {
      this.timer = 0.15;
      return;
    }
    const lv = this.level;
    const chains = 2 + lv;
    const dmg = (22 + (lv - 1) * 10) * game.player.damageMult;
    const cd = Math.max(
      0.6,
      (1.6 - (lv - 1) * 0.15) / game.player.fireRateMult,
    );
    const hit = new Set();
    let cur = t,
      curDmg = dmg;
    let prev = { x: game.player.x, y: game.player.y };
    const lines = [];
    for (let i = 0; i < chains && cur; i++) {
      hit.add(cur);
      lines.push({ x1: prev.x, y1: prev.y, x2: cur.x, y2: cur.y });
      cur.hurt(curDmg, 0, 0);
      game.spawnDamageNumber(
        cur.x,
        cur.y - cur.r,
        Math.round(curDmg),
        '#fde047',
      );
      prev = cur;
      curDmg *= 0.8;
      let next = null,
        bestD = 250 * 250;
      for (const e of game.enemies) {
        if (hit.has(e) || !e.active) continue;
        const d = (e.x - prev.x) ** 2 + (e.y - prev.y) ** 2;
        if (d < bestD) {
          bestD = d;
          next = e;
        }
      }
      cur = next;
    }
    game.chainEffects.push({ lines, life: 0.22, maxLife: 0.22 });
    this.timer = cd;
  }
}

// ===== МЕЧ (ФИКС: бьёт в сторону ближайшего врага) =====
class Sword extends Weapon {
  constructor() {
    super('sword', 'Меч', '⚔️');
  }
  getUpgradeDesc() {
    return '+урон и радиус';
  }
  update(dt, game) {
    this.timer -= dt;
    if (this.timer > 0) return;
    const lv = this.level;
    const radius = 95 + (lv - 1) * 12;
    const arcAngle = Math.PI * 0.9;
    const dmg = (26 + (lv - 1) * 14) * game.player.damageMult;
    const cd = Math.max(
      0.3,
      (0.85 - (lv - 1) * 0.1) / game.player.fireRateMult,
    );

    // ФИКС: цель — ближайший враг, а если его нет — куда смотрит игрок
    const target = game.nearestEnemy(game.player.x, game.player.y, radius + 60);
    const facing = target
      ? Math.atan2(target.y - game.player.y, target.x - game.player.x)
      : Math.atan2(game.player.facing.y, game.player.facing.x);

    for (const e of game.enemies) {
      if (!e.active) continue;
      const dx = e.x - game.player.x,
        dy = e.y - game.player.y;
      const d = Math.hypot(dx, dy);
      if (d > radius + e.r) continue;
      const ang = Math.atan2(dy, dx);
      let diff = ang - facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < arcAngle / 2) {
        e.hurt(dmg, dx, dy);
        game.spawnDamageNumber(e.x, e.y - e.r, Math.round(dmg), '#fbbf24');
      }
    }
    game.slashEffects.push({
      x: game.player.x,
      y: game.player.y,
      angle: facing,
      radius,
      arc: arcAngle,
      life: 0.2,
      maxLife: 0.2,
      color: '#fbbf24',
    });
    this.timer = cd;
  }
}

// ===== ВИХРЬ =====
class Whirlwind extends Weapon {
  constructor() {
    super('whirlwind', 'Вихрь', '🌪');
    this.radius = 0;
  }
  getUpgradeDesc() {
    return '+урон и радиус';
  }
  update(dt, game) {
    const lv = this.level;
    this.radius = 100 + (lv - 1) * 16;
    const dmg = (12 + (lv - 1) * 6) * game.player.damageMult;
    for (const e of game.enemies) {
      if (!e.active || e.whirlCd > 0) continue;
      const dx = e.x - game.player.x,
        dy = e.y - game.player.y;
      if (Math.hypot(dx, dy) < this.radius + e.r) {
        e.hurt(dmg, 0, 0);
        e.whirlCd = 0.3;
        game.spawnDamageNumber(e.x, e.y - e.r, Math.round(dmg), '#a5f3fc');
      }
    }
  }
}

// ===== ТОПОРЫ =====
class Axes extends Weapon {
  constructor() {
    super('axes', 'Топоры', '🪓');
  }
  getUpgradeDesc() {
    return '+1 топор, +урон';
  }
  update(dt, game) {
    this.timer -= dt;
    if (this.timer > 0) return;
    const t = game.nearestEnemy(game.player.x, game.player.y);
    if (!t) {
      this.timer = 0.1;
      return;
    }
    const lv = this.level;
    const count = 1 + Math.floor(lv / 2);
    const dmg = (24 + (lv - 1) * 12) * game.player.damageMult;
    const cd = Math.max(
      0.4,
      (1.2 - (lv - 1) * 0.12) / game.player.fireRateMult,
    );
    const baseAng = Math.atan2(t.y - game.player.y, t.x - game.player.x);
    for (let i = 0; i < count; i++) {
      const a = baseAng + (count === 1 ? 0 : (i - (count - 1) / 2) * 0.5);
      game.spawnProjectile({
        x: game.player.x,
        y: game.player.y,
        vx: Math.cos(a) * 520,
        vy: Math.sin(a) * 520,
        damage: dmg,
        r: 8,
        pierce: 4,
        color: '#e0a040',
        life: 1.3,
        spin: true,
      });
    }
    this.timer = cd;
  }
}

// ===== МОЛОТ (паладин): тяжёлый удар по кругу вокруг игрока, замедляет врагов =====
class Hammer extends Weapon {
  constructor() {
    super('hammer', 'Молот', '🔨');
  }
  getUpgradeDesc() {
    return '+урон и радиус, дольше замаха';
  }
  update(dt, game) {
    this.timer -= dt;
    if (this.timer > 0) return;
    const lv = this.level;
    const radius = 105 + (lv - 1) * 14;
    const dmg = (38 + (lv - 1) * 18) * game.player.damageMult;
    const cd = Math.max(
      0.9,
      (1.9 - (lv - 1) * 0.18) / game.player.fireRateMult,
    );
    const slowTime = 0.6 + lv * 0.15;

    for (const e of game.enemies) {
      if (!e.active) continue;
      const dx = e.x - game.player.x,
        dy = e.y - game.player.y;
      const d = Math.hypot(dx, dy);
      if (d < radius + e.r) {
        e.hurt(dmg, dx * 3, dy * 3); // сильный knockback
        e.slowTime = Math.max(e.slowTime || 0, slowTime);
        game.spawnDamageNumber(e.x, e.y - e.r, Math.round(dmg), '#fbbf24');
        game.spawnParticles(e.x, e.y, '#fbbf24', 5);
      }
    }
    game.camera.shake = Math.max(game.camera.shake, 6);
    game.slashEffects.push({
      x: game.player.x,
      y: game.player.y,
      angle: 0,
      radius,
      arc: Math.PI * 2,
      life: 0.35,
      maxLife: 0.35,
      color: '#f0d060',
      full: true,
    });
    this.timer = cd;
  }
}

// ===== СВЯТОЕ КОПЬЁ (паладин): длинный пробивающий снаряд =====
class HolySpear extends Weapon {
  constructor() {
    super('holySpear', 'Копьё', '🌟');
  }
  getUpgradeDesc() {
    return '+урон, +пробитие';
  }
  update(dt, game) {
    this.timer -= dt;
    if (this.timer > 0) return;
    const t = game.nearestEnemy(game.player.x, game.player.y);
    if (!t) {
      this.timer = 0.1;
      return;
    }
    const lv = this.level;
    const dmg = (30 + (lv - 1) * 14) * game.player.damageMult;
    const pierce = 5 + lv;
    const cd = Math.max(
      0.5,
      (1.4 - (lv - 1) * 0.13) / game.player.fireRateMult,
    );
    const a = Math.atan2(t.y - game.player.y, t.x - game.player.x);
    game.spawnProjectile({
      x: game.player.x,
      y: game.player.y,
      vx: Math.cos(a) * 780,
      vy: Math.sin(a) * 780,
      damage: dmg,
      r: 8,
      pierce,
      color: '#fde047',
      life: 1.3,
    });
    this.timer = cd;
  }
}

// ===== АУРА СВЕТА (паладин): урон + лечение игрока =====
class LightAura extends Weapon {
  constructor() {
    super('lightAura', 'Свет', '✨');
    this.radius = 0;
  }
  getUpgradeDesc() {
    return '+урон, +радиус, +лечение';
  }
  update(dt, game) {
    const lv = this.level;
    this.radius = 105 + (lv - 1) * 18;
    const dmg = (8 + (lv - 1) * 5) * game.player.damageMult;
    const heal = 0.4 + (lv - 1) * 0.25;
    // Лечение
    game.player.hp = Math.min(game.player.maxHp, game.player.hp + heal * dt);
    // Урон
    for (const e of game.enemies) {
      if (!e.active || e.auraCd > 0) continue;
      const dx = e.x - game.player.x,
        dy = e.y - game.player.y;
      if (Math.hypot(dx, dy) < this.radius + e.r) {
        e.hurt(dmg, 0, 0);
        e.auraCd = 0.5;
        game.spawnDamageNumber(e.x, e.y - e.r, Math.round(dmg), '#fde047');
      }
    }
  }
}

// ===== ПРОКЛЯТИЕ (чернокнижник): DoT на N ближайших врагов =====
class Curse extends Weapon {
  constructor() {
    super('curse', 'Проклятие', '☠');
  }
  getUpgradeDesc() {
    return '+1 цель, +урон яда';
  }
  update(dt, game) {
    this.timer -= dt;
    if (this.timer > 0) return;
    const lv = this.level;
    const count = 2 + lv;
    const dmgPerTick = (5 + (lv - 1) * 3) * game.player.damageMult;
    const cd = Math.max(
      0.4,
      (1.2 - (lv - 1) * 0.12) / game.player.fireRateMult,
    );

    // Собираем ближайших врагов
    const sorted = game.enemies
      .filter((e) => e.active)
      .map((e) => ({
        e,
        d: (e.x - game.player.x) ** 2 + (e.y - game.player.y) ** 2,
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, count);

    for (const { e } of sorted) {
      e.dots.push({
        damage: dmgPerTick,
        time: 2.5,
        interval: 0.4,
        tick: 0.4,
      });
      game.spawnDamageNumber(e.x, e.y - e.r, '☠', '#a040ff');
    }
    this.timer = cd;
  }
}

// ===== ЯД (чернокнижник): снаряд, при попадании — облако отравы =====
class Poison extends Weapon {
  constructor() {
    super('poison', 'Яд', '🧪');
  }
  getUpgradeDesc() {
    return '+урон и радиус облака';
  }
  update(dt, game) {
    this.timer -= dt;
    if (this.timer > 0) return;
    const t = game.nearestEnemy(game.player.x, game.player.y);
    if (!t) {
      this.timer = 0.15;
      return;
    }
    const lv = this.level;
    const dmg = (8 + (lv - 1) * 4) * game.player.damageMult; // per tick
    const radius = 60 + (lv - 1) * 12;
    const cd = Math.max(
      0.6,
      (1.7 - (lv - 1) * 0.18) / game.player.fireRateMult,
    );
    const a = Math.atan2(t.y - game.player.y, t.x - game.player.x);
    game.spawnProjectile({
      x: game.player.x,
      y: game.player.y,
      vx: Math.cos(a) * 480,
      vy: Math.sin(a) * 480,
      damage: dmg,
      r: 7,
      pierce: 1,
      color: '#7dd050',
      life: 1.5,
      areaDot: radius,
      dotDamage: dmg,
      dotTime: 3,
    });
    this.timer = cd;
  }
}

// ===== ВЫТЯГИВАНИЕ (чернокнижник): снаряд, лечит игрока =====
class Drain extends Weapon {
  constructor() {
    super('drain', 'Вытяг.', '🩸');
  }
  getUpgradeDesc() {
    return '+урон, +лечение';
  }
  update(dt, game) {
    this.timer -= dt;
    if (this.timer > 0) return;
    const t = game.nearestEnemy(game.player.x, game.player.y);
    if (!t) {
      this.timer = 0.1;
      return;
    }
    const lv = this.level;
    const dmg = (22 + (lv - 1) * 11) * game.player.damageMult;
    const cd = Math.max(
      0.5,
      (1.3 - (lv - 1) * 0.12) / game.player.fireRateMult,
    );
    const a = Math.atan2(t.y - game.player.y, t.x - game.player.x);
    game.spawnProjectile({
      x: game.player.x,
      y: game.player.y,
      vx: Math.cos(a) * 660,
      vy: Math.sin(a) * 660,
      damage: dmg,
      r: 8,
      pierce: 1,
      color: '#e04070',
      life: 1.5,
      healOnHit: dmg * 0.35,
    });
    this.timer = cd;
  }
}

const WEAPON_CLASSES = {
  pistol: Pistol,
  shotgun: Shotgun,
  knives: Knives,
  orbit: Orbit,
  aura: Aura,
  magicMissile: MagicMissile,
  fireball: Fireball,
  chainLightning: ChainLightning,
  sword: Sword,
  whirlwind: Whirlwind,
  axes: Axes,
  hammer: Hammer,
  holySpear: HolySpear,
  lightAura: LightAura,
  curse: Curse,
  poison: Poison,
  drain: Drain,
};

const WEAPON_META = {
  pistol: { name: 'Пистолет', desc: 'Быстрые снаряды', icon: '🔫' },
  shotgun: { name: 'Дробовик', desc: 'Веер дробинок', icon: '💥' },
  knives: { name: 'Ножи', desc: 'Пробивают насквозь', icon: '🗡' },
  orbit: { name: 'Орбита', desc: 'Вращающиеся щиты', icon: '🛡' },
  aura: { name: 'Аура', desc: 'Урон вокруг', icon: '🌀' },
  magicMissile: { name: 'Магия', desc: 'Самонаводящиеся снаряды', icon: '✨' },
  fireball: { name: 'Огн. шар', desc: 'Взрыв по площади', icon: '🔥' },
  chainLightning: { name: 'Молния', desc: 'Цепная атака', icon: '⚡' },
  sword: { name: 'Меч', desc: 'Дуговой удар', icon: '⚔️' },
  whirlwind: { name: 'Вихрь', desc: 'Урон вокруг', icon: '🌪' },
  axes: { name: 'Топоры', desc: 'Летящие топоры', icon: '🪓' },
  hammer: { name: 'Молот', desc: 'Тяжёлый удар по кругу', icon: '🔨' },
  holySpear: { name: 'Копьё', desc: 'Долгий пробивной снаряд', icon: '🌟' },
  lightAura: { name: 'Свет', desc: 'Урон вокруг + лечение', icon: '✨' },
  curse: { name: 'Проклятие', desc: 'Отравляет нескольких', icon: '☠' },
  poison: { name: 'Яд', desc: 'Облако отравы', icon: '🧪' },
  drain: { name: 'Вытяг.', desc: 'Урон + лечение', icon: '🩸' },
};

function makeWeapon(id) {
  return new WEAPON_CLASSES[id]();
}
