/* The opening stage (html.pin only). The live window starts beside the copy, smaller and running off the right
   edge, with another session's window behind it and a notification in front of it. Scrolling slides it home to the
   middle (its own CSS box, where it is the demo) over the headline, while the planes move at their own rates: the
   window behind drifts slowest and fades, the notification leaves first and fastest, the light follows the window.
   Before the scroll starts, a fine pointer tilts the planes against each other a few pixels. */
(function (S) {
  'use strict';

  const { span, ease } = S.scroll;

  const stage = S.$('.stage');
  const copy = S.$('.stage__copy');
  const title = S.$('.stage__title');
  const side = S.$('.stage__side');
  const head = S.$('.stage__head');
  const frame = S.$('.stage__frame');
  const back = S.$('.stage__back');
  const toast = S.$('.stage__toast');
  const light = S.$('.stage__light');
  const planes = [copy, head, frame, back, toast, light];
  const finePointer = window.matchMedia('(pointer: fine)');

  const ARRIVE = 0.62; // the window is home at this much of the run; the rest is the demo held in place
  const DEMO_AT = 0.72; // where the nav's Demo link lands

  let geo = null;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, raf: 0 };

  /* Measured untransformed: the window's home box, and the opening one beside the copy. */
  function layout(on) {
    planes.forEach(el => {
      el.style.transform = '';
      el.style.opacity = '';
      el.style.visibility = '';
    });
    geo = null;
    if (!on) return;

    const vw = stage.clientWidth;
    const vh = window.innerHeight;
    const home = { x: frame.offsetLeft, y: frame.offsetTop, w: frame.offsetWidth };
    const titleBottom = copy.offsetTop + title.offsetTop + title.offsetHeight;
    const sideRight = copy.offsetLeft + side.offsetLeft + side.offsetWidth;

    const x = Math.max(sideRight + 64, vw * 0.48);
    const y = titleBottom + 44;
    // Runs off the right edge by a quarter of what's left, but stays above the bottom edge.
    const w = Math.max(home.w * 0.45, Math.min((vw - x) * 1.28, ((vh - 32 - y) * 1280) / 700));
    geo = { home, x, y, w, h: (w * 700) / 1280, s: w / home.w };
    back.style.setProperty('--back-w', `${Math.round(w * 0.6)}px`);
  }

  function update(t) {
    if (t === null || !geo) return;
    const { home, x, y, w, h, s } = geo;
    const p = ease(span(t, 0, ARRIVE));
    const k = 1 - p;
    // The pointer's pull fades out as soon as the scroll takes over.
    const d = 1 - span(t, 0, 0.2);
    const px = pointer.x * d;
    const py = pointer.y * d;

    frame.style.transform = `translate3d(${(x - home.x) * k + px * 5}px, ${(y - home.y) * k + py * 4}px, 0) scale(${s + (1 - s) * p})`;

    copy.style.transform = `translate3d(${-px * 3}px, ${-36 * p}px, 0)`;
    const copyOpacity = 1 - span(t, 0.14, 0.48);
    copy.style.opacity = copyOpacity.toFixed(3);
    copy.style.visibility = copyOpacity < 0.02 ? 'hidden' : '';

    back.style.transform = `translate3d(${x + w * 0.5 - px * 10}px, ${y - h * 0.36 - 70 * p - py * 8}px, 0) scale(${1 - 0.08 * p})`;
    back.style.opacity = (0.42 * (1 - span(t, 0.08, 0.42))).toFixed(3);

    toast.style.transform = `translate3d(${x - 72 + px * 16}px, ${y + h - 96 - 300 * span(t, 0, 0.36) + py * 12}px, 0)`;
    toast.style.opacity = (1 - span(t, 0.06, 0.3)).toFixed(3);

    const cx = x + (w / 2) * k + (home.x + home.w / 2 - x) * p;
    const cy = y + h * 0.6 * k + (home.y + (home.w * 700) / 1280 / 2 - y) * p;
    light.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    light.style.opacity = (1 - 0.45 * p).toFixed(3);

    const headIn = span(t, 0.5, 0.68);
    head.style.opacity = headIn.toFixed(3);
    head.style.transform = `translate3d(0, ${12 * (1 - headIn)}px, 0)`;
    head.style.visibility = headIn < 0.02 ? 'hidden' : '';
  }

  /* The pointer eases toward where it is, a frame at a time, only while it moves. */
  function follow() {
    pointer.x += (pointer.tx - pointer.x) * 0.12;
    pointer.y += (pointer.ty - pointer.y) * 0.12;
    S.scroll.schedule();
    const settled = Math.abs(pointer.tx - pointer.x) < 0.002 && Math.abs(pointer.ty - pointer.y) < 0.002;
    pointer.raf = settled ? 0 : requestAnimationFrame(follow);
  }

  function aim(x, y) {
    pointer.tx = x;
    pointer.ty = y;
    if (!pointer.raf) pointer.raf = requestAnimationFrame(follow);
  }

  function onPointer(event) {
    if (!geo || !finePointer.matches || window.scrollY > window.innerHeight * 0.3) return;
    const clamp = v => Math.max(-1, Math.min(1, v));
    aim(clamp((event.clientX / window.innerWidth) * 2 - 1), clamp((event.clientY / window.innerHeight) * 2 - 1));
  }

  /* Pinned, #demo would land wherever the sticky box happens to be; scroll to the held demo instead. */
  function onDemoLink(event) {
    const link = event.target.closest('a[href="#demo"]');
    if (!link || !geo) return;
    event.preventDefault();
    const run = stage.offsetHeight - window.innerHeight;
    window.scrollTo({ top: stage.offsetTop + run * DEMO_AT });
  }

  function init() {
    S.scroll.add(stage, update, layout);
    stage.addEventListener('pointermove', onPointer);
    stage.addEventListener('pointerleave', () => aim(0, 0));
    document.addEventListener('click', onDemoLink);
  }

  S.stage = { init };
})(window.Stanza);
