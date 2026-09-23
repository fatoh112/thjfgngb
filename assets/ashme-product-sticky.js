if (!customElements.get('ashme-sticky-buy')) {
  customElements.define(
    'ashme-sticky-buy',
    class AshmeStickyBuy extends HTMLElement {
      connectedCallback() {
        this.sectionId = this.dataset.sectionId;
        this.productInfo = this.closest('product-info');
        this.stickyButton = this.querySelector('[data-ashme-sticky-button]');
        this.stickyLabel = this.querySelector('[data-ashme-sticky-label]');
        this.stickyPrice = this.querySelector('[data-ashme-sticky-price]');
        if (!this.productInfo || !this.stickyButton) return;
        this.productButton = this.productInfo.querySelector(`#ProductSubmitButton-${this.sectionId}`);
        if (!this.productButton) {
          this.hidden = true;
          return;
        }

        this.hidden = true;
        this.submitWasVisible = false;
        this.submitHasPassed = false;
        this.footerIsVisible = false;
        this.syncFromProductInfo();
        this.observer = new MutationObserver(() => this.syncFromProductInfo());
        this.observer.observe(this.productInfo.querySelector('.product__info-container') || this.productInfo, {
          attributes: true,
          childList: true,
          subtree: true,
        });
        if ('IntersectionObserver' in window) {
          this.visibilityObserver = new IntersectionObserver((entries) => {
            for (const entry of entries) {
              if (entry.target === this.productButton) {
                if (entry.isIntersecting) this.submitWasVisible = true;
                else if (this.submitWasVisible) this.submitHasPassed = true;
              } else if (entry.target === this.footer) {
                this.footerIsVisible = entry.isIntersecting;
              }
            }
            this.updateVisibility();
          });
          this.visibilityObserver.observe(this.productButton);
          this.footer = document.querySelector('footer');
          if (this.footer) this.visibilityObserver.observe(this.footer);
        }
        this.handleResize = () => this.updateVisibility();
        window.addEventListener('resize', this.handleResize);
      }

      disconnectedCallback() {
        this.observer?.disconnect();
        this.visibilityObserver?.disconnect();
        if (this.handleResize) window.removeEventListener('resize', this.handleResize);
      }

      syncFromProductInfo() {
        const productButton = this.productInfo.querySelector(`#ProductSubmitButton-${this.sectionId}`);
        const price = this.productInfo.querySelector(`#price-${this.sectionId}`);
        if (productButton) {
          this.stickyButton.disabled = productButton.disabled;
          const label = productButton.querySelector('span')?.textContent?.trim();
          if (label) this.stickyLabel.textContent = label;
        } else {
          this.stickyButton.disabled = true;
        }
        if (price && this.stickyPrice) this.stickyPrice.innerHTML = price.innerHTML;
        this.updateVisibility();
      }

      updateVisibility() {
        const isMobile = window.matchMedia('(max-width: 749px)').matches;
        this.hidden = !isMobile || !this.submitHasPassed || this.footerIsVisible || this.stickyButton.disabled;
      }
    }
  );
}
