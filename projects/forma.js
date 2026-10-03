import { preview } from './forma-preview-config.js?v=20261003-forma1';

// One initializer serves the physical HTML and the router's imported view.
export function initForma(view, { standalone = false } = {}) {
  const scope = standalone ? document : view;
  const strings = [...scope.querySelectorAll('[data-en]')].map(node => ({ node, ru: node.textContent, en: node.dataset.en }));
  const attributes = [...scope.querySelectorAll('[data-aria-en],[data-alt-en]')].flatMap(node => ['aria', 'alt'].filter(type => node.hasAttribute(`data-${type}-en`)).map(type => ({ node, name: type === 'aria' ? 'aria-label' : 'alt', ru: node.getAttribute(type === 'aria' ? 'aria-label' : 'alt'), en: node.getAttribute(`data-${type}-en`) })));
  const dialog = view.querySelector('.image-viewer');
  const image = dialog.querySelector('img');
  const caption = dialog.querySelector('[data-forma-viewer-caption]');
  const zoom = dialog.querySelector('.viewer-zoom');
  let language = 'ru', opener = null, saved = null, down = null, previewTimer;
  const ordinary = event => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  function metadata() {
    if (!standalone && view.hidden) return;
    document.title = language === 'en' ? view.dataset.titleEn : view.dataset.titleRu;
    document.querySelector('meta[name="description"]').content = language === 'en' ? view.dataset.descriptionEn : view.dataset.descriptionRu;
  }
  function updateZoom() {
    const actual = dialog.classList.contains('is-actual');
    zoom.textContent = actual ? (language === 'en' ? 'Fit to screen' : 'Вписать в экран') : '100%';
    zoom.setAttribute('aria-label', actual ? (language === 'en' ? 'Fit screenshot to screen' : 'Вписать снимок в экран') : (language === 'en' ? 'View screenshot at original size' : 'Показать снимок в исходном размере'));
    zoom.setAttribute('aria-pressed', String(actual));
  }
  function setLanguage(value) {
    language = value === 'en' ? 'en' : 'ru';
    strings.forEach(({ node, ru, en }) => { node.textContent = language === 'en' ? en : ru; });
    attributes.forEach(({ node, name, ru, en }) => node.setAttribute(name, language === 'en' ? en : ru));
    if (standalone) {
      document.documentElement.lang = language;
      document.querySelectorAll('[data-lang]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lang === language)));
      try { localStorage.setItem('virentora-language', language); } catch {}
    }
    if (opener) {
      image.alt = opener.querySelector('img').alt;
      caption.textContent = opener.closest('figure').querySelector('[data-forma-caption]').textContent;
    }
    updateZoom();
    metadata();
  }
  function prioritizeHero() {
    const heroImage = view.querySelector('.forma-hero-media img');
    if (!view.hidden && heroImage.getBoundingClientRect().top < innerHeight) {
      heroImage.loading = 'eager'; heroImage.fetchPriority = 'high';
    }
  }
  function unlock() {
    if (!saved) return;
    const state = saved; saved = null;
    document.body.style.cssText = state.style;
    window.scrollTo({ top: state.y, left: state.x, behavior: 'instant' });
    if (opener?.isConnected && !view.hidden) opener.focus({ preventScroll: true });
  }
  function close() { unlock(); if (dialog.open) dialog.close(); }
  view.querySelectorAll('[data-forma-shot]').forEach(link => link.addEventListener('click', event => {
    if (!ordinary(event) || typeof dialog.showModal !== 'function') return;
    const source = link.querySelector('img');
    image.src = link.href; image.alt = source.alt;
    image.width = Number(source.getAttribute('width')); image.height = Number(source.getAttribute('height'));
    opener = link; caption.textContent = link.closest('figure').querySelector('[data-forma-caption]').textContent;
    dialog.classList.remove('is-actual'); updateZoom();
    // If the native dialog cannot open, the original image link still works.
    try { dialog.showModal(); } catch { return; }
    event.preventDefault();
    saved = { style: document.body.style.cssText, x: scrollX, y: scrollY };
    const gutter = innerWidth - document.documentElement.clientWidth;
    Object.assign(document.body.style, { position: 'fixed', top: `${-saved.y}px`, left: '0', width: '100%', overflow: 'hidden', paddingRight: `${gutter}px` });
    dialog.querySelector('.viewer-scroll').scrollTo(0, 0);
    dialog.querySelector('.viewer-close').focus();
  }));
  zoom.addEventListener('click', () => { dialog.classList.toggle('is-actual'); updateZoom(); dialog.querySelector('.viewer-scroll').scrollTo(0, 0); });
  dialog.querySelector('.viewer-close').addEventListener('click', close);
  dialog.addEventListener('close', unlock);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  function outside(event) { const r = dialog.getBoundingClientRect(); return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom; }
  dialog.addEventListener('pointerdown', event => { down = { outside: outside(event), x: event.clientX, y: event.clientY }; });
  dialog.addEventListener('click', event => { if (down?.outside && outside(event) && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 8) close(); down = null; });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const stops = [...dialog.querySelectorAll('button,[tabindex="0"]')];
    const first = stops[0], last = stops[stops.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  view.querySelectorAll('[data-forma-section]').forEach(link => link.addEventListener('click', event => {
    if (!ordinary(event)) return;
    const target = view.querySelector(new URL(link.href).hash);
    if (!target) return;
    event.preventDefault(); target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    target.tabIndex = -1; target.focus({ preventScroll: true });
    target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
  }));
  function updatePreview() {
    clearTimeout(previewTimer);
    const now = Date.now(), checked = Date.parse(preview.checkedAt), expires = Date.parse(preview.expiresAt);
    let allowed = false;
    try { const url = new URL(preview.url); allowed = preview.enabled && url.protocol === 'https:' && /^[a-z0-9-]+\.shopifypreview\.com$/.test(url.hostname) && !url.username && !url.password && checked <= now && now < expires && expires - checked <= 2 * 86400000; } catch {}
    const block = view.querySelector('[data-forma-preview]');
    block.hidden = !allowed;
    if (allowed) { block.querySelector('a').href = preview.url; previewTimer = setTimeout(updatePreview, expires - now + 1); }
    else block.querySelector('a').removeAttribute('href');
  }
  updatePreview();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updatePreview(); });
  if (standalone) document.querySelectorAll('[data-lang]').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.lang)));
  let initial = document.documentElement.lang;
  if (standalone) try { initial = localStorage.getItem('virentora-language') || 'ru'; } catch {}
  setLanguage(initial);
  if (standalone) requestAnimationFrame(prioritizeHero);
  return { setLanguage, close, updatePreview, prioritizeHero };
}
const physical = document.querySelector('body.case-page [data-forma-view]');
if (physical) initForma(physical, { standalone: true });
