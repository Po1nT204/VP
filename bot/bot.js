import { Bot, InlineKeyboard } from 'grammy';
import {
  discoverMovies,
  getMovieDetails,
  getRandomPopular,
  IMG_BASE,
  TMDB_SITE,
} from './movies.js';
import 'dotenv/config';
import * as store from './storage.js';

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не задан. Создай .env файл с BOT_TOKEN=...');
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

// ============ СПРАВОЧНИКИ ============
const MOODS = {
  serious: { label: '🎭 Серьёзное', genres: [18, 36, 10752] },
  funny: { label: '😂 Весёлое', genres: [35, 10751] },
  sad: { label: '😢 Грустное', genres: [18, 10749] },
  thrilling: { label: '🤯 Захватывающее', genres: [28, 12, 53] },
  thoughtful: { label: '🧠 Заставляет думать', genres: [18, 9648, 99] },
  romantic: { label: '❤️ Романтичное', genres: [10749] },
  scary: { label: '😱 Страшное', genres: [27, 53] },
  fantastic: { label: '🌌 Фантастическое', genres: [878, 14] },
};

const LENGTHS = {
  short: { label: '🕐 До 90 мин', runtimeGte: 1, runtimeLte: 89 },
  medium: { label: '⏱ 90–120 мин', runtimeGte: 90, runtimeLte: 120 },
  long: { label: '🎬 Больше 2 часов', runtimeGte: 121 },
  any: { label: '🎲 Не важно' },
};

const YEARS = {
  old: { label: '📼 До 2000', dateLte: '1999-12-31' },
  mid: { label: '🕰 2000–2015', dateGte: '2000-01-01', dateLte: '2015-12-31' },
  recent: {
    label: '🆕 2015–2026',
    dateGte: '2015-01-01',
    dateLte: '2026-12-31',
  },
  any: { label: '🎲 Любые годы' },
};

const GENRES = {
  action: { label: '🎬 Боевик', id: 28 },
  drama: { label: '🎭 Драма', id: 18 },
  comedy: { label: '😂 Комедия', id: 35 },
  thriller: { label: '🔪 Триллер', id: 53 },
  horror: { label: '😱 Ужасы', id: 27 },
  scifi: { label: '🚀 Фантастика', id: 878 },
  fantasy: { label: '🧙 Фэнтези', id: 14 },
  romance: { label: '❤️ Романтика', id: 10749 },
  mystery: { label: '🔍 Детектив', id: 9648 },
  adventure: { label: '🏰 Приключения', id: 12 },
  animation: { label: '🎨 Анимация', id: 16 },
  history: { label: '📖 История', id: 36 },
  war: { label: '⚔️ Военное', id: 10752 },
  western: { label: '🤠 Вестерн', id: 37 },
  any: { label: '🎲 Любой жанр', id: null },
};

// ============ СЕССИИ ============
const sessions = new Map();
function getSession(uid) {
  const key = String(uid);
  if (!sessions.has(key)) {
    sessions.set(key, {
      mood: null,
      length: null,
      years: null,
      genre: null,
      lastResults: [],
    });
  }
  return sessions.get(key);
}

// ============ УТИЛИТЫ ============
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function ageRating(m) {
  return m.vote_average ? `⭐ ${m.vote_average.toFixed(1)}` : '⭐ —';
}

function prettyDate(s) {
  if (!s) return '—';
  const y = s.slice(0, 4);
  const mo = s.slice(5, 7);
  const d = s.slice(8, 10);
  return `${d}.${mo}.${y}`;
}

// ============ КЛАВИАТУРЫ ============
function mainMenu() {
  return new InlineKeyboard()
    .text('🎲 Подобрать фильм', 'start_pick')
    .row()
    .text('🎬 Случайный фильм', 'random_movie')
    .row()
    .text('⭐ Избранное', 'show_favs')
    .text('📜 История', 'show_history')
    .row()
    .text('❓ Помощь', 'help');
}

function moodKeyboard() {
  const kb = new InlineKeyboard();
  const items = Object.entries(MOODS);
  for (let i = 0; i < items.length; i += 2) {
    kb.text(items[i][1].label, `mood:${items[i][0]}`);
    if (items[i + 1]) kb.text(items[i + 1][1].label, `mood:${items[i + 1][0]}`);
    kb.row();
  }
  return kb;
}

function lengthKeyboard() {
  const kb = new InlineKeyboard();
  for (const [key, v] of Object.entries(LENGTHS))
    kb.text(v.label, `len:${key}`).row();
  return kb;
}

function yearsKeyboard() {
  const kb = new InlineKeyboard();
  for (const [key, v] of Object.entries(YEARS))
    kb.text(v.label, `yr:${key}`).row();
  return kb;
}

function genreKeyboard() {
  const kb = new InlineKeyboard();
  const items = Object.entries(GENRES);
  for (let i = 0; i < items.length; i += 2) {
    kb.text(items[i][1].label, `g:${items[i][0]}`);
    if (items[i + 1]) kb.text(items[i + 1][1].label, `g:${items[i + 1][0]}`);
    kb.row();
  }
  return kb;
}

function moviesKeyboard(movies) {
  const kb = new InlineKeyboard();
  movies.forEach((m, i) => {
    const y = (m.release_date || '').slice(0, 4) || '—';
    const title = m.title.length > 40 ? m.title.slice(0, 37) + '…' : m.title;
    kb.text(`${i + 1}. ${title} (${y})`, `movie:${i}`).row();
  });
  kb.text('🔄 Новый подбор', 'start_pick').row();
  return kb;
}

function cardKeyboard(movie, uid) {
  const fav = store.isFavorite(uid, movie.id)
    ? '★ В избранном'
    : '⭐ В избранное';
  const rating = store.getRating(uid, movie.id);
  const likeMark = rating === 'like' ? '👍✓' : '👍';
  const dislikeMark = rating === 'dislike' ? '👎✓' : '👎';

  return new InlineKeyboard()
    .text('🔁 Ещё подбор', 'more_like_this')
    .row()
    .text(fav, `fav:${movie.id}`)
    .row()
    .text(likeMark, `rate:${movie.id}:like`)
    .text(dislikeMark, `rate:${movie.id}:dislike`)
    .row()
    .text('⬅️ К списку', 'back_to_list')
    .row()
    .text('🏠 В меню', 'go_menu');
}

// ============ ХЕНДЛЕРЫ: КОМАНДЫ ============
bot.command('start', async (ctx) => {
  store.ensureUser?.(ctx.from.id);
  const s = getSession(ctx.from.id);
  s.mood = s.length = s.years = s.genre = null;
  s.lastResults = [];

  await ctx.reply(
    `👋 Привет, <b>${esc(ctx.from.first_name || 'друг')}</b>!\n\n` +
      `Я помогу выбрать фильм на вечер. Отвечу на 4 коротких вопроса и предложу 5 вариантов.\n\n` +
      `Жми кнопку ниже, чтобы начать.`,
    { parse_mode: 'HTML', reply_markup: mainMenu() },
  );
});

bot.command('random', async (ctx) => {
  await ctx.reply('🎲 Кидаю кубик...');
  try {
    const movie = await getRandomPopular();
    if (!movie) return ctx.reply('Не удалось найти фильм. Попробуй ещё раз.');
    const s = getSession(ctx.from.id);
    s.lastResults = [movie];
    await sendCard(ctx, movie, 0);
  } catch (e) {
    console.error(e);
    await ctx.reply('⚠ Ошибка при обращении к TMDB. Проверь API-ключ.');
  }
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    `<b>Что умею:</b>\n\n` +
      `/start — начать подбор\n` +
      `/random — случайный фильм\n` +
      `/history — последние 10 рекомендаций\n` +
      `/favorites — избранное\n` +
      `/help — эта справка\n\n` +
      `После подбора можно ставить 👍/👎 и добавлять в избранное.`,
    { parse_mode: 'HTML' },
  );
});

bot.command('history', async (ctx) => {
  const h = store.getHistory(ctx.from.id).slice(0, 10);
  if (!h.length) return ctx.reply('История пуста. Сначала подбери фильм.');
  const lines = h.map((m, i) => `${i + 1}. <b>${esc(m.title)}</b> (${m.year})`);
  await ctx.reply(`📜 <b>Последние рекомендации:</b>\n\n${lines.join('\n')}`, {
    parse_mode: 'HTML',
  });
});

bot.command('favorites', async (ctx) => {
  const f = store.getFavorites(ctx.from.id);
  if (!f.length)
    return ctx.reply('В избранном пусто. Добавляй фильмы кнопкой ⭐.');
  const lines = f.map((m, i) => `${i + 1}. <b>${esc(m.title)}</b> (${m.year})`);
  await ctx.reply(`⭐ <b>Избранное:</b>\n\n${lines.join('\n')}`, {
    parse_mode: 'HTML',
  });
});

// ============ ХЕНДЛЕРЫ: КНОПКИ МЕНЮ ============
bot.callbackQuery('help', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    `/start — начать подбор\n/random — случайный фильм\n/history — история\n/favorites — избранное`,
    { reply_markup: mainMenu() },
  );
});

bot.callbackQuery('random_movie', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply('🎲 Кидаю кубик...');
  try {
    const movie = await getRandomPopular();
    if (!movie) return ctx.reply('Не удалось найти фильм. Попробуй ещё раз.');
    const s = getSession(ctx.from.id);
    s.lastResults = [movie];
    await sendCard(ctx, movie, 0);
  } catch (e) {
    console.error(e);
    await ctx.reply('⚠ Ошибка при обращении к TMDB.');
  }
});

bot.callbackQuery('go_menu', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply('Главное меню:', { reply_markup: mainMenu() });
});

bot.callbackQuery('start_pick', async (ctx) => {
  await ctx.answerCallbackQuery();
  const s = getSession(ctx.from.id);
  s.mood = s.length = s.years = s.genre = null;
  s.lastResults = [];
  await ctx.reply('🎭 <b>Шаг 1 из 4. Какое настроение сейчас?</b>', {
    parse_mode: 'HTML',
    reply_markup: moodKeyboard(),
  });
});

// ============ ХЕНДЛЕРЫ: ШАГИ ============
bot.callbackQuery(/^mood:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const s = getSession(ctx.from.id);
  s.mood = ctx.match[1];
  await ctx.editMessageText(
    `🎭 Настроение: <b>${MOODS[s.mood].label}</b>\n\n` +
      `⏱ <b>Шаг 2 из 4. Сколько времени есть на фильм?</b>`,
    { parse_mode: 'HTML', reply_markup: lengthKeyboard() },
  );
});

bot.callbackQuery(/^len:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const s = getSession(ctx.from.id);
  s.length = ctx.match[1];
  await ctx.editMessageText(
    `⏱ Длина: <b>${LENGTHS[s.length].label}</b>\n\n` +
      `📅 <b>Шаг 3 из 4. Какие годы?</b>`,
    { parse_mode: 'HTML', reply_markup: yearsKeyboard() },
  );
});

bot.callbackQuery(/^yr:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const s = getSession(ctx.from.id);
  s.years = ctx.match[1];
  await ctx.editMessageText(
    `📅 Годы: <b>${YEARS[s.years].label}</b>\n\n` +
      `🎬 <b>Шаг 4 из 4. Какой жанр?</b>`,
    { parse_mode: 'HTML', reply_markup: genreKeyboard() },
  );
});

bot.callbackQuery(/^g:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const s = getSession(ctx.from.id);
  s.genre = ctx.match[1];
  await runSearch(ctx, s);
});

// ============ ПОИСК И ВЫДАЧА ============
async function runSearch(ctx, s) {
  const uid = ctx.from.id;

  // Какие жанры использовать
  let genres = [];
  if (s.genre && s.genre !== 'any' && GENRES[s.genre].id) {
    genres = [GENRES[s.genre].id];
  } else if (s.mood && MOODS[s.mood].genres) {
    genres = MOODS[s.mood].genres;
  }

  const lengthDef = LENGTHS[s.length] || {};
  const yearsDef = YEARS[s.years] || {};

  await ctx.reply('🔎 Ищу фильмы...');

  try {
    const data = await discoverMovies({
      genres,
      runtimeGte: lengthDef.runtimeGte,
      runtimeLte: lengthDef.runtimeLte,
      dateGte: yearsDef.dateGte,
      dateLte: yearsDef.dateLte,
      page: 1,
    });

    const results = (data.results || []).filter((m) => m.title).slice(0, 20);
    if (results.length === 0) {
      return ctx.reply(
        '😔 По таким параметрам ничего не нашлось.\nПопробуй ослабить фильтры.',
        { reply_markup: mainMenu() },
      );
    }

    // Перемешиваем и берём 5
    const shuffled = results.sort(() => Math.random() - 0.5).slice(0, 8);
    s.lastResults = shuffled;

    // Отсекаем те, что уже не нравятся
    const filtered = shuffled.filter(
      (m) => store.getRating(uid, m.id) !== 'dislike',
    );
    const finalList = filtered.length >= 3 ? filtered : shuffled;
    s.lastResults = finalList;

    const summary =
      `🎯 <b>Подобрал под запрос:</b>\n` +
      `🎭 ${MOODS[s.mood]?.label || '—'}\n` +
      `⏱ ${LENGTHS[s.length]?.label || '—'}\n` +
      `📅 ${YEARS[s.years]?.label || '—'}\n` +
      `🎬 ${GENRES[s.genre]?.label || '—'}\n\n` +
      `<b>Выбери фильм из списка:</b>`;

    await ctx.reply(summary, {
      parse_mode: 'HTML',
      reply_markup: moviesKeyboard(finalList),
    });
  } catch (e) {
    console.error('Search error:', e);
    await ctx.reply(
      '⚠ Ошибка при обращении к TMDB. Проверь API-ключ в movies.js',
    );
  }
}

// ============ КАРТОЧКА ФИЛЬМА ============
async function sendCard(ctx, movie, idx) {
  const uid = ctx.from.id;
  const s = getSession(uid);

  let details = movie;
  try {
    details = await getMovieDetails(movie.id);
  } catch (e) {
    console.error('Details error:', e);
  }

  store.addToHistory(uid, details);

  const year = (details.release_date || '').slice(0, 4) || '—';
  const runtime = details.runtime ? `${details.runtime} мин` : '—';
  const genres = (details.genres || []).map((g) => g.name).join(', ') || '—';
  const overview = details.overview
    ? details.overview
    : 'Описание отсутствует.';
  const rating = details.vote_average ? details.vote_average.toFixed(1) : '—';

  // Формируем "почему подойдёт"
  const whyParts = [];
  if (s.mood) whyParts.push(MOODS[s.mood].label);
  if (s.length && s.length !== 'any') whyParts.push(LENGTHS[s.length].label);
  if (s.years && s.years !== 'any') whyParts.push(YEARS[s.years].label);
  if (s.genre && s.genre !== 'any') whyParts.push(GENRES[s.genre].label);
  const why = whyParts.length ? whyParts.join(' · ') : 'Твой случайный выбор';

  const caption =
    `<b>${esc(details.title)}</b> (${year})\n\n` +
    `⭐ ${rating} / 10\n` +
    `🎭 ${esc(genres)}\n` +
    `⏱ ${runtime}\n` +
    `📅 Премьера: ${prettyDate(details.release_date)}\n\n` +
    `📝 ${esc(overview.slice(0, 400))}${overview.length > 400 ? '…' : ''}\n\n` +
    `💡 <b>Почему подойдёт:</b> ${esc(why)}\n` +
    `🔗 <a href="${TMDB_SITE}/${details.id}">Страница на TMDB</a>`;

  const kb = cardKeyboard(details, uid);

  try {
    if (details.poster_path) {
      await ctx.replyWithPhoto(`${IMG_BASE}${details.poster_path}`, {
        caption,
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    } else {
      await ctx.reply(caption, { parse_mode: 'HTML', reply_markup: kb });
    }
  } catch (e) {
    console.error('Send card error:', e);
    await ctx
      .reply(caption, { parse_mode: 'HTML', reply_markup: kb })
      .catch(() => {});
  }
}

// ============ КНОПКИ: ВЫБОР ФИЛЬМА И ДЕЙСТВИЯ ============
bot.callbackQuery(/^movie:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const s = getSession(ctx.from.id);
  const idx = parseInt(ctx.match[1]);
  const movie = s.lastResults[idx];
  if (!movie) return ctx.reply('Список устарел. Запусти подбор заново: /start');
  await sendCard(ctx, movie, idx);
});

bot.callbackQuery('back_to_list', async (ctx) => {
  await ctx.answerCallbackQuery();
  const s = getSession(ctx.from.id);
  if (!s.lastResults.length) return ctx.reply('Список пуст. Жми /start');
  await ctx.reply('⬅️ К списку:', {
    reply_markup: moviesKeyboard(s.lastResults),
  });
});

bot.callbackQuery('more_like_this', async (ctx) => {
  await ctx.answerCallbackQuery();
  const s = getSession(ctx.from.id);
  if (!s.mood) return ctx.reply('Сначала собери параметры: /start');
  await ctx.reply('🔁 Ищу ещё...');
  await runSearch(ctx, s);
});

bot.callbackQuery(/^fav:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const movieId = parseInt(ctx.match[1]);
  const s = getSession(ctx.from.id);

  // Найдём фильм в последних результатах
  const movie = s.lastResults.find((m) => m.id === movieId);
  if (!movie) return;

  const added = store.toggleFavorite(ctx.from.id, movie);
  await ctx.answerCallbackQuery({
    text: added ? '⭐ Добавлено в избранное' : 'Убрано из избранного',
    show_alert: false,
  });
});

bot.callbackQuery(/^rate:(\d+):(like|dislike)$/, async (ctx) => {
  const movieId = parseInt(ctx.match[1]);
  const kind = ctx.match[2];
  const s = getSession(ctx.from.id);
  const movie = s.lastResults.find((m) => m.id === movieId);
  if (movie) store.rateMovie(ctx.from.id, movie, kind === 'like');
  await ctx.answerCallbackQuery({
    text: kind === 'like' ? '👍 Учту!' : '👎 Понял, больше не предложу',
  });
});

// ============ ЗАПУСК ============
process.on('unhandledRejection', (e) => console.error('Unhandled:', e));

bot.catch((err) => {
  console.error('Bot error:', err);
});

bot.start({
  onStart: (info) => {
    console.log(`✅ Бот запущен: @${info.username}`);
    console.log(`   Нажми /start в Telegram, чтобы проверить.`);
  },
});
