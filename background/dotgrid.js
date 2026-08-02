export function initDotGrid(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error(`Missing <canvas id="${canvasId}">`);
    return;
  }

  const ctx = canvas.getContext('2d');

  // ── Configuration (unchanged) ──
  const gap = 40;
  const radiusVmin = 30;
  const speedIn = 0.5;
  const speedOut = 0.6;
  const restScale = 0.09;
  const minHoverScale = 1;
  const maxHoverScale = 3;
  const waveSpeed = 1200;
  const waveWidth = 180;
  const blinkFreq = 0.25;
  const PARALLAX = 0.012;
  const MAGNET_RADIUS_FACTOR = 1.2;
  const MAX_PULL = 0.4;

  const PALETTE = [
    { type:'solid', value:'#5c0000' }, { type:'solid', value:'#3d0000' },
    { type:'solid', value:'#240000' }, { type:'solid', value:'#140000' },
    { type:'solid', value:'#0c0000' },
    { type:'gradient', stops:['#5c0000','#3d0000'] },
    { type:'gradient', stops:['#3d0000','#240000'] },
    { type:'gradient', stops:['#240000','#140000'] },
    { type:'gradient', stops:['#140000','#0c0000'] },
    { type:'gradient', stops:['#3d0000','#140000'] },
    { type:'gradient', stops:['#5c0000','#240000'] },
    { type:'gradient', stops:['#240000','#0c0000'] }
  ];

  // ── Helpers ──
  const rnd = (a,b) => Math.random()*(b-a)+a;
  const rndInt = (a,b) => Math.floor(rnd(a,b+1));
  const pick = a => a[Math.floor(Math.random()*a.length)];
  const smoothstep = t => { const c=Math.max(0,Math.min(1,t)); return c*c*(3-2*c); };
  const durFactor = s => s<=0 ? 1 : 1-Math.pow(0.05, 1/(60*s));

  function lerpHex(a,b,t){
    const ra=parseInt(a.slice(1,3),16), ga=parseInt(a.slice(3,5),16), ba=parseInt(a.slice(5,7),16);
    const rb=parseInt(b.slice(1,3),16), gb=parseInt(b.slice(3,5),16), bb=parseInt(b.slice(5,7),16);
    return '#'+((1<<24)+(Math.round(ra+(rb-ra)*t)<<16)+(Math.round(ga+(gb-ga)*t)<<8)+Math.round(ba+(bb-ba)*t)).toString(16).slice(1);
  }

  function drawCircle(c,s){ c.beginPath(); c.arc(0,0,s/2,0,Math.PI*2); c.fill(); }
  function drawShape(c,s){ if(s.type==='circle') drawCircle(c,s.size); }

  function resolveFill(ctx,def,sz){
    if(def.type==='solid') return def.value;
    const g=ctx.createRadialGradient(0,-sz*0.3,0,0,sz*0.3,sz*1.5);
    g.addColorStop(0,def.stops[0]); g.addColorStop(1,def.stops[1]);
    return g;
  }

  // ── State ──
  let grid, pointer, activity = 0, waves = [];
  let dpr = window.devicePixelRatio || 1;
  let brightWaveActive = false;
  const brightWaveColor = '#ff1a1a';

  function buildGrid(){
    let W=window.innerWidth, H=window.innerHeight;
    if(window.visualViewport) H=window.visualViewport.height;
    const isM = W<=480, eg = isM?gap*0.5:gap, sm = isM?0.5:1;
    const cols=Math.floor(W/eg), rows=Math.floor(H/eg);
    const ox=(W-(cols-1)*eg)/2, oy=(H-(rows-1)*eg)/2;
    const shapes=[];
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
      const s={
        x:ox+c*eg, y:oy+r*eg, type:'circle', color:pick(PALETTE),
        angle:0, size:eg*0.38*sm, scale:restScale,
        maxScale:rnd(minHoverScale,maxHoverScale), hovered:false,
        baseColor:'', blinking:false, blinkPhase:0,
        magnetX:0, magnetY:0
      };
      s.baseColor = s.color.type==='solid'?s.color.value:s.color.stops[0];
      shapes.push(s);
    }
    // blinking dots
    const blinkCount = Math.max(6, Math.min(10, Math.floor(shapes.length*0.05)));
    const inds = [];
    while(inds.length<blinkCount){
      const ix=rndInt(0,shapes.length-1);
      if(inds.indexOf(ix)===-1) inds.push(ix);
    }
    for(const i of inds){
      shapes[i].blinking=true;
      shapes[i].blinkPhase=Math.random()*Math.PI*2;
    }
    return {shapes, width:W, height:H};
  }

  function initShapeWave(){
    let W=window.innerWidth, H=window.innerHeight;
    if(window.visualViewport) H=window.visualViewport.height;
    dpr = window.devicePixelRatio||1;
    canvas.width=W*dpr; canvas.height=H*dpr;
    canvas.style.width=W+'px'; canvas.style.height=H+'px';
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(dpr,dpr);
    grid = buildGrid();
  }

  function triggerBrightWave(x,y){
    waves.push({x,y,startTime:performance.now()});
    brightWaveActive=true;
    const dur = (Math.sqrt(innerWidth*innerWidth+innerHeight*innerHeight)/waveSpeed)*1000+200;
    setTimeout(()=>{ brightWaveActive=false; }, dur);
  }

  function tick(){
    if(!grid) { requestAnimationFrame(tick); return; }
    const {shapes, width:w, height:h} = grid;
    const radius = Math.min(w,h)*(radiusVmin/100);
    const magnetRadius = radius * MAGNET_RADIUS_FACTOR;
    const now = performance.now();

    ctx.clearRect(0,0,w,h);

    activity *= 0.93;
    waves = waves.filter(wv => (now-wv.startTime)/1000*waveSpeed < Math.sqrt(w*w+h*h)+waveWidth);
    const effWaveW = innerWidth<=480 ? waveWidth*1.5 : waveWidth;

    let pX=0, pY=0;
    if(pointer) {
      pX = (pointer.x - w/2) * PARALLAX;
      pY = (pointer.y - h/2) * PARALLAX;
    }

    for(const s of shapes){
      // magnet
      if(pointer){
        const dx = pointer.x - s.x, dy = pointer.y - s.y, dist = Math.hypot(dx,dy);
        let tX=0, tY=0;
        if(dist < magnetRadius && dist>0.1){
          const pull = (1 - dist/magnetRadius) * MAX_PULL;
          tX = dx * pull; tY = dy * pull;
        }
        const magF = durFactor(speedIn);
        s.magnetX += (tX - s.magnetX) * magF;
        s.magnetY += (tY - s.magnetY) * magF;
      } else { s.magnetX *= 0.95; s.magnetY *= 0.95; }

      // hover scale
      let pi=0;
      if(pointer && activity>0.001){
        const dx2=s.x-pointer.x, dy2=s.y-pointer.y, dist2=Math.sqrt(dx2*dx2+dy2*dy2);
        pi = smoothstep(1-dist2/radius) * activity;
        if(pi>0.05 && !s.hovered){ s.hovered=true; s.maxScale=rnd(minHoverScale,maxHoverScale); s.angle=0; }
        else if(pi<=0.05) s.hovered=false;
      } else s.hovered=false;

      // wave influence
      let wi=0;
      for(const wv of waves){
        const wr = (now - wv.startTime)/1000 * waveSpeed;
        const wdist = Math.hypot(s.x-wv.x, s.y-wv.y);
        const t = 1 - Math.abs(wdist - wr) / effWaveW;
        if(t>0) wi = Math.max(wi, Math.sin(Math.PI*t));
      }

      const targetScale = Math.max(restScale+pi*(s.maxScale-restScale), restScale+wi*(s.maxScale-restScale));
      const factor = targetScale>s.scale ? durFactor(speedIn) : durFactor(speedOut);
      s.scale += (targetScale - s.scale) * factor;
      if(s.scale < restScale*0.15) continue;

      ctx.save();
      ctx.translate(s.x + pX + s.magnetX, s.y + pY + s.magnetY);
      ctx.rotate(s.angle);
      ctx.scale(s.scale, s.scale);

      if(brightWaveActive) ctx.fillStyle = brightWaveColor;
      else if(s.blinking && s.scale<=restScale*1.05){
        const blinkAlpha = (Math.sin(now*0.001*blinkFreq*2*Math.PI + s.blinkPhase)+1)/2;
        const activation = Math.max(0, (s.scale-restScale)/(s.maxScale-restScale+0.001));
        const alpha = blinkAlpha * Math.max(0,1-activation);
        ctx.fillStyle = lerpHex(s.baseColor, '#ffffff', alpha);
      } else ctx.fillStyle = resolveFill(ctx, s.color, s.size);

      drawShape(ctx, s);
      ctx.restore();
    }
    requestAnimationFrame(tick);
  }

  function getCanvasCoords(e){ const r=canvas.getBoundingClientRect(); return {x:e.clientX-r.left, y:e.clientY-r.top}; }

  function onMove(e){
    pointer = getCanvasCoords(e);
    activity = 1;
  }

  function triggerWave(x,y){
    x = x!=null ? x : innerWidth/2;
    y = y!=null ? y : innerHeight/2;
    waves.push({x, y, startTime:performance.now()});
  }

  function onClick(e){
    if(e.target.closest('#linkedin-cta')) return;
    const pos = getCanvasCoords(e);
    triggerWave(pos.x, pos.y);
    // tryAudio will be handled outside, but we can still call it if needed
    if (window.tryAudio) window.tryAudio();
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('click', onClick);
  initShapeWave();
  requestAnimationFrame(tick);
  triggerWave();  // initial ripple

  window.addEventListener('resize', initShapeWave);

  // Expose triggerWave for external use (e.g., CTA clicks)
  window.triggerDotWave = triggerWave;

  console.log('✨ Shape‑wave dot grid initialised');
}