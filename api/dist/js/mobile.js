(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('[data-menu-toggle]');
    const nav = document.querySelector('[data-nav]');
    const backdrop = document.querySelector('[data-backdrop]');

    const open = () => {
      document.body.classList.add('nav-open');
      nav?.setAttribute('aria-hidden', 'false');
      toggle?.setAttribute('aria-expanded', 'true');
      if (backdrop) backdrop.hidden = false;
      if (nav) trapFocus(nav);
    };
    const close = () => {
      document.body.classList.remove('nav-open');
      nav?.setAttribute('aria-hidden', 'true');
      toggle?.setAttribute('aria-expanded', 'false');
      if (backdrop) backdrop.hidden = true;
      releaseFocus();
    };

    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        document.body.classList.contains('nav-open') ? close() : open();
      });
    }
    backdrop?.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    // Accordion
    document.querySelectorAll('[data-accordion] button[aria-controls]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('aria-controls');
        const content = id ? document.getElementById(id) : null;
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        if (content) content.hidden = expanded;
      });
    });

    // Header: hide on scroll down
    const header = document.querySelector('.app-header');
    let lastY = window.scrollY;
    window.addEventListener('scroll', () => {
      if (!header) return;
      const y = window.scrollY;
      if (y > lastY && y > 80) header.classList.add('header--hidden');
      else header.classList.remove('header--hidden');
      lastY = y;
    }, { passive: true });

    // Respect reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.style.setProperty('--motion', '0ms');
    }
  });

  // Focus trap simple
  let lastActive = null;
  function trapFocus(container) {
    lastActive = document.activeElement;
    const SELECTOR = 'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const getFocusable = () =>
      Array.from(container.querySelectorAll(SELECTOR))
        .filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');

    function loop(e) {
      if (e.key !== 'Tab') return;
      const els = getFocusable();
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    container.addEventListener('keydown', loop);
    container.__focusTrap = loop;
    const firstEl = getFocusable()[0];
    if (firstEl) firstEl.focus({ preventScroll: true });
  }
  function releaseFocus() {
    const nav = document.querySelector('[data-nav]');
    if (nav && nav.__focusTrap) {
      nav.removeEventListener('keydown', nav.__focusTrap);
      delete nav.__focusTrap;
    }
    if (lastActive && document.contains(lastActive)) {
      lastActive.focus?.({ preventScroll: true });
    }
  }
})();
