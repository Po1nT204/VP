import https from 'node:https';
import dns from 'node:dns';
import { URL } from 'node:url';
import 'dotenv/config';

const TMDB_KEY = process.env.TMDB_KEY;
if (!TMDB_KEY) {
  console.error('❌ TMDB_KEY не задан. Создай .env файл с TMDB_KEY=...');
  process.exit(1);
}

// Реальные IP-адреса TMDB (получены через Cloudflare DoH в обход DNS-блокировки провайдера).
// Если TMDB перестанет отвечать — обнови их здесь:
// https://dns.google/query?name=api.themoviedb.org&type=A
const HOSTS_OVERRIDE = {
  'api.themoviedb.org': '65.9.130.126',
};

// Кастомный DNS-lookup: для TMDB — фиксированный IP, для всего остального — обычный DNS
function customLookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  const ip = HOSTS_OVERRIDE[hostname];
  if (ip) {
    return process.nextTick(() => {
      if (options && options.all) callback(null, [{ address: ip, family: 4 }]);
      else callback(null, ip, 4);
    });
  }
  return dns.lookup(hostname, options, callback);
}

export const IMG_BASE = 'https://image.tmdb.org/t/p/w500';
export const TMDB_SITE = 'https://www.themoviedb.org/movie';
const BASE = 'https://api.themoviedb.org/3';

// Обход fetch и undici — используем голый https.request с нашим lookup
function httpsGetJSON(urlStr) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'GET',
        lookup: customLookup,
        headers: { Accept: 'application/json' },
        timeout: 15000,
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(
              new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`),
            );
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid JSON: ' + data.slice(0, 200)));
          }
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('Request timeout')));
    req.on('error', reject);
    req.end();
  });
}

async function tmdb(path, params = {}) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('api_key', TMDB_KEY);
  url.searchParams.set('language', 'ru-RU');
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  return httpsGetJSON(url.toString());
}

export async function discoverMovies(opts) {
  const params = {
    sort_by: 'popularity.desc',
    include_adult: 'true',
    'vote_count.gte': 300,
    'vote_average.gte': 6,
    with_original_language: 'en|ru|fr|de|es|it|ja|ko|zh',
    page: opts.page || 1,
  };
  if (opts.genres && opts.genres.length)
    params.with_genres = opts.genres.join(',');
  if (opts.runtimeGte != null) params['with_runtime.gte'] = opts.runtimeGte;
  if (opts.runtimeLte != null) params['with_runtime.lte'] = opts.runtimeLte;
  if (opts.dateGte) params['primary_release_date.gte'] = opts.dateGte;
  if (opts.dateLte) params['primary_release_date.lte'] = opts.dateLte;
  return tmdb('/discover/movie', params);
}

export async function getMovieDetails(id) {
  return tmdb(`/movie/${id}`);
}

export async function getRandomPopular() {
  const page = 1 + Math.floor(Math.random() * 20);
  const data = await tmdb('/discover/movie', {
    sort_by: 'popularity.desc',
    'vote_count.gte': 200,
    'vote_average.gte': 6.5,
    page,
  });
  const list = data.results || [];
  if (list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}
