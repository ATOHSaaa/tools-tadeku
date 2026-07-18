(function () {
  const STORAGE_PREFIX = 'tadeku-tool-favorites:';
  const DRAG_THRESHOLD = 6;

  function storageKey() {
    return STORAGE_PREFIX + location.pathname;
  }

  function loadFavorites() {
    try {
      const raw = localStorage.getItem(storageKey());
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function saveFavorites(favorites) {
    localStorage.setItem(storageKey(), JSON.stringify(favorites));
  }

  function createHeartButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tool-favorite-btn';
    btn.setAttribute('aria-label', 'お気に入りに追加');
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path class="heart-path" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>' +
      '</svg>';
    return btn;
  }

  function createFavoritesSection() {
    const section = document.createElement('section');
    section.className = 'category tool-favorites-section';
    section.innerHTML =
      '<h2 class="category-title">お気に入り</h2>' +
      '<div class="grid tool-favorites-grid"></div>';
    return section;
  }

  function openToolLink(link) {
    if (!link) return;
    if (link.target === '_blank') {
      window.open(link.href, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = link.href;
    }
  }

  function createFavoriteWrap(id, source, onToggle) {
    const wrap = document.createElement('div');
    wrap.className = 'item-wrap favorites-item-wrap';
    wrap.dataset.toolId = id;

    const link = source.cloneNode(true);
    link.draggable = false;
    link.setAttribute('draggable', 'false');
    wrap.appendChild(link);

    const btn = createHeartButton();
    btn.classList.add('is-favorite');
    btn.setAttribute('aria-pressed', 'true');
    btn.setAttribute('aria-label', 'お気に入りから外す');
    wrap.appendChild(btn);

    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onToggle(id);
    });

    return wrap;
  }

  function clearDragStyles(wrap) {
    wrap.style.position = '';
    wrap.style.left = '';
    wrap.style.top = '';
    wrap.style.width = '';
    wrap.style.height = '';
    wrap.style.zIndex = '';
    wrap.style.margin = '';
    wrap.style.transition = '';
    wrap.style.transform = '';
    wrap.style.pointerEvents = '';
    wrap.style.boxShadow = '';
  }

  function flipReorder(grid, mutate) {
    const nodes = [...grid.querySelectorAll('.favorites-item-wrap:not(.is-dragging)')];
    const first = new Map(nodes.map((node) => [node, node.getBoundingClientRect()]));

    mutate();

    nodes.forEach((node) => {
      const prev = first.get(node);
      if (!prev) return;
      const next = node.getBoundingClientRect();
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (!dx && !dy) return;

      node.style.transition = 'none';
      node.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          node.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)';
          node.style.transform = '';
        });
      });
    });
  }

  function reorderPlaceholder(grid, placeholder, probeX, probeY, prevProbeY) {
    const draggingDown = prevProbeY == null || probeY >= prevProbeY;
    const ratio = draggingDown ? 0.3 : 0.7;
    const others = [...grid.querySelectorAll('.favorites-item-wrap:not(.is-dragging)')];

    let next = null;
    for (const other of others) {
      const rect = other.getBoundingClientRect();
      const inSameRow = probeY >= rect.top - 8 && probeY <= rect.bottom + 8;

      if (inSameRow) {
        if (probeX < rect.left + rect.width * 0.5) {
          next = other;
          break;
        }
        continue;
      }

      if (probeY < rect.top + rect.height * ratio) {
        next = other;
        break;
      }
    }

    const wouldMove = next
      ? placeholder.nextElementSibling !== next
      : grid.lastElementChild !== placeholder;
    if (!wouldMove) return;

    flipReorder(grid, () => {
      if (next) grid.insertBefore(placeholder, next);
      else grid.appendChild(placeholder);
    });
  }

  function setupFavoritesGridDrag(grid, getFavorites, setFavorites, save) {
    function orderFromDom() {
      return [...grid.querySelectorAll('.favorites-item-wrap')].map(
        (wrap) => wrap.dataset.toolId
      );
    }

    function startPointerDrag(event, wrap) {
      if (event.button != null && event.button > 0) return;
      if (event.target.closest('.tool-favorite-btn')) return;

      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      let started = false;
      let placeholder = null;
      let lastProbeY = null;
      let offsetX = 0;
      let offsetY = 0;

      const onMove = (ev) => {
        if (ev.pointerId !== pointerId) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        if (!started) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
          started = true;
          if (ev.cancelable) ev.preventDefault();

          const rect = wrap.getBoundingClientRect();
          offsetX = startX - rect.left;
          offsetY = startY - rect.top;

          placeholder = document.createElement('div');
          placeholder.className = 'favorites-drop-placeholder';
          placeholder.setAttribute('aria-hidden', 'true');
          placeholder.style.minHeight = `${rect.height}px`;
          grid.insertBefore(placeholder, wrap);

          wrap.classList.add('is-dragging');
          grid.classList.add('is-sorting');
          wrap.style.position = 'fixed';
          wrap.style.left = `${rect.left}px`;
          wrap.style.top = `${rect.top}px`;
          wrap.style.width = `${rect.width}px`;
          wrap.style.height = `${rect.height}px`;
          wrap.style.zIndex = '100';
          wrap.style.margin = '0';
          wrap.style.transition = 'none';
          wrap.style.transform = 'scale(1.02)';
          wrap.style.pointerEvents = 'none';
          wrap.style.boxShadow = '0 14px 32px rgba(26, 26, 26, 0.16)';

          try {
            wrap.setPointerCapture(pointerId);
          } catch {
            /* ignore */
          }
        }

        if (ev.cancelable) ev.preventDefault();

        const left = ev.clientX - offsetX;
        const top = ev.clientY - offsetY;
        wrap.style.left = `${left}px`;
        wrap.style.top = `${top}px`;

        const probeX = left + wrap.offsetWidth * 0.5;
        const probeY = top + wrap.offsetHeight * 0.5;
        reorderPlaceholder(grid, placeholder, probeX, probeY, lastProbeY);
        lastProbeY = probeY;
      };

      const finish = (ev) => {
        if (ev && ev.pointerId !== pointerId) return;

        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', finish);
        document.removeEventListener('pointercancel', finish);

        if (!started) {
          openToolLink(wrap.querySelector('a.item'));
          return;
        }

        if (!placeholder) return;

        const target = placeholder.getBoundingClientRect();
        let released = false;

        const release = () => {
          if (released) return;
          released = true;

          grid.insertBefore(wrap, placeholder);
          placeholder.remove();
          wrap.classList.remove('is-dragging');
          grid.classList.remove('is-sorting');
          clearDragStyles(wrap);

          const nextOrder = orderFromDom();
          const favorites = getFavorites();
          if (nextOrder.join('|') !== favorites.join('|')) {
            setFavorites(nextOrder);
            save(nextOrder);
          }
        };

        wrap.style.transition =
          'top 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), left 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.2s ease, box-shadow 0.2s ease';
        wrap.style.left = `${target.left}px`;
        wrap.style.top = `${target.top}px`;
        wrap.style.transform = 'scale(1)';
        wrap.style.boxShadow = 'none';
        wrap.addEventListener('transitionend', release, { once: true });
        setTimeout(release, 220);
      };

      document.addEventListener('pointermove', onMove, { passive: false });
      document.addEventListener('pointerup', finish);
      document.addEventListener('pointercancel', finish);
    }

    return function bindFavoriteWrapDrag(wrap) {
      wrap.addEventListener('pointerdown', (event) => {
        startPointerDrag(event, wrap);
      });
    };
  }

  function init() {
    const nav = document.querySelector('nav[aria-label="ツール一覧"]');
    if (!nav) return;

    const registry = new Map();
    let favorites = loadFavorites();
    let favoritesSection = null;
    let bindFavoriteWrapDrag = null;

    nav.querySelectorAll('a.item').forEach((item) => {
      const id = item.getAttribute('href');
      if (!id) return;

      registry.set(id, item);

      const wrap = document.createElement('div');
      wrap.className = 'item-wrap';
      wrap.dataset.toolId = id;

      item.parentNode.insertBefore(wrap, item);
      wrap.appendChild(item);

      const btn = createHeartButton();
      wrap.appendChild(btn);

      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(id);
      });
    });

    favorites = favorites.filter((id) => registry.has(id));
    render();

    function toolName(id) {
      const item = registry.get(id);
      if (!item) return 'このツール';
      const title = item.querySelector('h3');
      return title ? title.textContent.trim() : 'このツール';
    }

    function toggleFavorite(id) {
      const index = favorites.indexOf(id);
      if (index >= 0) {
        if (!confirm(`「${toolName(id)}」をお気に入りから外しますか？`)) return;
        favorites.splice(index, 1);
      } else {
        favorites.push(id);
      }
      saveFavorites(favorites);
      render();
    }

    function updateHeartStates() {
      const favoriteSet = new Set(favorites);
      nav.querySelectorAll('.item-wrap[data-tool-id]').forEach((wrap) => {
        const btn = wrap.querySelector('.tool-favorite-btn');
        if (!btn) return;
        const isFavorite = favoriteSet.has(wrap.dataset.toolId);
        btn.classList.toggle('is-favorite', isFavorite);
        btn.setAttribute('aria-pressed', String(isFavorite));
        btn.setAttribute(
          'aria-label',
          isFavorite ? 'お気に入りから外す' : 'お気に入りに追加'
        );
      });
    }

    function render() {
      if (favorites.length === 0) {
        if (favoritesSection) {
          favoritesSection.remove();
          favoritesSection = null;
          bindFavoriteWrapDrag = null;
        }
        updateHeartStates();
        return;
      }

      if (!favoritesSection) {
        favoritesSection = createFavoritesSection();
        nav.insertBefore(favoritesSection, nav.querySelector('.category'));
      }

      const grid = favoritesSection.querySelector('.tool-favorites-grid');

      if (!bindFavoriteWrapDrag) {
        bindFavoriteWrapDrag = setupFavoritesGridDrag(
          grid,
          () => favorites,
          (next) => {
            favorites = next;
          },
          saveFavorites
        );
      }

      grid.replaceChildren();

      favorites.forEach((id) => {
        const source = registry.get(id);
        if (!source) return;
        const wrap = createFavoriteWrap(id, source, toggleFavorite);
        bindFavoriteWrapDrag(wrap);
        grid.appendChild(wrap);
      });

      updateHeartStates();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
