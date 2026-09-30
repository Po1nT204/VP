// ==================== СЛОВАРИ И НОРМАЛИЗАЦИЯ ====================

// Маппинг primary_muscle → канонической группы на русском
const MUSCLE_MAP = {
  // Пресс / кор
  Obliques: 'Пресс',
  'Rectus Abdominis': 'Пресс',
  'Rectus Abdominis (Lower)': 'Пресс',
  'Rectus Abdominis (Upper)': 'Пресс',
  'Lower Rectus Abdominis': 'Пресс',
  Core: 'Пресс',
  'Abs / Core': 'Пресс',
  'Abs  /  Core': 'Пресс',
  'Transverse Abdominis': 'Пресс',
  // Бицепс
  'Biceps Brachii': 'Бицепс',
  Biceps: 'Бицепс',
  Brachialis: 'Бицепс',
  Brachioradialis: 'Бицепс',
  // Предплечья
  'Forearms (Front)': 'Предплечья',
  Forearms: 'Предплечья',
  // Трицепс
  'Triceps Brachii': 'Трицепс',
  Triceps: 'Трицепс',
  // Грудь
  'Pectoralis Major': 'Грудь',
  Chest: 'Грудь',
  'Upper Pectoralis': 'Грудь',
  // Плечи
  Deltoids: 'Плечи',
  Shoulders: 'Плечи',
  'Anterior Deltoid': 'Плечи',
  'Rear Deltoids': 'Плечи',
  'Shoulder Stabilizers': 'Плечи',
  'Rotator Cuff': 'Плечи',
  // Спина
  'Latissimus Dorsi': 'Спина',
  Back: 'Спина',
  'Back (Full)': 'Спина',
  'Upper Back': 'Спина',
  Rhomboids: 'Спина',
  'Erector Spinae': 'Спина',
  Trapezius: 'Спина',
  'Trapezius (Middle)': 'Спина',
  // Квадрицепс
  Quadriceps: 'Квадрицепс',
  'Legs – Quads': 'Квадрицепс',
  'Legs – Quads ': 'Квадрицепс',
  // Бицепс бедра
  Hamstrings: 'Бицепс бедра',
  'Legs – Hamstrings': 'Бицепс бедра',
  // Ягодицы
  'Gluteus Maximus': 'Ягодицы',
  'Gluteus Medius': 'Ягодицы',
  Glutes: 'Ягодицы',
  // Икры
  Calves: 'Икры',
  'Gastrocnemius (Calves)': 'Икры',
  // Кардио / растяжка
  Cardio: 'Кардио',
  Stretching: 'Растяжка',
  // Всё тело / прочее
  'Full Body': 'Всё тело',
  Other: 'Всё тело',
};

// Все канонические группы (порядок для гистограммы)
const MUSCLE_ORDER = [
  'Грудь',
  'Спина',
  'Плечи',
  'Бицепс',
  'Трицепс',
  'Предплечья',
  'Пресс',
  'Ягодицы',
  'Квадрицепс',
  'Бицепс бедра',
  'Икры',
  'Кардио',
  'Растяжка',
];

// Группы "фокуса" для пресетов
const FOCUS_PRESETS = {
  all: MUSCLE_ORDER,
  top: ['Грудь', 'Спина', 'Плечи', 'Бицепс', 'Трицепс', 'Предплечья'],
  bottom: ['Ягодицы', 'Квадрицепс', 'Бицепс бедра', 'Икры'],
  core: ['Пресс'],
  cardio: ['Кардио'],
  stretch: ['Растяжка'],
};

// Определение оборудования по имени + полю equipment
function detectEquipment(raw) {
  const n = (raw.name || '').toLowerCase();
  const eq = raw.equipment || [];
  const result = new Set();

  if (
    eq.includes('resistance band') ||
    n.includes('resistance_band') ||
    n.includes('band')
  )
    result.add('band');
  if (n.includes('dumbbell') || n.includes('dumbell')) result.add('dumbbell');
  if (n.includes('barbell')) result.add('barbell');
  if (n.includes('kettlebell')) result.add('kettlebell');
  if (
    n.includes('cable') ||
    n.includes('machine') ||
    n.includes('crossover') ||
    n.includes('smith_machine') ||
    n.includes('leg_press') ||
    n.includes('stepmill') ||
    n.includes('elliptical') ||
    n.includes('rowing_machine')
  )
    result.add('machine');
  if (
    n.includes('pull_up') ||
    n.includes('pull-up') ||
    n.includes('chin_up') ||
    n.includes('chin-up')
  )
    result.add('pullup');
  if (n.includes('bench')) result.add('bench');

  if (result.size === 0) result.add('bodyweight');
  return Array.from(result);
}

// Парсинг typical_sets_reps типа "3x12-15" → { sets, repsText }
function parseSetsReps(raw) {
  const s = raw.typical_sets_reps || '3x12';
  const m = s.match(/(\d+)\s*[xх]\s*(.+)/i);
  if (!m) return { sets: 3, repsText: s };
  return { sets: parseInt(m[1]), repsText: m[2].trim() };
}

// Нормализация одного упражнения
function normalizeExercise(raw) {
  const muscles = new Set();
  const primary =
    raw.primary_muscle || raw.primary_muscle === 'Other'
      ? raw.primary_muscle
      : 'Other';
  if (MUSCLE_MAP[primary]) muscles.add(MUSCLE_MAP[primary]);

  // Достаём главные мышцы из muscle_intensity (P = primary)
  if (raw.muscle_intensity) {
    for (const [k, v] of Object.entries(raw.muscle_intensity)) {
      if (typeof v === 'string' && v.startsWith('P')) {
        const key = k.replace(/_/g, ' ').trim();
        // маппинг ключей muscle_intensity
        const map = {
          'abs / core': 'Пресс',
          'abs  /  core': 'Пресс',
          shoulders: 'Плечи',
          chest: 'Грудь',
          back: 'Спина',
          biceps: 'Бицепс',
          triceps: 'Трицепс',
          'forearms (front)': 'Предплечья',
          'legs quads': 'Квадрицепс',
          'legs hamstrings': 'Бицепс бедра',
          glutes: 'Ягодицы',
          calves: 'Икры',
          cardio: 'Кардио',
          stretching: 'Растяжка',
          other: 'Всё тело',
        };
        const ru = map[key.toLowerCase()];
        if (ru) muscles.add(ru);
      }
    }
  }

  return {
    id: raw.id || raw.name,
    name: raw.name,
    nameRu: prettifyName(raw.name),
    muscles: Array.from(muscles),
    primaryMuscle: Array.from(muscles)[0] || 'Всё тело',
    equipment: detectEquipment(raw),
    difficulty: raw.difficulty || 5,
    category: raw.category || 'strength',
    calories: raw.calories_per_kg_per_hour || 5,
    setsReps: parseSetsReps(raw),
    tips: raw.execution_tips || [],
  };
}

// Красивое имя из snake_case (оставляем английское, но читаемое)
function prettifyName(s) {
  return s
    .replace(/_/g, ' ')
    .replace(/\(([^)]+)\)/g, '($1)')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ==================== ГОТОВЫЙ НАБОР ====================
let EXERCISES = [];
function buildExercisePool() {
  if (typeof EXERCISES_RAW === 'undefined') {
    console.error('exercises.js не загружен');
    return;
  }
  EXERCISES = EXERCISES_RAW.map(normalizeExercise).filter(
    (e) => e.muscles.length > 0,
  );
  console.log(`Загружено упражнений: ${EXERCISES.length}`);
}
