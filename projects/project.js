(() => {
  const root = document.documentElement;
  const translations = [...document.querySelectorAll('[data-en]')].map(node => ({node, ru:node.textContent, en:node.dataset.en}));
  const attributes = [...document.querySelectorAll('[data-aria-en],[data-alt-en]')].flatMap(node => ['aria','alt'].filter(type => node.hasAttribute(`data-${type}-en`)).map(type => ({node, name:type==='aria'?'aria-label':'alt', ru:node.getAttribute(type==='aria'?'aria-label':'alt'), en:node.getAttribute(`data-${type}-en`)})));
  const viewer = document.querySelector('.image-viewer');
  const zoom = viewer.querySelector('.viewer-zoom');
  const image = viewer.querySelector('img');
  const scroller = viewer.querySelector('.viewer-scroll');
  let lang = 'ru';
  let opener;

  function zoomLabel() {
    const actual = viewer.classList.contains('is-actual');
    zoom.setAttribute('aria-pressed', String(actual));
    zoom.textContent = lang === 'ru' ? (actual ? 'Вписать в экран' : 'Масштаб 100%') : (actual ? 'Fit to screen' : '100% scale');
  }
  function translate(value) {
    lang = value === 'en' ? 'en' : 'ru';
    root.lang = lang;
    translations.forEach(item => {item.node.textContent=item[lang];});
    attributes.forEach(item => item.node.setAttribute(item.name,item[lang]));
    document.querySelectorAll('[data-lang]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.lang===lang)));
    document.title = lang === 'ru' ? 'Приём заявок в amoCRM — Virentora' : 'Enquiry intake in amoCRM — Virentora';
    zoomLabel();
    try {localStorage.setItem('virentora-language',lang);} catch {}
  }
  document.querySelectorAll('[data-lang]').forEach(button => button.addEventListener('click',()=>translate(button.dataset.lang)));
  try {translate(localStorage.getItem('virentora-language') || 'ru');} catch {translate('ru');}

  if (typeof viewer.showModal !== 'function') return;
  document.querySelectorAll('[data-screenshot]').forEach(link => link.addEventListener('click', event => {
    // Modified clicks and the no-JS path keep the original image link.
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    opener = link;
    const original = link.querySelector('img');
    image.src = link.href;
    image.alt = original.alt;
    image.width = Number(original.getAttribute('width'));
    image.height = Number(original.getAttribute('height'));
    viewer.classList.remove('is-actual');
    zoomLabel();
    viewer.showModal();
    document.body.classList.add('image-viewer-open');
    scroller.scrollTo(0,0);
  }));
  zoom.addEventListener('click', () => {
    viewer.classList.toggle('is-actual');
    zoomLabel();
    scroller.scrollTo(0,0);
  });
  viewer.querySelector('.viewer-close').addEventListener('click',()=>viewer.close());
  viewer.addEventListener('click',event=>{
    if (event.target !== viewer) return;
    const r=viewer.getBoundingClientRect();
    if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) viewer.close();
  });
  viewer.addEventListener('close',()=>{
    document.body.classList.remove('image-viewer-open');
    opener?.focus({preventScroll:true});
  });
})();
