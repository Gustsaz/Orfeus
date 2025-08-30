const disc = document.getElementById("disc");
const seta = document.getElementById("seta");
const buttons = document.querySelectorAll(".icon-btn");

let isDragging = false;
let currentRotation = 0;
let velocity = 0;
let lastAngle = 0;
const autoSpinSpeed = 0.3;
let activeButton = null; // botão atualmente destacado
let locked = false;      // trava o disco na "agarradinha"
let lockTimeout = null;  // controla o tempo de travamento

function normalize180(a) {
  let ang = ((a + 180) % 360 + 360) % 360 - 180;
  return ang;
}

function getAngle(x, y) {
  const rect = disc.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return Math.atan2(y - cy, x - cx) * (180 / Math.PI);
}

function spin() {
  // Gira o disco
  if (!locked) {
    if (isDragging) {
      currentRotation += velocity;
    } else {
      if (Math.abs(velocity) > autoSpinSpeed) {
        velocity *= 0.95;
        currentRotation += velocity;
      } else {
        velocity = 0;
        currentRotation += autoSpinSpeed;
      }
    }
  }

  // Aplica a rotação ao disco
  disc.style.transform = `translate(-50%, -50%) rotate(${currentRotation}deg)`;

  // --- Posição da seta ---
  const radius = disc.offsetWidth / 2;
  const arrowH = seta.offsetHeight || 40;
  const margem = 6;
  const r = radius - arrowH / 2 - margem;

  seta.style.transform = `
    translate(-50%, -50%)
    rotate(${currentRotation}deg)
    translateY(-${r}px)
  `;

  // --- DETECÇÃO VETORIAL ---
  const rad = (currentRotation - 90) * Math.PI / 180;
  const sx = Math.cos(rad);
  const sy = Math.sin(rad);

  let foundButton = null;
  let bestDot = -2;

  buttons.forEach((btn) => {
    const rect = disc.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const btnRect = btn.getBoundingClientRect();
    const bx = btnRect.left + btnRect.width / 2 - cx;
    const by = btnRect.top + btnRect.height / 2 - cy;

    const len = Math.hypot(bx, by);
    const vx = bx / len;
    const vy = by / len;

    const dot = sx * vx + sy * vy; // alinhamento

    // converte dot -> ângulo em graus
    const angleDiff = Math.acos(dot) * (180 / Math.PI);

    // só aceita botões com diferença de até 15°
    if (angleDiff <= 15 && dot > bestDot) {
      bestDot = dot;
      foundButton = btn;
    }
  });

  // Atualiza o destaque
  if (foundButton !== activeButton) {
    if (activeButton) {
      activeButton.style.backgroundColor = "rgba(128,128,128,0.7)";
    }
    if (foundButton) {
      foundButton.style.backgroundColor = "#ff5050";

      // "Agarradinha" só quando o usuário está arrastando
      if (isDragging) {
        locked = true;
        velocity = 0;
        clearTimeout(lockTimeout);
        lockTimeout = setTimeout(() => {
          locked = false;
        }, 500);
      }
    }
    activeButton = foundButton;
  }

  requestAnimationFrame(spin);
}

spin();

// Quando começa a arrastar
disc.addEventListener("mousedown", (e) => {
  isDragging = true;
  disc.style.cursor = "grabbing";
  lastAngle = getAngle(e.clientX, e.clientY);
  locked = false; // desbloqueia se o usuário mexer
});

// Quando solta o disco
window.addEventListener("mouseup", () => {
  isDragging = false;
  disc.style.cursor = "grab";
});

// Movimento do mouse
window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  const angle = getAngle(e.clientX, e.clientY);
  let delta = angle - lastAngle;

  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;

  velocity = delta * 1.5;
  lastAngle = angle;
});
