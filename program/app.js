// ==================== СОСТОЯНИЕ ====================
const state = {
  goal: 'strength',
  level: 'medium',
  duration: 60,
  equipment: new Set(['bodyweight']),
  focus: new Set(['all']),
  perWeek: 3,
  workout: { warmup: [], main: [], cooldown: [] },
  timer: null,
  timerExIdx: 0,
  timerRemaining: 0,
  timerRunning: false,
  recent: [],
};

// ==================== LOCALSTORAGE ====================
const LS_KEY = 'workout_constructor_v1';

function saveState() {
  try {
    const toSave = {
      goal: state.goal,
      level: state.level,
      duration: state.duration,
      equipment: Array.from(state.equipment),
      focus: Array.from(state.focus),
      perWeek: state.perWeek,
      workout: state.workout,
      recent: state.recent.slice(0, 5),
    };
    localStorage.setItem(LS_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn('save err', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    state.goal = s.goal || state.goal;
    state.level = s.level || state.level;
    state.duration = s.duration || state.duration;
    if (s.equipment) state.equipment = new Set(s.equipment);
    if (s.focus) state.focus = new Set(s.focus);
    state.perWeek = s.perWeek || state.perWeek;
    if (s.workout) state.workout = s.workout;
    if (s.recent) state.recent = s.recent;
  } catch (e) {
    console.warn('load err', e);
  }
}

// ==================== ФИЛЬТР ОБОРУДОВАНИЯ ====================
function currentFocusMuscles() {
  if (state.focus.has('all') || state.focus.size === 0) return MUSCLE_ORDER;
  const set = new Set();
  for (const key of state.focus) {
    if (FOCUS_PRESETS[key]) FOCUS_PRESETS[key].forEach((m) => set.add(m));
  }
  return Array.from(set);
}

// ==================== ГЕНЕРАЦИЯ ====================
function doGenerate() {
  const params = {
    goal: state.goal,
    level: state.level,
    duration: state.duration,
    equipment: Array.from(state.equipment),
    focusMuscles: currentFocusMuscles(),
  };

  const workout = generateWorkout(params);
  const total =
    workout.warmup.length + workout.main.length + workout.cooldown.length;

  if (total === 0) {
    document.getElementById('hint').textContent =
      '⚠ Ничего не подобралось. Попробуй больше оборудования или другой уровень.';
    return;
  }

  const t = totalTime(workout);
  document.getElementById('hint').textContent =
    `✓ ${total} упражнений · ~${t} мин`;

  state.workout = workout;
  pushRecent(workout, params);
  saveState();
  render();
}

function pushRecent(workout, params) {
  const label = new Date().toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  state.recent.unshift({
    label,
    params,
    workout,
  });
  if (state.recent.length > 5) state.recent.length = 5;
}

// ==================== РЕНДЕР ====================
function render() {
  renderWorkoutList();
  renderHistogram();
  renderDonut();
  renderRecent();
}

function allExercises() {
  return [
    ...state.workout.warmup,
    ...state.workout.main,
    ...state.workout.cooldown,
  ];
}

function renderWorkoutList() {
  const list = document.getElementById('workoutList');
  const empty = document.getElementById('emptyState');
  list.innerHTML = '';

  const total = allExercises().length;
  if (total === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const phases = [
    { key: 'warmup', label: 'Разминка' },
    { key: 'main', label: 'Основная часть' },
    { key: 'cooldown', label: 'Заминка' },
  ];

  let idx = 1;
  for (const { key, label } of phases) {
    const arr = state.workout[key];
    if (arr.length === 0) continue;

    const div = document.createElement('li');
    div.className = 'phase-divider';
    div.textContent = label;
    list.appendChild(div);

    arr.forEach((ex, i) => {
      const li = document.createElement('li');
      li.className = `exercise phase-${key}`;
      li.draggable = true;
      li.dataset.phase = key;
      li.dataset.idx = i;

      const setsReps = ex.setsReps;
      li.innerHTML = `
        <div class="ex-num">${idx++}</div>
        <div class="ex-body">
          <div class="ex-name">${escapeHtml(ex.nameRu)}</div>
          <div class="ex-meta">
            <span class="tag muscle">${ex.primaryMuscle}</span>
            <span class="sets">${setsReps.sets} подх. × ${escapeHtml(setsReps.repsText)}</span>
            <span class="tag equip">${ex.equipment.map(eqRu).join(', ')}</span>
            <span class="tag">уровень ${ex.difficulty}/10</span>
          </div>
        </div>
        <div class="ex-actions">
          <button class="icon-btn" title="Заменить">🔄</button>
          <button class="icon-btn danger" title="Удалить">✕</button>
        </div>
      `;

      // Drag events
      li.addEventListener('dragstart', (e) => {
        li.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `${key}:${i}`);
      });
      li.addEventListener('dragend', () => li.classList.remove('dragging'));
      li.addEventListener('dragover', (e) => {
        e.preventDefault();
        li.classList.add('drag-over');
      });
      li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        li.classList.remove('drag-over');
        const [srcPhase, srcIdx] = e.dataTransfer
          .getData('text/plain')
          .split(':');
        handleDrop(srcPhase, +srcIdx, key, i);
      });

      // Кнопки
      li.querySelector('.icon-btn.danger').onclick = (ev) => {
        ev.stopPropagation();
        state.workout[key].splice(i, 1);
        saveState();
        render();
      };
      li.querySelector('.icon-btn:not(.danger)').onclick = (ev) => {
        ev.stopPropagation();
        replaceExercise(key, i);
      };

      // Клик — таймер
      li.onclick = () => openTimer(key, i);

      list.appendChild(li);
    });
  }
}

function handleDrop(srcPhase, srcIdx, dstPhase, dstIdx) {
  if (srcPhase === dstPhase) {
    const arr = state.workout[srcPhase];
    const [moved] = arr.splice(srcIdx, 1);
    arr.splice(dstIdx, 0, moved);
  } else {
    const [moved] = state.workout[srcPhase].splice(srcIdx, 1);
    moved.phase = dstPhase;
    state.workout[dstPhase].splice(dstIdx, 0, moved);
  }
  saveState();
  render();
}

function replaceExercise(phase, idx) {
  const current = state.workout[phase][idx];
  const usedIds = new Set(allExercises().map((e) => e.id));

  const params = {
    goal: state.goal,
    level: state.level,
    equipment: Array.from(state.equipment),
    focusMuscles: currentFocusMuscles(),
  };
  const candidates = filterAndScore(EXERCISES, params)
    .filter((s) => !usedIds.has(s.ex.id))
    .filter((s) => {
      // По возможности та же главная мышца
      if (current.primaryMuscle === 'Всё тело') return true;
      return (
        s.ex.primaryMuscle === current.primaryMuscle ||
        s.ex.muscles.includes(current.primaryMuscle)
      );
    });

  if (candidates.length === 0) {
    document.getElementById('hint').textContent = 'Нет альтернативы для замены';
    return;
  }
  const pick =
    candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];
  state.workout[phase][idx] = { ...pick.ex, phase };
  saveState();
  render();
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c],
  );
}

function eqRu(eq) {
  return (
    {
      bodyweight: 'Без инвентаря',
      dumbbell: 'Гантели',
      barbell: 'Штанга',
      kettlebell: 'Гиря',
      band: 'Резинки',
      machine: 'Тренажёр',
      pullup: 'Турник',
      bench: 'Скамья',
    }[eq] || eq
  );
}

// ==================== ГИСТОГРАММА (SVG) ====================
function renderHistogram() {
  const svg = document.getElementById('histogram');
  svg.innerHTML = '';
  const dist = muscleDistribution(state.workout);
  const entries = MUSCLE_ORDER.map((m) => ({ m, v: dist[m] || 0 }));
  const max = Math.max(1, ...entries.map((e) => e.v));

  const W = 380,
    H = 200;
  const padL = 8,
    padR = 8,
    padT = 8,
    padB = 50;
  const barW = (W - padL - padR) / entries.length;

  entries.forEach((e, i) => {
    const h = ((H - padT - padB) * e.v) / max;
    const x = padL + i * barW + 4;
    const y = H - padB - h;
    const w = barW - 8;

    // Бар
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('rx', 4);
    rect.setAttribute('fill', e.v > 0 ? 'url(#barGrad)' : '#1c232c');
    svg.appendChild(rect);

    // Значение
    if (e.v > 0) {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', x + w / 2);
      t.setAttribute('y', y - 4);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('fill', '#e6edf3');
      t.setAttribute('font-size', '11');
      t.setAttribute('font-weight', '700');
      t.textContent = e.v;
      svg.appendChild(t);
    }

    // Название снизу (вертикально)
    const label = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'text',
    );
    label.setAttribute('x', x + w / 2);
    label.setAttribute('y', H - padB + 12);
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('fill', '#8b949e');
    label.setAttribute('font-size', '10');
    label.setAttribute(
      'transform',
      `rotate(-45 ${x + w / 2} ${H - padB + 12})`,
    );
    label.textContent = e.m;
    svg.appendChild(label);
  });

  // Градиент
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>`;
  svg.insertBefore(defs, svg.firstChild);
}

// ==================== DONUT (SVG) ====================
function renderDonut() {
  const svg = document.getElementById('donut');
  svg.innerHTML = '';
  const total = totalTime(state.workout);
  const target = state.duration;
  const ratio = Math.min(1, total / target);

  const R = 62;
  const C = 2 * Math.PI * R;

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bg.setAttribute('cx', 80);
  bg.setAttribute('cy', 80);
  bg.setAttribute('r', R);
  bg.setAttribute('fill', 'none');
  bg.setAttribute('stroke', '#1a212c');
  bg.setAttribute('stroke-width', '14');
  svg.appendChild(bg);

  const fg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  fg.setAttribute('cx', 80);
  fg.setAttribute('cy', 80);
  fg.setAttribute('r', R);
  fg.setAttribute('fill', 'none');
  fg.setAttribute('stroke', 'url(#donutGrad)');
  fg.setAttribute('stroke-width', '14');
  fg.setAttribute('stroke-linecap', 'round');
  fg.setAttribute('stroke-dasharray', C);
  fg.setAttribute('stroke-dashoffset', C * (1 - ratio));
  fg.setAttribute('transform', 'rotate(-90 80 80)');
  fg.style.filter = 'drop-shadow(0 0 10px rgba(52,211,153,0.5))';
  svg.appendChild(fg);

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="donutGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>`;
  svg.insertBefore(defs, svg.firstChild);

  document.getElementById('totalMin').textContent = total;
  document.getElementById('targetMin').textContent = target;
}

// ==================== RECENT ====================
function renderRecent() {
  const block = document.getElementById('recentBlock');
  const list = document.getElementById('recentList');
  list.innerHTML = '';
  if (state.recent.length === 0) {
    block.classList.add('hidden');
    return;
  }
  block.classList.remove('hidden');
  state.recent.forEach((r, i) => {
    const el = document.createElement('div');
    el.className = 'recent-item';
    const total =
      r.workout.warmup.length +
      r.workout.main.length +
      r.workout.cooldown.length;
    el.innerHTML = `<b>${total} упр.</b><small>${r.label}</small>`;
    el.onclick = () => {
      state.workout = r.workout;
      render();
    };
    list.appendChild(el);
  });
}

// ==================== ТАЙМЕР ====================
let timerInterval = null;

function openTimer(phase, idx) {
  const ex = state.workout[phase][idx];
  if (!ex) return;
  state.timerExIdx = { phase, idx };
  state.timerRemaining = 60; // 1 минута по умолчанию
  state.timerRunning = true;

  document.getElementById('timerExName').textContent = ex.nameRu;
  document.getElementById('timerModal').classList.remove('hidden');
  updateTimerUI();

  clearInterval(timerInterval);
  timerInterval = setInterval(tickTimer, 1000);
}

function tickTimer() {
  if (!state.timerRunning) return;
  state.timerRemaining--;
  if (state.timerRemaining <= 0) {
    nextExercise();
    return;
  }
  updateTimerUI();
}

function updateTimerUI() {
  const m = Math.floor(state.timerRemaining / 60);
  const s = state.timerRemaining % 60;
  document.getElementById('timerNum').textContent =
    `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  const R = 88;
  const C = 2 * Math.PI * R;
  const total = 60;
  const ratio = state.timerRemaining / total;
  const fg = document.getElementById('ringFg');
  fg.setAttribute('stroke-dasharray', C);
  fg.setAttribute('stroke-dashoffset', C * (1 - ratio));
  fg.setAttribute('stroke', ratio > 0.3 ? '#34d399' : '#ef4444');
}

function nextExercise() {
  const { phase, idx } = state.timerExIdx;
  const arr = state.workout[phase];
  if (!arr) return closeTimer();
  if (idx + 1 < arr.length) {
    state.timerExIdx = { phase, idx: idx + 1 };
  } else {
    // Переход к следующей фазе
    const order = ['warmup', 'main', 'cooldown'];
    const currentPhaseIdx = order.indexOf(phase);
    let next = null;
    for (let i = currentPhaseIdx + 1; i < order.length; i++) {
      if (state.workout[order[i]].length > 0) {
        next = { phase: order[i], idx: 0 };
        break;
      }
    }
    if (!next) return closeTimer();
    state.timerExIdx = next;
  }
  const ex = state.workout[state.timerExIdx.phase][state.timerExIdx.idx];
  document.getElementById('timerExName').textContent = ex.nameRu;
  state.timerRemaining = 60;
  updateTimerUI();
}

function closeTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  state.timerRunning = false;
  document.getElementById('timerModal').classList.add('hidden');
}

// ==================== СКАЧАТЬ ====================
function downloadWorkout() {
  const lines = [];
  const now = new Date().toLocaleString('ru-RU');
  lines.push(`ТРЕНИРОВКА · ${now}`);
  lines.push(
    `Цель: ${goalRu(state.goal)} · Уровень: ${levelRu(state.level)} · ~${totalTime(state.workout)} мин`,
  );
  lines.push('='.repeat(50));
  lines.push('');

  const phases = [
    { key: 'warmup', label: 'РАЗМИНКА' },
    { key: 'main', label: 'ОСНОВНАЯ ЧАСТЬ' },
    { key: 'cooldown', label: 'ЗАМИНКА' },
  ];

  let n = 1;
  for (const { key, label } of phases) {
    if (state.workout[key].length === 0) continue;
    lines.push(`## ${label}`);
    for (const ex of state.workout[key]) {
      lines.push(`${n}. ${ex.nameRu}`);
      lines.push(`   ${ex.setsReps.sets} подходов × ${ex.setsReps.repsText}`);
      lines.push(
        `   Группа: ${ex.primaryMuscle} · Оборудование: ${ex.equipment.map(eqRu).join(', ')}`,
      );
      if (ex.tips && ex.tips.length > 0) {
        lines.push(`   Совет: ${ex.tips[0]}`);
      }
      lines.push('');
      n++;
    }
  }
  lines.push('='.repeat(50));
  lines.push('Сгенерировано в «Конструкторе тренировок»');

  const blob = new Blob([lines.join('\n')], {
    type: 'text/plain;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workout_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function goalRu(g) {
  return (
    {
      strength: 'сила',
      mass: 'масса',
      weightloss: 'похудение',
      endurance: 'выносливость',
      technique: 'техника',
    }[g] || g
  );
}
function levelRu(l) {
  return (
    { novice: 'новичок', medium: 'средний', advanced: 'продвинутый' }[l] || l
  );
}

// ==================== ИВЕНТЫ ====================
function bindUI() {
  // Select-поля
  document.getElementById('goal').onchange = (e) => {
    state.goal = e.target.value;
    saveState();
  };
  document.getElementById('level').onchange = (e) => {
    state.level = e.target.value;
    saveState();
  };
  document.getElementById('perWeek').onchange = (e) => {
    state.perWeek = +e.target.value;
    saveState();
  };

  const dur = document.getElementById('duration');
  dur.oninput = (e) => {
    state.duration = +e.target.value;
    document.getElementById('durLabel').textContent = `${state.duration} мин`;
    saveState();
  };

  // Chips оборудования
  document.querySelectorAll('#equipChips .chip').forEach((chip) => {
    chip.onclick = () => {
      const eq = chip.dataset.eq;
      if (state.equipment.has(eq)) {
        if (state.equipment.size > 1) {
          state.equipment.delete(eq);
          chip.classList.remove('active');
        }
      } else {
        state.equipment.add(eq);
        chip.classList.add('active');
      }
      saveState();
    };
  });

  // Chips фокуса
  document.querySelectorAll('#focusChips .chip').forEach((chip) => {
    chip.onclick = () => {
      const f = chip.dataset.focus;
      if (f === 'all') {
        state.focus = new Set(['all']);
      } else {
        state.focus.delete('all');
        if (state.focus.has(f)) state.focus.delete(f);
        else state.focus.add(f);
        if (state.focus.size === 0) state.focus.add('all');
      }
      // Перерисовать chips
      document.querySelectorAll('#focusChips .chip').forEach((c) => {
        c.classList.toggle('active', state.focus.has(c.dataset.focus));
      });
      saveState();
    };
  });

  // Кнопки
  document.getElementById('generateBtn').onclick = doGenerate;
  document.getElementById('downloadBtn').onclick = downloadWorkout;
  document.getElementById('timerBtn').onclick = () => {
    if (allExercises().length === 0) return;
    openTimer('warmup', 0);
  };
  document.getElementById('clearBtn').onclick = () => {
    state.workout = { warmup: [], main: [], cooldown: [] };
    saveState();
    render();
    document.getElementById('hint').textContent = '';
  };

  // Модалка таймера
  document.getElementById('timerClose').onclick = closeTimer;
  document.getElementById('timerSkip').onclick = nextExercise;
  document.getElementById('timerPause').onclick = () => {
    state.timerRunning = !state.timerRunning;
    document.getElementById('timerPause').textContent = state.timerRunning
      ? '⏸ Пауза'
      : '▶ Продолжить';
  };

  // Горячие клавиши в таймере
  window.addEventListener('keydown', (e) => {
    if (document.getElementById('timerModal').classList.contains('hidden'))
      return;
    if (e.code === 'Space') {
      e.preventDefault();
      state.timerRunning = !state.timerRunning;
      document.getElementById('timerPause').textContent = state.timerRunning
        ? '⏸ Пауза'
        : '▶ Продолжить';
    }
    if (e.code === 'ArrowRight') nextExercise();
    if (e.code === 'Escape') closeTimer();
  });
}

// ==================== ПРИМЕНЕНИЕ ЗАГРУЖЕННОГО СОСТОЯНИЯ ====================
function applyStateToUI() {
  document.getElementById('goal').value = state.goal;
  document.getElementById('level').value = state.level;
  document.getElementById('perWeek').value = state.perWeek;
  document.getElementById('duration').value = state.duration;
  document.getElementById('durLabel').textContent = `${state.duration} мин`;

  document.querySelectorAll('#equipChips .chip').forEach((c) => {
    c.classList.toggle('active', state.equipment.has(c.dataset.eq));
  });
  document.querySelectorAll('#focusChips .chip').forEach((c) => {
    c.classList.toggle('active', state.focus.has(c.dataset.focus));
  });
}

// ==================== INIT ====================
function init() {
  buildExercisePool();
  loadState();
  applyStateToUI();
  bindUI();

  if (allExercises().length > 0) {
    render();
    document.getElementById('hint').textContent =
      `Загружена последняя тренировка · ~${totalTime(state.workout)} мин`;
  } else {
    render();
  }
}
init();
