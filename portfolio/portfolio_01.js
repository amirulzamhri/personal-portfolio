(function() {
  'use strict';

  async function initPortfolio() {
    const container = document.getElementById('portfolio-01-container');
    if (!container) return;

    if (container.children.length > 0) {
      setupGallery(container);
      return;
    }

    try {
      const response = await fetch('portfolio/portfolio_01.html');
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

    console.log('✨ Gallery loaded | Slides:', total, 'Indicators:', dots.length);

    function updateIndicators(activeIndex) {
      dots.forEach((d, i) => d.classList.toggle('active', i === activeIndex));
    }

    function goTo(index) {
      index = ((index % total) + total) % total;
      slides.forEach(s => s.classList.remove('active'));
      slides[index].classList.add('active');
      current = index;
      updateIndicators(current);
    }

    function nextSlide() {
      goTo(current + 1);
    }

    function prevSlide() {
      goTo(current - 1);
    }

    gallery.addEventListener('click', () => {
      nextSlide();
      resetAutoplay();
    });

    if (prevOverlay) {
      prevOverlay.addEventListener('click', (e) => {
        e.stopPropagation();
        prevSlide();
        resetAutoplay();
      });
    }

    dots.forEach((dot, idx) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        goTo(idx);
        resetAutoplay();
      });
    });

    let autoplayInterval;
    function startAutoplay() {
      autoplayInterval = setInterval(nextSlide, 4000);
    }
    function resetAutoplay() {
      clearInterval(autoplayInterval);
      startAutoplay();
    }

    goTo(0);
    startAutoplay();
  }

  initPortfolio();
})();