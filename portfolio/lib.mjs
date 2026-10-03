export const categories = [
  {id:'all', label:'Все проекты'}, {id:'web', label:'Сайты'}, {id:'telegram', label:'Telegram'},
  {id:'crm', label:'CRM и автоматизация'}, {id:'ai', label:'AI и данные'}
];
export function visibleProjects(projects, category = 'all') {
  return projects.filter(p => p.published && (category === 'all' || p.categories.includes(category))).sort((a,b) => a.order-b.order);
}
export function parseRoute(hash) {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const segments = path.split('/');
  if (segments[0] === 'project' && segments.length === 2) return {page:'project', id:segments[1] || ''};
  if (['about','contact'].includes(path)) return {page:path, project:new URLSearchParams(query).get('project')};
  if (!path || path === 'projects') return {page:'projects'};
  return {page:'missing'};
}
export function messageText(project, brief = '') {
  const intro = project ? `Лев, здравствуйте! Посмотрел проект «${project.title}». Хочу обсудить похожую задачу.` : 'Лев, здравствуйте! Хочу обсудить задачу.';
  return brief.trim() ? `${intro}\n\n${brief.trim()}` : `${intro}\n\nЧто нужно сделать: `;
}
export function contactUrl(site, project, brief = '') {
  const message = messageText(project, brief);
  return site.telegram ? `https://t.me/${site.telegram}?text=${encodeURIComponent(message)}` : `mailto:${site.email}?subject=${encodeURIComponent(project ? `Проект: ${project.title}` : 'Задача для Virentora')}&body=${encodeURIComponent(message)}`;
}
export function shareUrl(site, id, base) {
  if (site.botUsername && site.telegramAppEnabled !== false) return `https://t.me/${site.botUsername}${site.appName ? '/'+site.appName : ''}?startapp=case_${id}`;
  const url = new URL(site.publicUrl || base);
  url.search = ''; url.hash = `/project/${id}`;
  return url.href;
}
export function startProject(search, webApp) {
  const value = new URLSearchParams(search).get('tgWebAppStartParam') || webApp?.initDataUnsafe?.start_param || '';
  // This public routing hint is never used for identity, permissions or server actions.
  return /^case_[a-z0-9-]+$/.test(value) ? value.slice(5) : null;
}
export function safeExternal(url) {
  try { const u = new URL(url); return ['https:', 'mailto:'].includes(u.protocol); } catch { return false; }
}
