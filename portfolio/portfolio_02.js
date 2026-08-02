(function() {
  'use strict';

  async function initPortfolio() {
    const container = document.getElementById('portfolio-02-container');
    if (!container) return;

    if (container.children.length > 0) {
      setupGallery(container);
      return;
    }

    try {
      const response = await fetch('portfolio/portfolio_02.html');
      if (!response.ok) throw new Error('Network response was not ok');
      const html = await response.text();
      container.innerHTML = html;
      setupGallery(container);
    } catch (error) {
      console.error('Failed to load portfolio HTML:', error);
    }
  }

  function setupGallery(container) {
    const section = container.querySelector('.portfolio-section');
    if (!section) return;

    const gallery = section.querySelector('[data-gallery]');
    if (!gallery) return;

    const slides = gallery.querySelectorAll('.gallery-slide');
    const total = slides.length;
    let current = 0;
    const indicators = section.querySelector('[data-indicators]');
    const dots = indicators ? indicators.querySelectorAll('.indicator') : [];
    const prevOverlay = gallery.querySelector('.gallery-prev');

    // Compare bar elements
    const compareBar = section.querySelector('.compare-bar');
    const compareKnob = section.querySelector('.compare-knob');

    // ── Store a separate split position for each slide (initially 50%) ──
    const slidePositions = new Array(total).fill(50);

    console.log('✨ Gallery loaded (no autoplay) | Slides:', total, 'Indicators:', dots.length);

    // Indicator helpers
    function updateIndicators(activeIndex) {
      dots.forEach((d, i) => d.classList.toggle('active', i === activeIndex));
    }

    // Get the currently visible compare elements
    function getActiveCompareElements() {
      const activeSlide = slides[current];
      if (!activeSlide) return null;
      return {
        afterWrap: activeSlide.querySelector('.compare-after-wrap'),
        line: activeSlide.querySelector('.compare-line')
      };
    }

    // Set compare split position (0–100%) and remember it for the current slide
    function setComparePosition(percent) {
      const elements = getActiveCompareElements();
      if (!elements) return;

      const clamped = Math.max(5, Math.min(95, percent));
      slidePositions[current] = clamped;   // remember for later

      if (elements.afterWrap) {
        elements.afterWrap.style.clipPath = `inset(0 0 0 ${clamped}%)`;
        elements.afterWrap.style.webkitClipPath = `inset(0 0 0 ${clamped}%)`;
      }
      if (elements.line) {
        elements.line.style.left = `${clamped}%`;
      }
      if (compareKnob) {
        compareKnob.style.left = `${clamped}%`;
      }
    }

    // Slide navigation
    function goTo(index) {
      index = ((index % total) + total) % total;
      slides.forEach(s => s.classList.remove('active'));
      slides[index].classList.add('active');
      current = index;
      updateIndicators(current);

      // Apply the stored (or default) position for this slide
      setComparePosition(slidePositions[current] ?? 50);
    }

    function nextSlide() { goTo(current + 1); }
    function prevSlide() { goTo(current - 1); }

    // Click-to-advance (ignoring clicks on the compare bar)
    gallery.addEventListener('click', (e) => {
      if (compareBar && compareBar.contains(e.target)) return;
      nextSlide();
    });

    if (prevOverlay) {
      prevOverlay.addEventListener('click', (e) => {
        e.stopPropagation();
        prevSlide();
      });
    }

    dots.forEach((dot, idx) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        goTo(idx);
      });
    });

    // Compare-bar drag logic
    if (compareBar && compareKnob) {
      let isDragging = false;

      function getPercentFromEvent(e) {
        const rect = compareBar.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        return ((clientX - rect.left) / rect.width) * 100;
      }

      function onDragStart(e) {
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;

        // Kill transitions while dragging
        compareKnob.style.transition = 'none';
        const elems = getActiveCompareElements();
        if (elems) {
          if (elems.afterWrap) elems.afterWrap.style.transition = 'none';
          if (elems.line) elems.line.style.transition = 'none';
        }
        setComparePosition(getPercentFromEvent(e));  // updates slidePositions too
      }

      function onDragMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        setComparePosition(getPercentFromEvent(e));
      }

      function onDragEnd() {
        if (!isDragging) return;
        isDragging = false;

        // Restore transitions
        compareKnob.style.transition = '';
        const elems = getActiveCompareElements();
        if (elems) {
          if (elems.afterWrap) elems.afterWrap.style.transition = '';
          if (elems.line) elems.line.style.transition = '';
        }
      }

      // Mouse
      compareKnob.addEventListener('mousedown', onDragStart);
      window.addEventListener('mousemove', onDragMove);
      window.addEventListener('mouseup', onDragEnd);

      // Touch
      compareKnob.addEventListener('touchstart', onDragStart, { passive: false });
      window.addEventListener('touchmove', onDragMove, { passive: false });
      window.addEventListener('touchend', onDragEnd);

      // Also start drag when clicking on the bar itself
      compareBar.addEventListener('mousedown', (e) => {
        if (e.target === compareKnob || compareKnob.contains(e.target)) return;
        onDragStart(e);
      });
      compareBar.addEventListener('touchstart', (e) => {
        if (e.target === compareKnob || compareKnob.contains(e.target)) return;
        onDragStart(e);
      }, { passive: false });
    }

    // Initialise first slide with default 50%
    goTo(0);
  }

  initPortfolio();
})();
