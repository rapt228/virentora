(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.querySelector('#hdr');
  const hero = document.querySelector('#top');
  const menu = document.querySelector('#mm');
  const burger = document.querySelector('#burger');
  const closeButton = document.querySelector('#menu-close');
  const motionButton = document.querySelector('#motion-toggle');
  let lang = 'ru';
  let paused = reduced.matches;
  let sceneProgress = 0;
  let sceneReady = false;
  let menuDestination = null;
  let ticking = false;
  const translations = [...document.querySelectorAll('[data-en]')].map(node => ({node, ru:node.textContent, en:node.dataset.en}));
  const translatedAttributes = [...document.querySelectorAll('[data-aria-en],[data-alt-en]')].flatMap(node => ['aria','alt'].filter(type => node.hasAttribute(`data-${type}-en`)).map(type => ({node, attribute:type==='aria'?'aria-label':'alt', ru:node.getAttribute(type==='aria'?'aria-label':'alt'), en:node.getAttribute(`data-${type}-en`)})));

  function updateMotionLabel() {
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.querySelector('.motion-icon').textContent = paused ? '▷' : 'Ⅱ';
    motionButton.querySelector('[data-motion-label]').textContent = lang === 'ru' ? (paused ? 'Включить анимацию' : 'Пауза анимации') : (paused ? 'Enable animation' : 'Pause animation');
  }
  function updateLanguage(value) {
    lang = value === 'en' ? 'en' : 'ru';
    root.lang = lang;
    translations.forEach(({node,ru,en}) => { node.textContent = lang === 'en' ? en : ru; });
    translatedAttributes.forEach(({node,attribute,ru,en}) => node.setAttribute(attribute, lang==='en'?en:ru));
    document.querySelectorAll('[data-lang]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lang === lang)));
    burger.setAttribute('aria-label', lang === 'ru' ? 'Открыть меню' : 'Open menu');
    closeButton.setAttribute('aria-label', lang === 'ru' ? 'Закрыть меню' : 'Close menu');
    menu.setAttribute('aria-label', lang === 'ru' ? 'Навигация по сайту' : 'Site navigation');
    document.querySelector('.bot-preview').setAttribute('aria-label', lang === 'ru' ? 'Пример интерфейса бота' : 'Example bot interface');
    document.title = lang === 'ru' ? 'Virentora — сайты, Telegram-боты и автоматизация' : 'Virentora — websites, Telegram bots & automation';
    document.querySelector('meta[name="description"]').content = lang === 'ru' ? 'Сайты, Telegram-боты, AI-ассистенты и интеграции для бизнеса. Собственные и демонстрационные проекты, понятный процесс и стоимость до начала работы.' : 'Websites, Telegram bots, AI assistants and business integrations. Personal and demo projects, a clear process and costs agreed before work begins.';
    updateMotionLabel();
    try { localStorage.setItem('virentora-language',lang); } catch {}
  }
  document.querySelectorAll('[data-lang]').forEach(button => button.addEventListener('click', () => updateLanguage(button.dataset.lang)));
  try { updateLanguage(localStorage.getItem('virentora-language') || 'ru'); } catch { updateLanguage('ru'); }

  function applyMotion() {
    root.dataset.motion = paused ? 'paused' : 'running';
    updateMotionLabel();
    window.dispatchEvent(new CustomEvent('virentora:motion',{detail:{paused}}));
    updateScroll();
  }
  motionButton.addEventListener('click', () => {
    if (reduced.matches) return;
    paused = !paused;
    applyMotion();
  });
  function reducedChanged() {
    paused = reduced.matches;
    motionButton.hidden = reduced.matches || !sceneReady;
    applyMotion();
  }
  reduced.addEventListener('change', reducedChanged);
  reducedChanged();
  window.addEventListener('virentora:scene-ready', () => { sceneReady=true; motionButton.hidden=reduced.matches; });
  window.addEventListener('virentora:scene-restored', () => { sceneReady=true; motionButton.hidden=reduced.matches; });
  window.addEventListener('virentora:scene-error', () => { sceneReady=false; motionButton.hidden=true; });

  function openMenu() {
    menu.showModal();
    burger.setAttribute('aria-expanded','true');
    document.body.classList.add('menu-open');
    closeButton.focus();
  }
  function closeMenu() { menu.close(); }
  burger.addEventListener('click', openMenu);
  closeButton.addEventListener('click', closeMenu);
  menu.addEventListener('click', e => { if(e.target === menu) { const r=menu.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) closeMenu(); } });
  menu.addEventListener('close', () => {
    document.body.classList.remove('menu-open');
    burger.setAttribute('aria-expanded','false');
    const destination = menuDestination;
    menuDestination = null;
    if (destination) { destination.tabIndex=-1; destination.focus({preventScroll:true}); }
    else burger.focus({preventScroll:true});
  });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    menuDestination = document.querySelector(a.hash);
    closeMenu();
  }));
  matchMedia('(min-width: 801px)').addEventListener('change', e => { if(e.matches && menu.open) closeMenu(); });

  function updateScroll() {
    ticking = false;
    header.classList.toggle('stuck', scrollY > 25);
    const range = Math.max(1, hero.offsetHeight - document.querySelector('.hero-scene').offsetHeight);
    if(reduced.matches) sceneProgress=0;
    else if(!paused) sceneProgress=Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / range));
    const p=sceneProgress;
    const a = Math.max(0, 1 - p * 2.6);
    const b = Math.min(1, Math.max(0, (p - .4) * 3.5));
    hero.style.setProperty('--scene-progress', p.toFixed(4));
    hero.style.setProperty('--hero-opacity', a.toFixed(4));
    hero.style.setProperty('--journey-opacity', b.toFixed(4));
    hero.classList.toggle('journey-active', p > .45);
    document.querySelector('.hero-copy').inert = a < .1;
    document.querySelector('.journey-copy').inert = p <= .45;
  }
  addEventListener('scroll', () => { if(!ticking) { ticking=true; requestAnimationFrame(updateScroll); } }, {passive:true});
  addEventListener('resize', updateScroll, {passive:true});
  document.fonts.ready.then(updateScroll);
  updateScroll();
  document.querySelector('#year').textContent = new Date().getFullYear();
})();
