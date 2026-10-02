// The saved case is readable without JavaScript. Enhance only its nine-step guide.
(() => {
  const journey = document.querySelector('.gc-journey');
  if (!journey) return;
  const navigation = journey.querySelector('.gc-step-navigation');
  const tablist = journey.querySelector('.gc-step-tabs');
  const tabs = [...tablist.querySelectorAll('button')];
  const panels = [...journey.querySelectorAll('.gc-step-panel')];
  const preview = journey.querySelector('.gc-preview');
  const panelHost = journey.querySelector('.gc-panels');
  const controls = journey.querySelector('.gc-step-controls');
  const previous = controls.querySelector('[data-previous]');
  const next = controls.querySelector('[data-next]');
  const counter = controls.querySelector('[data-current]');
  const returnButton = controls.querySelector('[data-all-steps]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  if (tabs.length !== 9 || panels.length !== tabs.length) return;
  let selected = 0;
  let ready = false;
  let heightTransition;

  function select(index, focus = false, reveal = false) {
    if (index < 0 || index >= tabs.length) return;
    const animateHeight = ready && index !== selected && !motion.matches && typeof panelHost.animate === 'function';
    const previousHeight = animateHeight ? panelHost.getBoundingClientRect().height : 0;
    heightTransition?.cancel();
    panelHost.style.overflow = '';
    selected = index;
    tabs.forEach((tab, i) => {
      const active = i === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      panels[i].hidden = !active;
    });
    counter.textContent = String(index + 1);
    previous.setAttribute('aria-disabled', String(index === 0));
    next.setAttribute('aria-disabled', String(index === tabs.length - 1));
    // Animate between natural heights only during selection. No fixed empty panel
    // on mobile, and repeated clicks continue from the current rendered height.
    if (animateHeight) {
      const height = panelHost.getBoundingClientRect().height;
      panelHost.style.overflow = 'hidden';
      const transition = panelHost.animate([{height:`${previousHeight}px`}, {height:`${height}px`}], {duration:180,easing:'ease-out'});
      heightTransition = transition;
      transition.finished.then(() => {
        if (heightTransition === transition) panelHost.style.overflow = '';
      }).catch(() => {});
    }
    if (focus) tabs[index].focus({preventScroll:true});
    // A pointer selection on a narrow screen opens the explanation below the grid.
    // Arrow keys keep focus and scroll in the grid; Tab reaches the preview controls.
    if (reveal && matchMedia('(max-width: 1100px)').matches && preview.getBoundingClientRect().top > innerHeight * .3) {
      preview.scrollIntoView({block:'start', behavior:motion.matches ? 'instant' : 'smooth'});
    }
  }

  tablist.setAttribute('role', 'tablist');
  tabs.forEach((tab, index) => {
    tab.setAttribute('role', 'tab');
    panels[index].setAttribute('role', 'tabpanel');
    panels[index].setAttribute('aria-labelledby', tab.id);
    panels[index].tabIndex = 0;
    tab.addEventListener('click', event => select(index, false, event.detail > 0));
    tab.addEventListener('keydown', event => {
      let target;
      const columns = getComputedStyle(tablist).gridTemplateColumns.split(' ').length;
      if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') target = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'ArrowDown') target = Math.min(index + columns, tabs.length - 1);
      if (event.key === 'ArrowUp') target = Math.max(index - columns, 0);
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = tabs.length - 1;
      if (target !== undefined) { event.preventDefault(); select(target, true); }
    });
  });
  previous.addEventListener('click', () => select(selected - 1));
  next.addEventListener('click', () => select(selected + 1));
  returnButton.addEventListener('click', () => {
    tabs[selected].focus({preventScroll:true});
    navigation.scrollIntoView({block:'start', behavior:motion.matches ? 'instant' : 'smooth'});
  });
  journey.classList.add('is-interactive');
  select(0);
  ready = true;
  navigation.hidden = false;
  controls.hidden = false;
  motion.addEventListener('change', () => {
    if (motion.matches) { heightTransition?.cancel(); panelHost.style.overflow = ''; }
  });
})();
