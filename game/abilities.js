// Абилки на Q и E для каждого персонажа.
// fire(game) вызывается при активации.
const ABILITY_DEFS = {
  // ============ ОХОТНИК ============
  volley: {
    name: 'Залп',
    icon: '🏹',
    cd: 8,
    color: '#7dd3fc',
    desc: 'Веер из 16 стрел во все стороны',
    fire: (game) => {
      const p = game.player;
      const count = 16;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        game.spawnProjectile({
          x: p.x,
          y: p.y,
          vx: Math.cos(a) * 720,
          vy: Math.sin(a) * 720,
          damage: 22 * p.damageMult,
          r: 6,
          pierce: 2,
          color: '#7dd3fc',
          life: 1.0,
        });
      }
      game.showBanner('ЗАЛП!', 'Стрелы во все стороны', '#7dd3fc');
    },
  },
  mark: {
    name: 'Метка',
    icon: '🎯',
    cd: 20,
    color: '#fde047',
    desc: '+50% урона на 6 секунд',
    fire: (game) => {
      game.player.applyBuff(1.5, 6);
      game.showBanner('МЕТКА ОХОТНИКА', '+50% урона на 6с', '#fde047');
    },
  },

  // ============ МАГ ============
  teleport: {
    name: 'Телепорт',
    icon: '✨',
    cd: 6,
    color: '#c084fc',
    desc: 'Рывок вперёд на 260px, неуязвимость',
    fire: (game) => {
      const p = game.player;
      const dist = 260;
      const fromX = p.x,
        fromY = p.y;
      p.x += p.facing.x * dist;
      p.y += p.facing.y * dist;
      p.invuln = Math.max(p.invuln, 0.6);
      // Частицы по пути
      for (let i = 0; i < 20; i++) {
        const t = i / 20;
        const px = Utils.lerp(fromX, p.x, t);
        const py = Utils.lerp(fromY, p.y, t);
        const a = Math.random() * Math.PI * 2;
        const sp = Utils.rand(60, 240);
        game.particles.push(
          new Particle(
            px,
            py,
            Math.cos(a) * sp,
            Math.sin(a) * sp,
            '#c084fc',
            Utils.rand(0.3, 0.6),
            Utils.rand(3, 5),
          ),
        );
      }
    },
  },
  freeze: {
    name: 'Заморозка',
    icon: '❄',
    cd: 18,
    color: '#7dd3fc',
    desc: 'Все враги в радиусе замедляются на 4с',
    fire: (game) => {
      let count = 0;
      for (const e of game.enemies) {
        if (!e.active) continue;
        if (Math.hypot(e.x - game.player.x, e.y - game.player.y) < 550) {
          e.slowTime = Math.max(e.slowTime || 0, 4);
          count++;
        }
      }
      game.showBanner('ЗАМОРОЗКА', `${count} врагов замедлены`, '#7dd3fc');
      game.slashEffects.push({
        x: game.player.x,
        y: game.player.y,
        angle: 0,
        radius: 550,
        arc: Math.PI * 2,
        life: 0.5,
        maxLife: 0.5,
        color: '#7dd3fc',
        full: true,
      });
    },
  },

  // ============ РЫЦАРЬ ============
  shield: {
    name: 'Щит',
    icon: '🛡',
    cd: 12,
    color: '#fbbf24',
    desc: 'Неуязвимость на 3 секунды',
    fire: (game) => {
      game.player.invuln = Math.max(game.player.invuln, 3);
      game.showBanner('ЩИТ', 'Ты неуязвим 3с', '#fbbf24');
    },
  },
  charge: {
    name: 'Таран',
    icon: '💥',
    cd: 10,
    color: '#f97316',
    desc: 'Рывок с уроном по площади',
    fire: (game) => {
      const p = game.player;
      // Рывок
      p.dashActive = 0.22;
      p.dashDir.x = p.facing.x;
      p.dashDir.y = p.facing.y;
      p.invuln = Math.max(p.invuln, 0.4);
      // AoE вокруг
      const dmg = 90 * p.damageMult;
      for (const e of game.enemies) {
        if (!e.active) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < 200) {
          e.hurt(dmg, 0, 0);
          game.spawnDamageNumber(e.x, e.y - e.r, Math.round(dmg), '#f97316');
        }
      }
      game.slashEffects.push({
        x: p.x,
        y: p.y,
        angle: 0,
        radius: 200,
        arc: Math.PI * 2,
        life: 0.35,
        maxLife: 0.35,
        color: '#f97316',
        full: true,
      });
      game.camera.shake = Math.max(game.camera.shake, 12);
    },
  },

  // ============ ПАЛАДИН ============
  consecrate: {
    name: 'Освящение',
    icon: '✝',
    cd: 14,
    color: '#fde047',
    desc: 'Урон по площади + лечение 25%',
    fire: (game) => {
      const p = game.player;
      const dmg = 110 * p.damageMult;
      for (const e of game.enemies) {
        if (!e.active) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < 220) {
          e.hurt(dmg, 0, 0);
          game.spawnDamageNumber(e.x, e.y - e.r, Math.round(dmg), '#fde047');
        }
      }
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.25);
      game.slashEffects.push({
        x: p.x,
        y: p.y,
        angle: 0,
        radius: 220,
        arc: Math.PI * 2,
        life: 0.45,
        maxLife: 0.45,
        color: '#fde047',
        full: true,
      });
      game.camera.shake = Math.max(game.camera.shake, 14);
      game.showBanner('ОСВЯЩЕНИЕ', '+25% HP', '#fde047');
    },
  },
  bless: {
    name: 'Благословение',
    icon: '✨',
    cd: 25,
    color: '#fde047',
    desc: '+60% урона и 40% HP на 6с',
    fire: (game) => {
      const p = game.player;
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.4);
      p.applyBuff(1.6, 6);
      game.showBanner('БЛАГОСЛОВЕНИЕ', '+60% урона на 6с', '#fde047');
    },
  },

  // ============ ЧЕРНОКНИЖНИК ============
  bloodSacrifice: {
    name: 'Кровь',
    icon: '🩸',
    cd: 10,
    color: '#e04070',
    desc: 'Тратит 15% HP → мощный урон вокруг',
    fire: (game) => {
      const p = game.player;
      const cost = p.maxHp * 0.15;
      p.hp = Math.max(1, p.hp - cost);
      const dmg = 160 * p.damageMult;
      for (const e of game.enemies) {
        if (!e.active) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < 260) {
          e.hurt(dmg, 0, 0);
          game.spawnDamageNumber(e.x, e.y - e.r, Math.round(dmg), '#e04070');
        }
      }
      game.slashEffects.push({
        x: p.x,
        y: p.y,
        angle: 0,
        radius: 260,
        arc: Math.PI * 2,
        life: 0.35,
        maxLife: 0.35,
        color: '#e04070',
        full: true,
      });
      game.camera.shake = Math.max(game.camera.shake, 16);
    },
  },
  plague: {
    name: 'Чума',
    icon: '☠',
    cd: 20,
    color: '#a040ff',
    desc: 'Все враги рядом получают яд на 6с',
    fire: (game) => {
      let count = 0;
      for (const e of game.enemies) {
        if (!e.active) continue;
        if (Math.hypot(e.x - game.player.x, e.y - game.player.y) < 550) {
          e.dots.push({ damage: 25, time: 6, interval: 0.4, tick: 0.4 });
          count++;
        }
      }
      game.showBanner('ЧУМА', `${count} врагов отравлены`, '#a040ff');
    },
  },
};
