import { createCinematicScene } from './ashme-intro-scene.js';

const root = document.querySelector('[data-ashme-cinematic]');

if (root && !window.__ashmeCinematicV2Started) {
  window.__ashmeCinematicV2Started = true;
  const canvas = root.querySelector('[data-ashme-canvas]');
  const skip = root.querySelector('[data-ashme-skip]');
  const eyebrow = root.querySelector('[data-ashme-eyebrow]');
  const line = root.querySelector('[data-ashme-line]');
  const loading = root.querySelector('[data-ashme-loading]');
  const progress = root.querySelector('[data-ashme-progress]');
  const sessionKey = 'ashme-cinematic-intro-seen';
  const gsap = window.gsap;
  let cinematic;
  let timeline;
  let finished = false;
  let resize;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const remember = () => { try { sessionStorage.setItem(sessionKey, '1'); } catch {} };
  const restorePage = () => {
    document.documentElement.classList.remove('ashme-cinematic-pending', 'ashme-cinematic-active', 'ashme-website-reveal');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    if (window.__ashmeRevealFailsafe) clearTimeout(window.__ashmeRevealFailsafe);
  };
  const failOpen = () => {
    if (finished) return;
    finished = true;
    remember();
    restorePage();
    root.hidden = true;
    skip?.removeEventListener('click', onSkip);
    window.removeEventListener('keydown', onKeyDown);
    cinematic?.renderer.setAnimationLoop(null);
    if (resize) window.removeEventListener('resize', resize);
    if (cinematic) cinematic.dispose();
  };
  const onKeyDown = (event) => { if (event.key === 'Escape') onSkip(); };
  const onSkip = () => {
    if (finished) return;
    remember();
    timeline?.kill();
    if (gsap && cinematic) {
      gsap.to(root, { autoAlpha: 0, duration: 0.48, ease: 'power2.inOut', onComplete: failOpen });
    } else failOpen();
  };

  if (!reducedMotion && gsap && document.documentElement.classList.contains('ashme-cinematic-pending')) {
    root.hidden = false;
    document.documentElement.classList.add('ashme-cinematic-active');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    skip.addEventListener('click', onSkip);
    window.addEventListener('keydown', onKeyDown);
    createCinematicScene(root, canvas).then((scene) => {
      if (finished) { scene.dispose(); return; }
      cinematic = scene;
      gsap.to(loading, { autoAlpha: 0, duration: 0.34, ease: 'power1.out' });
      scene.renderer.setAnimationLoop(scene.render);
      resize = scene.resize;
      window.addEventListener('resize', resize, { passive: true });
      canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); failOpen(); }, { once: true });
      const state = scene.state;
      let copyState = 0;
      const setCopy = (index, y = 0) => {
        if (copyState === index) return;
        copyState = index;
        gsap.to([eyebrow, line], { autoAlpha: 0, y: -8, duration: 0.2, stagger: 0.025, onComplete: () => {
          if (index === 1) {
            eyebrow.textContent = root.dataset.productEyebrow;
            line.textContent = root.dataset.productLine;
          }
          gsap.to([eyebrow, line], { autoAlpha: 1, y, duration: 0.38, stagger: 0.055, ease: 'power2.out' });
        } });
      };
      const requestedHold = Number(new URLSearchParams(location.search).get('ashme_hold'));
      const holdAt = Number.isFinite(requestedHold) && requestedHold > 0
        ? Math.min(requestedHold, 6.95)
        : null;
      timeline = gsap.timeline({
        onUpdate: () => { progress.style.transform = `scaleX(${timeline.progress()})`; },
        onComplete: failOpen,
        paused: holdAt !== null
      });
      root._ashmeTimeline = timeline;
      timeline.fromTo([eyebrow, line], { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.62, stagger: 0.1, ease: 'power2.out' }, 0.08);
      timeline.to(state, { burn: 1, duration: 1.24, ease: 'sine.inOut' }, 0.72);
      timeline.to(state, { ash: 1, duration: 1.25, ease: 'power2.inOut' }, 1.28);
      timeline.to(state, { sag: 1, duration: 0.38, ease: 'power2.in' }, 2.52);
      timeline.to(state, { break: 1, duration: 0.22, ease: 'power2.in' }, 2.78);
      timeline.to(state, { reveal: 1, duration: 2.1, ease: 'power2.out' }, 2.68);
      timeline.to(state, { fall: 1, duration: 2.45, ease: 'power2.in' }, 2.98);
      timeline.to(state, { exit: 1, duration: 1.35, ease: 'power1.in' }, 3.36);
      timeline.to(state, { impact: 1, duration: 0.5, ease: 'elastic.out(1, 0.6)' }, 5.22);
      timeline.call(() => setCopy(1), null, 5.34);
      timeline.to(state, { hero: 1, duration: 0.96, ease: 'power2.inOut' }, 5.32);
      timeline.call(() => {
        document.documentElement.classList.remove('ashme-cinematic-pending');
        document.documentElement.classList.add('ashme-website-reveal');
      }, null, 6.04);
      timeline.to(root, { autoAlpha: 0, duration: 0.92, ease: 'power2.inOut' }, 6.08);
      timeline.to([eyebrow, line], { autoAlpha: 0, y: -8, duration: 0.34, ease: 'power2.in' }, 6.08);
      timeline.call(() => document.documentElement.classList.remove('ashme-website-reveal'), null, 7.02);
      if (holdAt !== null) {
        timeline.pause();
        timeline.seek(holdAt, false);
        timeline.pause();
        if (holdAt >= 5.34) {
          eyebrow.textContent = root.dataset.productEyebrow;
          line.textContent = root.dataset.productLine;
          gsap.set([eyebrow, line], { autoAlpha: 1, y: 0 });
        }
      }
    }).catch((error) => { console.error('AshMe cinematic intro failed to load.', error); failOpen(); });
  } else {
    root.hidden = true;
    restorePage();
  }
}
