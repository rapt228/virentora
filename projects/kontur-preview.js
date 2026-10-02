(() => {
  // A backdrop press must start and end outside; dragging an image never dismisses it.
  function protectBackdrop(dialog, dismiss) {
    let press;
    const outside = event => {
      const r = dialog.getBoundingClientRect();
      return event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom);
    };
    dialog.addEventListener('pointerdown', event => { press = {x:event.clientX,y:event.clientY,outside:outside(event)}; });
    dialog.addEventListener('pointercancel', () => { press = null; });
    dialog.addEventListener('click', event => {
      if (!outside(event)) return;
      const valid = press?.outside && Math.hypot(event.clientX-press.x,event.clientY-press.y) < 8;
      press = null;
      if (!valid) event.stopImmediatePropagation();
      else if (dismiss) dialog.close();
    }, true);
  }
  const gallery = document.querySelector('.kontur-case .image-viewer');
  if (gallery) protectBackdrop(gallery, false);
  const dialog = document.querySelector('.kontur-preview');
  const trigger = document.querySelector('[data-kontur-preview]');
  if (!dialog || !trigger || typeof dialog.showModal !== 'function') return;
  let position, bodyStyle;
  trigger.setAttribute('aria-haspopup','dialog');
  trigger.setAttribute('aria-controls',dialog.id);
  trigger.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    event.preventDefault();
    position = {x:window.scrollX,y:window.scrollY};
    bodyStyle = document.body.getAttribute('style');
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    Object.assign(document.body.style,{position:'fixed',top:`-${position.y}px`,left:'0',width:'100%',paddingRight:`${gutter}px`,overflow:'hidden'});
    dialog.showModal();
    dialog.querySelector('.kontur-preview-content').scrollTop = 0;
    dialog.querySelector('.kontur-preview-close').focus({preventScroll:true});
  });
  dialog.querySelector('.kontur-preview-close').addEventListener('click',()=>dialog.close());
  protectBackdrop(dialog,true);
  dialog.addEventListener('keydown',event=>{
    if (event.key !== 'Tab') return;
    const stops = [...dialog.querySelectorAll('button,a[href],[tabindex="0"]')];
    const i = stops.indexOf(document.activeElement);
    if (event.shiftKey && i <= 0) {event.preventDefault();stops.at(-1).focus();}
    else if (!event.shiftKey && (i < 0 || i === stops.length-1)) {event.preventDefault();stops[0].focus();}
  });
  dialog.addEventListener('close',()=>{
    if (bodyStyle === null) document.body.removeAttribute('style');
    else document.body.setAttribute('style',bodyStyle);
    window.scrollTo({left:position.x,top:position.y,behavior:'instant'});
    trigger.focus({preventScroll:true});
  });
  // Leave the history entry unlocked if the full case is opened from the preview.
  dialog.querySelectorAll('a:not([target="_blank"])').forEach(link=>link.addEventListener('click',event=>{
    if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) dialog.close();
  }));
})();
