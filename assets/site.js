(() => {
  const d = document, html = d.documentElement;
  const strip = d.querySelector('.strip'), slides = [...d.querySelectorAll('.slide')], b = d.querySelector('.bloom');
  const wide = matchMedia('(min-width:1000px) and (min-height:720px)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  // phone menu
  const menu = d.getElementById('menu'), opener = d.querySelector('.burger');
  const setMenu = on => { if (!menu) return; menu.hidden = !on; opener.setAttribute('aria-expanded', on); html.style.overflow = on ? 'hidden' : ''; (on ? menu.querySelector('.close') : opener).focus(); };
  if (menu && opener) {
    opener.addEventListener('click', () => setMenu(true));
    menu.querySelector('.close').addEventListener('click', () => setMenu(false));
    d.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });
  }

  // slides
  // the bar: the white block (arrows, name, count, tabs) sits in place of the current section's link
  const deck = d.querySelector('.deck'), block = deck.querySelector('.cur'), links = [...deck.querySelectorAll('a[data-sec]')];
  const num = deck.querySelector('.count'), name = deck.querySelector('.nm span');
  const segs = [...deck.querySelectorAll('.segs i')], prev = deck.querySelector('.prev'), next = deck.querySelector('.next');
  const place = sec => { const a = links.find(l => l.dataset.sec === sec) || links[0]; deck.insertBefore(block, a); links.forEach(l => { l.hidden = l === a; }); };
  const live = () => slides.filter(s => !s.hidden);
  const pad = n => String(n).padStart(2, '0');
  const cur = () => Math.round(strip.scrollLeft / strip.clientWidth);
  const go = i => {
    const L = live(); i = Math.max(0, Math.min(L.length - 1, i));
    const target = L[i]; i = slides.indexOf(target);
    if (wide.matches) strip.scrollTo({ left: L.indexOf(target) * strip.clientWidth, behavior: reduce.matches ? 'auto' : 'smooth' });
    else target.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth' });
  };
  let shown = -1;
  const update = () => {
    if (wide.matches) {
      const x = strip.scrollLeft / strip.clientWidth, i = Math.round(x);
      if (b) { b.style.opacity = 1 - 0.7 * Math.min(1, x); b.style.setProperty('--bp', Math.min(3, x) * 0.6); }
      const L = live(); if (i === shown || !L[i]) return;
      shown = i;
      const s = L[i];
      num.textContent = pad(i + 1) + ' / ' + pad(slides.length);
      name.textContent = s.dataset.name;
      segs.forEach((g, k) => g.classList.toggle('on', k === i));
      prev.disabled = i === 0; next.disabled = i >= L.length - 1;
      html.classList.toggle('on-dark', s.classList.contains('dark'));
      html.classList.toggle('on-home', s.id === 'home');
      place(s.dataset.nav || deck.dataset.sec);
      history.replaceState(null, '', i && s.id ? '#' + s.id : location.pathname + location.search);
    } else {
      if (b) { const p = scrollY / innerHeight; b.style.opacity = 1 - 0.7 * Math.min(1, p); b.style.setProperty('--bp', Math.min(1.5, p)); }
      html.classList.remove('on-dark'); shown = -1;
    }
  };
  let raf = 0;
  const later = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); };
  strip.addEventListener('scroll', later, { passive: true });
  addEventListener('scroll', later, { passive: true });
  addEventListener('resize', () => { if (wide.matches && shown >= 0) strip.scrollLeft = shown * strip.clientWidth; later(); });
  prev.addEventListener('click', () => go(cur() - 1));
  next.addEventListener('click', () => go(cur() + 1));

  // a mouse wheel or vertical trackpad swipe moves one slide per gesture
  let until = 0, acc = 0, lastT = 0;
  strip.addEventListener('wheel', e => {
    if (!wide.matches || e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    if (e.target.closest('textarea, select')) return;
    e.preventDefault();
    const now = performance.now();
    if (now < until) { until = Math.max(until, now + 180); return; }
    if (now - lastT > 300) acc = 0;
    lastT = now; acc += e.deltaY;
    if (Math.abs(acc) >= 25) { go(cur() + Math.sign(acc)); acc = 0; until = now + 700; }
  }, { passive: false });

  // keys
  d.addEventListener('keydown', e => {
    if (!wide.matches || e.altKey || e.metaKey || e.ctrlKey || (menu && !menu.hidden)) return;
    if (e.target.closest('input, textarea, select, button, [contenteditable]')) return;
    const k = e.key; let i = null;
    if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) i = cur() + 1;
    else if (k === 'ArrowLeft' || k === 'PageUp' || (k === ' ' && e.shiftKey)) i = cur() - 1;
    else if (k === 'Home') i = 0;
    else if (k === 'End') i = live().length - 1;
    if (i !== null) { e.preventDefault(); go(i); }
  });

  // links to a slide on this page
  d.addEventListener('click', e => {
    const a = e.target.closest('a[href*="#"]'); if (!a) return;
    const u = new URL(a.href, location.href); if (u.pathname !== location.pathname) return;
    const i = live().indexOf(d.getElementById(u.hash.slice(1))); if (i < 0) return;
    e.preventDefault(); if (menu && !menu.hidden) setMenu(false); go(i);
  });
  d.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => go(+btn.dataset.go)));

  // open on the slide named in the address
  if (location.hash) {
    const L = live(), i = L.indexOf(d.getElementById(location.hash.slice(1)));
    if (i > 0) { if (wide.matches) strip.scrollLeft = i * strip.clientWidth; else L[i].scrollIntoView(); }
  }
  wide.addEventListener('change', () => { shown = -1; update(); });
  update();

  // request form: one page; Send turns yellow once every field is filled; the confirmation opens after Send (prototype: nothing is sent)
  const form = d.querySelector('form.req');
  if (form) {
    const need = ['address', 'lender', 'type', 'name', 'phone', 'email'];
    const val = k => { const el = form.elements[k]; return el ? String(el.value || '').trim() : ''; };
    const send = form.querySelector('.send');
    const check = () => { const ok = need.every(val); send.classList.toggle('ready', ok); return ok; };
    form.addEventListener('input', check); form.addEventListener('change', check); check();
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!check()) { const k = need.find(k => !val(k)); const el = form.elements[k]; if (el && el.focus) el.focus(); return; }
      form.querySelectorAll('[data-sum]').forEach(dd => { dd.textContent = val(dd.dataset.sum) || '–'; });
      const ref = form.querySelector('[data-ref]'); if (ref) ref.textContent = 'VCO-' + String(Date.now()).slice(-6);
      const sent = d.getElementById('sent'); sent.hidden = false; shown = -1;
      requestAnimationFrame(() => go(1));
    });
  }
})();
