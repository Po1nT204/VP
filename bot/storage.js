import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, 'data.json');

let data = { users: {} };

function load() {
  try {
    if (fs.existsSync(FILE)) {
      data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Storage load error:', e.message);
  }
}
function save() {
  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Storage save error:', e.message);
  }
}
load();

function ensureUser(uid) {
  const key = String(uid);
  if (!data.users[key]) {
    data.users[key] = { favorites: [], history: [], likes: [], dislikes: [] };
    save();
  }
  return data.users[key];
}

function movieBrief(m) {
  return {
    id: m.id,
    title: m.title,
    year: (m.release_date || '').slice(0, 4) || '—',
    ts: Date.now(),
  };
}

export function addToHistory(uid, movie) {
  const u = ensureUser(uid);
  u.history = u.history.filter((h) => h.id !== movie.id);
  u.history.unshift(movieBrief(movie));
  if (u.history.length > 50) u.history.length = 50;
  save();
}

export function getHistory(uid) {
  return ensureUser(uid).history;
}

export function toggleFavorite(uid, movie) {
  const u = ensureUser(uid);
  const idx = u.favorites.findIndex((f) => f.id === movie.id);
  if (idx >= 0) {
    u.favorites.splice(idx, 1);
    save();
    return false;
  }
  u.favorites.unshift(movieBrief(movie));
  save();
  return true;
}

export function isFavorite(uid, id) {
  return ensureUser(uid).favorites.some((f) => f.id === id);
}

export function getFavorites(uid) {
  return ensureUser(uid).favorites;
}

export function rateMovie(uid, movie, liked) {
  const u = ensureUser(uid);
  if (liked) {
    if (!u.likes.includes(movie.id)) u.likes.push(movie.id);
    u.dislikes = u.dislikes.filter((x) => x !== movie.id);
  } else {
    if (!u.dislikes.includes(movie.id)) u.dislikes.push(movie.id);
    u.likes = u.likes.filter((x) => x !== movie.id);
  }
  save();
}

export function getRating(uid, id) {
  const u = ensureUser(uid);
  if (u.likes.includes(id)) return 'like';
  if (u.dislikes.includes(id)) return 'dislike';
  return null;
}
