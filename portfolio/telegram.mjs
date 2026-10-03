export function connectTelegram(onBack) {
  let tg, active = false, backVisible = false;
  let userTheme = '';
  try { userTheme = localStorage.getItem('virentora-theme') || ''; } catch {}
  const root = document.documentElement;
  const supports = version => active && tg.isVersionAtLeast?.(version);
  const safely = fn => { try { fn(); } catch {} };
  function theme() {
    const mode = userTheme || (active ? tg.colorScheme : 'dark');
    root.dataset.theme = mode === 'light' ? 'light' : 'dark';
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
    document.querySelector('[data-action="theme"]')?.setAttribute('aria-label',mode==='light'?'Включить тёмную тему':'Включить светлую тему');
    if (active) {
      if(supports('6.1')) {
        safely(()=>tg.setHeaderColor(supports('6.9')?bg:'bg_color'));
        safely(()=>tg.setBackgroundColor(bg));
      }
      if(supports('7.10')) safely(()=>tg.setBottomBarColor(bg));
    }
  }
  function viewport() {
    if(active) {
      if(tg.viewportHeight>0) root.style.setProperty('--app-height',`${tg.viewportHeight}px`);
      if(tg.viewportStableHeight>0) root.style.setProperty('--stable-height',`${tg.viewportStableHeight}px`);
      for(const side of ['top','right','bottom','left']) root.style.setProperty(`--safe-${side}`,`${Math.max(tg.safeAreaInset?.[side]||0,tg.contentSafeAreaInset?.[side]||0)}px`);
    }
    const v = window.visualViewport;
    const keyboard = v && window.innerHeight-v.height > 150 && document.activeElement?.matches('textarea,input');
    document.body.classList.toggle('keyboard-open',Boolean(keyboard));
  }
  function init() {
    const candidate = window.Telegram?.WebApp;
    if(!candidate || candidate===tg)return;
    tg=candidate;active=Boolean(tg.platform && tg.platform!=='unknown');
    if(active){
      safely(()=>tg.ready()); safely(()=>tg.expand());
      tg.onEvent?.('themeChanged',theme);tg.onEvent?.('viewportChanged',viewport);
      if(supports('8.0')) {tg.onEvent?.('safeAreaChanged',viewport);tg.onEvent?.('contentSafeAreaChanged',viewport);}
      if(supports('6.1')) safely(()=>tg.BackButton?.onClick(onBack));
    }
    theme();viewport();back(backVisible);
    if(active)window.dispatchEvent(new Event('telegram-connected'));
  }
  function back(visible){backVisible=visible;if(supports('6.1'))safely(()=>tg.BackButton?.[visible?'show':'hide']());}
  theme();init();
  document.querySelector('#telegram-sdk')?.addEventListener('load',init,{once:true});
  window.visualViewport?.addEventListener('resize',viewport);
  document.addEventListener('focusin',viewport);document.addEventListener('focusout',()=>requestAnimationFrame(viewport));
  return {
    get tg(){return tg;},back,
    toggleTheme(){userTheme=root.dataset.theme==='light'?'dark':'light';try{localStorage.setItem('virentora-theme',userTheme);}catch{}theme();},
    open(url){
      if(!supports('6.1'))return false;
      try {
        const target=new URL(url);
        if(target.protocol!=='https:')return false;
        if(target.hostname==='t.me')tg.openTelegramLink(url);else tg.openLink(url);
        return true;
      }catch{return false;}
    }
  };
}
