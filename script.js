// script.js
// Place in the same folder as index.html and style.css
// Defer is used in index.html so DOM is ready.

(() => {
  // Canvas & ctx
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d', { alpha: true });

  // UI elements
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resetBtn = document.getElementById('resetBtn');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayMsg = document.getElementById('overlayMsg');
  const overlayStart = document.getElementById('overlayStart');
  const overlayClose = document.getElementById('overlayClose');
  const scoreEl = document.getElementById('score');
  const highscoreEl = document.getElementById('highscore');
  const speedRange = document.getElementById('speedRange');
  const mobileControls = document.getElementById('mobileControls');

  // Game settings
  let tileCount = 24;                 // grid size (24x24)
  let tileSize = Math.floor(canvas.width / tileCount);
  let speed = Number(speedRange.value); // game speed (FPS-ish)
  let lastFrameTime = 0;
  let frameInterval = 1000 / speed;   // milliseconds between moves

  // Game state
  let snake = [{ x: 12, y: 12 }]; // start in center
  let velocity = { x: 0, y: 0 };   // initial stationary
  let apple = { x: 6, y: 8 };
  let tailLength = 3;
  let score = 0;
  let highscore = Number(localStorage.getItem('neonSnakeHigh') || 0);
  let running = false;
  let particles = [];

  highscoreEl.textContent = highscore;

  // Colors / visuals
  const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bgGradient.addColorStop(0, 'rgba(0,20,30,0.9)');
  bgGradient.addColorStop(1, 'rgba(0,0,0,1)');

  // helpers
  function setSpeedFromRange() {
    speed = Number(speedRange.value);
    frameInterval = 1000 / speed;
  }

  function resetBoardSize() {
    // keep canvas square but responsive
    const rect = canvas.getBoundingClientRect();
    // use internal resolution fixed to 720 for crispness, but draw scaled
    // tileCount remains same
    tileSize = Math.floor(canvas.width / tileCount);
  }

  // Random apple placement not overlapping snake
  function placeApple() {
    let tries = 0;
    while (true) {
      const x = Math.floor(Math.random() * tileCount);
      const y = Math.floor(Math.random() * tileCount);
      // ensure it's not on the snake
      if (!snake.some(s => s.x === x && s.y === y)) {
        apple = { x, y };
        break;
      }
      if (++tries > 500) { // fallback
        apple = { x: (snake[0].x + 5) % tileCount, y: (snake[0].y + 3) % tileCount };
        break;
      }
    }
  }

  // Input handling (keyboard + WASD)
  window.addEventListener('keydown', (e) => {
    if (!running && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || ['w','a','s','d','W','A','S','D'].includes(e.key))) {
      startGame();
    }
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W':
        if (velocity.y === 1) break;
        velocity = { x: 0, y: -1 };
        break;
      case 'ArrowDown': case 's': case 'S':
        if (velocity.y === -1) break;
        velocity = { x: 0, y: 1 };
        break;
      case 'ArrowLeft': case 'a': case 'A':
        if (velocity.x === 1) break;
        velocity = { x: -1, y: 0 };
        break;
      case 'ArrowRight': case 'd': case 'D':
        if (velocity.x === -1) break;
        velocity = { x: 1, y: 0 };
        break;
      case ' ': // space = pause
      case 'p': case 'P':
        togglePause();
        break;
    }
  });

  // Mobile control bindings
  mobileControls?.addEventListener('click', (e) => {
    const dir = e.target.dataset.dir;
    if (!dir) return;
    if (!running) startGame();
    if (dir === 'up' && velocity.y !== 1) velocity = { x: 0, y: -1 };
    if (dir === 'down' && velocity.y !== -1) velocity = { x: 0, y: 1 };
    if (dir === 'left' && velocity.x !== 1) velocity = { x: -1, y: 0 };
    if (dir === 'right' && velocity.x !== -1) velocity = { x: 1, y: 0 };
  });

  // simple swipe detection for mobile
  let touchStart = null;
  canvas.addEventListener('touchstart', (evt) => {
    if (evt.touches.length === 1) touchStart = { x: evt.touches[0].clientX, y: evt.touches[0].clientY };
  }, { passive: true });
  canvas.addEventListener('touchend', (evt) => {
    if (!touchStart) return;
    const t = evt.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 20 && velocity.x !== -1) velocity = { x: 1, y: 0 };
      if (dx < -20 && velocity.x !== 1) velocity = { x: -1, y: 0 };
    } else {
      if (dy > 20 && velocity.y !== -1) velocity = { x: 0, y: 1 };
      if (dy < -20 && velocity.y !== 1) velocity = { x: 0, y: -1 };
    }
    touchStart = null;
  }, { passive: true });

  // UI events
  startBtn.addEventListener('click', () => startGame());
  pauseBtn.addEventListener('click', () => togglePause());
  resetBtn.addEventListener('click', () => restartGame());
  overlayStart.addEventListener('click', () => { overlay.classList.add('hidden'); startGame(); });
  overlayClose.addEventListener('click', () => overlay.classList.add('hidden'));
  speedRange.addEventListener('input', () => {
    setSpeedFromRange();
  });

  // game helpers
  function updateScore(delta=0) {
    score += delta;
    scoreEl.textContent = score;
    if (score > highscore) {
      highscore = score;
      highscoreEl.textContent = highscore;
      localStorage.setItem('neonSnakeHigh', highscore);
    }
  }

  function startGame() {
    if (!running) {
      running = true;
      // if first start or after reset, ensure some velocity
      if (velocity.x === 0 && velocity.y === 0) velocity = { x: 1, y: 0 };
      overlay.classList.add('hidden');
      lastFrameTime = performance.now();
      requestAnimationFrame(loop);
    }
  }

  function togglePause() {
    running = !running;
    if (running) {
      lastFrameTime = performance.now();
      requestAnimationFrame(loop);
      pauseBtn.textContent = 'Pause';
      overlay.classList.add('hidden');
    } else {
      pauseBtn.textContent = 'Resume';
      overlayTitle.textContent = 'Paused';
      overlayMsg.textContent = 'Game paused — press Resume or Start to continue';
      overlay.classList.remove('hidden');
    }
  }

  function restartGame() {
    // reset state
    snake = [{ x: 12, y: 12 }];
    velocity = { x: 0, y: 0 };
    tailLength = 3;
    score = 0;
    updateScore(0); // update display
    score = 0; scoreEl.textContent = 0; // ensure zero
    running = false;
    pauseBtn.textContent = 'Pause';
    placeApple();
    particles = [];
    overlayTitle.textContent = 'Neon Snake';
    overlayMsg.textContent = 'Press Start to play';
    overlay.classList.remove('hidden');
    clearCanvas();
    draw();
  }

  function gameOver() {
    running = false;
    overlayTitle.textContent = 'Game Over';
    overlayMsg.textContent = `Score: ${score} — Highscore: ${highscore}`;
    overlay.classList.remove('hidden');
    // small flash
    flashScreen();
  }

  // core game loop (movement ticks controlled by frameInterval)
  function loop(timestamp) {
    if (!running) return;
    const elapsed = timestamp - lastFrameTime;
    if (elapsed >= frameInterval) {
      lastFrameTime = timestamp;
      update(); // move snake / collision / logic
    }
    render(); // draws smoothly (particles)
    requestAnimationFrame(loop);
  }

  // update game logic at tick
  function update() {
    // move head
    const head = { x: snake[0].x + velocity.x, y: snake[0].y + velocity.y };

    // wrap-around behavior (optional) — we will lose on wall collision for challenge
    // boundaries check -> game over if outside
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
      gameOver();
      return;
    }

    // self-collision -> game over
    if (snake.some(seg => seg.x === head.x && seg.y === head.y)) {
      gameOver();
      return;
    }

    // add head
    snake.unshift(head);

    // apple check
    if (head.x === apple.x && head.y === apple.y) {
      tailLength += 1;
      updateScore(1);
      placeApple();
      // spawn a small particle burst
      spawnParticles(head.x, head.y, 18);
      // small speed bump when eating (subtle)
      // frameInterval *= 0.995;
    }

    // trim tail if needed
    while (snake.length > tailLength) snake.pop();
  }

  // drawing functions
  function clearCanvas() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
  }

  function render() {
    clearCanvas();

    // background
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // subtle grid
    drawGrid();

    // draw apple (glowing)
    drawApple();

    // draw snake body with neon gradient
    drawSnake();

    // draw particles
    updateParticles();

    // draw HUD overlays (small)
    // (score/hiscore are in DOM)
  }

  function drawGrid() {
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = '#00ffd5';
    ctx.lineWidth = 1;
    for (let i = 0; i <= tileCount; i++) {
      const pos = i * tileSize;
      // vertical
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, canvas.height);
      ctx.stroke();
      // horizontal
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(canvas.width, pos);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawApple() {
    const x = apple.x * tileSize + tileSize/2;
    const y = apple.y * tileSize + tileSize/2;
    const radius = tileSize * 0.38;

    // glow
    const g = ctx.createRadialGradient(x, y, radius*0.1, x, y, radius*2);
    g.addColorStop(0, 'rgba(255,60,90,0.95)');
    g.addColorStop(0.45, 'rgba(255,60,90,0.45)');
    g.addColorStop(1, 'rgba(255,60,90,0.02)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius*1.2, 0, Math.PI*2);
    ctx.fill();

    // apple body
    ctx.fillStyle = '#ff2d5b';
    roundRect(ctx, apple.x * tileSize + tileSize*0.12, apple.y * tileSize + tileSize*0.12, tileSize * 0.76, tileSize * 0.76, tileSize*0.14, true, false);

    // leaf
    ctx.fillStyle = '#4de07a';
    ctx.beginPath();
    ctx.ellipse(x + radius*0.18, y - radius*0.6, radius*0.34, radius*0.18, -0.6, 0, Math.PI*2);
    ctx.fill();

    // small shine
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(x - radius*0.25, y - radius*0.15, radius*0.13, radius*0.08, -0.5, 0, Math.PI*2);
    ctx.fill();
  }

  function drawSnake() {
    // draw segments from tail to head to create gradient along body
    for (let i = snake.length - 1; i >= 0; i--) {
      const seg = snake[i];
      const px = seg.x * tileSize;
      const py = seg.y * tileSize;

      // color gradient: head brighter
      const t = i / Math.max(1, snake.length - 1);
      const r = Math.floor(120 + (1 - t) * 135);
      const g = Math.floor(255 - (1 - t) * 60);
      const b = Math.floor(200 + t * 40);
      // use neon palette blend
      const fill = `rgba(${r},${g},${b},${0.95})`;

      // draw rounded block
      roundRect(ctx, px + tileSize*0.08, py + tileSize*0.08, tileSize*0.84, tileSize*0.84, tileSize*0.18, true, false, fill);

      // subtle glow
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'rgba(0,255,213,0.2)';
      ctx.fillStyle = fill;
      ctx.fillRect(px + tileSize*0.08, py + tileSize*0.08, tileSize*0.84, tileSize*0.84);
      ctx.restore();
    }

    // head accent (stroke)
    if (snake.length) {
      const h = snake[0];
      ctx.save();
      ctx.lineWidth = Math.max(2, tileSize * 0.06);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.strokeRect(h.x * tileSize + tileSize*0.08, h.y * tileSize + tileSize*0.08, tileSize*0.84, tileSize*0.84);
      ctx.restore();
    }
  }

  // small rounded rect helper
  function roundRect(ctx, x, y, w, h, r, fill=true, stroke=false, fillStyle=null) {
    if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
    ctx.beginPath();
    ctx.moveTo(x + r.tl, y);
    ctx.lineTo(x + w - r.tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
    ctx.lineTo(x + w, y + h - r.br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
    ctx.lineTo(x + r.bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
    ctx.lineTo(x, y + r.tl);
    ctx.quadraticCurveTo(x, y, x + r.tl, y);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fillStyle || 'rgba(0,255,213,0.08)';
      ctx.fill();
    }
    if (stroke) ctx.stroke();
  }

  // particles for apple bursts
  function spawnParticles(tileX, tileY, count=12) {
    const centerX = tileX * tileSize + tileSize/2;
    const centerY = tileY * tileSize + tileSize/2;
    for (let i=0;i<count;i++){
      const angle = Math.random() * Math.PI*2;
      const speed = 0.6 + Math.random()*2.8;
      particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle)*speed,
        vy: Math.sin(angle)*speed,
        life: 40 + Math.random()*40,
        size: 2 + Math.random()*4,
        hue: 330 + Math.random()*80
      });
    }
  }

  function updateParticles() {
    for (let i = particles.length-1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= 1.6;

      // draw
      ctx.beginPath();
      ctx.fillStyle = `hsla(${p.hue}, 90%, 60%, ${Math.max(0, p.life/80)})`;
      ctx.arc(p.x, p.y, p.size * Math.max(0, p.life/80), 0, Math.PI*2);
      ctx.fill();

      if (p.life <= 0) particles.splice(i,1);
    }
  }

  // screen flash on game over
  function flashScreen() {
    const flash = { alpha: 0.9 };
    let t = 0;
    const iv = setInterval(() => {
      t++;
      ctx.save();
      ctx.fillStyle = `rgba(255,40,100,${flash.alpha*(1 - t/8)})`;
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.restore();
      if (t > 7) {
        clearInterval(iv);
        render(); // ensure proper final frame
      }
    }, 28);
  }

  // simple animation-friendly draw call
  function draw() {
    render();
  }

  // initial placement
  placeApple();
  draw();

  // expose some API on window for debug (optional)
  window._neonSnake = {
    placeApple, spawnParticles, restartGame
  };

  // initial responsive adjustments
  function onResize() {
    // keep canvas internal resolution consistent for crisp visuals
    // But we keep css size responsive; canvas width/height fixed at 720 for drawing clarity
    // If you want more resolution: set canvas.width/height dynamically
    const containerWidth = Math.min(window.innerWidth - 60, 880);
    const cssSize = Math.min(containerWidth, 720);
    canvas.style.width = cssSize + 'px';
    canvas.style.height = cssSize + 'px';
    // internal canvas drawing resolution remains at 720 to keep pixel math simple
    // recompute tileSize
    tileSize = Math.floor(canvas.width / tileCount);
  }
  window.addEventListener('resize', onResize);
  onResize();

  // initial overlay visible
  overlay.classList.remove('hidden');
  overlayTitle.textContent = 'NEON SNAKE';
  overlayMsg.textContent = 'Eat apples to grow. Use Arrow keys or WASD. Tap arrows on mobile.';
  overlayStart.textContent = 'Play';
  overlayClose.textContent = 'Close';
})();
