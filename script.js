const disc = document.getElementById("disc");
const seta = document.getElementById("seta");
const buttons = document.querySelectorAll(".icon-btn");


let isDragging = false;
let currentRotation = 0;
let velocity = 0;
let lastAngle = 0;
const autoSpinSpeed = 0.3;
let activeButton = null;
let locked = false;
let lockTimeout = null;

// Utils
function normalize180(a) {
  return ((a + 180) % 360 + 360) % 360 - 180;
}

function getAngle(x, y) {
  const rect = disc.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return Math.atan2(y - cy, x - cx) * (180 / Math.PI);
}

// Detecta qual botão a seta está apontando
function detectButton() {
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

    const dot = sx * vx + sy * vy;
    const angleDiff = Math.acos(dot) * (180 / Math.PI);

    if (angleDiff <= 15 && dot > bestDot) {
      bestDot = dot;
      foundButton = btn;
    }
  });

  return foundButton;
}

function spin() {
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

  // aplica rotação
  disc.style.transform = `translate(-50%, -50%) rotate(${currentRotation}deg)`;

  // posição da seta
  const radius = disc.offsetWidth / 2;
  const arrowH = seta.offsetHeight || 40;
  const margem = 6;
  const r = radius - arrowH / 2 - margem;

  seta.style.transform = `
    translate(-50%, -50%)
    rotate(${currentRotation}deg)
    translateY(-${r}px)
  `;

  // só muda cor enquanto gira
  const foundButton = detectButton();
  if (foundButton !== activeButton) {
    if (activeButton) {
      activeButton.style.backgroundColor = "rgba(128,128,128,0.7)";
      activeButton.classList.remove("agarrado");
    }
    if (foundButton) {
      foundButton.style.backgroundColor = "#ff5050";
    }
    activeButton = foundButton;
  }

  requestAnimationFrame(spin);
}

spin();

// arrastar
disc.addEventListener("mousedown", (e) => {
  isDragging = true;
  disc.style.cursor = "grabbing";
  lastAngle = getAngle(e.clientX, e.clientY);
  locked = false;
});

// soltar
window.addEventListener("mouseup", () => {
  isDragging = false;
  disc.style.cursor = "grab";

  // verifica se soltou em cima de um botão válido
  const targetBtn = detectButton();
  if (targetBtn) {
    locked = true;
    velocity = 0;
    targetBtn.classList.add("agarrado");
  }
});

// movimento
window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  const angle = getAngle(e.clientX, e.clientY);
  let delta = angle - lastAngle;

  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;

  velocity = delta * 1.5;
  lastAngle = angle;
});
