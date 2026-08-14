import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchItemByKeywords } from './amazon-creators-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizeTitle(title) {
  return String(title)
    .replace(/\s+/g, '')
    .replace(/[！!？?…・:：\-―ー「」『』（）()［］\[\]【】]/g, '')
    .toLowerCase();
}

export function isbn13ToIsbn10(isbn13) {
  if (!/^\d{13}$/.test(isbn13) || !isbn13.startsWith('978')) return '';
  const core = isbn13.slice(3, 12);
  if (!/^\d{9}$/.test(core)) return '';
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(core[i]) * (10 - i);
  }
  const check = (11 - (sum % 11)) % 11;
  const checkChar = check === 10 ? 'X' : String(check);
  return core + checkChar;
}

export function normalizeProductId(raw) {
  const id = String(raw || '').replace(/[^0-9X]/gi, '').toUpperCase();
  if (/^[A-Z0-9]{10}$/.test(id)) return id;
  if (/^\d{13}$/.test(id)) return id;
  return '';
}

export function loadAsinCache(cachePath) {
  if (!fs.existsSync(cachePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {
    return {};
  }
}

export function saveAsinCache(cachePath, cache) {
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2) + '\n', 'utf8');
}

export function loadReadtypeAsinIndex(root) {
  const file = path.join(root, 'shared/readtype-rec-books.js');
  const content = fs.readFileSync(file, 'utf8');
  const index = new Map();
  const re = /asin:\s*'([^']+)', title:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(content))) {
    index.set(normalizeTitle(m[2]), m[1]);
  }
  return index;
}

export function matchAsinFromIndex(title, index) {
  const norm = normalizeTitle(title);
  if (index.has(norm)) return index.get(norm);
  for (const [key, asin] of index) {
    if (key.includes(norm) || norm.includes(key)) return asin;
  }
  return '';
}

export async function lookupAsinViaBooklog(title) {
  const q = encodeURIComponent(title);
  const url = `https://booklog.jp/search?display=book&keyword=${q}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'tadeku-tools/1.0 (hajimete-hon build)',
      Accept: 'text/html',
    },
    redirect: 'follow',
  });
  if (!res.ok) return '';

  const html = await res.text();
  const want = normalizeTitle(title);
  const wantCore = want.slice(0, Math.min(8, want.length));
  const titleMatches = [...html.matchAll(/class="title">([^<]+)/g)].map((m) => m[1].trim());
  const asinMatches = [...html.matchAll(/\/item\/1\/(\d{10,13})/g)].map((m) => m[1]);

  for (let i = 0; i < titleMatches.length; i += 1) {
    const got = normalizeTitle(titleMatches[i]);
    if (!got.includes(wantCore) && !want.includes(got.slice(0, 8))) continue;
    const asin = asinMatches[i] || asinMatches[0];
    if (asin) return asin;
  }

  return asinMatches[0] || '';
}

async function lookupViaGoogleBooks(title, author) {
  const q = encodeURIComponent(`intitle:${title} inauthor:${author}`);
  const url = `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=5&country=JP`;
  const res = await fetch(url, { headers: { 'User-Agent': 'tadeku-tools/1.0' } });
  if (!res.ok) return '';
  const data = await res.json();
  const want = normalizeTitle(title).slice(0, 8);
  for (const item of data.items || []) {
    const info = item.volumeInfo || {};
    const got = normalizeTitle(info.title || '');
    if (want.length >= 4 && !got.includes(want) && !want.includes(got.slice(0, 8))) continue;
    for (const id of info.industryIdentifiers || []) {
      const val = normalizeProductId(id.identifier);
      if (val) return val;
    }
  }
  return '';
}

export async function lookupAsinViaOpenLibrary(title, author) {
  const q = encodeURIComponent(`${title} ${author}`);
  const url = `https://openlibrary.org/search.json?q=${q}&limit=5&fields=isbn,title`;
  const res = await fetch(url, { headers: { 'User-Agent': 'tadeku-tools/1.0' } });
  if (!res.ok) return '';
  const data = await res.json();
  const want = normalizeTitle(title).slice(0, 8);
  for (const doc of data.docs || []) {
    const docTitle = normalizeTitle(doc.title || '');
    if (want.length >= 4 && !docTitle.includes(want) && !want.includes(docTitle.slice(0, 8))) continue;
    for (const raw of doc.isbn || []) {
      const isbn = normalizeProductId(raw);
      if (isbn) return isbn;
    }
  }
  return '';
}

async function lookupViaCreatorsSearch(book, creatorsOptions) {
  const keywords = `${book.name} ${book.author}`.replace(/\s+/g, ' ').trim();
  const hit = await searchItemByKeywords(keywords, creatorsOptions);
  if (!hit?.asin) return { asin: '', meta: null };
  return { asin: hit.asin, meta: hit };
}

export async function resolveAsins(books, options = {}) {
  const {
    root,
    cachePath,
    useOpenLibrary = false,
    useBooklog = true,
    useGoogleBooks = false,
    useCreatorsSearch = false,
    creatorsOptions = null,
    delayMs = 200,
  } = options;

  const index = loadReadtypeAsinIndex(root);
  const cache = loadAsinCache(cachePath);
  const resolved = [];
  let fromCache = 0;
  let fromReadtype = 0;
  let fromBooklog = 0;
  let fromGoogle = 0;
  let fromOpenLibrary = 0;
  let fromCreators = 0;

  for (const book of books) {
    let asin = normalizeProductId(book.asin);
    let searchMeta = null;

    if (!asin && cache[book.id]) {
      asin = normalizeProductId(cache[book.id]);
      if (asin) fromCache += 1;
    }
    if (!asin) {
      asin = normalizeProductId(matchAsinFromIndex(book.name, index));
      if (asin) fromReadtype += 1;
    }
    if (!asin && useBooklog) {
      asin = normalizeProductId(await lookupAsinViaBooklog(book.name));
      if (asin) fromBooklog += 1;
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    }
    if (!asin && useGoogleBooks) {
      asin = normalizeProductId(await lookupViaGoogleBooks(book.name, book.author));
      if (asin) fromGoogle += 1;
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    }
    if (!asin && useOpenLibrary) {
      asin = normalizeProductId(await lookupAsinViaOpenLibrary(book.name, book.author));
      if (asin) fromOpenLibrary += 1;
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    }
    if (!asin && useCreatorsSearch && creatorsOptions) {
      const hit = await lookupViaCreatorsSearch(book, creatorsOptions);
      asin = normalizeProductId(hit.asin);
      searchMeta = hit.meta;
      if (asin) fromCreators += 1;
      if (delayMs) await new Promise((r) => setTimeout(r, 800));
    }

    if (asin) cache[book.id] = asin;
    resolved.push({
      ...book,
      asin,
      _searchMeta: searchMeta,
    });
  }

  saveAsinCache(cachePath, cache);

  return {
    books: resolved.map(({ _searchMeta, ...book }) => book),
    stats: {
      fromCache,
      fromReadtype,
      fromBooklog,
      fromGoogle,
      fromOpenLibrary,
      fromCreators,
      withAsin: resolved.filter((b) => b.asin).length,
    },
    searchMetaById: Object.fromEntries(
      resolved.filter((b) => b._searchMeta).map((b) => [b.id, b._searchMeta]),
    ),
  };
}
