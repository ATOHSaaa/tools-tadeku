import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  amazonUrlFromAsin,
  enrichBooksWithCreatorsApi,
  fallbackCoverUrl,
} from './lib/amazon-creators-api.mjs';
import { resolveAsins } from './lib/book-asin-resolve.mjs';
import { enrichBooksWithSynopsis } from './lib/book-synopsis.mjs';
import {
  buildBookRecord,
  fetchHontaiWikitext,
  inferDims,
  parseHontaiNominees,
} from './lib/hontai-wikipedia.mjs';
import { QUESTIONS } from './hajimete-hon-questions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outPath = path.join(root, 'shared/hajimete-hon-data.js');
const cachePath = path.join(__dirname, 'hajimete-hon-asin-cache.json');
const synopsisCachePath = path.join(__dirname, 'hajimete-hon-synopsis-cache.json');
const envPath = path.join(__dirname, '.env');
const DIMENSIONS = ['easy', 'fun', 'deep', 'pace', 'short', 'real'];

function loadEnvFile() {
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return out;
}

function mergeEnv() {
  const fileEnv = loadEnvFile();
  return {
    credentialId: process.env.AMAZON_CREATORS_CREDENTIAL_ID || fileEnv.AMAZON_CREATORS_CREDENTIAL_ID,
    credentialSecret: process.env.AMAZON_CREATORS_CREDENTIAL_SECRET || fileEnv.AMAZON_CREATORS_CREDENTIAL_SECRET,
    partnerTag: process.env.AMAZON_ASSOCIATE_TAG || fileEnv.AMAZON_ASSOCIATE_TAG || 'hajimete-hon-22',
  };
}

function applyFallback(books, partnerTag, searchMetaById = {}) {
  return books.map((book) => {
    const productId = book.asin;
    const meta = searchMetaById[book.id];
    return {
      ...book,
      coverUrl: meta?.coverUrl || (productId ? fallbackCoverUrl(productId) : ''),
      amazonUrl: meta?.amazonUrl || (productId ? amazonUrlFromAsin(productId, partnerTag) : ''),
    };
  });
}

function dedupeIds(books) {
  const counts = new Map();
  return books.map((book) => {
    const base = book.id;
    const n = counts.get(base) || 0;
    counts.set(base, n + 1);
    if (n === 0) return book;
    return { ...book, id: `${base}-${n}` };
  });
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const useOpenLibrary = args.has('--with-openlibrary');
  const skipAsinRemote = args.has('--fast');
  const skipSynopsis = args.has('--skip-synopsis');
  const { credentialId, credentialSecret, partnerTag } = mergeEnv();
  const hasCreators = Boolean(credentialId && credentialSecret);

  console.log('Fetching 本屋大賞 nominee list from Wikipedia…');
  const wikitext = await fetchHontaiWikitext();
  const nominees = parseHontaiNominees(wikitext);
  let books = dedupeIds(nominees.map(buildBookRecord));
  console.log(`Parsed ${books.length} unique 本屋大賞 works (${nominees.filter((n) => n.won).length} winners in source).`);

  console.log('Resolving ASIN / ISBN…');
  const resolveResult = await resolveAsins(books, {
    root,
    cachePath,
    useBooklog: !skipAsinRemote,
    useOpenLibrary: useOpenLibrary && !skipAsinRemote,
    useGoogleBooks: false,
    useCreatorsSearch: hasCreators && !skipAsinRemote,
    creatorsOptions: hasCreators ? {
      credentialId,
      credentialSecret,
      partnerTag,
    } : null,
    delayMs: skipAsinRemote ? 0 : 250,
  });
  books = resolveResult.books;
  const { stats, searchMetaById } = resolveResult;
  console.log(`Product IDs: ${stats.withAsin}/${books.length} (cache ${stats.fromCache}, readtype ${stats.fromReadtype}, booklog ${stats.fromBooklog}, openlibrary ${stats.fromOpenLibrary}, creators-search ${stats.fromCreators})`);

  let catalogSource = 'fallback';
  const withAsin = books.filter((b) => b.asin);
  const withoutAsin = books.filter((b) => !b.asin);

  if (hasCreators && withAsin.length) {
    console.log('Fetching cover images and purchase links via Creators API getItems…');
    try {
      const enriched = await enrichBooksWithCreatorsApi(withAsin, {
        credentialId,
        credentialSecret,
        partnerTag,
      });
      books = [
        ...enriched,
        ...applyFallback(withoutAsin, partnerTag, searchMetaById),
      ];
      catalogSource = 'creators-api';
      console.log('Creators API getItems complete.');
    } catch (err) {
      console.warn('Creators API getItems failed, using fallback URLs:', err.message);
      books = applyFallback(books, partnerTag, searchMetaById);
    }
  } else {
    if (!hasCreators) {
      console.warn('No Creators API credentials — using fallback image/link URLs.');
    }
    books = applyFallback(books, partnerTag, searchMetaById);
  }

  const withCover = books.filter((b) => b.coverUrl).length;
  const withAmazon = books.filter((b) => b.amazonUrl).length;

  let synopsisStats = { fromCache: 0, fetched: 0, withSynopsis: 0, failed: 0 };
  if (!skipSynopsis) {
    console.log('Fetching book synopsis from Wikipedia…');
    const synopsisResult = await enrichBooksWithSynopsis(books, {
      cachePath: synopsisCachePath,
      skipRemote: false,
      delayMs: 280,
    });
    books = synopsisResult.books;
    synopsisStats = synopsisResult.stats;
    console.log(`Synopsis: ${synopsisStats.withSynopsis}/${books.length} (cache ${synopsisStats.fromCache}, fetched ${synopsisStats.fetched}, failed ${synopsisStats.failed})`);
  } else {
    books = books.map((book) => ({ ...book, synopsis: book.synopsis || '' }));
  }

  const withSynopsis = books.filter((b) => b.synopsis).length;

  books = books.map((book) => ({
    ...book,
    dims: inferDims(book.name, book.hontai, book.author, book.synopsis || ''),
  }));

  const output = `/* generated by scripts/build-hajimete-hon-data.mjs — do not edit by hand */
(function () {
  const DIMENSIONS = ${JSON.stringify(DIMENSIONS, null, 2)};

  const BOOKS = ${JSON.stringify(books, null, 2)};

  const QUESTIONS = ${JSON.stringify(QUESTIONS, null, 2)};

  window.HajimeteHonData = {
    DIMENSIONS,
    BOOKS,
    QUESTIONS,
    meta: {
      generatedAt: '${new Date().toISOString()}',
      catalogSource: '${catalogSource}',
      partnerTag: '${partnerTag}',
      catalog: 'hontai-nominees-all',
      bookCount: ${books.length},
      asinResolved: ${stats.withAsin},
      withCover: ${withCover},
      withAmazon: ${withAmazon},
      withSynopsis: ${withSynopsis},
    },
  };
})();
`;

  fs.writeFileSync(outPath, output, 'utf8');
  console.log(`Wrote ${books.length} books to ${outPath} (cover ${withCover}, amazon ${withAmazon}, synopsis ${withSynopsis})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
