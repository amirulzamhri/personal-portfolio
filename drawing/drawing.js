(function() {
  var isTouchDevice = ('ontouchstart' in window);

  // –––––– Disable drawing / enable eraser on these elements ––––––
  var drawDisabledSelectors = [
    '.compare-bar',
    '.compare-knob',
    '.image-compare',
    '.compare-slider'
  ];

  var ERASE_RADIUS = 20; // pixels

  // Elements
  var trailCanvas = document.getElementById('trail-canvas');
  var trailCtx = trailCanvas ? trailCanvas.getContext('2d') : null;
  var scribbleCanvas = document.getElementById('scribble-canvas');
  var scribbleCtx = scribbleCanvas ? scribbleCanvas.getContext('2d') : null;
  var strokeIndicator = document.getElementById('stroke-indicator');
  var customCursor = document.getElementById('custom-cursor');

  // Trail state
  var trailPoints = [];
  var TRAIL_MAX_AGE = 2000;
  var TRAIL_MAX_LENGTH = 500;

  // Scribble state
  var isDrawing = false;
  var scribbleLineWidth = 2;
  var scribblePaths = [];
  var currentStroke = null;

  // Panel state
  var panel = document.getElementById('drawing-info-panel');
  var toggleBtn = document.getElementById('panel-toggle-btn');
  var panelOpen = false;
  var userToggled = false;
  var closedLeft = -260;
  var openLeft = 0;

  // Cursor
  var cursorActive = false;

  var dpr = window.devicePixelRatio || 1;

  // –––––– Procedural drawing sound ––––––
  var audioCtx = null;
  var noiseNode = null;
  var gainNode = null;
  var filterNode = null;
  var lastDrawPos = null;
  var soundActive = false;
  var dragStarted = false;

  function initDrawingSound() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      var bufferSize = audioCtx.sampleRate * 2;
      var noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      var output = noiseBuffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      noiseNode = audioCtx.createBufferSource();
      noiseNode.buffer = noiseBuffer;
      noiseNode.loop = true;

      filterNode = audioCtx.createBiquadFilter();
      filterNode.type = 'bandpass';
      filterNode.frequency.value = 800;
      filterNode.Q.value = 1.5;

      gainNode = audioCtx.createGain();
      gainNode.gain.value = 0;

      noiseNode.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      noiseNode.start();
    } catch (e) {
      console.warn('Web Audio not supported:', e);
    }
  }

  function startWriteSound() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    soundActive = true;
    gainNode.gain.setTargetAtTime(0.15, audioCtx.currentTime, 0.05);
    lastDrawPos = null;
  }

  function stopWriteSound() {
    if (!audioCtx || !soundActive) return;
    soundActive = false;
    gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.02);
  }

  function updateWriteVolume(moveSpeed) {
    if (!audioCtx || !soundActive) return;
    var vol = Math.min(0.15, 0.02 + moveSpeed * 0.03);
    gainNode.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.05);
  }

  // –––––– Helpers for disabled area detection & eraser ––––––
  function isPointOverDisabledArea(clientX, clientY) {
    for (var s = 0; s < drawDisabledSelectors.length; s++) {
      var els = document.querySelectorAll(drawDisabledSelectors[s]);
      for (var i = 0; i < els.length; i++) {
        var rect = els[i].getBoundingClientRect();
        if (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        ) {
          return true;
        }
      }
    }
    return false;
  }

  function eraseNearPoint(x, y) {
    var changed = false;
    for (var i = scribblePaths.length - 1; i >= 0; i--) {
      var pts = scribblePaths[i];
      var filtered = [];
      for (var j = 0; j < pts.length; j++) {
        var dx = pts[j].x - x;
        var dy = pts[j].y - y;
        if (Math.sqrt(dx*dx + dy*dy) > ERASE_RADIUS) {
          filtered.push(pts[j]);
        } else {
          changed = true;
        }
      }
      if (filtered.length < 2) {
        scribblePaths.splice(i, 1);
      } else {
        scribblePaths[i] = filtered;
      }
    }
    if (currentStroke) {
      var alive = [];
      for (var k = 0; k < currentStroke.length; k++) {
        var dx2 = currentStroke[k].x - x;
        var dy2 = currentStroke[k].y - y;
        if (Math.sqrt(dx2*dx2 + dy2*dy2) > ERASE_RADIUS) {
          alive.push(currentStroke[k]);
        } else {
          changed = true;
        }
      }
      currentStroke = alive.length >= 2 ? alive : null;
    }
    return changed;
  }

  function cancelDrawing() {
    if (currentStroke) {
      currentStroke[0].lineWidth = scribbleLineWidth;
      scribblePaths.push(currentStroke);
      currentStroke = null;
    }
    isDrawing = false;
    dragStarted = false;
    stopWriteSound();
    lastDrawPos = null;
    strokeIndicator.style.display = 'none';
  }

  // Hide mobile elements
  if (isTouchDevice) {
    if (strokeIndicator) strokeIndicator.style.display = 'none';
    if (customCursor) customCursor.style.display = 'none';
  } else {
    initDrawingSound();
  }

  // Initialise canvases
  function initCanvases() {
    var W = window.innerWidth, H = window.innerHeight;
    if (window.visualViewport) H = window.visualViewport.height;
    dpr = window.devicePixelRatio || 1;

    if (trailCanvas && trailCtx) {
      trailCanvas.width = W * dpr;
      trailCanvas.height = H * dpr;
      trailCanvas.style.width = W + 'px';
      trailCanvas.style.height = H + 'px';
      trailCtx.setTransform(1,0,0,1,0,0);
      trailCtx.scale(dpr, dpr);
    }
    if (scribbleCanvas && scribbleCtx) {
      scribbleCanvas.width = W * dpr;
      scribbleCanvas.height = H * dpr;
      scribbleCanvas.style.width = W + 'px';
      scribbleCanvas.style.height = H + 'px';
      // Immediately clear and set the transform for the new canvas size
      scribbleCtx.setTransform(1,0,0,1,0,0);
      scribbleCtx.clearRect(0, 0, W, H);
    }
  }

  // Redraw trail and scribble
  function drawTrailAndScribble() {
    if (!trailCtx || !scribbleCtx) return;
    var now = performance.now();
    var W = window.innerWidth, H = window.innerHeight;

    // Trail
    trailCtx.clearRect(0, 0, W, H);
    while (trailPoints.length && (now - trailPoints[0].time) > TRAIL_MAX_AGE) trailPoints.shift();
    if (trailPoints.length >= 2) {
      var drawPoints = [], totalDist = 0;
      for (var i = trailPoints.length - 1; i >= 0; i--) {
        drawPoints.unshift(trailPoints[i]);
        if (i > 0) {
          var dx = trailPoints[i].x - trailPoints[i-1].x, dy = trailPoints[i].y - trailPoints[i-1].y;
          totalDist += Math.sqrt(dx*dx + dy*dy);
          if (totalDist >= TRAIL_MAX_LENGTH) {
            var excess = totalDist - TRAIL_MAX_LENGTH;
            var lastSeg = Math.sqrt(dx*dx + dy*dy);
            var ratio = excess / lastSeg;
            var firstPt = drawPoints[0], nextPt = drawPoints[1];
            drawPoints[0] = { x: firstPt.x + (nextPt.x - firstPt.x) * ratio, y: firstPt.y + (nextPt.y - firstPt.y) * ratio };
            break;
          }
        }
      }
      if (drawPoints.length >= 2) {
        var head = drawPoints[drawPoints.length-1], tail = drawPoints[0];
        var grad = trailCtx.createLinearGradient(tail.x, tail.y, head.x, head.y);
        grad.addColorStop(0, 'rgba(224,49,49,0)');
        grad.addColorStop(1, 'rgba(224,49,49,1)');
        trailCtx.strokeStyle = grad;
        trailCtx.lineWidth = 0.5;
        trailCtx.beginPath();
        trailCtx.moveTo(drawPoints[0].x, drawPoints[0].y);
        for (var j = 1; j < drawPoints.length; j++) trailCtx.lineTo(drawPoints[j].x, drawPoints[j].y);
        trailCtx.stroke();
      }
    }

    // Scribble
    scribbleCtx.clearRect(0, 0, scribbleCanvas.width / dpr, scribbleCanvas.height / dpr);
    scribbleCtx.save();
    scribbleCtx.setTransform(dpr, 0, 0, dpr, -window.scrollX * dpr, -window.scrollY * dpr);
    scribbleCtx.strokeStyle = '#e03131';
    scribbleCtx.lineCap = 'round';
    for (var si = 0; si < scribblePaths.length; si++) {
      var pts = scribblePaths[si];
      if (pts.length < 2) continue;
      scribbleCtx.lineWidth = pts[0].lineWidth || scribbleLineWidth;
      scribbleCtx.beginPath();
      scribbleCtx.moveTo(pts[0].x, pts[0].y);
      for (var pi = 1; pi < pts.length; pi++) scribbleCtx.lineTo(pts[pi].x, pts[pi].y);
      scribbleCtx.stroke();
    }
    if (currentStroke && currentStroke.length >= 2) {
      scribbleCtx.lineWidth = scribbleLineWidth;
      scribbleCtx.beginPath();
      scribbleCtx.moveTo(currentStroke[0].x, currentStroke[0].y);
      for (var ci = 1; ci < currentStroke.length; ci++) scribbleCtx.lineTo(currentStroke[ci].x, currentStroke[ci].y);
      scribbleCtx.stroke();
    }
    scribbleCtx.restore();
  }

  function drawingTick() {
    drawTrailAndScribble();
    requestAnimationFrame(drawingTick);
  }
  requestAnimationFrame(drawingTick);

  // Pointer movement – now includes eraser when over disabled area and mouse down
  function onPointerMove(e) {
    if (isTouchDevice) return;
    trailPoints.push({ x: e.clientX, y: e.clientY, time: performance.now() });

    if (isDrawing) {
      if (isPointOverDisabledArea(e.clientX, e.clientY)) {
        cancelDrawing();
        return;
      }

      if (!dragStarted) {
        dragStarted = true;
        startWriteSound();
      }

      currentStroke.push({ x: e.pageX, y: e.pageY });
      var radius = Math.max(15, scribbleLineWidth * 5);
      strokeIndicator.style.left = e.clientX + 'px';
      strokeIndicator.style.top = e.clientY + 'px';
      strokeIndicator.style.width = radius * 2 + 'px';
      strokeIndicator.style.height = radius * 2 + 'px';
      strokeIndicator.style.display = 'block';

      if (soundActive && lastDrawPos) {
        var dx = e.clientX - lastDrawPos.x;
        var dy = e.clientY - lastDrawPos.y;
        var dist = Math.sqrt(dx*dx + dy*dy);
        updateWriteVolume(dist);
      }
      lastDrawPos = { x: e.clientX, y: e.clientY };
    } else {
      strokeIndicator.style.display = 'none';

      if (e.buttons === 1 && isPointOverDisabledArea(e.clientX, e.clientY)) {
        eraseNearPoint(e.clientX, e.clientY);
      }
    }
  }

  // Cursor
  function updateCursor(e) {
    if (!customCursor || isTouchDevice) return;
    if (!cursorActive) { customCursor.classList.add('active'); cursorActive = true; }
    customCursor.style.transform = 'translate(' + (e.clientX - 10) + 'px, ' + (e.clientY - 10) + 'px)';
  }
  function onMouseLeave(e) {
    if (customCursor && !isTouchDevice) { customCursor.classList.remove('active'); cursorActive = false; }
  }

  function onMouseDown(e) {
    if (isTouchDevice) return;
    if (isPointOverDisabledArea(e.clientX, e.clientY)) return;

    e.preventDefault();
    isDrawing = true;
    currentStroke = [];
    currentStroke.push({ x: e.pageX, y: e.pageY });
    strokeIndicator.style.left = e.clientX + 'px';
    strokeIndicator.style.top = e.clientY + 'px';
    var radius = Math.max(15, scribbleLineWidth * 5);
    strokeIndicator.style.width = radius * 2 + 'px';
    strokeIndicator.style.height = radius * 2 + 'px';
    strokeIndicator.style.display = 'block';

    dragStarted = false;
    lastDrawPos = { x: e.clientX, y: e.clientY };
  }

  function onMouseUp(e) {
    if (isDrawing && currentStroke) {
      currentStroke[0].lineWidth = scribbleLineWidth;
      scribblePaths.push(currentStroke);
      currentStroke = null;
    }
    isDrawing = false;
    strokeIndicator.style.display = 'none';

    stopWriteSound();
    dragStarted = false;
    lastDrawPos = null;
  }

  function onWheel(e) {
    if (isDrawing) {
      e.preventDefault();
      scribbleLineWidth = Math.max(1, Math.min(10, scribbleLineWidth - e.deltaY * 0.01));
      var radius = Math.max(15, scribbleLineWidth * 5);
      strokeIndicator.style.width = radius * 2 + 'px';
      strokeIndicator.style.height = radius * 2 + 'px';
    }
  }

  // Panel toggle and drag (unchanged)
  function setPanelLeft(value, transition) {
    if (!panel) return;
    panel.style.transition = transition ? 'left 0.35s ease' : 'none';
    panel.style.left = value + 'px';
  }
  function openPanel(animate) {
    setPanelLeft(openLeft, animate !== false);
    panelOpen = true;
  }
  function closePanel(animate) {
    setPanelLeft(closedLeft, animate !== false);
    panelOpen = false;
    userToggled = false;
  }

  var isDragging = false, startX = 0, startLeft = 0;
  function onBtnDragStart(e) {
    if (!panel || isTouchDevice) return;
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startLeft = parseFloat(panel.style.left) || closedLeft;
    setPanelLeft(startLeft, false);
    if (toggleBtn) toggleBtn.style.cursor = 'grabbing';
  }
  function onBtnDragMove(e) {
    if (!isDragging || !panel) return;
    var dx = e.clientX - startX;
    var newLeft = startLeft + dx;
    if (newLeft < closedLeft) newLeft = closedLeft;
    if (newLeft > openLeft) newLeft = openLeft;
    setPanelLeft(newLeft, false);
  }
  function onBtnDragEnd(e) {
    if (!isDragging || !panel) return;
    isDragging = false;
    if (toggleBtn) toggleBtn.style.cursor = 'grab';
    var currentLeft = parseFloat(panel.style.left);
    var threshold = (openLeft - closedLeft) * 0.5;
    if ((currentLeft - closedLeft) > threshold) {
      openPanel(true);
      userToggled = false;
    } else {
      closePanel(true);
      userToggled = true;
    }
  }

  var clickMoved = false;
  if (toggleBtn) {
    toggleBtn.addEventListener('mousedown', onBtnDragStart);
    toggleBtn.addEventListener('click', function(e) {
      if (clickMoved) { clickMoved = false; return; }
      if (panelOpen) {
        closePanel(true);
        userToggled = true;
      } else {
        openPanel(true);
        userToggled = false;
      }
    });
    toggleBtn.addEventListener('mousedown', function(e) { clickMoved = false; });
    window.addEventListener('mousemove', function(e) {
      if (isDragging) {
        e.preventDefault();
        clickMoved = true;
        onBtnDragMove(e);
      }
    });
    window.addEventListener('mouseup', function(e) {
      if (isDragging) onBtnDragEnd(e);
    });
  }

  // Section observers
  function setupObservers() {
    var section1 = document.querySelector('#portfolio-01-container')?.closest('.section');
    var section2 = document.querySelector('#portfolio-02-container')?.closest('.section');
    var checkInterval = setInterval(function() {
      if (!section1) section1 = document.querySelector('#portfolio-01-container')?.closest('.section');
      if (!section2) section2 = document.querySelector('#portfolio-02-container')?.closest('.section');
      if (section1 && section2) {
        clearInterval(checkInterval);
        startObservers(section1, section2);
      }
    }, 200);

    function startObservers(s1, s2) {
      new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting && !userToggled) {
            openPanel(true);
          } else if (!entry.isIntersecting) {
            closePanel(true);
          }
        });
      }, { threshold: 0.1 }).observe(s1);

      new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            closePanel(true);
          }
        });
      }, { threshold: 0.1 }).observe(s2);
    }
  }

  // Attach events
  document.addEventListener('pointermove', onPointerMove);
  if (!isTouchDevice) {
    document.addEventListener('mousemove', updateCursor);
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('wheel', onWheel, { passive: false });
  }

  window.addEventListener('resize', initCanvases);
  initCanvases();

  if (panel) {
    panel.style.left = closedLeft + 'px';
    panel.style.transition = 'left 0.35s ease';
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupObservers);
  } else {
    setupObservers();
  }
})();