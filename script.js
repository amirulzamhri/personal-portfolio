import { initBlob } from './background/blob.js';
import { initDotGrid } from './background/dotgrid.js';

/* ===================================================
   Start background effects
   =================================================== */
initBlob('three-blob-canvas');
initDotGrid('hero-canvas');


/* ===================================================
   SECTION 3 – AUDIO & UI (unchanged)
   =================================================== */
const BG_AUDIO_URL = 'https://assets.mixkit.co/music/292/292.mp3';
const bgAudio = new Audio(BG_AUDIO_URL);
bgAudio.loop = true;
bgAudio.volume = 1.0;
bgAudio.autoplayStarted = false;

function tryAudio(){
  if(bgAudio && bgAudio.paused && !bgAudio.autoplayStarted){
    bgAudio.play().then(()=>{ bgAudio.autoplayStarted=true; updateAudioToggleUI(); }).catch(()=>{});
  }
}
window.tryAudio = tryAudio;
window.addEventListener('touchstart', tryAudio, {passive:true});
window.addEventListener('click', tryAudio);
window.addEventListener('touchstart', ()=>{ if(navigator.vibrate) navigator.vibrate(10); }, {passive:true});

const toggleContainer = document.getElementById('audio-toggle-container');
const togglePanel = document.createElement('div');
togglePanel.className='glass-panel';
togglePanel.setAttribute('aria-label','Toggle background audio');
togglePanel.innerHTML = getWavePlayingSVG();
toggleContainer.appendChild(togglePanel);

function getWavePlayingSVG(){
  return `<svg viewBox="0 0 24 16" xmlns="http://www.w3.org/2000/svg">
    <path d="M1,8 Q4,2 7,8 T13,8 T19,8 T23,8" fill="none" stroke="white" stroke-width="2">
      <animate attributeName="d" values="M1,8 Q4,2 7,8 T13,8 T19,8 T23,8;M1,8 Q4,14 7,8 T13,8 T19,8 T23,8;M1,8 Q4,2 7,8 T13,8 T19,8 T23,8" dur="0.6s" repeatCount="indefinite" />
    </path></svg>`;
}
function getWavePausedSVG(){
  return `<svg viewBox="0 0 24 16" xmlns="http://www.w3.org/2000/svg">
    <line x1="3" y1="8" x2="21" y2="8" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" /></svg>`;
}
function updateAudioToggleUI(){
  if(bgAudio && !bgAudio.paused){
    togglePanel.innerHTML = getWavePlayingSVG();
    togglePanel.classList.remove('muted');
  } else {
    togglePanel.innerHTML = getWavePausedSVG();
    togglePanel.classList.add('muted');
  }
}
togglePanel.addEventListener('click',(e)=>{
  e.stopPropagation();
  if(!bgAudio) return;
  if(bgAudio.paused){
    bgAudio.play().then(()=>{ bgAudio.autoplayStarted=true; updateAudioToggleUI(); }).catch(()=>{});
  } else { bgAudio.pause(); updateAudioToggleUI(); }
});
updateAudioToggleUI();

// Section / footer / marquee observers
const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(e => e.target.classList.toggle('section-visible', e.isIntersecting));
}, {threshold:0});
document.querySelectorAll('.section').forEach(s => sectionObserver.observe(s));

const footerEl = document.querySelector('.footer');
if(footerEl){
  const footerObs = new IntersectionObserver(entries => {
    entries.forEach(e => e.target.classList.toggle('footer-visible', e.isIntersecting));
  }, {threshold:0});
  footerObs.observe(footerEl);
}

const marquee = document.getElementById('hero-marquee');
if(marquee){
  const marqueeObs = new IntersectionObserver(entries => {
    entries.forEach(e => e.target.classList.toggle('marquee-visible', e.isIntersecting));
  }, {threshold:0});
  marqueeObs.observe(marquee);
}

// Mobile drawing notice
const notice = document.getElementById('mobile-drawing-notice');
if(notice){
  let shown = false, hideTimer;
  function showNotice(){
    if(shown) return; shown=true;
    notice.classList.add('visible');
    hideTimer = setTimeout(()=> notice.classList.remove('visible'), 4000);
  }
  window.addEventListener('scroll', ()=>{ if(!shown) showNotice(); }, {passive:true});
  if('ontouchstart' in window) window.addEventListener('touchstart', showNotice, {once:true, passive:true});
  window.addEventListener('beforeunload', ()=>{ if(hideTimer) clearTimeout(hideTimer); });
}

// Hero text blur-in + header reveal (instant class removal)
window.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('.hero-text').forEach(el => el.classList.add('hero-visible'));

  // Header blurs clear immediately – same as footer‑text-visible toggle
  const header = document.querySelector('.header');
  if (header) header.classList.remove('header-blurred');
});

// LinkedIn CTA
const linkedCta = document.getElementById('linkedin-cta');
if(linkedCta){
  const hoverSound = new Audio('audio/CTA-Mouse-Over.mp3');
  hoverSound.volume = 1.0;
  const clickSound = new Audio('audio/CTA-Click.mp3');
  clickSound.volume = 1.0;

  linkedCta.addEventListener('mouseenter', ()=>{
    hoverSound.pause(); hoverSound.currentTime=0; hoverSound.play().catch(()=>{});
  });
  linkedCta.addEventListener('click', (e)=>{
    e.preventDefault(); e.stopPropagation();
    hoverSound.pause(); hoverSound.currentTime=0;
    clickSound.pause(); clickSound.currentTime=0; clickSound.play().catch(()=>{});
    const rect = linkedCta.getBoundingClientRect();
    if (window.triggerDotWave) {
      window.triggerDotWave(rect.left+rect.width/2, rect.top+rect.height/2);
    }
    setTimeout(()=> window.open(linkedCta.href, '_blank'), 500);
  });
}

// Navigation CTAs – audio feedback only
const navCtas = document.querySelectorAll('#site-navigation .fixed-cta');
if(navCtas.length){
  const hoverS = new Audio('audio/CTA-Mouse-Over.mp3');
  hoverS.volume = 1.0;
  const clickS = new Audio('audio/CTA-Click.mp3');
  clickS.volume = 1.0;

  navCtas.forEach(cta => {
    cta.addEventListener('mouseenter', ()=>{
      hoverS.pause(); hoverS.currentTime=0; hoverS.play().catch(()=>{});
    });
    cta.addEventListener('click', ()=>{
      clickS.pause(); clickS.currentTime=0; clickS.play().catch(()=>{});
    });
  });
}


/* ===================================================
   CUSTOM SMOOTH SCROLL HANDLERS
   =================================================== */

// Helper: desktop centres, mobile uses adjustable offset
function smoothScrollToElement(targetEl, desktopBlock = 'center', mobileOffset = -0.12) {
  if (!targetEl) return;
  const isDesktop = window.innerWidth > 768;

  if (isDesktop) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: desktopBlock });
  } else {
    const headerHeight = 70;
    const extraOffset = window.innerHeight * mobileOffset;
    const top = targetEl.getBoundingClientRect().top + window.pageYOffset;
    window.scrollTo({
      top: top - headerHeight - extraOffset,
      behavior: 'smooth'
    });
  }
}

// 1. Logo → top of page
const logoLink = document.querySelector('.logo-link');
if (logoLink) {
  logoLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// 2. About CTA (mobile offset -0.12)
const aboutLink = document.querySelector('#site-navigation a[href="#about"]');
if (aboutLink) {
  aboutLink.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.getElementById('about');
    smoothScrollToElement(target, 'center', -0.1);
  });
}

// 3. Portfolio CTA (mobile offset 0.0)
const portfolioLink = document.querySelector('#site-navigation a[href="#portfolio"]');
if (portfolioLink) {
  portfolioLink.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.getElementById('portfolio-01-container');
    smoothScrollToElement(target, 'center', 0.0);
  });
}

// 4. Contact CTA → scroll to footer text
const contactLink = document.querySelector('#site-navigation a[href="#contact"]');
if (contactLink) {
  contactLink.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.getElementById('contact');
    smoothScrollToElement(target, 'center', 0.0);
  });
}

console.log('✨ Clean setup: background modules loaded + UI.');
