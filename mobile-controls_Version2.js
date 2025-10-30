/* Mobile Controls v1.0
 - cria joystick virtual + botões (fire, melee, trocar armas)
 - emula eventos de teclado (WASD, 1/2/3) e mouse/pointer para o canvas do jogo
 - expõe window.applyMeleeSkin(skinId) e window.mobileWeaponsData
 - Recomendações: incluir <script src="mobile-controls.js"></script> antes do </body>
*/

(function () {
  if (typeof document === 'undefined') return;

  // Helper para detectar touch
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  // Only add controls if device supports touch, but allow manual enabling:
  if (!isTouch) {
    // Controls hidden on desktop by default (CSS @media). Still create API.
  }

  // Default key mapping (can be customized)
  const KEYMAP = {
    up: 'w',
    down: 's',
    left: 'a',
    right: 'd',
    melee: 'f',
    weapon1: '1',
    weapon2: '2',
    weapon3: '3'
  };

  // state of pressed keys to avoid repeated keydown events
  const pressedKeys = new Set();

  function dispatchKey(key, type) {
    // type = 'down' or 'up'
    try {
      const ev = new KeyboardEvent('keydown', { key: key, bubbles: true });
      const evUp = new KeyboardEvent('keyup', { key: key, bubbles: true });
      // Some games listen to keydown/keyup on document
      if (type === 'down') {
        document.dispatchEvent(ev);
        window.dispatchEvent(ev);
      } else {
        document.dispatchEvent(evUp);
        window.dispatchEvent(evUp);
      }
    } catch (e) {
      console.warn('mobile-controls: keyboard event dispatch failed', e);
    }
  }

  function pressKeyOnce(key) {
    if (pressedKeys.has(key)) return;
    pressedKeys.add(key);
    dispatchKey(key, 'down');
  }
  function releaseKeyOnce(key) {
    if (!pressedKeys.has(key)) return;
    pressedKeys.delete(key);
    dispatchKey(key, 'up');
  }

  // Helper to fire pointer/mouse events on canvas
  function fireCanvasPointer(canvas, type, clientX, clientY) {
    if (!canvas) return;
    let event;
    try {
      // pointer event
      event = new PointerEvent(type, {
        bubbles: true,
        clientX: clientX || (canvas.getBoundingClientRect().left + canvas.width / 2),
        clientY: clientY || (canvas.getBoundingClientRect().top + canvas.height / 2),
        pointerType: 'touch',
        isPrimary: true
      });
      canvas.dispatchEvent(event);
    } catch (e) {
      try {
        // fallback to MouseEvent
        event = new MouseEvent(type === 'pointerdown' ? 'mousedown' : 'mouseup', {
          bubbles: true,
          clientX: clientX || (canvas.getBoundingClientRect().left + canvas.width / 2),
          clientY: clientY || (canvas.getBoundingClientRect().top + canvas.height / 2)
        });
        canvas.dispatchEvent(event);
      } catch (err) {
        console.warn('mobile-controls: failed to dispatch pointer/mouse event', err);
      }
    }
  }

  // Build DOM
  const container = document.createElement('div');
  container.id = 'mobile-controls';
  container.innerHTML = `
    <div id="mc-left">
      <div class="mc-joy-base" id="mc-joy">
        <div class="mc-joy-knob" id="mc-knob"></div>
      </div>
    </div>
    <div id="mc-right">
      <div class="mc-row">
        <div class="mc-btn" id="mc-fire">FIRE</div>
        <div class="mc-btn" id="mc-melee">MELEE</div>
      </div>
      <div class="mc-row">
        <div class="mc-btn" id="mc-w1">1</div>
        <div class="mc-btn" id="mc-w2">2</div>
        <div class="mc-btn" id="mc-w3">3</div>
      </div>
      <div class="mc-row">
        <div class="mc-btn" id="mc-skin">SKIN</div>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  // Canvas detection (try common selectors)
  const gameCanvas = document.querySelector('canvas') || document.getElementById('gameCanvas') || null;

  // Joystick logic
  const joy = document.getElementById('mc-joy');
  const knob = document.getElementById('mc-knob');
  let joyRect, centerX, centerY, maxRadius;

  function updateBounds() {
    joyRect = joy.getBoundingClientRect();
    centerX = joyRect.left + joyRect.width / 2;
    centerY = joyRect.top + joyRect.height / 2;
    maxRadius = Math.min(joyRect.width, joyRect.height) / 2;
  }
  updateBounds();
  window.addEventListener('resize', updateBounds);

  let activeTouchId = null;

  function onJoyStart(e) {
    e.preventDefault();
    updateBounds();
    const touch = (e.changedTouches && e.changedTouches[0]) || e;
    activeTouchId = touch.identifier !== undefined ? touch.identifier : 'mouse';
    moveKnobTo(touch.clientX, touch.clientY);
  }

  function onJoyMove(e) {
    if (activeTouchId === null) return;
    const touches = e.changedTouches || [e];
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i];
      if ((t.identifier !== undefined && t.identifier === activeTouchId) || activeTouchId === 'mouse') {
        moveKnobTo(t.clientX, t.clientY);
        break;
      }
    }
  }

  function onJoyEnd(e) {
    const touches = e.changedTouches || [e];
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i];
      if ((t.identifier !== undefined && t.identifier === activeTouchId) || activeTouchId === 'mouse') {
        // reset
        knob.style.left = '50%';
        knob.style.top = '50%';
        releaseKeyOnce(KEYMAP.left);
        releaseKeyOnce(KEYMAP.right);
        releaseKeyOnce(KEYMAP.up);
        releaseKeyOnce(KEYMAP.down);
        activeTouchId = null;
        break;
      }
    }
  }

  function moveKnobTo(clientX, clientY) {
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);
    const limited = Math.min(dist, maxRadius);
    const posX = centerX + nx * limited;
    const posY = centerY + ny * limited;

    // knob position relative
    const leftPct = ((posX - joyRect.left) / joyRect.width) * 100;
    const topPct = ((posY - joyRect.top) / joyRect.height) * 100;
    knob.style.left = leftPct + '%';
    knob.style.top = topPct + '%';

    // Decide which directions to press
    const deadZone = 0.25 * maxRadius;
    // horizontal
    if (Math.abs(dx) > deadZone) {
      if (dx < 0) {
        pressKeyOnce(KEYMAP.left);
        releaseKeyOnce(KEYMAP.right);
      } else {
        pressKeyOnce(KEYMAP.right);
        releaseKeyOnce(KEYMAP.left);
      }
    } else {
      releaseKeyOnce(KEYMAP.left);
      releaseKeyOnce(KEYMAP.right);
    }
    // vertical
    if (Math.abs(dy) > deadZone) {
      if (dy < 0) {
        // up (note: dy < 0 means move up on screen)
        pressKeyOnce(KEYMAP.up);
        releaseKeyOnce(KEYMAP.down);
      } else {
        pressKeyOnce(KEYMAP.down);
        releaseKeyOnce(KEYMAP.up);
      }
    } else {
      releaseKeyOnce(KEYMAP.up);
      releaseKeyOnce(KEYMAP.down);
    }
  }

  // Attach events (touch + mouse as fallback)
  joy.addEventListener('touchstart', onJoyStart, {passive: false});
  joy.addEventListener('touchmove', onJoyMove, {passive: false});
  joy.addEventListener('touchend', onJoyEnd, {passive: false});
  joy.addEventListener('touchcancel', onJoyEnd, {passive: false});

  joy.addEventListener('mousedown', onJoyStart);
  window.addEventListener('mousemove', onJoyMove);
  window.addEventListener('mouseup', onJoyEnd);

  // Buttons logic
  function makeButton(id, onTouchStart, onTouchEnd) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', function (ev) { ev.preventDefault(); onTouchStart(); }, {passive:false});
    el.addEventListener('mousedown', function (ev) { ev.preventDefault(); onTouchStart(); });
    el.addEventListener('touchend', function (ev) { ev.preventDefault(); onTouchEnd(); }, {passive:false});
    el.addEventListener('mouseup', function (ev) { ev.preventDefault(); onTouchEnd(); });
  }

  // Fire button: emulate pointerdown/up on canvas
  makeButton('mc-fire', function () {
    if (gameCanvas) {
      const r = gameCanvas.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      fireCanvasPointer(gameCanvas, 'pointerdown', cx, cy);
    } else {
      // fallback: try to press left mouse button event on document
      fireCanvasPointer(document, 'pointerdown');
    }
  }, function () {
    if (gameCanvas) {
      const r = gameCanvas.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      fireCanvasPointer(gameCanvas, 'pointerup', cx, cy);
    } else {
      fireCanvasPointer(document, 'pointerup');
    }
  });

  // Melee button: send key (press while touch down)
  makeButton('mc-melee', function () { pressKeyOnce(KEYMAP.melee); }, function () { releaseKeyOnce(KEYMAP.melee); });

  // Weapon buttons: send single press (1,2,3)
  function weaponPress(nKey) {
    pressKeyOnce(nKey);
    setTimeout(() => releaseKeyOnce(nKey), 120);
  }
  makeButton('mc-w1', function(){ weaponPress(KEYMAP.weapon1); }, function(){});
  makeButton('mc-w2', function(){ weaponPress(KEYMAP.weapon2); }, function(){});
  makeButton('mc-w3', function(){ weaponPress(KEYMAP.weapon3); }, function(){});

  // Skin button: open a simple prompt selector (demo)
  const skinBtn = document.getElementById('mc-skin');
  skinBtn && skinBtn.addEventListener('click', function () {
    const skins = (window.mobileWeaponsData && window.mobileWeaponsData.meleeSkins) || [];
    if (!skins.length) {
      alert('Sem skins registradas. Adicione skins em mobile-weapons.json ou use window.mobileWeaponsData.');
      return;
    }
    const names = skins.map((s, i) => `${i+1}: ${s.name}`).join('\n');
    const choice = prompt('Escolha skin melee:\n' + names + '\nDigite o número da skin:');
    const idx = parseInt(choice, 10) - 1;
    if (!isNaN(idx) && skins[idx]) {
      const skinId = skins[idx].id || skins[idx].name;
      if (window.applyMeleeSkin) window.applyMeleeSkin(skinId);
      alert('Tentando aplicar skin: ' + (skins[idx].name || skinId));
    }
  });

  // Expose API and default data structure
  window.mobileWeaponsData = window.mobileWeaponsData || {
    weapons: [
      // Você pode editar esse arquivo separadamente (mobile-weapons.json)
    ],
    meleeSkins: [
      // items { id, name, img (data-uri optional) }
    ]
  };

  window.applyMeleeSkin = function (skinId) {
    // Attempt to integrate with common game variables (best-effort)
    try {
      // If your game exposes a player object (common names: player, game.player)
      let player = window.player || (window.game && window.game.player) || null;
      if (player) {
        // try a couple of property names
        if ('meleeSkin' in player) {
          player.meleeSkin = skinId;
          console.log('mobile-controls: applied skin to player.meleeSkin =', skinId);
        } else if (player.setMeleeSkin) {
          player.setMeleeSkin(skinId);
          console.log('mobile-controls: called player.setMeleeSkin(', skinId, ')');
        } else {
          // attach property
          player.meleeSkin = skinId;
          console.log('mobile-controls: attached player.meleeSkin =', skinId);
        }
      } else {
        console.log('mobile-controls: player object not found; will store lastSkin for manual integration');
        window.__mobile_lastSkin = skinId;
      }

      // Also try to update a DOM element if present for fast visual feedback
      const weaponEl = document.querySelector('.player-weapon, #player-weapon');
      if (weaponEl) {
        weaponEl.setAttribute('data-melee-skin', skinId);
      }
    } catch (err) {
      console.warn('mobile-controls: applyMeleeSkin failed', err);
    }
  };

  // Small helper: expose an enable/disable if someone wants to hide controls programmatically
  window.mobileControls = {
    enable: function () { container.style.display = ''; },
    disable: function () { container.style.display = 'none'; }
  };

  // initialize visibility based on touch
  if (!isTouch) container.style.display = 'none';

  console.log('mobile-controls: initialized (touch=' + isTouch + ')');
})();