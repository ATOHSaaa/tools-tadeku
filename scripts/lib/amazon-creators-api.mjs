const TOKEN_URL = 'https://api.amazon.co.jp/auth/o2/token';
const API_GET_ITEMS = 'https://creatorsapi.amazon/catalog/v1/getItems';
const API_SEARCH_ITEMS = 'https://creatorsapi.amazon/catalog/v1/searchItems';
const MARKETPLACE = 'www.amazon.co.jp';

let cachedToken = null;

export function amazonUrlFromAsin(asin, partnerTag) {
  if (!asin) return '';
  const url = new URL(`https://www.amazon.co.jp/dp/${asin}`);
  if (partnerTag) url.searchParams.set('tag', partnerTag);
  return url.toString();
}

export function fallbackCoverUrl(asin) {
  if (!asin) return '';
  return `https://images-fe.ssl-images-amazon.com/images/P/${asin}.09._SL300_.jpg`;
}

function pickImageUrl(images) {
  if (!images) return '';
  const primary = images.primary || images.Primary;
  if (!primary) return '';
  return (
    primary.large?.url
    || primary.Large?.URL
    || primary.medium?.url
    || primary.Medium?.URL
    || primary.small?.url
    || primary.Small?.URL
    || ''
  );
}

function pickDetailPageUrl(item) {
  return (
    item.detailPageURL
    || item.detailPageUrl
    || item.detailPageInfo?.detailPageURL
    || item.detailPageInfo?.detailPageUrl
    || ''
  );
}

export async function getAccessToken(credentialId, credentialSecret) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: credentialId,
      client_secret: credentialSecret,
      scope: 'creatorsapi::default',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Creators API token failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in || 3600) - 60) * 1000,
  };
  return cachedToken.token;
}

export async function getItemsByAsin(asins, options) {
  const {
    credentialId,
    credentialSecret,
    partnerTag,
    marketplace = MARKETPLACE,
  } = options;

  const token = await getAccessToken(credentialId, credentialSecret);
  const res = await fetch(API_GET_ITEMS, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-marketplace': marketplace,
    },
    body: JSON.stringify({
      itemIds: asins,
      itemIdType: 'ASIN',
      marketplace,
      partnerTag,
      partnerType: 'Associates',
      resources: [
        'images.primary.large',
        'images.primary.medium',
        'detailPageURL',
        'itemInfo.title',
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Creators API getItems failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const items = data.itemsResult?.items || data.ItemsResult?.Items || [];
  const map = new Map();

  for (const item of items) {
    const asin = item.asin || item.ASIN;
    if (!asin) continue;
    const coverUrl = pickImageUrl(item.images || item.Images);
    const detailUrl = pickDetailPageUrl(item);
    map.set(asin, {
      asin,
      coverUrl,
      amazonUrl: detailUrl || amazonUrlFromAsin(asin, partnerTag),
    });
  }

  return map;
}

export async function searchItemByKeywords(keywords, options) {
  const {
    credentialId,
    credentialSecret,
    partnerTag,
    marketplace = MARKETPLACE,
  } = options;

  const token = await getAccessToken(credentialId, credentialSecret);
  const res = await fetch(API_SEARCH_ITEMS, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-marketplace': marketplace,
    },
    body: JSON.stringify({
      keywords,
      searchIndex: 'Books',
      itemCount: 3,
      marketplace,
      partnerTag,
      partnerType: 'Associates',
      resources: [
        'images.primary.medium',
        'itemInfo.title',
        'itemInfo.byLineInfo',
        'detailPageURL',
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Creators API searchItems failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const items = data.searchResult?.items || data.itemsResult?.items || [];
  if (!items.length) return null;

  const item = items[0];
  const asin = item.asin || item.ASIN;
  if (!asin) return null;

  return {
    asin,
    coverUrl: pickImageUrl(item.images || item.Images),
    amazonUrl: pickDetailPageUrl(item) || amazonUrlFromAsin(asin, partnerTag),
    title: item.itemInfo?.title?.displayValue || item.itemInfo?.Title?.DisplayValue || '',
  };
}

export async function enrichBooksWithCreatorsApi(books, options) {
  const asins = [...new Set(books.map((b) => b.asin).filter(Boolean))];
  const result = new Map();

  for (let i = 0; i < asins.length; i += 10) {
    const chunk = asins.slice(i, i + 10);
    const chunkMap = await getItemsByAsin(chunk, options);
    for (const [asin, meta] of chunkMap) {
      result.set(asin, meta);
    }
    if (i + 10 < asins.length) {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  return books.map((book) => {
    const meta = result.get(book.asin);
    const amazonUrl = meta?.amazonUrl || amazonUrlFromAsin(book.asin, options.partnerTag);
    const coverUrl = meta?.coverUrl || fallbackCoverUrl(book.asin);
    return { ...book, coverUrl, amazonUrl };
  });
}
