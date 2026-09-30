const CHARACTERS = {
  hunter: {
    id: 'hunter',
    name: 'Охотник',
    icon: '🏹',
    desc: 'Быстрый стрелок. Средний урон, дальний бой.',
    sprite: 'hunter',
    baseHp: 100,
    baseSpeed: 250,
    dmgMult: 1.0,
    fireMult: 1.0,
    startWeapon: 'pistol',
    pool: ['pistol', 'shotgun', 'knives', 'orbit', 'aura'],
    stats: { hp: 3, dmg: 3, spd: 5 },
    abilities: ['volley', 'mark'],
  },
  mage: {
    id: 'mage',
    name: 'Маг',
    icon: '🔮',
    desc: 'Хрупкий, но мощный. Магия бьёт по площади.',
    sprite: 'mage',
    baseHp: 80,
    baseSpeed: 220,
    dmgMult: 1.35,
    fireMult: 0.85,
    startWeapon: 'magicMissile',
    pool: ['magicMissile', 'fireball', 'chainLightning', 'orbit', 'aura'],
    stats: { hp: 2, dmg: 5, spd: 3 },
    abilities: ['teleport', 'freeze'],
  },
  knight: {
    id: 'knight',
    name: 'Рыцарь',
    icon: '⚔️',
    desc: 'Танк ближнего боя. Много HP, держит удар.',
    sprite: 'knight',
    baseHp: 160,
    baseSpeed: 215,
    dmgMult: 1.1,
    fireMult: 1.05,
    startWeapon: 'sword',
    pool: ['sword', 'whirlwind', 'axes', 'orbit', 'aura'],
    stats: { hp: 5, dmg: 4, spd: 2 },
    abilities: ['shield', 'charge'],
  },
  paladin: {
    id: 'paladin',
    name: 'Паладин',
    icon: '🔨',
    desc: 'Тяжёлый, лечится, бьёт по кругу. Держит удар.',
    sprite: 'paladin',
    baseHp: 140,
    baseSpeed: 220,
    dmgMult: 1.15,
    fireMult: 0.95,
    startWeapon: 'hammer',
    pool: ['hammer', 'holySpear', 'lightAura', 'sword', 'orbit'],
    stats: { hp: 5, dmg: 4, spd: 3 },
    abilities: ['consecrate', 'bless'],
  },
  warlock: {
    id: 'warlock',
    name: 'Чернокнижник',
    icon: '☠',
    desc: 'Яд, проклятия, вытягивает жизнь. Хрупкий, но злой.',
    sprite: 'warlock',
    baseHp: 90,
    baseSpeed: 230,
    dmgMult: 1.25,
    fireMult: 0.9,
    startWeapon: 'curse',
    pool: ['curse', 'poison', 'drain', 'aura', 'magicMissile'],
    stats: { hp: 2, dmg: 5, spd: 4 },
    abilities: ['bloodSacrifice', 'plague'],
  },
};

class Player {
  constructor(x, y, charDef) {
    this.x = x;
    this.y = y;
    this.r = 16;
    this.charDef = charDef;
    this.maxHp = charDef.baseHp;
    this.hp = this.maxHp;
    this.speed = charDef.baseSpeed;
    this.damageMult = charDef.dmgMult;
    this.fireRateMult = charDef.fireMult;
    this.pickupRange = 130;
    this.regen = 0;
    this.invuln = 0;
    this.xp = 0;
    this.level = 1;
    this.xpToNext = 4;
    this.weapons = [];
    this.facing = { x: 1, y: 0 };
    this.hitFlash = 0;
    this.dashCd = 0;
    this.dashCdMax = 2.0;
    this.dashActive = 0; // всегда сбрасываем в 0, не в минус!
    this.dashDir = { x: 1, y: 0 };
    this.abilities = (charDef.abilities || []).map((id) => ({
      id,
      def: ABILITY_DEFS[id],
      cd: 0,
    }));
    this._qHeld = false;
    this._eHeld = false;
    this._baseDamageMult = this.damageMult;
    this.buffTime = 0;
    this.buffMult = 1;
  }

  update(dt, input, game) {
    if (this.dashCd > 0) this.dashCd -= dt;

    // FIX: явная проверка <= 0 и сброс
    if (this.dashActive > 0) {
      this.dashActive -= dt;
      if (this.dashActive < 0) this.dashActive = 0;
      this.x += this.dashDir.x * 1100 * dt;
      this.y += this.dashDir.y * 1100 * dt;
    } else {
      let dx = 0,
        dy = 0;
      if (input.keys['w'] || input.keys['arrowup']) dy -= 1;
      if (input.keys['s'] || input.keys['arrowdown']) dy += 1;
      if (input.keys['a'] || input.keys['arrowleft']) dx -= 1;
      if (input.keys['d'] || input.keys['arrowright']) dx += 1;
      if (dx !== 0 || dy !== 0) {
        const d = Math.hypot(dx, dy);
        this.x += (dx / d) * this.speed * dt;
        this.y += (dy / d) * this.speed * dt;
        this.facing.x = dx / d;
        this.facing.y = dy / d;
      }
    }

    // Dash триггер — только когда стоит и cd готов
    if (
      input.keys[' '] &&
      this.dashCd <= 0 &&
      this.dashActive <= 0 &&
      !this._spaceHeld
    ) {
      this.dashCd = this.dashCdMax;
      this.dashActive = 0.18;
      this.invuln = Math.max(this.invuln, 0.45);
      this.dashDir.x = this.facing.x;
      this.dashDir.y = this.facing.y;
      this._spaceHeld = true;
      if (window.Sound) Sound.dash();
    }
    if (!input.keys[' ']) this._spaceHeld = false;

    if (this.regen > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
    }
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;

    // Кулдауны абилок
    for (const ab of this.abilities) {
      if (ab.cd > 0) ab.cd -= dt;
    }
    // Q
    if (
      input.keys['q'] &&
      this.abilities[0] &&
      this.abilities[0].cd <= 0 &&
      !this._qHeld
    ) {
      this._qHeld = true;
      this.abilities[0].cd = this.abilities[0].def.cd;
      if (window.Sound) Sound.levelup();
      this.abilities[0].def.fire(game);
    }
    if (!input.keys['q']) this._qHeld = false;
    // E
    if (
      input.keys['e'] &&
      this.abilities[1] &&
      this.abilities[1].cd <= 0 &&
      !this._eHeld
    ) {
      this._eHeld = true;
      this.abilities[1].cd = this.abilities[1].def.cd;
      if (window.Sound) Sound.levelup();
      this.abilities[1].def.fire(game);
    }
    if (!input.keys['e']) this._eHeld = false;
    // Бафы (метка/благословение)
    if (this.buffTime > 0) {
      this.buffTime -= dt;
      this.damageMult = this._baseDamageMult * this.buffMult;
      if (this.buffTime <= 0) {
        this.damageMult = this._baseDamageMult;
        this.buffMult = 1;
      }
    } else {
      this.damageMult = this._baseDamageMult;
    }
  }

  applyBuff(mult, time) {
    // Сохраняем базу если ещё не
    if (this.buffTime <= 0) this._baseDamageMult = this.damageMult;
    this.buffMult = mult;
    this.buffTime = time;
    this.damageMult = this._baseDamageMult * mult;
  }

  hurt(dmg) {
    if (this.invuln > 0) return false;
    this.hp -= dmg;
    this.invuln = 0.5;
    this.hitFlash = 0.3;
    if (this.hp < 0) this.hp = 0;
    return true;
  }
}

const ENEMY_TYPES = {
  bat: { hp: 6, speed: 130, r: 11, dmg: 8, xp: 1, sprite: 'bat' },
  zombie: { hp: 12, speed: 62, r: 14, dmg: 12, xp: 1, sprite: 'zombie' },
  ghost: { hp: 8, speed: 90, r: 12, dmg: 10, xp: 2, sprite: 'ghost' },
  wolf: { hp: 55, speed: 58, r: 22, dmg: 22, xp: 5, sprite: 'wolf' },
};

class Enemy {
  constructor(x, y, typeKey, hpScale = 1, dmgScale = 1) {
    const t = ENEMY_TYPES[typeKey];
    this.x = x;
    this.y = y;
    this.type = typeKey;
    this.hp = t.hp * hpScale;
    this.maxHp = this.hp;
    this.speed = t.speed;
    this.r = t.r;
    this.damage = t.dmg * dmgScale;
    this.xp = t.xp;
    this.spriteKey = t.sprite;
    this.hitFlash = 0;
    this.knockback = { x: 0, y: 0 };
    this.auraCd = 0;
    this.orbitCd = 0;
    this.whirlCd = 0;
    this.flip = false;
    this.wobble = Math.random() * Math.PI * 2;
    this.active = true;
    this.isElite = false;
    this.dots = []; // [{ damage, time, interval, tick }]
    this.slowTime = 0;
  }

  update(dt, player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    let spd = this.speed;
    if (this.slowTime > 0) {
      this.slowTime -= dt;
      spd *= 0.45;
    }
    this.x += (dx / d) * spd * dt;
    this.y += (dy / d) * spd * dt;
    this.x += this.knockback.x * dt;
    this.y += this.knockback.y * dt;
    const kd = Math.pow(0.001, dt);
    this.knockback.x *= kd;
    this.knockback.y *= kd;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.auraCd > 0) this.auraCd -= dt;
    if (this.orbitCd > 0) this.orbitCd -= dt;
    if (this.whirlCd > 0) this.whirlCd -= dt;
    this.wobble += dt * 6;
    this.flip = dx < 0;
    if (this.dots.length > 0) {
      for (let i = this.dots.length - 1; i >= 0; i--) {
        const d = this.dots[i];
        d.time -= dt;
        d.tick -= dt;
        if (d.tick <= 0) {
          d.tick = d.interval;
          this.hurt(d.damage, 0, 0);
        }
        if (d.time <= 0) this.dots.splice(i, 1);
      }
    }
    this.active = d < 1500;
  }

  hurt(dmg, kx = 0, ky = 0) {
    this.hp -= dmg;
    this.hitFlash = 0.1;
    const kd = Math.hypot(kx, ky);
    if (kd > 0) {
      this.knockback.x += (kx / kd) * 90;
      this.knockback.y += (ky / kd) * 90;
    }
  }
}

class Boss {
  constructor(x, y, wave = 1) {
    this.x = x;
    this.y = y;
    this.wave = wave;
    this.hp = 2000 * (1 + wave * 1.2); // было 400*(1+wave*0.75)
    this.maxHp = this.hp;
    this.speed = 38 + wave * 2;
    this.baseSpeed = this.speed;
    this.r = 38 + wave * 3;
    this.damage = 25 + wave * 6;
    this.baseDamage = this.damage;
    this.xp = 50;
    this.spriteKey = wave % 2 === 0 ? 'boss2' : 'boss';
    this.hitFlash = 0;
    this.knockback = { x: 0, y: 0 };
    this.auraCd = 0;
    this.orbitCd = 0;
    this.whirlCd = 0;
    this.slowTime = 0;
    this.flip = false;
    this.wobble = 0;
    this.isBoss = true;
    this.active = true;
    this.phase2 = false;
  }
  update(dt, player) {
    // Фаза 2: при 50% HP ускоряется и бьёт сильнее
    if (!this.phase2 && this.hp < this.maxHp * 0.5) {
      this.phase2 = true;
      this.speed = this.baseSpeed * 1.5;
      this.damage = this.baseDamage * 1.35;
      this.r *= 1.1;
    }
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    let spd = this.speed;
    if (this.slowTime > 0) {
      this.slowTime -= dt;
      spd *= 0.55;
    }
    this.x += (dx / d) * spd * dt;
    this.y += (dy / d) * spd * dt;
    this.x += this.knockback.x * dt;
    this.y += this.knockback.y * dt;
    const kd = Math.pow(0.001, dt);
    this.knockback.x *= kd;
    this.knockback.y *= kd;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.auraCd > 0) this.auraCd -= dt;
    if (this.orbitCd > 0) this.orbitCd -= dt;
    if (this.whirlCd > 0) this.whirlCd -= dt;
    this.wobble += dt * 4;
    this.flip = dx < 0;
    this.active = true;
  }
  hurt(dmg) {
    this.hp -= dmg;
    this.hitFlash = 0.1;
  }
}

class Projectile {
  constructor(x, y, vx, vy, damage, r, pierce, color, life = 2.0, opts = {}) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.r = r;
    this.pierce = pierce;
    this.color = color;
    this.life = life;
    this.hitSet = new Set();
    this.trail = [];
    this.homing = opts.homing || false;
    this.explodeRadius = opts.explodeRadius || 0;
    this.explodeDamage = opts.explodeDamage || 0;
    this.spin = opts.spin || false;
    this.angle = 0;
    this.healOnHit = opts.healOnHit || 0; // лечение игрока при попадании
    this.dotDamage = opts.dotDamage || 0;
    this.dotTime = opts.dotTime || 0;
    this.areaDot = opts.areaDot || 0; // если >0 — вешаем DoT по площади
    this.speed = Math.hypot(vx, vy);
  }
  update(dt, game) {
    if (this.spin) this.angle += dt * 14;
    if (this.homing && game) {
      const target = game.nearestEnemy(this.x, this.y, 500);
      if (target) {
        const targetAng = Math.atan2(target.y - this.y, target.x - this.x);
        const curAng = Math.atan2(this.vy, this.vx);
        let diff = targetAng - curAng;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const newAng = curAng + Utils.clamp(diff, -5 * dt, 5 * dt);
        this.vx = Math.cos(newAng) * this.speed;
        this.vy = Math.sin(newAng) * this.speed;
      }
    }
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 4) this.trail.shift();
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.areaDot > 0 && game) {
      // ничего — обрабатываем при попадании в game.js
    }
    this.life -= dt;
  }
}

class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = size;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const d = Math.pow(0.1, dt);
    this.vx *= d;
    this.vy *= d;
    this.life -= dt;
  }
}

class XPOrb {
  constructor(x, y, value) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.r = 7;
    this.vx = Utils.rand(-50, 50);
    this.vy = Utils.rand(-50, 50);
    this.magnetized = false;
    this.pulse = Math.random() * Math.PI * 2;
    this.life = 15; // всего живёт 15 сек
    this.maxLife = 15;
    this.fading = false; // начал затухать
  }
  update(dt, player) {
    this.pulse += dt * 6;
    this.life -= dt;
    if (this.life <= 3) this.fading = true;

    // Магнитим, только если игрок близко ИЛИ орб ещё не затухает
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;

    if (d < player.pickupRange || this.magnetized) {
      this.magnetized = true;
      const speed = Utils.clamp((900 / d) * 100, 400, 1200);
      this.x += (dx / d) * speed * dt;
      this.y += (dy / d) * speed * dt;
    } else {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const dd = Math.pow(0.05, dt);
      this.vx *= dd;
      this.vy *= dd;
    }
    return d < player.r + this.r + 4;
  }
  // 0..1 — сколько видимости (для затухания)
  alpha() {
    if (this.life >= 3) return 1;
    return Utils.clamp(this.life / 3, 0, 1);
  }
  dead() {
    return this.life <= 0;
  }
}

class HPPickup {
  constructor(x, y, heal) {
    this.x = x;
    this.y = y;
    this.heal = heal;
    this.r = 9;
    this.life = 15;
    this.pulse = Math.random() * Math.PI * 2;
  }
  update(dt, player) {
    this.pulse += dt * 5;
    this.life -= dt;
    const d = Math.hypot(player.x - this.x, player.y - this.y);
    return { picked: d < player.r + this.r + 4, dead: this.life <= 0 };
  }
}

class DamageNumber {
  constructor(x, y, value, color = '#fff') {
    this.x = x;
    this.y = y;
    this.value = value;
    this.color = color;
    this.life = 0.7;
    this.maxLife = 0.7;
    this.vy = -60;
    this.vx = Utils.rand(-30, 30);
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 100 * dt;
    this.life -= dt;
  }
}

class Chest {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 22;
    this.life = 45;
    this.pulse = 0;
  }
  update(dt, player) {
    this.pulse += dt * 4;
    this.life -= dt;
  }
}
