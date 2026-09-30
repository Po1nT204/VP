function buildUpgradeChoices(player, count = 3) {
  const pool = [];

  for (const w of player.weapons) {
    if (w.level < w.maxLevel) {
      pool.push({
        icon: w.icon,
        title: `${w.name} → ур. ${w.level + 1}`,
        desc: w.getUpgradeDesc(),
        apply: () => w.upgrade(),
      });
    }
  }

  const ownedIds = new Set(player.weapons.map((w) => w.id));
  if (player.weapons.length < 5) {
    for (const id of player.charDef.pool) {
      if (ownedIds.has(id)) continue;
      const meta = WEAPON_META[id];
      pool.push({
        icon: meta.icon,
        title: meta.name,
        desc: meta.desc,
        apply: () => player.weapons.push(makeWeapon(id)),
      });
    }
  }

  pool.push({
    icon: '❤',
    title: 'Стойкость',
    desc: '+25 макс. HP и лечение',
    apply: () => {
      player.maxHp += 25;
      player.hp = Math.min(player.maxHp, player.hp + 25);
    },
  });
  pool.push({
    icon: '🏃',
    title: 'Лёгкость',
    desc: '+15% скорости',
    apply: () => (player.speed *= 1.15),
  });
  pool.push({
    icon: '⚔',
    title: 'Ярость',
    desc: '+25% урона',
    apply: () => (player.damageMult *= 1.25),
  });
  pool.push({
    icon: '⚡',
    title: 'Спешка',
    desc: '+20% скорость атаки',
    apply: () => (player.fireRateMult *= 1.2),
  });
  pool.push({
    icon: '🧲',
    title: 'Магнит',
    desc: '+40% радиус сбора',
    apply: () => (player.pickupRange *= 1.4),
  });
  pool.push({
    icon: '✚',
    title: 'Регенерация',
    desc: '+0.6 HP/сек',
    apply: () => (player.regen += 0.6),
  });
  pool.push({
    icon: '💨',
    title: 'Быстрый рывок',
    desc: '−25% кд рывка',
    apply: () => (player.dashCdMax *= 0.75),
  });

  Utils.shuffle(pool);
  const seen = new Set();
  const out = [];
  for (const p of pool) {
    if (seen.has(p.title)) continue;
    seen.add(p.title);
    out.push(p);
    if (out.length >= count) break;
  }
  return out;
}
