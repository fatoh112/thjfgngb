(() => {
  const root = document.querySelector('[data-ashme-video-intro]');
  const doc = document.documentElement;
  const pendingClass = 'ashme-video-intro-pending';
  const activeClass = 'ashme-video-intro-active';
  const revealingClass = 'ashme-video-intro-revealing';
  const sessionKey = 'ashmeVideoIntroSeen';

  if (!root || !doc.classList.contains(pendingClass) || window.Shopify?.designMode) return;

  if (window.__ashmeVideoIntroFailsafe) window.clearTimeout(window.__ashmeVideoIntroFailsafe);

  const video = root.querySelector('[data-ashme-video]');
  const enter = root.querySelector('[data-ashme-enter]');
  const skip = root.querySelector('[data-ashme-skip]');
  const status = root.querySelector('[data-ashme-status]');
  const statusText = root.querySelector('[data-ashme-status-text]');
  const errorText = root.dataset.errorText || 'Audio could not start. Please try again or skip the intro.';
  const controller = new AbortController();
  let closed = false;
  let mediaReady = false;
  let cleanupTimer;

  const remember = () => {
    try { window.sessionStorage.setItem(sessionKey, '1'); } catch {}
  };

  const updateStatus = (message) => {
    statusText.textContent = message;
    status.hidden = !message;
  };

  const cleanup = () => {
    window.clearTimeout(cleanupTimer);
    controller.abort();
    video.pause();
    video.removeAttribute('src');
    video.removeAttribute('poster');
    video.load();
    root.remove();
  };

  const reveal = () => {
    if (closed) return;
    closed = true;
    remember();
    video.pause();
    root.classList.add('is-closing');
    root.setAttribute('aria-hidden', 'true');
    root.inert = true;
    doc.classList.remove(pendingClass, activeClass);
    doc.classList.add(revealingClass);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => doc.classList.remove(revealingClass));
    });
    cleanupTimer = window.setTimeout(cleanup, 730);
  };

  const onSkip = () => reveal();
  const onKeyDown = (event) => {
    if (event.key === 'Escape' && !closed) {
      event.preventDefault();
      reveal();
    }
  };

  const onReady = () => {
    if (closed || mediaReady || video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return;
    mediaReady = true;
    root.classList.add('is-ready');
    root.dataset.state = 'ready';
    enter.hidden = false;
    enter.disabled = false;
    updateStatus('');
  };

  const onPlaying = () => {
    if (closed) return;
    remember();
    root.classList.add('is-playing');
    root.dataset.state = 'playing';
    updateStatus('');
  };

  const onMediaError = () => {
    if (!closed) reveal();
  };

  const onEnter = () => {
    if (closed || enter.disabled) return;
    video.pause();
    video.currentTime = 0;
    video.muted = false;
    video.volume = 1;
    root.classList.add('is-playing');
    root.dataset.state = 'playing';

    let playback;
    try {
      playback = video.play();
    } catch {
      playback = Promise.reject();
    }

    Promise.resolve(playback).catch(() => {
      if (closed) return;
      root.classList.remove('is-playing');
      root.dataset.state = 'ready';
      enter.disabled = false;
      updateStatus(errorText);
    });
  };

  video.autoplay = false;
  video.controls = false;
  video.muted = false;
  doc.classList.add(activeClass);

  const options = { signal: controller.signal };
  video.addEventListener('canplay', onReady, options);
  video.addEventListener('playing', onPlaying, options);
  video.addEventListener('ended', reveal, options);
  video.addEventListener('error', onMediaError, options);
  enter.addEventListener('click', onEnter, options);
  skip.addEventListener('click', onSkip, options);
  document.addEventListener('keydown', onKeyDown, options);

  video.poster = video.dataset.posterSrc;
  video.preload = 'auto';
  video.src = video.dataset.videoSrc;
  video.load();

  if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) onReady();
  if (video.error) onMediaError();
})();
