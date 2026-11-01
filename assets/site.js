/* The VCO bloom, drawn in the browser (comment, 1 Nov): the same line screen as the brand artwork, rendered at the
   screen's own resolution (sharp, no grain), in two layers, slate blue under yellow, so the page can move them.
   The whole bloom is always fitted inside the window, whatever its size, so it is never cropped by the screen. */
const VCOBloom = (() => {
  const SH = { PEB: [[2, .13, .3], [3, .11, 1.1]], EGG: [[1, .08, 0], [2, .32, 0]], LOP: [[1, .5, 0], [2, .08, .9]] };
  // shapes in their own units: [x, y, radius, shape, rotation, strength]; the yellow pass sits up and right by SHIFT
  const SPECS = {
    pebble:  { cell: 16, parts: [[0, 0, 520, 'PEB', -22, .55]] },
    about:   { cell: 14, parts: [[0, 0, 280, 'PEB', -22, .55], [-170, -80, 165, 'EGG', -72, .5]] },
    service: { cell: 14, parts: [[0, 0, 320, 'LOP', -48, .55], [-180, 80, 160, 'EGG', -72, .5]] }
  };
  // where each page's bloom lives in the window, as fractions [left, top, right, bottom]; the bloom is scaled to fit
  const ZONES = {
    home:    { wide: [.47, .1, .98, .96], narrow: [.04, .56, .96, .985] },
    about:   { wide: [.02, .06, .46, .9], narrow: [.04, .56, .96, .985] },
    service: { wide: [.56, .03, .98, .5], narrow: [.3, .02, .98, .3] },
    request: { wide: [.62, .52, .98, .985], narrow: [.04, .6, .96, .985] },
    menu:    { wide: [.04, .56, .96, .985], narrow: [.04, .56, .96, .985] }
  };
  const SHIFT = [137, -45];
  const BLUE = '#7E9DB4', YELLOW = '#EBAA1A', BOOST = 2.3, ANG = 20 * Math.PI / 180;
  const fr = (sh, t) => { let f = 1; for (const [n, a, p] of SH[sh]) f += a * Math.cos(n * t + p); return Math.max(f, .2); };
  const harm = ([cx, cy, R, sh, rot, k]) => (x, y) => {
    const t = Math.atan2(y - cy, x - cx) - rot * Math.PI / 180;
    return k * Math.pow(Math.max(0, 1 - Math.hypot(x - cx, y - cy) / (R * fr(sh, t))), 1.2);
  };
  // the bloom's full extent in its own units, both passes included
  function extent(spec) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [cx, cy, R, sh, rot] of spec.parts) for (let i = 0; i < 360; i += 2) {
      const a = i * Math.PI / 180, r = R * fr(sh, a - rot * Math.PI / 180);
      for (const [ox, oy] of [[0, 0], SHIFT]) {
        const x = cx + ox + r * Math.cos(a), y = cy + oy + r * Math.sin(a);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
    return [x0, y0, x1, y1];
  }
  // place the bloom in its zone of a W x H window: scale s and offset so that window = offset + s * local
  function fit(spec, zone, W, H) {
    const [x0, y0, x1, y1] = extent(spec), [l, t, r, b] = zone;
    const zx = l * W, zy = t * H, zw = (r - l) * W, zh = (b - t) * H;
    const s = Math.min(zw / (x1 - x0), zh / (y1 - y0));
    return { s, ox: zx + (zw - s * (x1 - x0)) / 2 - s * x0, oy: zy + (zh - s * (y1 - y0)) / 2 - s * y0, box: [x0, y0, x1, y1] };
  }

  function layer(ctx, spec, which, W, H, dpr, zone) {
    const F = fit(spec, zone, W, H), s = F.s;
    const fs = spec.parts.map(p => harm([F.ox + s * p[0], F.oy + s * p[1], s * p[2], p[3], p[4], p[5]]));
    const base = (x, y) => 1 - fs.reduce((m, f) => m * (1 - f(x, y)), 1);
    const gap = spec.cell * .6 * Math.max(s, .35), dx = SHIFT[0] * s, dy = SHIFT[1] * s;
    const nx = Math.sin(ANG), ny = Math.cos(ANG), lx = Math.cos(-ANG), ly = Math.sin(-ANG), px = -ly, py = lx;
    let cov = base, ox = W / 2, oy = H / 2;
    if (which === 'y') {   // the yellow pass sits up and right, its rules landing midway between the blue ones
      cov = (x, y) => base(x - dx, y - dy);
      const Dof = (cx, cy) => Math.hypot(W, H) / 2 + gap + Math.hypot(cx - W / 2, cy - H / 2);
      const b0 = (W / 2) * nx + (H / 2) * ny - Dof(W / 2, H / 2);
      ox = W / 2 + dx; oy = H / 2 + dy;
      for (let k = 0; k < 8; k++) {
        const off = (((ox * nx + oy * ny - Dof(ox, oy) - b0) % gap) + gap) % gap;
        const adj = ((((.5 * gap - off + gap / 2) % gap) + gap) % gap) - gap / 2;
        ox += adj * nx; oy += adj * ny;
      }
    }
    // only work inside the bloom's own box
    const bx0 = F.ox + s * F.box[0] - gap, by0 = F.oy + s * F.box[1] - gap, bx1 = F.ox + s * F.box[2] + gap, by1 = F.oy + s * F.box[3] + gap;
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = which === 'y' ? YELLOW : BLUE;
    const D = Math.hypot(W, H) / 2 + gap + Math.hypot(ox - W / 2, oy - H / 2), step = Math.max(1.5, gap / 4);
    ctx.beginPath();
    const flush = run => {
      if (run.length < 2) return;
      const [x0, y0, t0] = run[0], [x1, y1, t1] = run[run.length - 1];
      ctx.moveTo(x0 - px * t0, y0 - py * t0);
      for (const [x, y, t] of run) ctx.lineTo(x - px * t, y - py * t);
      for (let i = run.length - 1; i >= 0; i--) { const [x, y, t] = run[i]; ctx.lineTo(x + px * t, y + py * t); }
      ctx.closePath();
      ctx.moveTo(x0 + t0, y0); ctx.arc(x0, y0, t0, 0, 2 * Math.PI);
      ctx.moveTo(x1 + t1, y1); ctx.arc(x1, y1, t1, 0, 2 * Math.PI);
    };
    for (let v = -D; v <= D; v += gap) {
      let run = [];
      for (let u = -D; u <= D + step; u += step) {
        const x = ox + u * lx + v * px, y = oy + u * ly + v * py;
        const t = (x > bx0 && x < bx1 && y > by0 && y < by1) ? gap * Math.min(1, BOOST * cov(x, y)) * .68 / 2 : 0;
        if (t > gap * .02) run.push([x, y, t]);
        else if (run.length) { flush(run); run = []; }
      }
      flush(run);
    }
    ctx.fill();
    // fade: full where the rules are heavy, thin rules all but vanish (a small soft mask, scaled up)
    const q = Math.max(2, W / 240), MW = Math.floor(W / q) + 1, MH = Math.floor(H / q) + 1;
    let a = new Float32Array(MW * MH);
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
      const x = i * q, y = j * q; if (x < bx0 || x > bx1 || y < by0 || y > by1) continue;
      const c = Math.min(1, BOOST * cov(x, y));
      a[j * MW + i] = c > .01 ? Math.pow(Math.min(1, 1.5 * c), 1.7) : 0;
    }
    for (let pass = 0; pass < 2; pass++) {
      const bb = new Float32Array(a.length);
      for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
        let sm = 0, n = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= MW || jj >= MH) continue;
          const wt = (di && dj) ? 1 : (di || dj) ? 2 : 4; sm += a[jj * MW + ii] * wt; n += wt;
        }
        bb[j * MW + i] = sm / n;
      }
      a = bb;
    }
    const m = document.createElement('canvas'); m.width = MW; m.height = MH;
    const mc = m.getContext('2d'), img = mc.createImageData(MW, MH);
    for (let k = 0; k < a.length; k++) img.data[k * 4 + 3] = Math.round(255 * a[k]);
    mc.putImageData(img, 0, 0);
    ctx.globalCompositeOperation = 'destination-in'; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(m, 0, 0, MW * q, MH * q);
    ctx.restore();
  }

  const narrow = () => innerWidth < 700;
  const size = () => { const dpr = Math.min(window.devicePixelRatio || 1, 2); return { W: innerWidth, H: innerHeight, dpr }; };
  function paint(canvas, spec, which, zoneName) {
    const { W, H, dpr } = size(), zone = ZONES[zoneName][narrow() ? 'narrow' : 'wide'];
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    layer(ctx, spec, which, W, H, dpr, zone); canvas.dataset.done = '1';
  }
  // both layers on one canvas over ink, brightened together (the phone menu)
  function paintInk(canvas) {
    const { W, H, dpr } = size(), spec = SPECS.pebble, zone = ZONES.menu.wide;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    for (const which of ['b', 'y']) {
      const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
      layer(c.getContext('2d'), spec, which, W, H, dpr, zone);
      ctx.globalCompositeOperation = which === 'b' ? 'source-over' : 'screen'; ctx.drawImage(c, 0, 0);
    }
  }
  function all() {
    document.querySelectorAll('.bloom[data-bloom]').forEach(el => {
      const spec = SPECS[el.dataset.bloom]; if (!spec) return;
      el.querySelectorAll('canvas').forEach(c => paint(c, spec, c.classList.contains('y') ? 'y' : 'b', el.dataset.zone));
    });
  }
  let t = 0, lastW = innerWidth, lastH = innerHeight;
  addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => {   // phones change height as the address bar hides; only redraw for real changes
      if (Math.abs(innerWidth - lastW) > 40 || Math.abs(innerHeight - lastH) > 160) { lastW = innerWidth; lastH = innerHeight; all(); }
    }, 250);
  });
  // the phone menu's bloom is drawn the first time the menu opens
  document.addEventListener('click', e => {
    if (!e.target.closest('.burger')) return;
    const mb = document.querySelector('.menu .mbloom');
    if (mb && !mb.dataset.done) requestAnimationFrame(() => { paintInk(mb); mb.dataset.done = '1'; });
  });
  return { all, paintInk, SPECS };
})();
VCOBloom.all();

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
