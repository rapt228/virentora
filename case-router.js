/* Progressive enhancement: the card's real HTML URL remains the fallback. */
(() => {
  const route = '#/projects/forma';
  const root = document.documentElement;
  if (location.hash === route) root.dataset.view = 'forma';
  document.addEventListener('DOMContentLoaded', () => {
    const home = document.querySelector('#home-main');
    const homeFooter = document.querySelector('body>footer');
    const host = document.querySelector('#case-route-host');
    const skip = document.querySelector('.skip-link');
    const fallback = host.firstElementChild;
    const physicalURL = new URL('projects/forma.html', document.baseURI);
    const previousScrollRestoration = history.scrollRestoration;
    const contacts = [...document.querySelectorAll('#hdr a[href^="https://t.me/"],#mm a[href^="https://t.me/"]')].map(link => ({ link, href: link.href }));
    let view, controller, pending, serial = 0, active = false, explicitReturn = false;
    let homeY = scrollY;
    const ordinary = event => event.button === 0 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
    const styles = () => new Promise((resolve, reject) => {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'projects/project.css?v=20261002-polish1';
      link.onload = resolve; link.onerror = () => { link.remove(); reject(new Error('Case styles unavailable')); };
      // Put shared styles before the case overrides already present in the head.
      document.head.insertBefore(link, document.querySelector('link[href^="projects/forma.css"]'));
    });
    async function loadView() {
      if (controller) return;
      if (!pending) pending = (async () => {
        const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 8000);
        try {
          const [response, module] = await Promise.all([fetch(physicalURL, { signal: abort.signal }), import('./projects/forma.js?v=20261003-forma1'), styles()]);
          if (!response.ok) throw new Error('Case document unavailable');
          // A template stays inert: parsing the case must not eagerly fetch its gallery.
          // The HTML is our own same-origin physical page, never external content.
          const template = document.createElement('template');
          template.innerHTML = await response.text();
          const source = template.content.querySelector('[data-forma-view]');
          if (!source?.querySelector('h1')) throw new Error('Invalid case document');
          source.querySelectorAll('[src],[href]').forEach(node => {
            for (const name of ['src', 'href']) if (node.hasAttribute(name)) node.setAttribute(name, new URL(node.getAttribute(name), physicalURL).href);
          });
          view = document.importNode(source, true);
          view.hidden = true; host.append(view);
          controller = module.initForma(view);
        } finally { clearTimeout(timer); }
      })().catch(error => { pending = null; throw error; });
      await pending;
    }
    function focus(node) {
      if (!node) return;
      if (!node.matches('a,button')) {
        node.tabIndex = -1;
        node.addEventListener('blur', () => node.removeAttribute('tabindex'), { once: true });
      }
      node.focus({ preventScroll: true });
    }
    function saveHome() {
      homeY = scrollY;
      const focused = document.activeElement?.closest('[data-forma-route]');
      history.replaceState({ ...history.state, virentoraHome: { y: homeY, focus: Boolean(focused) } }, '', location.href);
    }
    function showHomeAnchor() {
      let target;
      try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch {}
      const saved = history.state?.virentoraHome;
      if (!explicitReturn && saved) {
        window.scrollTo({ top: saved.y, behavior: 'instant' });
        if (saved.focus) focus(document.querySelector('[data-forma-route]'));
      } else if (target) { target.scrollIntoView({ behavior: 'instant' }); focus(target); }
      else window.scrollTo({ top: homeY, behavior: 'instant' });
      explicitReturn = false;
    }
    async function render() {
      const generation = ++serial;
      if (location.hash !== route) {
        const wasActive = active || root.dataset.view === 'forma';
        controller?.close();
        if (view) { view.hidden = true; view.inert = true; }
        active = false; root.dataset.view = 'home'; home.hidden = false; home.inert = false; host.hidden = true; skip.href = '#services';
        if (homeFooter) { homeFooter.hidden = false; homeFooter.inert = false; }
        contacts.forEach(({ link, href }) => { link.href = href; });
        if (wasActive) {
          window.dispatchEvent(new CustomEvent('virentora:view', { detail: { view: 'home' } }));
          showHomeAnchor();
          history.scrollRestoration = previousScrollRestoration;
          // Layout observers run after display is restored; repeat only the measurement, not history.
          requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('virentora:view-layout')));
        }
        return;
      }
      active = true; root.dataset.view = 'forma'; home.hidden = true; home.inert = true; host.hidden = false; skip.href = 'projects/forma.html#forma-interface';
      history.scrollRestoration = 'manual';
      if (homeFooter) { homeFooter.hidden = true; homeFooter.inert = true; }
      contacts.forEach(({ link }) => { link.href = 'https://t.me/levvirentora'; });
      window.dispatchEvent(new CustomEvent('virentora:view', { detail: { view: 'forma' } }));
      fallback.hidden = Boolean(controller);
      window.scrollTo({ top: 0, behavior: 'instant' });
      try {
        await loadView();
        if (generation !== serial || location.hash !== route) return;
        fallback.hidden = true; view.hidden = false; view.inert = false;
        controller.setLanguage(root.lang); controller.updatePreview();
        requestAnimationFrame(() => { if (active) controller.prioritizeHero(); });
        window.scrollTo({ top: 0, behavior: 'instant' }); focus(view.querySelector('h1'));
      } catch {
        if (generation !== serial) return;
        fallback.hidden = false; focus(fallback.querySelector('a'));
        // A complete physical document is always available via this link.
      }
    }
    document.addEventListener('click', event => {
      const link = event.target.closest('a');
      if (!link || !ordinary(event)) return;
      if (link.matches('[data-forma-route]')) {
        event.preventDefault(); if (!active) saveHome();
        history.scrollRestoration = 'manual';
        if (location.hash === route) render(); else location.hash = route;
      } else if (active && link.matches('[data-forma-home],#hdr a[href^="#"],#mm a[href^="#"]')) {
        const url = new URL(link.href); if (!url.hash || url.hash === route) return;
        event.preventDefault(); explicitReturn = true; location.hash = url.hash;
      } else if (active && link === skip && controller) {
        event.preventDefault(); const target = view.querySelector('#forma-interface'); target.scrollIntoView({ behavior: 'instant' }); focus(target);
      }
    });
    window.addEventListener('virentora:language', event => { if (active && controller) controller.setLanguage(event.detail.language); });
    window.addEventListener('hashchange', render);
    window.addEventListener('pagehide', () => controller?.close());
    if (location.hash === route) history.scrollRestoration = 'manual';
    render();
  }, { once: true });
})();
