if (!customElements.get('ashme-story')) {
  customElements.define(
    'ashme-story',
    class AshmeStory extends HTMLElement {
      connectedCallback() {
        if (this.abortController) return;
        this.abortController = new AbortController();
        const { signal } = this.abortController;
        this.tabs = [...this.querySelectorAll('[role="tab"][data-ashme-step-title]')];
        this.panel = this.querySelector('[role="tabpanel"]');
        this.panelTitle = this.querySelector('[data-ashme-panel-title]');
        this.copy = this.querySelector('[data-ashme-panel-copy]');
        this.panelNumber = this.querySelector('[data-ashme-panel-number]');
        this.stageNumber = this.querySelector('[data-ashme-current-number]');
        this.stageImage = this.querySelector('.ashme-process__image');
        this.progress = this.querySelector('[data-ashme-progress-fill]');
        this.progressBar = this.querySelector('[role="progressbar"]');
        this.previous = this.querySelector('[data-ashme-previous]');
        this.next = this.querySelector('[data-ashme-next]');
        if (!this.tabs.length || !this.panel || !this.panelTitle || !this.copy) return;

        this.total = this.tabs.length;
        this.activeIndex = Math.max(0, this.tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));
        this.setAttribute('data-ready', 'true');
        this.tabs.forEach((tab, index) => {
          tab.addEventListener('click', () => this.activate(index, true), { signal });
          tab.addEventListener('keydown', (event) => this.onTabKeydown(event, index), { signal });
        });
        this.previous?.addEventListener('click', () => this.activate(this.activeIndex - 1, true), { signal });
        this.next?.addEventListener('click', () => this.activate(this.activeIndex + 1, true), { signal });
        this.activate(this.activeIndex, false, true);
      }

      disconnectedCallback() {
        this.abortController?.abort();
        this.abortController = null;
        this.transition?.kill();
      }

      activate(index, moveFocus, initial = false) {
        if (!this.total) return;
        const nextIndex = Math.min(this.total - 1, Math.max(0, index));
        if (nextIndex === this.activeIndex && !initial) {
          if (moveFocus) this.tabs[nextIndex].focus();
          return;
        }

        const previousIndex = this.activeIndex;
        this.activeIndex = nextIndex;
        const applyState = () => {
          const active = this.tabs[this.activeIndex];
          this.tabs.forEach((tab, tabIndex) => {
            const selected = tabIndex === this.activeIndex;
            tab.setAttribute('aria-selected', String(selected));
            tab.setAttribute('tabindex', selected ? '0' : '-1');
            tab.classList.toggle('is-active', selected);
          });
          this.panel.setAttribute('aria-labelledby', active.id);
          this.panelTitle.textContent = active.dataset.ashmeStepTitle || '';
          this.copy.textContent = active.dataset.ashmeStepCopy || '';
          const current = String(this.activeIndex + 1).padStart(2, '0');
          const total = String(this.total).padStart(2, '0');
          this.panelNumber.textContent = `${current} / ${total}`;
          if (this.stageNumber) this.stageNumber.textContent = current;
          if (this.previous) this.previous.disabled = this.activeIndex === 0;
          if (this.next) this.next.disabled = this.activeIndex === this.total - 1;
          this.dataset.step = String(this.activeIndex + 1);
          this.progressBar?.setAttribute('aria-valuenow', String(Math.round(((this.activeIndex + 1) / this.total) * 100)));
          if (moveFocus) active.focus();
        };

        const gsap = window.gsap;
        const motionAllowed = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (initial || !motionAllowed || !gsap || previousIndex < 0) {
          applyState();
          if (this.progress && gsap) gsap.set(this.progress, { scaleX: (nextIndex + 1) / this.total });
          return;
        }

        this.transition?.kill();
        const focalPoints = [
          { x: -8, y: 12, scale: 1.2, rotation: -2 },
          { x: 10, y: -10, scale: 1.34, rotation: 1.2 },
          { x: -4, y: -18, scale: 1.24, rotation: -0.8 },
          { x: 8, y: 16, scale: 1.32, rotation: 1.8 },
        ];
        const focus = focalPoints[nextIndex % focalPoints.length];
        const textParts = [this.panelNumber, this.panelTitle, this.copy];
        this.transition = gsap.timeline();
        this.transition.to(textParts, { autoAlpha: 0, y: -14, duration: 0.2, stagger: 0.025, ease: 'power2.in' });
        this.transition.add(applyState);
        this.transition.fromTo(textParts, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.46, stagger: 0.055, ease: 'power3.out' });
        if (this.stageImage) this.transition.to(this.stageImage, { ...focus, duration: 0.76, ease: 'power3.inOut' }, 0);
        if (this.progress) this.transition.to(this.progress, { scaleX: (nextIndex + 1) / this.total, duration: 0.65, ease: 'power3.inOut' }, 0);
      }

      onTabKeydown(event, index) {
        let nextIndex = index;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % this.total;
        else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + this.total) % this.total;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = this.total - 1;
        else return;
        event.preventDefault();
        this.activate(nextIndex, true);
      }
    }
  );
}

if (!customElements.get('ashme-hero-motion')) {
  customElements.define(
    'ashme-hero-motion',
    class AshmeHeroMotion extends HTMLElement {
      connectedCallback() {
        this.targets = [...document.querySelectorAll('[data-ashme-tilt]')];
        if (!this.targets.length || !window.matchMedia('(hover: hover) and (pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        this.targets.forEach((target) => {
          const layer = target.querySelector('[data-ashme-tilt-layer]');
          if (!layer) return;
          target.addEventListener('pointermove', (event) => {
            const rect = target.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width - 0.5;
            const y = (event.clientY - rect.top) / rect.height - 0.5;
            layer.style.setProperty('--ashme-tilt-x', `${(y * -5).toFixed(2)}deg`);
            layer.style.setProperty('--ashme-tilt-y', `${(x * 7).toFixed(2)}deg`);
            target.style.setProperty('--ashme-light-x', `${(50 + x * 18).toFixed(2)}%`);
            target.style.setProperty('--ashme-light-y', `${(48 + y * 16).toFixed(2)}%`);
          }, { passive: true });
          target.addEventListener('pointerleave', () => {
            layer.style.setProperty('--ashme-tilt-x', '0deg');
            layer.style.setProperty('--ashme-tilt-y', '0deg');
            target.style.setProperty('--ashme-light-x', '50%');
            target.style.setProperty('--ashme-light-y', '48%');
          }, { passive: true });
        });
      }
    }
  );
}

if (!document.querySelector('ashme-hero-motion') && document.querySelector('[data-ashme-hero]')) {
  const motion = document.createElement('ashme-hero-motion');
  motion.hidden = true;
  document.body.append(motion);
}
