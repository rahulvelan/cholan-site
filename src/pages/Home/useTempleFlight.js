import { useEffect } from 'react';
import { gsap } from '../../lib/gsap.js';

const FRAME_COUNT = 271; // original `uf`
const LAST_FRAME = 270; // original `df`
const FRAMES_PER_SECOND = 18; // original `ff`
const END_HOLD_SECONDS = 2.5; // original `pf`
const frameUrl = (variant, index) => `/images/temple/${variant}/${String(index).padStart(3, '0')}.webp`; // original `mf`

// Canvas frame-sequence "flight over the temple" + intro/cards timeline (the effect inside original `hf`).
// Frames are fetched as blobs, decoded to ImageBitmaps around the playhead and painted onto the canvas;
// a time-based loop advances the playhead while the section is at least half visible.
export function useTempleFlight(sectionRef, canvasRef) {
  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth <= 800;
    const variant = isMobile ? 'sm' : 'lg';
    const step = isMobile ? 2 : 1;
    const ctx2d = canvas.getContext('2d', { alpha: false });
    const playhead = { frame: 0 };
    const hq = { frame: -1, img: null, alpha: 0 };
    let hqTween = null;
    const hqCache = new Map();
    let disposed = false;
    let lastDrawn = -1;
    const blobs = Array(FRAME_COUNT).fill(null);
    const bitmaps = Array(FRAME_COUNT).fill(null);
    const decoding = new Set();
    const lookahead = isMobile ? 24 : 30;

    const decodeFrame = (index) => {
      bitmaps[index] ||
        decoding.has(index) ||
        !blobs[index] ||
        (decoding.add(index),
        createImageBitmap(blobs[index])
          .then((bitmap) => {
            if ((decoding.delete(index), disposed || index < playhead.frame - 4 - 8))
              return bitmap.close();
            ((bitmaps[index] = bitmap),
              (lastDrawn < 0 || Math.abs(index - playhead.frame) <= 2 * step) && draw(true),
              pump());
          })
          .catch(() => decoding.delete(index)));
    };
    let pumpQueued = false;
    function pump() {
      if (disposed) return;
      const current = Math.floor(playhead.frame);
      for (
        let i = Math.max(0, current - 4);
        i <= Math.min(LAST_FRAME, current + lookahead) && decoding.size < 4;
        i++
      )
        i % step === 0 && blobs[i] && !bitmaps[i] && decodeFrame(i);
      for (let i = 0; i < FRAME_COUNT; i++) {
        const far = i < current - 4 - 8 || i > current + lookahead + 8;
        bitmaps[i] && far && i !== hq.frame && (bitmaps[i].close(), (bitmaps[i] = null));
      }
    }
    const schedulePump = () => {
      pumpQueued ||
        ((pumpQueued = true),
        requestAnimationFrame(() => {
          ((pumpQueued = false), pump());
        }));
    };
    const fetchFrame = (index) =>
      fetch(frameUrl(variant, index))
        .then((res) => (res.ok ? res.blob() : null))
        .then((blob) => {
          !disposed &&
            blob &&
            ((blobs[index] = blob),
            index >= playhead.frame - 4 && index <= playhead.frame + lookahead && schedulePump());
        })
        .catch(() => {});
    const order = [];
    for (let i = 0; i < FRAME_COUNT; i += step) order.push(i);
    order.includes(LAST_FRAME) || order.push(LAST_FRAME);
    let started = false;
    const startLoading = () => {
      if (started) return;
      started = true;
      const queue = order.slice(1);
      const worker = async () => {
        for (; queue.length && !disposed; ) await fetchFrame(queue.shift());
      };
      for (let i = 0; i < 6; i++) worker();
    };
    const prevLoaded = (from, span) => {
      for (let i = from; i >= Math.max(0, from - span); i--) if (bitmaps[i]) return i;
      return -1;
    };
    const nextLoaded = (from, span) => {
      for (let i = from; i <= Math.min(LAST_FRAME, from + span); i++) if (bitmaps[i]) return i;
      return -1;
    };
    const nearestLoaded = (index) => {
      if (bitmaps[index]) return index;
      for (let d = 1; d < FRAME_COUNT; d++) {
        if (bitmaps[index - d]) return index - d;
        if (bitmaps[index + d]) return index + d;
      }
      return -1;
    };
    // "cover" fit of an image into the canvas
    const coverRect = (img) => {
      const cw = canvas.width;
      const ch = canvas.height;
      const scale = Math.max(cw / img.width, ch / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      return [(cw - w) / 2, (ch - h) / 2, w, h];
    };
    function draw(force = false) {
      if (((ctx2d.imageSmoothingQuality = hq.frame >= 0 ? 'high' : 'medium'), hq.frame >= 0)) {
        const base = nearestLoaded(hq.frame);
        ((ctx2d.globalAlpha = 1),
          base >= 0 && ctx2d.drawImage(bitmaps[base], ...coverRect(bitmaps[base])),
          hq.img &&
            ((ctx2d.globalAlpha = hq.alpha),
            ctx2d.drawImage(hq.img, ...coverRect(hq.img)),
            (ctx2d.globalAlpha = 1)));
        return;
      }
      const pos = Math.min(Math.max(playhead.frame, 0), LAST_FRAME);
      if (!force && Math.abs(pos - lastDrawn) < 0.002) return;
      const before = prevLoaded(Math.floor(pos), 4);
      const after = nextLoaded(Math.ceil(pos), 4);
      if (((ctx2d.globalAlpha = 1), before >= 0 && after >= 0 && after !== before)) {
        ctx2d.drawImage(bitmaps[before], ...coverRect(bitmaps[before]));
        const mix = (pos - before) / (after - before);
        mix > 0.01 &&
          ((ctx2d.globalAlpha = Math.min(mix, 1)),
          ctx2d.drawImage(bitmaps[after], ...coverRect(bitmaps[after])),
          (ctx2d.globalAlpha = 1));
      } else {
        const only = before >= 0 ? before : after >= 0 ? after : nearestLoaded(Math.round(pos));
        if (only < 0) return;
        ctx2d.drawImage(bitmaps[only], ...coverRect(bitmaps[only]));
      }
      lastDrawn = pos;
    }
    // high-quality final frame, cross-faded in over the low-res sequence
    const loadHq = (index) => {
      if (hqCache.has(index)) return hqCache.get(index);
      const promise = fetch(frameUrl('hq', index))
        .then((res) => {
          if (!res.ok) throw Error(`hq ${index}: ${res.status}`);
          return res.blob();
        })
        .then((blob) => createImageBitmap(blob));
      return (promise.catch(() => hqCache.delete(index)), hqCache.set(index, promise), promise);
    };
    const showHq = (index) => {
      (hqTween?.kill(),
        (hq.frame = index),
        (hq.img = null),
        (hq.alpha = 0),
        draw(true),
        loadHq(index)
          .then((bitmap) => {
            disposed ||
              hq.frame !== index ||
              ((hq.img = bitmap),
              (hqTween = gsap.to(hq, {
                alpha: 1,
                duration: 0.5,
                ease: 'sine.out',
                onUpdate: () => draw(true),
              })));
          })
          .catch(() => {}));
    };
    const clearHq = () => {
      hq.frame < 0 || (hqTween?.kill(), (hq.frame = -1), (hq.img = null), (lastDrawn = -1));
    };
    const resizeObserver = new ResizeObserver(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      ((canvas.width = Math.max(1, Math.round(rect.width * dpr))),
        (canvas.height = Math.max(1, Math.round(rect.height * dpr))),
        draw(true));
    });
    if ((resizeObserver.observe(canvas), reduced))
      return (
        section.classList.add('temple--static'),
        (playhead.frame = LAST_FRAME),
        fetchFrame(LAST_FRAME).then(() => {
          (decodeFrame(LAST_FRAME), showHq(LAST_FRAME));
        }),
        () => {
          ((disposed = true), resizeObserver.disconnect());
        }
      );
    const isNarrow = window.matchMedia('(max-width: 700px)').matches;
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
    const cards = gsap.utils.toArray('.temple__card', section);
    tl.fromTo(
      '.temple__intro-kicker',
      { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: 0.5 },
      0.3,
    )
      .fromTo(
        '.temple__intro-title .temple__word > span',
        { yPercent: 110 },
        { yPercent: 0, duration: 0.7, stagger: 0.06 },
        0.4,
      )
      .fromTo(
        '.temple__intro-rule',
        { scaleX: 0 },
        { scaleX: 1, duration: 0.6, ease: 'power2.inOut' },
        0.9,
      )
      .to(
        '.temple__intro-title .temple__word > span',
        { yPercent: -110, duration: 0.45, stagger: 0.03, ease: 'power2.in' },
        2.9,
      )
      .to('.temple__intro', { autoAlpha: 0, duration: 0.4, ease: 'sine.in' }, 3.1)
      .fromTo(
        '.temple__heading .temple__word > span',
        { yPercent: 110 },
        { yPercent: 0, duration: 0.7, stagger: 0.08 },
        3.3,
      )
      .fromTo(
        '.temple__heading-rule',
        { scaleX: 0 },
        { scaleX: 1, duration: 0.6, ease: 'power2.inOut' },
        3.7,
      );
    const cardGap = isNarrow ? 2.6 : 0.5;
    cards.forEach((card, i) => {
      const at = 3.8 + i * cardGap;
      (tl
        .fromTo(card, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.6 }, at)
        .fromTo(
          card.querySelectorAll('.temple__card-n, .temple__card-body > *'),
          { autoAlpha: 0, y: 10 },
          { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.07 },
          at + 0.1,
        )
        .add(() => card.classList.add('is-lit'), at + 0.2),
        isNarrow &&
          i < cards.length - 1 &&
          tl.to(card, { autoAlpha: 0, y: -20, duration: 0.4, ease: 'power2.in' }, at + cardGap - 0.4));
    });
    const progressFill = section.querySelector('.temple__progress-fill');
    let playing = false;
    let active = false;
    let holdLeft = 0;
    let raf = 0;
    let lastTs = 0;
    const ceilToStep = (frame) => Math.min(LAST_FRAME, Math.ceil(frame / step) * step);
    const tick = (ts) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((ts - lastTs) / 1e3, 0.1);
      if (((lastTs = ts), !active)) return;
      if (holdLeft > 0) {
        ((holdLeft -= dt), holdLeft <= 0 && ((playhead.frame = 0), clearHq(), schedulePump(), (playing = true)));
        return;
      }
      if (!playing) return;
      const next = Math.min(LAST_FRAME, playhead.frame + dt * FRAMES_PER_SECOND);
      if (!bitmaps[ceilToStep(next)]) {
        schedulePump();
        return;
      }
      ((playhead.frame = next),
        clearHq(),
        draw(),
        schedulePump(),
        (progressFill.style.transform = `scaleX(${playhead.frame / LAST_FRAME})`),
        playhead.frame >= LAST_FRAME && ((playing = false), showHq(LAST_FRAME), (holdLeft = END_HOLD_SECONDS)));
    };
    const start = () => {
      (tl.play(), (active = true), holdLeft <= 0 && (playing = true), (lastTs = performance.now()));
    };
    const stop = () => {
      ((active = false), tl.pause());
    };
    raf = requestAnimationFrame((ts) => {
      ((lastTs = ts), tick(ts));
    });
    const firstFrame = fetchFrame(0).then(() => decodeFrame(0));
    const loadObserver = new IntersectionObserver(
      (entries) => entries.some((entry) => entry.isIntersecting) && startLoading(),
      { rootMargin: '200% 0px' },
    );
    loadObserver.observe(section);
    const playObserver = new IntersectionObserver(
      (entries) => entries.forEach((entry) => (entry.isIntersecting ? firstFrame.then(start) : stop())),
      { threshold: 0.5 },
    );
    return (
      playObserver.observe(section),
      () => {
        ((disposed = true),
          cancelAnimationFrame(raf),
          resizeObserver.disconnect(),
          loadObserver.disconnect(),
          playObserver.disconnect(),
          tl.kill(),
          hqTween?.kill(),
          bitmaps.forEach((bitmap) => bitmap?.close()),
          hqCache.forEach((promise) => promise.then((bitmap) => bitmap.close()).catch(() => {})));
      }
    );
  }, []);
}
