// Progressive enhancement: only offscreen targets are prepared after boot.
// Content stays available without JS, on anchor/focus and with reduced motion.
(() => {
  if (!('IntersectionObserver' in window)) return;

  const selector = '.service, .work-grid > .work, .bot-case, .rag-section, .founder-section, .process-step, .plan, .section-heading';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const seen = new WeakSet();
  const pending = new Set();
  const running = new Map();
  let observer;

  function boot() {
    // A section and a child heading must not receive two nested animations.
    const targets = [...document.querySelectorAll(selector)].filter(node =>
      !node.closest('#top, .hero, #earth-stage') && !node.parentElement?.closest(selector)
    );

    function settle(node) {
      seen.add(node);
      observer?.unobserve(node);
      pending.delete(node);
      node.classList.remove('reveal-pending');
      const animation = running.get(node);
      if (!animation) return;
      clearTimeout(animation.timer);
      node.removeEventListener('animationend', animation.finish);
      node.removeEventListener('animationcancel', animation.finish);
      node.classList.remove('reveal-enter');
      node.style.removeProperty('--reveal-delay');
      running.delete(node);
    }

    function reveal(node, delay) {
      if (seen.has(node)) return;
      seen.add(node);
      observer.unobserve(node);
      pending.delete(node);
      node.classList.remove('reveal-pending');
      if (motion.matches || document.hidden || node.contains(document.activeElement)) return;

      const finish = event => {
        if (!event || (event.target === node && event.animationName === 'virentora-enter')) settle(node);
      };
      const timer = setTimeout(() => settle(node), 850 + delay);
      running.set(node, { finish, timer });
      node.addEventListener('animationend', finish);
      node.addEventListener('animationcancel', finish);
      node.style.setProperty('--reveal-delay', `${delay}ms`);
      node.classList.add('reveal-enter');
    }

    function onEntries(entries) {
      const groups = new Map();
      const viewport = document.documentElement.clientHeight;
      for (const entry of entries) {
        if (!entry.isIntersecting || seen.has(entry.target)) continue;
        // Begin 48 px inside the screen, so a slow scroll still shows the lift.
        // A large jump deep into the viewport should reveal content immediately.
        if (motion.matches || document.hidden || entry.boundingClientRect.top < viewport * .4) {
          settle(entry.target);
          continue;
        }
        const parent = entry.target.parentElement;
        if (!groups.has(parent)) groups.set(parent, []);
        groups.get(parent).push(entry);
      }
      for (const group of groups.values()) {
        group.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
        let rowTop = -Infinity, column = 0;
        for (const entry of group) {
          if (Math.abs(entry.boundingClientRect.top - rowTop) > 12) {
            rowTop = entry.boundingClientRect.top;
            column = 0;
          }
          reveal(entry.target, Math.min(column++, 2) * 60);
        }
      }
    }

    try {
      observer = new IntersectionObserver(onEntries, { rootMargin: '0px 0px -48px 0px', threshold: 0 });
    } catch {
      return;
    }

    function refresh() {
      observer.disconnect();
      for (const node of [...running.keys()]) settle(node);
      for (const node of pending) node.classList.remove('reveal-pending');
      pending.clear();
      if (motion.matches || document.hidden) return;
      const viewport = document.documentElement.clientHeight;
      const positions = targets.filter(node => !seen.has(node)).map(node => ({ node, top: node.getBoundingClientRect().top }));
      for (const { node, top } of positions) {
        // Includes blocks above the viewport after restoring scroll position.
        if (top < viewport) settle(node);
        else {
          pending.add(node);
          node.classList.add('reveal-pending');
          observer.observe(node);
        }
      }
    }

    function settleTarget(target, includeChildren = true) {
      if (!target) return;
      for (const node of targets) {
        if (node === target || node.contains(target) || (includeChildren && target.contains(node))) settle(node);
      }
    }

    function hashTarget(hash) {
      if (!hash || hash === '#') return null;
      try { return document.getElementById(decodeURIComponent(hash.slice(1))); }
      catch { return null; }
    }

    // Restoring focus to body must not mark every offscreen card as visited.
    document.addEventListener('focusin', event => settleTarget(event.target, false));
    // Do this before the browser starts native/smooth anchor scrolling.
    document.addEventListener('click', event => {
      const link = event.target.closest?.('a[href]');
      if (!link || (link.target && link.target !== '_self') || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      let url;
      try { url = new URL(link.href, location.href); } catch { return; }
      if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search) {
        settleTarget(hashTarget(url.hash));
      }
    }, true);
    addEventListener('hashchange', () => settleTarget(hashTarget(location.hash)));
    addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);
    motion.addEventListener('change', refresh);
    settleTarget(hashTarget(location.hash));
    refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
