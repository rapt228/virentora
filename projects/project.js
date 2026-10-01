(() => {
  const root = document.documentElement;
  const pageTitle = {ru:document.title, en:document.querySelector('title').dataset.titleEn || 'Website and Telegram inquiries in amoCRM — Virentora'};
  const description = document.querySelector('meta[name="description"]');
  const metadata = [...document.querySelectorAll('meta[data-content-en]')].map(node => ({node,ru:node.content,en:node.dataset.contentEn}));
  if (description && !description.hasAttribute('data-content-en')) metadata.push({node:description,ru:description.content,en:'Two inquiry channels in one CRM. Staff can see the source, customer history, task and notification.'});
  const translations = [...document.querySelectorAll('[data-en]')].map(node => ({node, ru:node.textContent, en:node.dataset.en}));
  const attributes = [...document.querySelectorAll('[data-aria-en],[data-alt-en]')].flatMap(node => ['aria','alt'].filter(type => node.hasAttribute(`data-${type}-en`)).map(type => ({node, name:type==='aria'?'aria-label':'alt', ru:node.getAttribute(type==='aria'?'aria-label':'alt'), en:node.getAttribute(`data-${type}-en`)})));
  const viewer = document.querySelector('.image-viewer');
  const zoom = viewer?.querySelector('.viewer-zoom');
  const image = viewer?.querySelector('img');
  const scroller = viewer?.querySelector('.viewer-scroll');
  let lang = 'ru';
  let opener;
  let scrollPosition;
  let savedBodyStyle;

  function zoomLabel() {
    if (!zoom) return;
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
    document.title = pageTitle[lang];
    metadata.forEach(item => {item.node.content=item[lang];});
    zoomLabel();
    if (viewer?.open && opener) image.alt = opener.querySelector('img').alt;
    try {localStorage.setItem('virentora-language',lang);} catch {}
  }
  document.querySelectorAll('[data-lang]').forEach(button => button.addEventListener('click',()=>translate(button.dataset.lang)));
  try {translate(localStorage.getItem('virentora-language') || 'ru');} catch {translate('ru');}

  const tablist = document.querySelector('.amocrm-step-tabs');
  const tabs = [...document.querySelectorAll('[data-step]')];
  const panels = [...document.querySelectorAll('.amocrm-step-panel')];
  function selectStep(index, focus = false) {
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    if (focus) tabs[index].focus({preventScroll:true});
  }
  if (tablist && tabs.length === panels.length && tabs.length) {
    tablist.hidden = false;
    tablist.setAttribute('role','tablist');
    tabs.forEach((tab,index) => {
      tab.setAttribute('role','tab');
      panels[index].setAttribute('role','tabpanel');
      panels[index].setAttribute('aria-labelledby',tab.id);
      panels[index].tabIndex = 0;
      tab.addEventListener('click',()=>selectStep(index));
      tab.addEventListener('keydown',event=>{
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next !== undefined) {event.preventDefault();selectStep(next,true);}
      });
    });
    selectStep(0);
  }

  if (!viewer || typeof viewer.showModal !== 'function') return;
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
    scrollPosition = {x:window.scrollX,y:window.scrollY};
    savedBodyStyle = document.body.getAttribute('style');
    const gutter = window.innerWidth - root.clientWidth;
    Object.assign(document.body.style,{position:'fixed',top:`-${scrollPosition.y}px`,left:'0',width:'100%',paddingRight:`${gutter}px`});
    document.body.classList.add('image-viewer-open');
    viewer.showModal();
    scroller.scrollTo(0,0);
  }));
  zoom.addEventListener('click', () => {
    viewer.classList.toggle('is-actual');
    zoomLabel();
    scroller.scrollTo(0,0);
  });
  viewer.querySelector('.viewer-close').addEventListener('click',()=>viewer.close());
  viewer.addEventListener('keydown',event=>{
    if (event.key !== 'Tab') return;
    const stops = [...viewer.querySelectorAll('button,[tabindex="0"]')];
    const index = stops.indexOf(document.activeElement);
    if (event.shiftKey && index <= 0) {
      event.preventDefault();stops.at(-1).focus();
    } else if (!event.shiftKey && (index === -1 || index === stops.length - 1)) {
      event.preventDefault();stops[0].focus();
    }
  });
  viewer.addEventListener('click',event=>{
    if (event.target !== viewer) return;
    const r=viewer.getBoundingClientRect();
    if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) viewer.close();
  });
  viewer.addEventListener('close',()=>{
    document.body.classList.remove('image-viewer-open');
    if (savedBodyStyle === null) document.body.removeAttribute('style');
    else document.body.setAttribute('style',savedBodyStyle);
    window.scrollTo({left:scrollPosition.x,top:scrollPosition.y,behavior:'instant'});
    opener?.focus({preventScroll:true});
  });
})();
