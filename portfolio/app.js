import {categories,visibleProjects,parseRoute,contactUrl,messageText,shareUrl,startProject,safeExternal} from './lib.mjs';
import {connectTelegram} from './telegram.mjs';
import * as views from './views.mjs';
const main=document.querySelector('#main'),gallery=document.querySelector('#gallery'),toast=document.querySelector('#toast');
let site,projects,route,category='all',galleryItems=[],imageIndex=0,galleryTrigger,lastRoute=null;
let toastTimer,renderNumber=0,navigationStarted=false,brief='';
const positions=new Map();
try {category=sessionStorage.getItem('virentora-category')||'all';brief=sessionStorage.getItem('virentora-brief')||'';}catch{}
if(!categories.some(c=>c.id===category))category='all';
const initialHash=location.hash;
// The SDK must read Telegram's bootstrap hash before the app replaces it with its own route.
if(/^#(?:tgWebApp|.*&tgWebApp)/.test(initialHash) && !window.Telegram?.WebApp){
  await new Promise(resolve=>{
    const timer=setTimeout(resolve,5000);
    document.querySelector('#telegram-sdk')?.addEventListener('load',()=>{clearTimeout(timer);resolve();},{once:true});
    document.querySelector('#telegram-sdk')?.addEventListener('error',()=>{clearTimeout(timer);resolve();},{once:true});
  });
}
const telegram=connectTelegram(goBack);
history.scrollRestoration='manual';
function applyStartRoute(){
  const hint=startProject(location.search,telegram.tg);
  const bootstrap=/^#(?:tgWebApp|.*&tgWebApp)/.test(location.hash);
  if(!navigationStarted && (bootstrap && telegram.tg || !location.hash)) history.replaceState(null,'',location.pathname+location.search+(hint?`#/project/${hint}`:'#/'));
}
applyStartRoute();
window.addEventListener('telegram-connected',()=>{applyStartRoute();if(projects)render();});
function selectedProject(){return projects?.find(p=>p.id===(route?.id||route?.project) && p.published);}
function goBack(){if(gallery.open){gallery.close();return;}if(history.state?.portfolioParent)history.back();else navigate('#/projects');}
function navigate(hash){
  navigationStarted=true;
  if(hash===location.hash){scrollTo({top:0,behavior:reduced()?'instant':'smooth'});return;}
  history.pushState({portfolioParent:location.hash||'#/'},'',hash);render();
}
function reduced(){return matchMedia('(prefers-reduced-motion: reduce)').matches;}
function persistBrief(){try{sessionStorage.setItem('virentora-brief',brief);}catch{}}
function render(){
  const ticket=++renderNumber,key=/^#(?:tgWebApp|.*&tgWebApp)/.test(location.hash)?'#/':location.hash||'#/';
  if(lastRoute)positions.set(lastRoute,{y:scrollY,focus:document.activeElement?.getAttribute('href')});
  if(gallery.open)gallery.close();
  route=parseRoute(key);
  const p=selectedProject();
  const context={site,projects,category,route,brief};
  main.innerHTML=route.page==='projects'?views.home(context):route.page==='about'?views.about(context):route.page==='contact'?views.contact(context):route.page==='project'&&p?views.projectView(p,context):views.missing();
  document.title=p && route.page==='project'?`${p.title} — Virentora`:route.page==='contact'?'Связаться — Virentora':route.page==='about'?'Лев — Virentora':'Virentora — портфолио разработчика';
  for(const item of document.querySelectorAll('[data-nav]')){
    const current=item.dataset.nav===(route.page==='project'?'projects':route.page);
    if(current)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');
    if(item.dataset.nav==='contact')item.href=`#/contact${p?'?project='+p.id:''}`;
  }
  for(const item of document.querySelectorAll('.desktop-nav a')){
    const current=item.getAttribute('href')===`#/${route.page}` || route.page==='project'&&item.getAttribute('href')==='#/projects';
    if(current)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');
  }
  telegram.back(route.page!=='projects');
  main.focus({preventScroll:true});
  const saved=positions.get(key);
  requestAnimationFrame(()=>{
    if(ticket!==renderNumber)return;
    scrollTo({top:saved?.y||0,behavior:'instant'});
    if(saved?.focus)[...main.querySelectorAll('a')].find(a=>a.getAttribute('href')===saved.focus)?.focus({preventScroll:true});
    document.body.classList.remove('keyboard-open');
  });
  lastRoute=key;
}
function notify(message){clearTimeout(toastTimer);toast.textContent=message;toast.classList.add('visible');toastTimer=setTimeout(()=>toast.classList.remove('visible'),3500);}
async function copy(value,success){
  try{await navigator.clipboard.writeText(value);notify(success);return;}catch{}
  let box=document.querySelector('#copy-fallback');
  if(!box){box=document.createElement('textarea');box.id='copy-fallback';box.className='copy-fallback';box.readOnly=true;box.setAttribute('aria-label','Текст для копирования');main.prepend(box);}
  box.value=value;box.focus();box.select();notify('Выделил текст: его можно скопировать вручную.');
}
async function share(){
  const p=selectedProject(),url=shareUrl(site,p.id,location.href);
  if(navigator.share && navigator.canShare?.({url})){
    try{await navigator.share({title:`${p.title} · Virentora`,text:p.summary,url});return;}catch(e){if(e.name==='AbortError')return;}
  }
  await copy(url,'Ссылка на проект скопирована');
}
function showImage(){
  const thumbFocused=gallery.querySelector('.gallery-thumbs').contains(document.activeElement);
  const img=document.querySelector('#gallery-image'),g=galleryItems[imageIndex];
  img.hidden=false;img.parentElement.querySelectorAll('.image-error').forEach(e=>e.remove());
  img.parentElement.classList.add('image-loading');img.src='./'+g.src;img.alt=g.caption;
  gallery.classList.remove('zoomed');
  gallery.querySelector('[data-action="zoom"]').setAttribute('aria-label','Увеличить изображение');
  document.querySelector('#gallery-title').textContent=`${imageIndex+1} / ${galleryItems.length}`;
  document.querySelector('#gallery-caption').textContent=g.caption;
  gallery.querySelector('[data-action="prev-image"]').disabled=galleryItems.length<2;
  gallery.querySelector('[data-action="next-image"]').disabled=galleryItems.length<2;
  gallery.querySelector('.gallery-thumbs').innerHTML=galleryItems.map((g,i)=>`<button data-image="${i}" aria-label="Изображение ${i+1}" aria-pressed="${i===imageIndex}"><img src="./${views.esc(g.src)}" alt="" loading="lazy"></button>`).join('');
  if(thumbFocused)gallery.querySelector(`[data-image="${imageIndex}"]`).focus({preventScroll:true});
  img.decode().then(()=>img.parentElement.classList.remove('image-loading')).catch(()=>{});
}
function changeImage(delta){imageIndex=(imageIndex+delta+galleryItems.length)%galleryItems.length;showImage();}
function openGallery(index,trigger){
  const p=selectedProject();if(!p?.gallery[index])return;
  galleryItems=p.gallery;imageIndex=index;galleryTrigger=trigger;showImage();
  document.body.classList.add('modal-open');gallery.showModal();telegram.back(true);
}
gallery.addEventListener('close',()=>{document.body.classList.remove('modal-open');telegram.back(route?.page!=='projects');if(galleryTrigger?.isConnected)galleryTrigger.focus({preventScroll:true});});
gallery.addEventListener('click',e=>{if(e.target===gallery)gallery.close();});
gallery.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();changeImage(e.key==='ArrowRight'?1:-1);}});
let touchStart;
gallery.addEventListener('touchstart',e=>{if(!gallery.classList.contains('zoomed') && e.touches.length===1)touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};else touchStart=null;},{passive:true});
gallery.addEventListener('touchend',e=>{if(!touchStart || gallery.classList.contains('zoomed'))return;const t=e.changedTouches[0],dx=t.clientX-touchStart.x,dy=t.clientY-touchStart.y;if(Math.abs(dx)>70 && Math.abs(dx)>Math.abs(dy)*1.5)changeImage(dx<0?1:-1);touchStart=null;},{passive:true});
document.addEventListener('load',e=>{if(e.target.tagName==='IMG')e.target.parentElement.classList.remove('image-loading');},true);
document.addEventListener('error',e=>{
  if(e.target.tagName!=='IMG')return;e.target.hidden=true;
  const parent=e.target.parentElement;parent.classList.remove('image-loading');
  if(!parent.querySelector('.image-error')){const text=document.createElement('span');text.className='image-error';text.textContent='Изображение недоступно';parent.append(text);}
},true);
document.addEventListener('input',e=>{
  if(e.target.id!=='project-brief')return;
  brief=e.target.value.slice(0,2000);persistBrief();
  document.querySelector('#brief-count').textContent=`${brief.length} / 2000`;
  document.querySelector('.send-brief').href=contactUrl(site,selectedProject(),brief);
});
document.addEventListener('click',async e=>{
  const target=e.target.closest('a,button');if(!target)return;
  if(target.dataset.external!==undefined && safeExternal(target.href) && telegram.open(target.href)){e.preventDefault();return;}
  if(target.hasAttribute('data-scroll')){e.preventDefault();document.getElementById(target.dataset.scroll)?.scrollIntoView({behavior:reduced()?'instant':'smooth'});return;}
  if(target.dataset.filter){
    navigationStarted=true;category=target.dataset.filter;try{sessionStorage.setItem('virentora-category',category);}catch{}
    for(const f of main.querySelectorAll('[data-filter]')){f.classList.toggle('selected',f.dataset.filter===category);f.setAttribute('aria-pressed',String(f.dataset.filter===category));}
    const filtered=visibleProjects(projects,category);
    document.querySelector('#project-grid').innerHTML=filtered.map(p=>views.card(p)).join('')||'<p>В этом направлении пока нет открытых работ.</p>';
    document.querySelector('#filter-status').textContent=`${filtered.length} из ${visibleProjects(projects).length} проектов`;
    return;
  }
  if(target.dataset.walk!==undefined){
    const p=selectedProject(),w=p.walkthrough[Number(target.dataset.walk)],g=p.gallery[w.image];
    for(const b of main.querySelectorAll('[data-walk]')){const selected=b===target;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));}
    const figure=main.querySelector('.walk-figure'),img=figure.querySelector('img');
    img.hidden=false;img.src='./'+g.src;img.alt=g.caption;figure.querySelectorAll('.image-error').forEach(x=>x.remove());
    figure.querySelector('button').dataset.gallery=w.image;figure.querySelector('figcaption').textContent=g.caption;
    return;
  }
  if(target.dataset.sample!==undefined){
    const example=selectedProject()?.savedDemo?.examples[Number(target.dataset.sample)];
    if(!example)return;
    for(const button of main.querySelectorAll('[data-sample]')){
      const active=button===target;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    }
    main.querySelector('#sample-result').innerHTML=views.savedResult(example);
    return;
  }
  if(target.dataset.gallery!==undefined){openGallery(Number(target.dataset.gallery),target);return;}
  if(target.dataset.image!==undefined){imageIndex=Number(target.dataset.image);showImage();return;}
  switch(target.dataset.action){
    case 'back':goBack();return;
    case 'theme':telegram.toggleTheme();return;
    case 'share':await share();return;
    case 'copy-email':await copy(site.email,'Email скопирован');return;
    case 'copy-brief':await copy(messageText(selectedProject(),brief),'Текст сообщения скопирован');return;
    case 'clear-brief':brief='';persistBrief();document.querySelector('#project-brief').value='';document.querySelector('#brief-count').textContent='0 / 2000';document.querySelector('.send-brief').href=contactUrl(site,selectedProject());document.querySelector('#project-brief').focus();return;
    case 'close-gallery':gallery.close();return;
    case 'next-image':changeImage(1);return;
    case 'prev-image':changeImage(-1);return;
    case 'zoom':gallery.classList.toggle('zoomed');target.setAttribute('aria-label',gallery.classList.contains('zoomed')?'Уместить изображение':'Увеличить изображение');return;
  }
  const href=target.getAttribute('href');if(href?.startsWith('#/')){e.preventDefault();navigate(href);}
});
window.addEventListener('popstate',()=>{if(projects)render();});
window.addEventListener('hashchange',()=>{if(projects && lastRoute!==(location.hash||'#/'))render();});
try{
  [site,projects]=await Promise.all(['site.json','projects.json'].map(async path=>{const r=await fetch('./'+path);if(!r.ok)throw Error(path);return r.json();}));
  render();
}catch{
  main.innerHTML='<section class="text-page"><h1>Не удалось загрузить проекты.</h1><p>Проверьте соединение и обновите страницу.</p><div class="case-actions"><button class="button primary" id="reload">Попробовать ещё раз</button><a class="button secondary" id="fallback-contact">Связаться ↗</a></div></section>';
  document.querySelector('#fallback-contact').href=document.body.dataset.contactUrl;
  document.querySelector('#reload').addEventListener('click',()=>location.reload());
}
