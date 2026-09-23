(() => {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger || window.ashmeMotion) return;

  gsap.registerPlugin(ScrollTrigger);

  const rootScopes = new WeakMap();
  const globalAbort = new AbortController();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = window.matchMedia('(min-width: 990px)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  function splitHeadline(headline) {
    if (!headline || headline.dataset.ashmeSplit === 'true') return [];
    const label = headline.textContent.trim().replace(/\s+/g, ' ');
    if (!label) return [];

    headline.setAttribute('aria-label', label);
    headline.dataset.ashmeSplit = 'true';
    const words = label.split(' ');
    const fragments = words.map((word) => {
      const clip = document.createElement('span');
      const inner = document.createElement('span');
      clip.className = 'ashme-hero__word-clip';
      inner.className = 'ashme-hero__word';
      inner.textContent = word;
      clip.append(inner);
      return clip;
    });
    headline.replaceChildren();
    fragments.forEach((fragment, index) => {
      headline.append(fragment);
      if (index < fragments.length - 1) headline.append(document.createTextNode(' '));
    });

    const lines = [];
    let currentTop = null;
    let line;
    let lineInner;
    fragments.forEach((fragment, index) => {
      const top = Math.round(fragment.getBoundingClientRect().top);
      if (currentTop !== top) {
        currentTop = top;
        line = document.createElement('span');
        line.className = 'ashme-hero__line-clip';
        line.setAttribute('aria-hidden', 'true');
        lineInner = document.createElement('span');
        lineInner.className = 'ashme-hero__line-inner';
        line.append(lineInner);
        lines.push(line);
      }
      lineInner.append(fragment);
      if (index < fragments.length - 1) lineInner.append(document.createTextNode(' '));
    });
    headline.replaceChildren(...lines);
    return lines.map((element) => element.querySelector('.ashme-hero__line-inner'));
  }

  function startVideo(root, scope) {
    const video = root.querySelector('.ashme-hero__video');
    if (!video) return;

    video.muted = true;
    video.playsInline = true;
    video.loop = false;
    video.removeAttribute('loop');
    if (reduceMotion.matches || navigator.connection?.saveData) {
      video.pause();
      return;
    }

    const clipStart = 3.25;
    const clipEnd = 4.75;
    let inView = false;
    const playWhenReady = () => {
      if (!inView || document.hidden || reduceMotion.matches) return;
      if (video.readyState >= 1 && (video.currentTime < clipStart || video.currentTime >= clipEnd) && video.duration > clipEnd) {
        try { video.currentTime = clipStart; } catch (_) { /* Metadata can still be settling. */ }
      }
      video.play().catch(() => {});
    };
    video.addEventListener('timeupdate', () => {
      if (video.currentTime >= clipEnd) {
        video.pause();
        video.currentTime = clipEnd;
      }
    }, { signal: scope.abort.signal });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        if (inView) playWhenReady();
        else video.pause();
      }, { threshold: 0.12 });
      observer.observe(video);
      scope.observers.push(observer);
    } else {
      inView = true;
      playWhenReady();
    }
    video.addEventListener('loadedmetadata', playWhenReady, { once: true, signal: scope.abort.signal });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) video.pause();
      else playWhenReady();
    }, { signal: scope.abort.signal });
    reduceMotion.addEventListener('change', (event) => {
      if (event.matches) video.pause();
      else playWhenReady();
    }, { signal: scope.abort.signal });
    scope.observers.push({ disconnect: () => video.pause() });
  }

  function initHero(root, scope) {
    const hero = root.matches('[data-ashme-hero]') ? root : root.querySelector('[data-ashme-hero]');
    if (!hero) return;
    const headline = hero.querySelector('h1');
    const lines = splitHeadline(headline);
    const copy = hero.querySelector('.ashme-hero__copy');
    const visual = hero.querySelector('.ashme-hero__visual');
    const stage = hero.querySelector('[data-ashme-scroll-stage]');
    const tiltLayer = hero.querySelector('[data-ashme-tilt-layer]');
    const floatLayer = hero.querySelector('[data-ashme-float]');
    const light = hero.querySelector('.ashme-hero__light');
    const orbit = hero.querySelector('.ashme-hero__orbit--outer');
    const note = hero.querySelector('.ashme-hero__product-note');
    const visualItems = [stage, note].filter(Boolean);
    const { signal } = scope.abort;

    startVideo(hero, scope);
    if (reduceMotion.matches) return;

    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
    const header = document.querySelector('.shopify-section-header');
    if (header && !header.dataset.ashmeIntro) {
      header.dataset.ashmeIntro = 'true';
      timeline.fromTo(header, { autoAlpha: 0, y: -12 }, { autoAlpha: 1, y: 0, duration: 0.48 }, 0);
    }
    const eyebrow = hero.querySelector('.ashme-eyebrow');
    if (eyebrow) timeline.fromTo(eyebrow, { autoAlpha: 0, y: 12, letterSpacing: '0.23em' }, { autoAlpha: 1, y: 0, letterSpacing: '0.14em', duration: 0.42 }, 0.06);
    if (lines.length) timeline.fromTo(lines, { yPercent: 112, rotateX: -8, transformOrigin: '50% 100%' }, { yPercent: 0, rotateX: 0, duration: 0.68, stagger: 0.105, ease: 'power4.out' }, 0.17);
    const supporting = [hero.querySelector('.ashme-hero__body'), hero.querySelector('.ashme-actions'), hero.querySelector('.ashme-hero__supporting')].filter(Boolean);
    timeline.fromTo(supporting, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.12 }, 0.46);
    timeline.fromTo(visualItems, { autoAlpha: 0, y: 38, scale: 0.94, rotationY: -7 }, { autoAlpha: 1, y: 0, scale: 1, rotationY: 0, duration: 0.86, stagger: 0.12, ease: 'power3.out' }, 0.2);
    if (orbit) gsap.to(orbit, { rotation: '+=360', duration: 42, repeat: -1, ease: 'none', transformOrigin: '50% 50%' });
    if (floatLayer) gsap.to(floatLayer, { y: -7, rotationZ: 0.35, duration: 6.4, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 1.25 });

    if (visual && tiltLayer && finePointer.matches) {
      const toX = gsap.quickTo(tiltLayer, 'x', { duration: 0.82, ease: 'power3.out' });
      const toY = gsap.quickTo(tiltLayer, 'y', { duration: 0.82, ease: 'power3.out' });
      const toRX = gsap.quickTo(tiltLayer, 'rotationX', { duration: 0.82, ease: 'power3.out' });
      const toRY = gsap.quickTo(tiltLayer, 'rotationY', { duration: 0.82, ease: 'power3.out' });
      const lightX = light && gsap.quickTo(light, 'x', { duration: 0.9, ease: 'power3.out' });
      const lightY = light && gsap.quickTo(light, 'y', { duration: 0.9, ease: 'power3.out' });
      visual.addEventListener('pointermove', (event) => {
        if (reduceMotion.matches) return;
        const bounds = visual.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        toX(x * 8);
        toY(y * -6);
        toRX(y * -3.2);
        toRY(x * 5.2);
        lightX?.(x * 18);
        lightY?.(y * 14);
      }, { passive: true, signal });
      visual.addEventListener('pointerleave', () => {
        toX(0); toY(0); toRX(0); toRY(0); lightX?.(0); lightY?.(0);
      }, { passive: true, signal });
    }

    if (desktop.matches) {
      const scrollTl = gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.65, invalidateOnRefresh: true } });
      scrollTl.to(copy, { y: -46, autoAlpha: 0.18, ease: 'none' }, 0);
      if (stage) scrollTl.to(stage, { y: 54, scale: 0.9, rotationY: -5, ease: 'none' }, 0);
      if (light) scrollTl.to(light, { opacity: 0.35, scale: 0.82, ease: 'none' }, 0);
    }
  }

  function initStory(root, scope) {
    const story = root.matches('ashme-story') ? root : root.querySelector('ashme-story');
    if (!story || !story.tabs?.length || reduceMotion.matches) return;
    const fill = story.querySelector('[data-ashme-progress-fill]');
    const progressBar = story.querySelector('[role="progressbar"]');
    if (desktop.matches) {
      const endDistance = () => `+=${Math.round(window.innerHeight * 1.4)}`;
      ScrollTrigger.create({
        trigger: story,
        start: 'top top+=84',
        end: endDistance,
        pin: true,
        pinSpacing: true,
        scrub: 0.7,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const index = Math.min(story.tabs.length - 1, Math.floor(self.progress * story.tabs.length));
          if (index !== story.activeIndex) story.activate(index, false);
          gsap.set(fill, { scaleX: self.progress });
          progressBar?.setAttribute('aria-valuenow', String(Math.round(self.progress * 100)));
        },
      });
    }
  }

  function initBenefits(root) {
    const benefits = root.querySelectorAll('.ashme-benefit');
    if (!benefits.length) return;
    gsap.fromTo(benefits, { y: 22, autoAlpha: 0 }, {
      y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.11, ease: 'power3.out',
      scrollTrigger: { trigger: benefits[0].parentElement, start: 'top 82%', once: true },
    });
  }

  function initSpotlight(root) {
    const media = root.querySelector('.ashme-spotlight__media');
    const content = root.querySelector('.ashme-spotlight__content');
    if (!media) return;
    gsap.fromTo(media, { y: 30, autoAlpha: 0, rotationY: 8, scale: 0.96, transformPerspective: 1100 }, {
      y: 0, autoAlpha: 1, rotationY: 0, scale: 1, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: media, start: 'top 84%', once: true },
    });
    if (content) gsap.fromTo([...content.children], { y: 18 }, {
      y: 0, duration: 0.48, stagger: 0.065, ease: 'power3.out',
      scrollTrigger: { trigger: content, start: 'top 84%', once: true },
    });
  }

  function initProductPage(root) {
    if (!document.body.classList.contains('template-product')) return;
    const media = root.querySelector('.product__media-wrapper');
    const info = root.querySelector('.product__info-container');
    if (media) gsap.fromTo(media, { autoAlpha: 0, y: 24, scale: 0.98 }, {
      autoAlpha: 1, y: 0, scale: 1, duration: 0.82, ease: 'power3.out',
      scrollTrigger: { trigger: media, start: 'top 90%', once: true },
    });
    if (info) gsap.fromTo([...info.children], { y: 16 }, {
      y: 0, duration: 0.48, stagger: 0.06, ease: 'power3.out',
      scrollTrigger: { trigger: info, start: 'top 92%', once: true },
    });
  }

  function initFaq(root, scope) {
    const list = root.querySelector('.ashme-faq__list');
    if (!list) return;
    const { signal } = scope.abort;
    list.addEventListener('click', (event) => {
      if (reduceMotion.matches) return;
      const summary = event.target.closest('summary');
      const details = summary?.parentElement;
      if (!details?.matches('.ashme-faq__item')) return;
      event.preventDefault();
      const answer = details.querySelector('.ashme-faq__answer');
      if (!answer) return;
      gsap.killTweensOf(answer);
      if (details.open) {
        gsap.to(answer, { height: 0, autoAlpha: 0, y: -6, duration: 0.26, ease: 'power2.in', onComplete: () => { details.open = false; gsap.set(answer, { clearProps: 'height,opacity,visibility,transform' }); } });
      } else {
        details.open = true;
        gsap.fromTo(answer, { height: 0, autoAlpha: 0, y: 8 }, { height: 'auto', autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out', onComplete: () => gsap.set(answer, { clearProps: 'height,opacity,visibility,transform' }) });
      }
    }, { signal });
  }

  function initReveals(root, scope) {
    if (root.querySelector('[data-ashme-hero]')) initHero(root, scope);
    if (root.querySelector('ashme-story')) initStory(root, scope);
    if (root.querySelector('.ashme-benefit')) initBenefits(root);
    if (root.querySelector('.ashme-spotlight__media')) initSpotlight(root);
    initProductPage(root);
    initFaq(root, scope);
  }

  function initRoot(root) {
    if (!root || rootScopes.has(root)) return;
    const scope = { motion: gsap.matchMedia() };
    rootScopes.set(root, scope);
    scope.motion.add({
      reduce: '(prefers-reduced-motion: reduce)',
      desktop: '(min-width: 990px)',
      finePointer: '(hover: hover) and (pointer: fine)',
    }, ({ conditions }) => {
      const branch = { abort: new AbortController(), observers: [], motion: scope.motion };
      if (!conditions.reduce) initReveals(root, branch);
      return () => {
        branch.abort.abort();
        branch.observers.forEach((observer) => observer.disconnect());
      };
    });
  }

  function cleanupRoot(root) {
    const scope = rootScopes.get(root);
    if (!scope) return;
    scope.motion.revert();
    rootScopes.delete(root);
  }

  function initGlobalMotion(signal) {
    if (reduceMotion.matches) return () => {};
    const header = document.querySelector('.shopify-section-header');
    if (header) {
      ScrollTrigger.create({
        start: 52,
        onEnter: () => header.classList.add('ashme-header-scrolled'),
        onLeaveBack: () => header.classList.remove('ashme-header-scrolled'),
      });
    }

    const magneticButtons = document.querySelectorAll('.ashme-hero .ashme-button--primary, .ashme-spotlight__submit, .product-form__submit, .ashme-mobile-buy__button');
    if (finePointer.matches) magneticButtons.forEach((button) => {
      const xTo = gsap.quickTo(button, 'x', { duration: 0.46, ease: 'power3.out' });
      const yTo = gsap.quickTo(button, 'y', { duration: 0.46, ease: 'power3.out' });
      button.addEventListener('pointermove', (event) => {
        if (reduceMotion.matches) return;
        const bounds = button.getBoundingClientRect();
        xTo(((event.clientX - bounds.left) / bounds.width - 0.5) * 7);
        yTo(((event.clientY - bounds.top) / bounds.height - 0.5) * 5);
      }, { passive: true, signal });
      button.addEventListener('pointerleave', () => { xTo(0); yTo(0); }, { passive: true, signal });
    });

    const drawer = document.querySelector('cart-drawer');
    let drawerObserver;
    let unsubscribeCart;
    if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      unsubscribeCart = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
        if (reduceMotion.matches || event?.source !== 'product-form') return;
        const cartIcon = document.querySelector('.header__icon--cart');
        if (cartIcon) gsap.fromTo(cartIcon, { scale: 1 }, { scale: 1.1, duration: 0.22, repeat: 1, yoyo: true, ease: 'power2.out', clearProps: 'transform' });
      });
    }
    if (drawer && 'MutationObserver' in window) {
      let wasActive = false;
      drawerObserver = new MutationObserver(() => {
        const isActive = drawer.classList.contains('active');
        if (isActive && !wasActive && !reduceMotion.matches) {
          const content = drawer.querySelectorAll('.drawer__header, .cart-item, .totals, .cart__checkout-button, .drawer__inner-empty > *');
          if (content.length) gsap.fromTo(content, { autoAlpha: 0, x: 16 }, { autoAlpha: 1, x: 0, duration: 0.4, stagger: 0.045, ease: 'power3.out', delay: 0.08 });
        }
        wasActive = isActive;
      });
      drawerObserver.observe(drawer, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
    }

    ScrollTrigger.refresh();
    return () => { drawerObserver?.disconnect(); unsubscribeCart?.(); };
  }

  function boot() {
    const globalMotion = gsap.matchMedia();
    globalMotion.add('(prefers-reduced-motion: no-preference)', () => {
      const abort = new AbortController();
      const cleanup = initGlobalMotion(abort.signal);
      return () => { abort.abort(); cleanup?.(); };
    });
    document.querySelectorAll('.shopify-section').forEach(initRoot);
    document.addEventListener('shopify:section:load', (event) => initRoot(event.target), { signal: globalAbort.signal });
    document.addEventListener('shopify:section:unload', (event) => cleanupRoot(event.target), { signal: globalAbort.signal });
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }

  if (document.readyState === 'loading' || document.readyState === 'interactive') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
  window.ashmeMotion = { refresh: () => ScrollTrigger.refresh() };
})();
