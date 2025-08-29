const disc = document.getElementById("disc");

let isDragging = false;
let currentRotation = 0;
let velocity = 0;
let lastAngle = 0;
let autoSpin = true;

// Função para calcular ângulo entre cursor e centro do disco
function getAngle(x, y) {
  const rect = disc.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return Math.atan2(y - cy, x - cx) * (180 / Math.PI);
}

// Loop de animação
function spin() {
  if (autoSpin && !isDragging) {
    currentRotation += 1; // velocidade automática
  } else if (isDragging) {
    currentRotation += velocity; // aplica a velocidade do mouse
  }
  
  disc.style.transform = `translate(-50%, -50%) rotate(${currentRotation}deg)`;
  requestAnimationFrame(spin);
}
spin();

// Pressiona o disco
disc.addEventListener("mousedown", (e) => {
  isDragging = true;
  autoSpin = false;
  disc.style.cursor = "grabbing";
  lastAngle = getAngle(e.clientX, e.clientY);
});

// Solta o disco
window.addEventListener("mouseup", () => {
  if (isDragging) {
    isDragging = false;
    autoSpin = true; // volta a girar sozinho
    disc.style.cursor = "grab";
  }
});

// Move o mouse
window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  const angle = getAngle(e.clientX, e.clientY);
  let delta = angle - lastAngle;

  // Corrige caso o delta passe de 180° (ex: de -179° para 179°)
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;

  // Multiplica o delta para dar mais velocidade
  velocity = delta * 2.5; // quanto maior o multiplicador, mais rápido

  lastAngle = angle;
});
