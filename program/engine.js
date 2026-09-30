// ==================== ГЕНЕРАТОР ТРЕНИРОВКИ ====================

const LEVEL_RANGES = {
  novice: { min: 1, max: 4 },
  medium: { min: 3, max: 7 },
  advanced: { min: 6, max: 10 },
};

const GOAL_BONUS = {
  strength: { strength: 2.5, cardio: -0.5, stretching: 0.3 },
  mass: { strength: 2.5, cardio: -0.5, stretching: 0.3 },
  weightloss: { strength: 0.5, cardio: 3.0, stretching: 0.5 },
  endurance: { strength: 0.5, cardio: 3.0, stretching: 1.0 },
  technique: { strength: 0.3, cardio: 0.5, stretching: 3.0 },
};

// ===== РЕАЛИСТИЧНАЯ ОЦЕНКА ВРЕМЕНИ (в минутах) =====
function estimateExerciseTime(ex) {
  const sets = ex.setsReps.sets || 3;
  const reps = String(ex.setsReps.repsText || '').toLowerCase();

  // Время на подход + отдых между подходами
  let perSet;
  if (/\d+\s*(sec|second|сек)/.test(reps)) {
    // Время-ориентированные (например "45-60 seconds")
    perSet = 1.2;
  } else if (/\d+\s*(min|мин)/.test(reps)) {
    perSet = 1.5;
  } else {
    // Повторения: 10-15 повторов ~ 40 сек + 40 сек отдых
    perSet = 0.75;
  }

  // Между подходами + переход между упражнениями
  const total = sets * perSet + 0.5;
  return Math.max(1.5, Math.round(total * 10) / 10);
}

// ===== СОВМЕСТИМОСТЬ ПО ОБОРУДОВАНИЮ =====
function isEquipmentCompatible(ex, equipSet) {
  const specific = ex.equipment.filter((e) => e !== 'bodyweight');

  // Упражнение только с весом тела
  if (specific.length === 0) {
    return equipSet.has('bodyweight');
  }

  // Есть специфическое оборудование — хотя бы одно должно быть выбрано
  return specific.some((e) => equipSet.has(e));
}

// ===== ОЦЕНКА УПРАЖНЕНИЯ =====
function scoreExercise(ex, params) {
  let score = 5;

  // Уровень сложности: чем ближе к середине диапазона, тем лучше
  const range = LEVEL_RANGES[params.level];
  const mid = (range.min + range.max) / 2;
  score += 3 - Math.abs(ex.difficulty - mid) * 0.5;

  // Бонус за цель
  const bonus = GOAL_BONUS[params.goal] || GOAL_BONUS.strength;
  const cat = ex.category || 'strength';
  score += bonus[cat] || 0;

  // Бонус за фокус
  if (params.focusMuscles.includes(ex.primaryMuscle)) score += 2.5;

  // Малый рандом
  score += Math.random() * 1.5;
  return score;
}

// ===== ФИЛЬТРАЦИЯ И СОРТИРОВКА =====
function getCandidates(all, params, excludeIds = new Set()) {
  const range = LEVEL_RANGES[params.level];
  const equipSet = new Set(params.equipment);
  const focusSet = new Set(params.focusMuscles);
  const allMuscles = focusSet.size === MUSCLE_ORDER.length;

  return all
    .filter((ex) => !excludeIds.has(ex.id))
    .filter((ex) => ex.difficulty >= range.min && ex.difficulty <= range.max)
    .filter((ex) => isEquipmentCompatible(ex, equipSet))
    .filter((ex) => {
      if (allMuscles) return true;
      return ex.muscles.some((m) => focusSet.has(m));
    })
    .map((ex) => ({ ex, score: scoreExercise(ex, params) }))
    .sort((a, b) => b.score - a.score);
}

// ===== ВЫБОР БЕЗ ПОВТОРОВ С ОГРАНИЧЕНИЕМ НА ГРУППУ =====
function pickDiverse(candidates, count, groupLimit = 2) {
  const out = [];
  const groupCount = {};
  for (const { ex } of candidates) {
    if (out.length >= count) break;
    const g = ex.primaryMuscle;
    if ((groupCount[g] || 0) >= groupLimit) continue;
    out.push(ex);
    groupCount[g] = (groupCount[g] || 0) + 1;
  }
  return out;
}

// ===== ГЛАВНАЯ ФУНКЦИЯ ГЕНЕРАЦИИ =====
function generateWorkout(params) {
  const duration = params.duration;

  // Разделение времени: 15% разминка, 15% заминка, 70% основная
  const warmupBudget = Math.round(duration * 0.15);
  const cooldownBudget = Math.round(duration * 0.15);
  const mainBudget = duration - warmupBudget - cooldownBudget;

  const usedIds = new Set();

  // ===== РАЗМИНКА: легкие кардио/растяжка/новичковые =====
  const warmupCandidates = getCandidates(EXERCISES, params, usedIds).filter(
    (s) =>
      s.ex.primaryMuscle === 'Кардио' ||
      s.ex.primaryMuscle === 'Растяжка' ||
      s.ex.difficulty <= 3,
  );
  const warmupPool =
    warmupCandidates.length >= 3
      ? warmupCandidates
      : getCandidates(EXERCISES, params, usedIds);

  const warmup = pickDiverse(warmupPool, 4, 1);
  warmup.forEach((ex) => usedIds.add(ex.id));

  // ===== ОСНОВНАЯ ЧАСТЬ =====
  const mainCandidates = getCandidates(EXERCISES, params, usedIds);
  const mainAll = pickDiverse(mainCandidates, 12, 2);

  // Подрезаем основную часть под бюджет
  const main = [];
  let mainTime = 0;
  for (const ex of mainAll) {
    const t = estimateExerciseTime(ex);
    if (mainTime + t > mainBudget + 0.5) break; // допуск полминуты
    main.push(ex);
    mainTime += t;
    usedIds.add(ex.id);
  }

  // ===== ЗАМИНКА =====
  const cooldownCandidates = getCandidates(EXERCISES, params, usedIds).filter(
    (s) => s.ex.primaryMuscle === 'Растяжка' || s.ex.difficulty <= 4,
  );
  const cooldownPool =
    cooldownCandidates.length >= 2
      ? cooldownCandidates
      : getCandidates(EXERCISES, params, usedIds);

  const cooldownAll = pickDiverse(cooldownPool, 4, 1);
  const cooldown = [];
  let coolTime = 0;
  for (const ex of cooldownAll) {
    const t = estimateExerciseTime(ex);
    if (coolTime + t > cooldownBudget + 0.5) break;
    cooldown.push(ex);
    coolTime += t;
  }

  return {
    warmup: warmup.map((e) => ({ ...e, phase: 'warmup' })),
    main: main.map((e) => ({ ...e, phase: 'main' })),
    cooldown: cooldown.map((e) => ({ ...e, phase: 'cooldown' })),
  };
}

// ===== ОБЩЕЕ ВРЕМЯ =====
function totalTime(workout) {
  let t = 0;
  for (const ex of [...workout.warmup, ...workout.main, ...workout.cooldown]) {
    t += estimateExerciseTime(ex);
  }
  return Math.round(t);
}

// ===== РАСПРЕДЕЛЕНИЕ ПО МЫШЦАМ =====
function muscleDistribution(workout) {
  const dist = {};
  for (const m of MUSCLE_ORDER) dist[m] = 0;
  for (const ex of [...workout.warmup, ...workout.main, ...workout.cooldown]) {
    const pm = ex.primaryMuscle;
    if (dist[pm] !== undefined) {
      dist[pm] += ex.setsReps.sets || 3;
    }
  }
  return dist;
}

// ===== ФИЛЬТР КАНДИДАТОВ (для замены упражнения) =====
function filterAndScore(all, params) {
  return getCandidates(all, params);
}
