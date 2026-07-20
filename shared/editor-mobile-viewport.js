(function (global) {
  const DEFAULT_BREAKPOINT = '(max-width: 640px)';

  function resolveRoot(root) {
    if (!root) return null;
    if (typeof root === 'string') return document.querySelector(root);
    return root;
  }

  function createBinding(options) {
    const rootSelector = options?.root || '.layout';
    let root = resolveRoot(rootSelector);

    const breakpoint = options?.breakpoint || DEFAULT_BREAKPOINT;
    const isActive = typeof options?.isActive === 'function' ? options.isActive : () => true;
    const mobileMq = global.matchMedia(breakpoint);
    let bound = false;

    function getRoot() {
      if (!root || !root.isConnected) {
        root = resolveRoot(rootSelector);
      }
      return root;
    }

    function reset() {
      const el = getRoot();
      if (!el) return;
      el.style.height = '';
      el.style.transform = '';
    }

    function sync() {
      const el = getRoot();
      if (!el) return;
      if (!isActive()) {
        reset();
        return;
      }
      if (!mobileMq.matches) {
        reset();
        return;
      }
      const vv = global.visualViewport;
      if (!vv) return;

      const layoutHeight = global.innerHeight;
      const viewportHeight = Math.round(vv.height);
      const offsetTop = Math.round(vv.offsetTop);
      const keyboardOpen = viewportHeight < layoutHeight - 64;

      if (keyboardOpen) {
        el.style.height = `${viewportHeight}px`;
        el.style.transform = offsetTop > 0 ? `translateY(${offsetTop}px)` : '';
      } else {
        reset();
      }
    }

    function bind() {
      if (bound || !global.visualViewport) return;
      bound = true;
      const onChange = () => sync();
      global.visualViewport.addEventListener('resize', onChange);
      global.visualViewport.addEventListener('scroll', onChange);
      global.addEventListener('orientationchange', onChange);
      mobileMq.addEventListener('change', onChange);
      onChange();
    }

    return { bind, sync, reset, getRoot };
  }

  const bindings = new Map();

  function bind(options) {
    const key = options?.id || (typeof options?.root === 'string' ? options.root : 'default');
    let binding = bindings.get(key);
    if (!binding) {
      binding = createBinding(options);
      bindings.set(key, binding);
    }
    binding.bind();
    return binding;
  }

  global.TadekuEditorMobileViewport = { bind, createBinding };
})(typeof window !== 'undefined' ? window : globalThis);
