import fs from 'node:fs';

const UA = 'tadeku-tools/1.0 (https://tools.tadeku.net; hajimete-hon build)';

function normalizeTitle(title) {
  return String(title)
    .replace(/\s+/g, '')
    .replace(/[！!？?…・:：\-―ー「」『』（）()［］\[\]【】]/g, '')
    .toLowerCase();
}

function normalizeAuthor(author) {
  return String(author || '').replace(/\s+/g, '').replace(/　/g, '');
}

function cleanWikiText(raw) {
  return String(raw || '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/''+/g, '')
    .replace(/^[:：]\s*/gm, '')
    .replace(/^===+\s*.+\s*===+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function trimSynopsis(text, maxLen = 420) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= maxLen) return trimmed;
  const cut = trimmed.slice(0, maxLen);
  const lastPeriod = cut.lastIndexOf('。');
  if (lastPeriod > maxLen * 0.45) return cut.slice(0, lastPeriod + 1);
  return cut + '…';
}

export function loadSynopsisCache(cachePath) {
  if (!fs.existsSync(cachePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {
    return {};
  }
}

export function saveSynopsisCache(cachePath, cache) {
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2) + '\n', 'utf8');
}

async function wikiApi(params) {
  const url = new URL('https://ja.wikipedia.org/w/api.php');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Wikipedia API failed: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.info || data.error.code);
  return data;
}

async function searchPages(queries) {
  const seen = new Map();
  for (const query of queries) {
    const data = await wikiApi({
      action: 'query',
      list: 'search',
      srsearch: query,
      format: 'json',
      srlimit: '5',
    });
    for (const hit of data.query?.search || []) {
      if (!seen.has(hit.pageid)) seen.set(hit.pageid, hit);
    }
  }
  return [...seen.values()];
}

function scoreHit(hit, title, author) {
  const titleNorm = normalizeTitle(title);
  const hitNorm = normalizeTitle(hit.title);
  const authorNorm = normalizeAuthor(author);
  const hitAuthorNorm = normalizeAuthor(hit.title);
  const core = titleNorm.slice(0, Math.min(8, titleNorm.length));

  if (hitNorm === titleNorm) return 100;
  if (hitNorm.includes(titleNorm) || titleNorm.includes(hitNorm)) return 90;
  if (core.length >= 4 && hitNorm.includes(core)) return 75;
  if (hitAuthorNorm === authorNorm || (authorNorm.length >= 4 && hitAuthorNorm.includes(authorNorm) && !hitNorm.includes(core))) {
    return 15;
  }
  return 35;
}

async function fetchPageWikitext(pageTitle) {
  const data = await wikiApi({
    action: 'parse',
    page: pageTitle,
    prop: 'wikitext',
    format: 'json',
  });
  return data.parse?.wikitext?.['*'] || '';
}

async function fetchPageExtract(pageTitle) {
  const data = await wikiApi({
    action: 'query',
    prop: 'extracts',
    exintro: '1',
    explaintext: '1',
    titles: pageTitle,
    format: 'json',
  });
  const pages = data.query?.pages || {};
  return Object.values(pages)[0]?.extract || '';
}

async function extractSynopsisFromPage(pageTitle) {
  const wikitext = await fetchPageWikitext(pageTitle);
  const section = wikitext.match(/==\s*あらすじ\s*==\s*([\s\S]*?)(?=\n==[^=])/)
    || wikitext.match(/==\s*ストーリー\s*==\s*([\s\S]*?)(?=\n==[^=])/)
    || wikitext.match(/==\s*プロット\s*==\s*([\s\S]*?)(?=\n==[^=])/);
  if (section) return cleanWikiText(section[1]);
  return cleanWikiText(await fetchPageExtract(pageTitle));
}

export async function resolveSynopsis(book) {
  const queries = [
    book.name,
    `${book.name} 小説`,
    `${book.name} ${book.author}`,
  ];
  const hits = await searchPages(queries);
  if (!hits.length) return { synopsis: '', page: '' };

  hits.sort((a, b) => scoreHit(b, book.name, book.author) - scoreHit(a, book.name, book.author));
  const best = hits[0];
  const bestScore = scoreHit(best, book.name, book.author);
  if (bestScore < 50) return { synopsis: '', page: '' };

  const synopsis = trimSynopsis(await extractSynopsisFromPage(best.title));
  return { synopsis, page: best.title };
}

export async function enrichBooksWithSynopsis(books, options = {}) {
  const {
    cachePath,
    skipRemote = false,
    delayMs = 280,
  } = options;

  const cache = loadSynopsisCache(cachePath);
  const stats = {
    fromCache: 0,
    fetched: 0,
    withSynopsis: 0,
    failed: 0,
  };

  const result = [];
  for (const book of books) {
    const cached = cache[book.id];
    if (cached) {
      stats.fromCache += 1;
      if (cached.synopsis) stats.withSynopsis += 1;
      result.push({ ...book, synopsis: cached.synopsis || '' });
      continue;
    }

    if (skipRemote) {
      result.push({ ...book, synopsis: '' });
      continue;
    }

    try {
      const { synopsis, page } = await resolveSynopsis(book);
      cache[book.id] = {
        synopsis,
        page,
        fetchedAt: new Date().toISOString(),
      };
      stats.fetched += 1;
      if (synopsis) stats.withSynopsis += 1;
      result.push({ ...book, synopsis });
      saveSynopsisCache(cachePath, cache);
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch {
      stats.failed += 1;
      cache[book.id] = { synopsis: '', page: '', fetchedAt: new Date().toISOString() };
      saveSynopsisCache(cachePath, cache);
      result.push({ ...book, synopsis: '' });
    }
  }

  return { books: result, stats };
}
