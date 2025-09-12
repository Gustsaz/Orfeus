
// ===== SISTEMA DE AUTENTICAÇÃO E USUÁRIO =====
let currentUser = null;
let userPoints = 0;

// Atualizar pontuação do usuário (quiz)
async function updateUserScore(delta) {
  if (!currentUser) return;

  try {
    const userRef = db.collection("users").doc(currentUser.uid);
    await db.runTransaction(async (t) => {
      const doc = await t.get(userRef);
      if (!doc.exists) return;
      const currentPoints = doc.data().points || 0;
      const newPoints = Math.max(0, currentPoints + delta); // nunca negativo
      t.update(userRef, { points: newPoints });
      userPoints = newPoints;
    });

    // Atualizar UI
    const pointsElement = document.querySelector(".user-points");
    if (pointsElement) pointsElement.textContent = `${userPoints} pts`;

    await updateRanking();
  } catch (err) {
    console.error("Erro ao atualizar pontuação:", err);
  }
}


// Função para renderizar a UI de autenticação
function renderAuthUi(user) {
  const authUI = document.getElementById('auth-ui');
  if (!authUI) return;

  if (user) {
    currentUser = user;
    loadUserData();

    authUI.innerHTML = `
      <div class="user-points">${userPoints} pts</div>
      <div id="user-info">
        <img src="${user.photoURL || 'https://via.placeholder.com/40'}" alt="Foto do usuário">
        <span>${user.displayName || user.email}</span>
      </div>
      <div class="user-actions">
        <button class="edit-profile-btn" id="editProfileBtn">Editar</button>
        <button id="logout-btn">Sair</button>
      </div>
    `;

    // Adicionar event listeners
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('editProfileBtn').addEventListener('click', openProfileModal);
  } else {
    currentUser = null;
    userPoints = 0;

    authUI.innerHTML = `
      <button id="google-login-btn">
        <img src="imgs/gmail.png" alt="Google Logo"> Entrar com Google
      </button>
    `;

    // Adicionar event listener para login
    document.getElementById('google-login-btn').addEventListener('click', loginWithGoogle);
  }
}

// Função para carregar dados do usuário
async function loadUserData() {
  if (!currentUser) return;

  try {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      userPoints = userData.points || 0;

      // Atualizar exibição de pontos
      const pointsElement = document.querySelector('.user-points');
      if (pointsElement) {
        pointsElement.textContent = `${userPoints} pts`;
      }

      // Atualizar ranking
      await updateRanking();
    } else {
      // Criar documento do usuário se não existir
      await db.collection('users').doc(currentUser.uid).set({
        displayName: currentUser.displayName,
        email: currentUser.email,
        photoURL: currentUser.photoURL,
        points: 0,
        completedModules: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      userPoints = 0;

      // Criar entrada no ranking
      await updateRanking();
    }
  } catch (error) {
    console.error('Erro ao carregar dados do usuário:', error);
  }
}

// Função de login com Google
async function loginWithGoogle() {
  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;

    // Se não tiver displayName ou photoURL, força pegar
    await db.collection('users').doc(user.uid).set({
      displayName: user.displayName || user.email,
      email: user.email,
      photoURL: user.photoURL || 'https://via.placeholder.com/80',
      points: firebase.firestore.FieldValue.increment(0), // mantém os pontos existentes
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    renderAuthUi(user);
    console.log('Login realizado com sucesso:', user);
  } catch (error) {
    console.error('Erro no login:', error);
    alert('Erro ao fazer login com Google. Verifique se o Firebase está configurado.');
  }
}

// Função de logout
async function logout() {
  try {
    await auth.signOut();
    console.log('Logout realizado com sucesso');
  } catch (error) {
    console.error('Erro no logout:', error);
  }
}

// Função para abrir modal de edição de perfil
function openProfileModal() {
  if (!currentUser) return;

  const modal = document.getElementById('profileModal');
  const form = document.getElementById('profileForm');

  // Preencher formulário com dados atuais
  document.getElementById('displayName').value = currentUser.displayName || '';
  document.getElementById('email').value = currentUser.email || '';
  document.getElementById('profilePicture').src = currentUser.photoURL || 'https://via.placeholder.com/80';

  modal.classList.add('show');
}

// Função para fechar modal de perfil
function closeProfileModal() {
  const modal = document.getElementById('profileModal');
  modal.classList.remove('show');
  document.getElementById('profileForm').reset();
}

// Função para salvar alterações do perfil
async function saveProfileChanges(formData) {
  if (!currentUser) return;

  try {
    const updates = {};

    // Atualizar nome se foi alterado
    if (formData.displayName && formData.displayName !== currentUser.displayName) {
      await currentUser.updateProfile({
        displayName: formData.displayName
      });
      updates.displayName = formData.displayName;
    }

    // Atualizar senha se fornecida
    if (formData.newPassword && formData.currentPassword) {
      const credential = firebase.auth.EmailAuthProvider.credential(
        currentUser.email,
        formData.currentPassword
      );
      await currentUser.reauthenticateWithCredential(credential);
      await currentUser.updatePassword(formData.newPassword);
    }

    // Atualizar foto se foi alterada
    if (formData.photoURL) {
      await currentUser.updateProfile({
        photoURL: formData.photoURL
      });
      updates.photoURL = formData.photoURL;
    }

    // Salvar no Firestore
    if (Object.keys(updates).length > 0) {
      await db.collection('users').doc(currentUser.uid).update(updates);
    }

    closeProfileModal();
    renderAuthUi(currentUser); // Atualizar UI

    alert('Perfil atualizado com sucesso!');
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    alert('Erro ao atualizar perfil. Verifique os dados e tente novamente.');
  }
}

// Função para atualizar progresso do usuário
async function updateUserProgress(moduleId) {
  if (!currentUser) return;

  try {
    const userRef = db.collection('users').doc(currentUser.uid);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      const completedModules = userData.completedModules || [];

      if (!completedModules.includes(moduleId.toString())) {
        completedModules.push(moduleId.toString());

        // Adicionar pontos por completar módulo
        const pointsToAdd = 100; // 100 pontos por módulo
        const newPoints = (userData.points || 0) + pointsToAdd;

        await userRef.update({
          completedModules: completedModules,
          points: newPoints
        });

        userPoints = newPoints;

        // Atualizar exibição de pontos
        const pointsElement = document.querySelector('.user-points');
        if (pointsElement) {
          pointsElement.textContent = `${userPoints} pts`;
        }

        // Atualizar ranking
        await updateRanking();

        console.log(`Módulo ${moduleId} concluído! +${pointsToAdd} pontos`);
      }
    }
  } catch (error) {
    console.error('Erro ao atualizar progresso do usuário:', error);
  }
}

// Função para atualizar a UI do progresso
async function updateProgressUI() {
  if (!currentUser) return;

  try {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data();
    const completedModules = userData.completedModules || []; // garante array vazio se não existir

    const completedCount = completedModules.length;
    const totalModules = 13; // Total de módulos
    const percentage = Math.round((completedCount / totalModules) * 100);

    // Atualizar barra de progresso
    const progressBar = document.getElementById('courseProgressBar');
    const progressText = document.getElementById('courseProgressText');

    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
    }

    if (progressText) {
      progressText.textContent = `${percentage}% concluído`;
    }

    // Atualizar status dos módulos
    document.querySelectorAll('.module-card').forEach(card => {
      const moduleId = card.dataset.module;
      const statusEl = card.querySelector('.module-status');

      if (completedModules.includes(moduleId)) {
        statusEl.setAttribute('data-status', 'done');
        statusEl.textContent = '✓';
      } else {
        statusEl.setAttribute('data-status', 'pending');
        statusEl.textContent = '✕';
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar progresso:', error);
  }
}

// ---------------- Disco Giratório ----------------
const disc = document.getElementById("disc");
const tonearm = document.querySelector(".tonearm");
const buttons = document.querySelectorAll(".icon-btn");

let isDragging = false;
let currentRotation = 0;
let velocity = 0;
let lastAngle = 0;

const friction = 0.985;
const minSpin = 0.25;
let lastSpinSign = 1;

let activeButton = null;
let locked = false;
let isPaused = false; // Estado do tonearm

function getAngle(x, y) {
  const rect = disc.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return Math.atan2(y - cy, x - cx) * (180 / Math.PI);
}

function detectButton() {
  const rad = (currentRotation - 90) * Math.PI / 180;
  const sx = Math.cos(rad), sy = Math.sin(rad);
  let foundButton = null, bestDot = -2;

  buttons.forEach(btn => {
    const rect = disc.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const br = btn.getBoundingClientRect();
    const bx = br.left + br.width / 2 - cx;
    const by = br.top + br.height / 2 - cy;

    const len = Math.hypot(bx, by);
    const vx = bx / len, vy = by / len;
    const dot = sx * vx + sy * vy;
    const angleDiff = Math.acos(dot) * (180 / Math.PI);

    if (angleDiff <= 15 && dot > bestDot) {
      bestDot = dot; foundButton = btn;
    }
  });
  return foundButton;
}

let movedThisFrame = false;

function updateRotation() {
  if (isDragging && !isPaused) {
    if (movedThisFrame) {
      currentRotation += velocity;
      if (velocity !== 0) lastSpinSign = Math.sign(velocity);
    } else velocity = 0;
    movedThisFrame = false;
  } else if (!isPaused) {
    if (Math.abs(velocity) > minSpin) {
      velocity *= friction;
      currentRotation += velocity;
    } else {
      velocity = lastSpinSign * minSpin;
      currentRotation += velocity;
    }
  }
}

function spin() {
  if (!locked) updateRotation();
  disc.style.setProperty("--rotation", `${currentRotation}deg`);

  let foundButton = null;
  if (window.innerWidth > 768) foundButton = detectButton();

  if (!locked && foundButton !== activeButton) {
    if (activeButton) {
      activeButton.style.backgroundColor = "rgba(128,128,128,0.7)";
      activeButton.classList.remove("agarrado");
    }
    if (foundButton) foundButton.style.backgroundColor = "#ff5050";
    activeButton = foundButton;
  }

  requestAnimationFrame(spin);
}
spin();

disc.addEventListener("mousedown", e => {
  if (window.innerWidth <= 768) return;
  isDragging = true;
  disc.style.cursor = "grabbing";
  lastAngle = getAngle(e.clientX, e.clientY);
  locked = false;
});
window.addEventListener("mouseup", () => {
  if (!isDragging) return;
  isDragging = false;
  disc.style.cursor = "grab";
  const targetBtn = detectButton();
  if (targetBtn) {
    locked = true;
    targetBtn.classList.add("agarrado");
    goToTabFromButton(targetBtn);
  } else locked = false;
});
window.addEventListener("mousemove", e => {
  if (!isDragging) return;
  const angle = getAngle(e.clientX, e.clientY);
  let delta = angle - lastAngle;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  velocity = delta * 1.5;
  lastAngle = angle;
  movedThisFrame = true;
});

// ---------------- Tabs ----------------
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-page").forEach(page => page.classList.remove("active"));
  const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  const tabPage = document.getElementById(tabId);
  if (tabBtn) tabBtn.classList.add("active");
  if (tabPage) {
    tabPage.classList.add("active");
    Array.from(tabPage.children).forEach((el, idx) => {
      el.classList.add('fade-in-load');
      el.style.setProperty('--fade-delay', `${idx * 60}ms`);
    });
    setTimeout(() => {
      Array.from(tabPage.children).forEach(el => {
        el.classList.remove('fade-in-load');
        el.style.removeProperty('--fade-delay');
      });
    }, 1200);
  }
}

function goToTabFromButton(btn) {
  if (btn.classList.contains("norte")) switchTab("afinador");
  else if (btn.classList.contains("sul")) switchTab("cursos");
  else if (btn.classList.contains("sudoeste")) switchTab("instrumentos");
  else if (btn.classList.contains("oeste")) switchTab("ranking");
}

// ---------------- Cursos ----------------
window.addEventListener("DOMContentLoaded", () => {
  const modulesRoot = document.querySelector('#cursos .modules');
  const lessonPanel = document.getElementById('lessonPanel');
  const lessonContent = document.getElementById('lessonContent');
  const lessonClose = document.getElementById('lessonClose');
  const courseBar = document.getElementById('courseProgressBar');
  const courseText = document.getElementById('courseProgressText');

  async function getUserProgress() {
    if (!auth.currentUser) return { completedModules: [], lastCompleted: null };
    const db = firebase.firestore();
    const userRef = db.collection("users").doc(auth.currentUser.uid);
    const doc = await userRef.get();
    if (doc.exists) {
      return {
        completedModules: doc.data().completedModules || [],
        lastCompleted: null
      };
    }
    return { completedModules: [], lastCompleted: null };
  }

  async function updateUserProgress(moduleId) {
    if (!auth.currentUser) return;
    const db = firebase.firestore();
    const userRef = db.collection("users").doc(auth.currentUser.uid);

    await db.runTransaction(async (t) => {
      const doc = await t.get(userRef);
      let progress = { completedModules: [], lastCompleted: null };
      let completed = [];
      if (doc.exists && doc.data().completedModules) {
        completed = doc.data().completedModules;
      }

      if (!completed.includes(moduleId)) {
        completed.push(moduleId);
      }

      t.update(userRef, { completedModules: completed });

    });
  }
  updateRanking();


  async function updateProgressUI() {
    const progress = await getUserProgress();
    const total = document.querySelectorAll('#cursos .module-card').length;
    const pct = Math.round((progress.completedModules.length / total) * 100);

    const courseBar = document.getElementById("courseProgressBar");
    const courseText = document.getElementById("courseProgressText");

    if (courseBar) courseBar.style.width = pct + "%";
    if (courseText) courseText.textContent = pct + "% concluído";

    document.querySelectorAll('#cursos .module-card').forEach(card => {
      const id = card.dataset.module;
      const status = card.querySelector('.module-status');
      const openBtn = card.querySelector('.module-open');

      if (progress.completedModules.includes(id)) {
        status.dataset.status = 'done';
        status.textContent = '✓';
        openBtn.disabled = false;
      } else {
        status.dataset.status = 'pending';
        status.textContent = '✕';
        // 🔒 só libera se o anterior estiver concluído
        const prevId = (parseInt(id) - 1).toString();
        if (id === "1" || progress.completedModules.includes(prevId)) {
          openBtn.disabled = false;
        } else {
          openBtn.disabled = true;
        }
      }
    });
  }

  async function completeModule(id) {
    if (!currentUser) return;

    try {
      await updateUserProgress(id);
      console.log(`Módulo ${id} marcado como concluído`);
    } catch (error) {
      console.error('Erro ao marcar módulo como concluído:', error);
    }
  }

  const quizQuestions = [
    { q: "Qual instrumento é mais grave?", options: ["Violão", "Contrabaixo", "Flauta"], correct: 1 },
    { q: "Um apito é considerado:", options: ["Agudo", "Grave"], correct: 0 },
    { q: "O bumbo da bateria é:", options: ["Agudo", "Grave"], correct: 1 },
    { q: "Uma flauta doce toca sons mais:", options: ["Agudos", "Graves"], correct: 0 },
    { q: "O som de trovão geralmente é:", options: ["Agudo", "Grave"], correct: 1 },
    { q: "Um violino toca geralmente em registro:", options: ["Mais agudo", "Mais grave"], correct: 0 },
    { q: "A tuba é um instrumento:", options: ["Agudo", "Grave"], correct: 1 },
    { q: "O canto de um pássaro pequeno costuma ser:", options: ["Agudo", "Grave"], correct: 0 },
    { q: "A voz masculina grave é chamada de:", options: ["Soprano", "Baixo"], correct: 1 },
    { q: "Quanto maior a frequência do som, ele é:", options: ["Mais grave", "Mais agudo"], correct: 1 }
  ];

  function openLesson(id) {
    if (!lessonPanel || !lessonContent) return;
    let html = '';
    if (id === '1') {
      html = `
        <h3>Módulo 1 — Sons agudos e graves</h3>
        <div style="margin:16px 0;">
          <iframe width="1250" height="703" src="https://www.youtube.com/embed/45C9i6cJTVY" title="ALTURA, INTENSIDADE E TIMBRE" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        </div>
        <p>Na música, chamamos de <b>altura</b> a percepção do quão <b>grave</b> ou <b>agudo</b> é um som.</p>
        <ul>
          <li><b>Sons graves</b> → frequências baixas, como o bumbo ou vozes masculinas mais profundas.</li>
          <li><b>Sons agudos</b> → frequências altas, como apitos, flautas ou vozes femininas mais finas.</li>
        </ul>
        <p>Essas diferenças acontecem porque o som é uma onda. Quanto maior a frequência, mais agudo o som. Quanto menor a frequência, mais grave.</p>
        <div id="startQuiz1" style="margin-top:30px; text-align:center;">
          <button id="startQuizBtn" style="padding:20px 32px; font-size:22px; font-weight:bold; background:#1a1a1a; color:#fff; border:2px solid #333; border-radius:12px; cursor:pointer;">
            Iniciar Quiz Completo (10 questões)
          </button>
        </div>
        <div id="fullQuiz1" style="display:none; margin-top:20px; padding:16px; border:1px solid #333; border-radius:8px;">
          <h4>Quiz sobre sons agudos e graves</h4>
          <p id="quiz-timer">Tempo restante: 60s</p>
          <div id="quiz-question"></div>
          <div id="quiz-options" style="margin-top:12px;"></div>
          <p id="quiz-feedback" style="margin-top:10px;"></p>
        </div>
      `;
    } else if (id === '2') {
      html = `
    <h3>Módulo 2 — Propriedades do Som</h3>
    <div style="margin:16px 0;">
      <iframe width="1250" height="703" src="https://www.youtube.com/embed/j3B_AAJ-Rtk" title="PROPRIEDADES DO SOM - Professor José Silveira (Teoria Musical Aula 1)" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
    </div>
    <p>O som possui <b>cinco propriedades fundamentais</b> que usamos para entender e organizar a música:</p>
    <ul>
      <li><b>Duração</b> → tempo que o som permanece soando.</li>
      <li><b>Pulsação</b> → batida regular que sentimos em uma música.</li>
      <li><b>Ritmo</b> → organização dos sons e silêncios no tempo.</li>
      <li><b>Intensidade</b> → volume, se o som é forte ou fraco.</li>
      <li><b>Altura</b> → se o som é grave ou agudo.</li>
      <li><b>Timbre</b> → “cor” do som, o que diferencia instrumentos tocando a mesma nota.</li>
    </ul>
    <p>Essas propriedades, juntas, tornam possível reconhecer, diferenciar e criar músicas.</p>

    <div id="startQuiz2" style="margin-top:30px; text-align:center;">
      <button id="startQuizBtn2" style="padding:20px 32px; font-size:22px; font-weight:bold; background:#1a1a1a; color:#fff; border:2px solid #333; border-radius:12px; cursor:pointer;">
        Iniciar Quiz Completo (10 questões)
      </button>
    </div>

    <div id="fullQuiz2" style="display:none; margin-top:20px; padding:16px; border:1px solid #333; border-radius:8px;">
      <h4>Quiz sobre Propriedades do Som</h4>
      <p id="quiz2-timer">Tempo restante: 60s</p>
      <div id="quiz2-question"></div>
      <div id="quiz2-options" style="margin-top:12px;"></div>
      <p id="quiz2-feedback" style="margin-top:10px;"></p>
    </div>
  `;
    } else if (id === '3') {
      html = `
    <h3>Módulo 3 — Ritmo</h3>
    <div style="margin:16px 0;">
            <iframe width="1250" height="703" src="https://www.youtube.com/embed/QLuHvLjl5t4" title="TEMPO MUSICAL não é bobagem, entenda..." frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
    </div>
    <p>O <b>ritmo</b> é a organização dos sons e silêncios no tempo.</p>
    <ul>
      <li><b>Pulsação</b> → a batida constante que sentimos numa música.</li>
      <li><b>Compasso</b> → a divisão da pulsação em grupos regulares.</li>
      <li><b>Ritmo</b> → a variação e combinação de sons curtos, longos e pausas.</li>
    </ul>
    <p>O ritmo é um dos principais elementos que dá identidade às músicas, especialmente no hip hop.</p>

    <div id="startQuiz3" style="margin-top:30px; text-align:center;">
      <button id="startQuizBtn3" style="padding:20px 32px; font-size:22px; font-weight:bold; background:#1a1a1a; color:#fff; border:2px solid #333; border-radius:12px; cursor:pointer;">
        Iniciar Quiz Completo (10 questões)
      </button>
    </div>

    <div id="fullQuiz3" style="display:none; margin-top:20px; padding:16px; border:1px solid #333; border-radius:8px;">
      <h4>Quiz sobre Ritmo</h4>
      <p id="quiz3-timer">Tempo restante: 60s</p>
      <div id="quiz3-question"></div>
      <div id="quiz3-options" style="margin-top:12px;"></div>
      <p id="quiz3-feedback" style="margin-top:10px;"></p>
    </div>
  `;
    } else if (id === '4') {
      html = `
    <h3>Módulo 4 — Tons e Semitons</h3>
    <div style="margin:16px 0;">
      <iframe width="1250" height="703" src="https://www.youtube.com/embed/1BSfno5tfdI" title="Tudo sobre tom e meio-tom (semitom)" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
    </div>
    <p>Na música, usamos <b>tons</b> e <b>semitons</b> para medir a distância entre notas:</p>
    <ul>
      <li><b>Semi-tom</b> → é a menor distância possível entre duas notas (ex: Mi → Fá, Si → Dó).</li>
      <li><b>Tom</b> → equivale a dois semitons (ex: Dó → Ré, Fá → Sol).</li>
    </ul>
    <p>Esses intervalos são a base para escalas, melodias e harmonia.</p>

    <div id="startQuiz4" style="margin-top:30px; text-align:center;">
      <button id="startQuizBtn4" style="padding:20px 32px; font-size:22px; font-weight:bold; background:#1a1a1a; color:#fff; border:2px solid #333; border-radius:12px; cursor:pointer;">
        Iniciar Quiz Completo (10 questões)
      </button>
    </div>

    <div id="fullQuiz4" style="display:none; margin-top:20px; padding:16px; border:1px solid #333; border-radius:8px;">
      <h4>Quiz sobre Tons e Semitons</h4>
      <p id="quiz4-timer">Tempo restante: 60s</p>
      <div id="quiz4-question"></div>
      <div id="quiz4-options" style="margin-top:12px;"></div>
      <p id="quiz4-feedback" style="margin-top:10px;"></p>
    </div>
  `;
    } else if (id === '5') {
      html = `
    <h3>Módulo 5 — Escala Maior</h3>
    <div style="margin:16px 0;">
      <iframe width="1250" height="703" src="https://www.youtube.com/embed/6vMgalKSnv4" title="Conhece a diferença entre a escala maior e menor? | Posso Tocar com Daiany Dezembro" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
    </div>
    <p>A <b>escala maior</b> é uma das mais usadas na música.  
    Ela é formada por uma sequência de <b>tons</b> e <b>semitons</b> (relembrando o Módulo 4):</p>

    <p><b>Padrão:</b> Tom – Tom – Semitom – Tom – Tom – Tom – Semitom</p>

    <p><b>Exemplo da Escala de Dó Maior:</b></p>
    <ul>
      <li>Dó → Ré (Tom)</li>
      <li>Ré → Mi (Tom)</li>
      <li>Mi → Fá (Semitom)</li>
      <li>Fá → Sol (Tom)</li>
      <li>Sol → Lá (Tom)</li>
      <li>Lá → Si (Tom)</li>
      <li>Si → Dó (Semitom)</li>
    </ul>

    <p>Essa é a escala mais comum para iniciantes, pois usa apenas as teclas brancas do piano 🎹.</p>

    <div id="startQuiz5" style="margin-top:30px; text-align:center;">
      <button id="startQuizBtn5" style="padding:20px 32px; font-size:22px; font-weight:bold; background:#1a1a1a; color:#fff; border:2px solid #333; border-radius:12px; cursor:pointer;">
        Iniciar Quiz Completo (10 questões)
      </button>
    </div>

    <div id="fullQuiz5" style="display:none; margin-top:20px; padding:16px; border:1px solid #333; border-radius:8px;">
      <h4>Quiz sobre Escala Maior</h4>
      <p id="quiz5-timer">Tempo restante: 60s</p>
      <div id="quiz5-question"></div>
      <div id="quiz5-options" style="margin-top:12px;"></div>
      <p id="quiz5-feedback" style="margin-top:10px;"></p>
    </div>
  `;
    } else if (id === '6') {
      html = `
    <h3>Módulo 6 — Escala Menor</h3>
    <div style="margin:16px 0;">
      <iframe width="1250" height="703" src="https://www.youtube.com/embed/6vMgalKSnv4" title="Conhece a diferença entre a escala maior e menor? | Posso Tocar com Daiany Dezembro" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
    </div>
    <p>A <b>escala menor natural</b> tem uma sonoridade mais triste ou melancólica, em contraste com a escala maior.</p>

    <p><b>Padrão:</b> Tom – Semitom – Tom – Tom – Semitom – Tom – Tom</p>

    <p><b>Exemplo da Escala de Lá Menor (relativa da Dó Maior):</b></p>
    <ul>
      <li>Lá → Si (Tom)</li>
      <li>Si → Dó (Semitom)</li>
      <li>Dó → Ré (Tom)</li>
      <li>Ré → Mi (Tom)</li>
      <li>Mi → Fá (Semitom)</li>
      <li>Fá → Sol (Tom)</li>
      <li>Sol → Lá (Tom)</li>
    </ul>

    <p>Perceba que a escala de <b>Lá menor natural</b> usa as mesmas notas da escala de <b>Dó maior</b>, mas começa do Lá.</p>

    <div id="startQuiz6" style="margin-top:30px; text-align:center;">
      <button id="startQuizBtn6" style="padding:20px 32px; font-size:22px; font-weight:bold; background:#1a1a1a; color:#fff; border:2px solid #333; border-radius:12px; cursor:pointer;">
        Iniciar Quiz Completo (10 questões)
      </button>
    </div>

    <div id="fullQuiz6" style="display:none; margin-top:20px; padding:16px; border:1px solid #333; border-radius:8px;">
      <h4>Quiz sobre Escala Menor</h4>
      <p id="quiz6-timer">Tempo restante: 60s</p>
      <div id="quiz6-question"></div>
      <div id="quiz6-options" style="margin-top:12px;"></div>
      <p id="quiz6-feedback" style="margin-top:10px;"></p>
    </div>
  `;
    } else if (id === '7') {
      html = `
    <h3>Módulo 7 — Figuras Musicais</h3>
    <div style="margin:16px 0;">
      <iframe width="1250" height="703" src="https://www.youtube.com/embed/W6VO9HqZFtU" title="TEMPOS E FIGURAS MUSICAIS - Professor José Silveira (Teoria Musical Aula 3)" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
    </div>

    <div style="display:flex; align-items:flex-start; gap:16px; margin-bottom:20px;">
      <img src="imgs/figs.jpg" alt="Figuras Musicais" 
           style="max-width:300px; border:1px solid #333; border-radius:8px;">
      <div>
        <p>As <b>figuras musicais</b> representam a <b>duração</b> de um som ou silêncio.</p>

        <p>Cada figura possui uma <b>estrutura</b>:</p>
        <ul>
          <li><b>Cabeça</b> → parte oval, pode ser vazada (semibreve) ou preenchida (semínima, colcheia, etc.).</li>
          <li><b>Haste</b> → traço vertical ligado à cabeça, usado em figuras de menor duração.</li>
          <li><b>Colchetes ou bandeirolas</b> → pequenos traços curvos ligados à haste, que indicam divisões menores (colcheia, semicolcheia, etc.).</li>
        </ul>

        <p>Na tabela ao lado estão as principais figuras de som, suas durações em tempos e os símbolos de silêncio correspondentes.</p>
      </div>
    </div>

    <div id="startQuiz7" style="margin-top:30px; text-align:center;">
      <button id="startQuizBtn7" style="padding:20px 32px; font-size:22px; font-weight:bold; background:#1a1a1a; color:#fff; border:2px solid #333; border-radius:12px; cursor:pointer;">
        Iniciar Quiz Completo (10 questões)
      </button>
    </div>

    <div id="fullQuiz7" style="display:none; margin-top:20px; padding:16px; border:1px solid #333; border-radius:8px;">
      <h4>Quiz sobre Figuras Musicais</h4>
      <p id="quiz7-timer">Tempo restante: 60s</p>
      <div id="quiz7-question"></div>
      <div id="quiz7-options" style="margin-top:12px;"></div>
      <p id="quiz7-feedback" style="margin-top:10px;"></p>
    </div>
  `;
    } else if (id === '8') {
      html = `
    <h3>Módulo 8 — Melhorando o Ritmo</h3>
    <div style="margin:16px 0;">
      <iframe width="1250" height="703" src="https://www.youtube.com/embed/xCXmWt20WQo" title="O que é Ritmo | Teoria Musical" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
    </div>

    <p>Agora que você já conhece o <b>ritmo básico</b>, vamos avançar utilizando figuras como a 
    <b>semínima</b> (1 tempo) e a <b>semínima pontuada</b> (1 tempo e meio).</p>

    <ul>
      <li><b>Semínima</b> → dura exatamente 1 tempo.</li>
      <li><b>Semínima pontuada</b> → recebe um ponto ao lado, aumentando sua duração em metade do valor (1 + ½ = 1,5 tempos).</li>
    </ul>

    <p>Também precisamos entender a diferença entre <b>ritmos simples</b> e <b>ritmos compostos</b>:</p>
    <ul>
      <li><b>Ritmos simples</b> → dividem o tempo em 2 partes iguais (ex: compasso 2/4 ou 4/4).</li>
      <li><b>Ritmos compostos</b> → dividem o tempo em 3 partes iguais (ex: compasso 6/8).</li>
    </ul>

    <p>Com isso, você poderá ler e executar <b>ritmos mais variados e dinâmicos</b>, unindo figuras diferentes para criar padrões musicais mais interessantes.</p>

    <div id="startQuiz8" style="margin-top:30px; text-align:center;">
      <button id="startQuizBtn8" style="padding:20px 32px; font-size:22px; font-weight:bold; background:#1a1a1a; color:#fff; border:2px solid #333; border-radius:12px; cursor:pointer;">
        Iniciar Quiz Completo (10 questões)
      </button>
    </div>

    <div id="fullQuiz8" style="display:none; margin-top:20px; padding:16px; border:1px solid #333; border-radius:8px;">
      <h4>Quiz sobre Ritmo Avançado</h4>
      <p id="quiz8-timer">Tempo restante: 60s</p>
      <div id="quiz8-question"></div>
      <div id="quiz8-options" style="margin-top:12px;"></div>
      <p id="quiz8-feedback" style="margin-top:10px;"></p>
    </div>
  `;
    } else // ---------------- MÓDULO 9 ----------------
      if (id === '9') {
        html = `
    <h3>Módulo 9 — Claves Musicais</h3>
    <div style="margin:16px 0;">
      <iframe width="1250" height="703" src="https://www.youtube.com/embed/AAfsAlWiuNY" title="O que são as Claves na música??? [Teoria 4]" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
    </div>
    <div style="display:flex; gap:20px; align-items:flex-start;">
      <img src="imgs/clave_img.png" alt="Claves Musicais" style="max-width:300px; border:1px solid #333; border-radius:6px;">
      <div>
        <p>As <b>claves</b> são símbolos usados no início da pauta musical para indicar a altura das notas.</p>
        <ul>
          <li><b>Clave de Sol</b> → a mais utilizada, posiciona a nota <b>Sol</b> na segunda linha da pauta. Muito usada para instrumentos como violino, flauta, guitarra e piano (mão direita).</li>
          <li><b>Clave de Fá</b> → posiciona a nota <b>Fá</b> na quarta linha. Muito usada para instrumentos graves como contrabaixo, fagote, trombone e piano (mão esquerda).</li>
          <li><b>Clave de Dó</b> → posiciona o <b>Dó</b> central em diferentes linhas, dependendo da versão (soprano, contralto, tenor). Usada em instrumentos como viola.</li>
        </ul>
        <p>A <b>clave de Sol</b> é a mais importante para iniciantes, pois é a base para a maioria dos instrumentos e para a leitura musical no geral.</p>
      </div>
    </div>

    <div id="startQuiz9" style="margin-top:30px; text-align:center;">
      <button id="startQuizBtn9" style="padding:20px 32px; font-size:22px; font-weight:bold; background:#1a1a1a; color:#fff; border:2px solid #333; border-radius:12px; cursor:pointer;">
        Iniciar Quiz Completo (10 questões)
      </button>
    </div>

    <div id="fullQuiz9" style="display:none; margin-top:20px; padding:16px; border:1px solid #333; border-radius:8px;">
      <h4>Quiz sobre Claves Musicais</h4>
      <p id="quiz9-timer">Tempo restante: 60s</p>
      <div id="quiz9-question"></div>
      <div id="quiz9-options" style="margin-top:12px;"></div>
      <p id="quiz9-feedback" style="margin-top:10px;"></p>
    </div>
  `;
      } else if (id === '10') {
        html = `
    <h3>Módulo 10 — Compasso</h3>
    <div style="margin:16px 0;">
      <iframe width="1250" height="703" src="https://www.youtube.com/embed/k3xxa3CF_Z4" title="Compasso Simples e Compasso Composto | Teoria Musical" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
    </div>

    <div style="display:flex; align-items:flex-start; gap:16px; margin-bottom:20px;">
      <img src="imgs/compasso_img.jpg" alt="Compasso" 
           style="max-width:300px; border:1px solid #333; border-radius:8px;">
      <div>
        <p>O <b>compasso</b> organiza os tempos da música em grupos regulares, facilitando a leitura e execução.</p>

        <p>👉 Tipos principais:</p>
        <ul>
          <li><b>Binário</b> — 2 tempos (ex: 2/4)</li>
          <li><b>Ternário</b> — 3 tempos (ex: 3/4)</li>
          <li><b>Quaternário</b> — 4 tempos (ex: 4/4, o mais comum)</li>
        </ul>

        <p>O compasso é indicado no início da partitura como uma fórmula de fração, onde o número superior indica quantos tempos há, e o inferior qual figura representa o tempo.</p>
      </div>
    </div>

    <div id="startQuiz10" style="margin-top:30px; text-align:center;">
      <button id="startQuizBtn10" style="padding:20px 32px; font-size:22px; font-weight:bold; background:#1a1a1a; color:#fff; border:2px solid #333; border-radius:12px; cursor:pointer;">
        Iniciar Quiz Completo (10 questões)
      </button>
    </div>

    <div id="fullQuiz10" style="display:none; margin-top:20px; padding:16px; border:1px solid #333; border-radius:8px;">
      <h4>Quiz sobre Compassos</h4>
      <p id="quiz10-timer">Tempo restante: 60s</p>
      <div id="quiz10-question"></div>
      <div id="quiz10-options" style="margin-top:12px;"></div>
      <p id="quiz10-feedback" style="margin-top:10px;"></p>
    </div>
  `;
      } else if (id === '11') {
        html = `
    <h3>Módulo 11 — Acidentes Musicais</h3>
    <div style="margin:16px 0;">
      <iframe width="1250" height="703" src="https://www.youtube.com/embed/w6bbgz0RkHE" title="Bemol e sustenido: Os acidentes musicais" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
    </div>

    <div style="display:flex; align-items:flex-start; gap:16px; margin-bottom:20px;">
      <img src="imgs/acidentes_img.png" alt="Acidentes Musicais" 
           style="max-width:300px; border:1px solid #333; border-radius:8px;">
      <div>
        <p>Os <b>acidentes musicais</b> são símbolos usados para alterar a altura natural de uma nota.</p>
        <ul>
          <li><b>Sustenido (♯)</b> → eleva a nota em 1 semitom.</li>
          <li><b>Bemol (♭)</b> → abaixa a nota em 1 semitom.</li>
          <li><b>Bequadro (♮)</b> → cancela o efeito de sustenidos ou bemóis anteriores.</li>
        </ul>
        <p>Os acidentes podem aparecer isolados em notas ou na <b>armadura de clave</b>, indicando alterações válidas para toda a música.</p>
      </div>
    </div>

    <div id="startQuiz11" style="margin-top:30px; text-align:center;">
      <button id="startQuizBtn11" style="padding:20px 32px; font-size:22px; font-weight:bold; background:#1a1a1a; color:#fff; border:2px solid #333; border-radius:12px; cursor:pointer;">
        Iniciar Quiz Completo (10 questões)
      </button>
    </div>

    <div id="fullQuiz11" style="display:none; margin-top:20px; padding:16px; border:1px solid #333; border-radius:8px;">
      <h4>Quiz sobre Acidentes Musicais</h4>
      <p id="quiz11-timer">Tempo restante: 60s</p>
      <div id="quiz11-question"></div>
      <div id="quiz11-options" style="margin-top:12px;"></div>
      <p id="quiz11-feedback" style="margin-top:10px;"></p>
    </div>
  `;
      } else if (id === '12') {
        html = `
    <h3>Módulo 12 — Armadura de Clave</h3>

    <div style="margin:16px 0;">
      <iframe width="1250" height="703" src="https://www.youtube.com/embed/PH8KYU08u3c" title="Armadura de clave: Os bemóis" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      <iframe width="1250" height="703" src="https://www.youtube.com/embed/d-uR11HYpPI" title="Armadura de clave: Os sustenidos" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
    </div>

    <div style="display:flex; align-items:flex-start; gap:16px; margin-bottom:20px;">
      <img src="imgs/armadura_img.jpg" alt="Armadura de Clave / Círculo das Quintas"
           style="max-width:300px; border:1px solid #333; border-radius:8px;">
      <div>
        <p>A <b>armadura de clave</b> é o conjunto de <b>sustenidos (♯)</b> e <b>bemóis (♭)</b> escrito após a clave, no início do pentagrama.
        Ela indica quais notas serão alteradas <b>durante toda a peça</b> (até que haja mudança de armadura).</p>

        <h4 style="margin-top:10px;">1) Ordem dos acidentes</h4>
        <p><b>Sustenidos (♯):</b> Fá♯, Dó♯, Sol♯, Ré♯, Lá♯, Mi♯, Si♯ (memória: <i>F C G D A E B</i>).</p>
        <p><b>Bemóis (♭):</b> Si♭, Mi♭, Lá♭, Ré♭, Sol♭, Dó♭, Fá♭ (memória: <i>B E A D G C F</i>).</p>

        <h4 style="margin-top:10px;">2) Como identificar a tonalidade maior pela armadura</h4>
        <ul>
          <li><b>Com sustenidos:</b> pegue o <b>último sustenido</b> e suba <b>meio tom</b>. Ex.: último ♯ é Sol♯ → tonalidade <b>Lá Maior</b>.</li>
          <li><b>Com bemóis:</b> a tonalidade é o <b>penúltimo bemol</b>. Ex.: armadura com Si♭ e Mi♭ → <b>Si♭ Maior</b>.
              <br><b>Exceção:</b> se houver apenas <b>um bemol</b> (Si♭), a tonalidade é <b>Fá Maior</b>.</li>
          <li><b>Sem acidentes:</b> <b>Dó Maior</b> (relativa: <b>Lá menor</b>).</li>
        </ul>

        <h4 style="margin-top:10px;">3) Relativas menores</h4>
        <p>Para achar a menor relativa de uma tonalidade maior, desça <b>1 tom e meio</b> (ou conte 6 graus).
           Ex.: Dó Maior → <b>Lá menor</b>; Mi♭ Maior → <b>Dó menor</b>. As duas compartilham a mesma armadura.</p>

        <h4 style="margin-top:10px;">4) Círculo das Quintas</h4>
        <p>Seguindo quintas ascendentes, adicionamos ♯ (G, D, A, E, B, F♯, C♯). Em quintas descendentes, adicionamos ♭ (F, B♭, E♭, A♭, D♭, G♭, C♭).
        Esse círculo organiza <b>afinidades tonais</b>, progressões e <b>modulações</b>.</p>

        <h4 style="margin-top:10px;">5) Boas práticas de leitura</h4>
        <ul>
          <li>Acidentes da armadura valem para todas as oitavas e linhas (salvo indicação de bequadro ♮).</li>
          <li>Mudança de tonalidade: uma nova armadura aparece após barra dupla; vale a partir daquele compasso.</li>
          <li><i>Cortesias</i> (acidentes entre parênteses) podem aparecer para facilitar a leitura.</li>
        </ul>

        <h4 style="margin-top:10px;">6) Exemplos rápidos</h4>
        <ul>
          <li><b>G Maior</b>: 1 ♯ (Fá♯) — relativa: <b>Em</b>.</li>
          <li><b>D Maior</b>: 2 ♯ (Fá♯, Dó♯) — relativa: <b>Bm</b>.</li>
          <li><b>F Maior</b>: 1 ♭ (Si♭) — relativa: <b>Dm</b>.</li>
          <li><b>E♭ Maior</b>: 3 ♭ (Si♭, Mi♭, Lá♭) — relativa: <b>Cm</b>.</li>
        </ul>
      </div>
    </div>

    <div id="startQuiz12" style="margin-top:30px; text-align:center;">
      <button id="startQuizBtn12"
        style="padding:20px 32px; font-size:22px; font-weight:bold; background:#1a1a1a; color:#fff; border:2px solid #333; border-radius:12px; cursor:pointer;">
        Iniciar Quiz Completo (10 questões)
      </button>
    </div>

    <div id="fullQuiz12" style="display:none; margin-top:20px; padding:16px; border:1px solid #333; border-radius:8px;">
      <h4>Quiz — Armadura de Clave</h4>
      <p id="quiz12-timer">Tempo restante: 60s</p>
      <div id="quiz12-question"></div>
      <div id="quiz12-options" style="margin-top:12px;"></div>
      <p id="quiz12-feedback" style="margin-top:10px;"></p>
    </div>
  `;
      } else if (id === '13') {
        html = `
    <h3>Módulo 13 — Desafio Final: Identificação de Notas</h3>
    <p>Selecione as notas corretas em cada posição da partitura abaixo:</p>
    
    <div style="margin:16px 0;">
      <img src="imgs/partitura.jpg" alt="Partitura" 
           style="max-width:100%; border:1px solid #333; border-radius:8px; display:block; margin-bottom:20px;">
    </div>

    <div id="noteSelectionArea" style="display:grid; grid-template-columns: repeat(6, auto); gap:12px; margin-bottom:20px; justify-content:center;">
    </div>

    <button id="checkNotesBtn" 
            style="padding:16px 28px; font-size:20px; font-weight:bold; background:#1a1a1a; color:#fff; border:2px solid #333; border-radius:12px; cursor:pointer;">
      Verificar Respostas
    </button>

    <p id="noteFeedback" style="margin-top:15px; font-size:18px; font-weight:bold;"></p>
  `;
      }


    lessonContent.innerHTML = html;

    // Quiz completo do módulo 1
    if (id === '1') {
      const startBtn = document.getElementById("startQuizBtn");
      const quizBox = document.getElementById("fullQuiz1");
      if (startBtn) {
        startBtn.addEventListener("click", () => {
          startBtn.style.display = "none";
          quizBox.style.display = "block";
          startFullQuiz();
        });
      }
      function startFullQuiz() {
        let current = 0;
        let score = 0;
        let timeLeft = 60;
        const timerEl = document.getElementById("quiz-timer");
        const qEl = document.getElementById("quiz-question");
        const optsEl = document.getElementById("quiz-options");
        const feedbackEl = document.getElementById("quiz-feedback");
        const timer = setInterval(() => {
          timeLeft--;
          timerEl.textContent = `Tempo restante: ${timeLeft}s`;
          if (timeLeft <= 0) { clearInterval(timer); finishQuiz(); }
        }, 1000);
        function showQuestion() {
          if (current >= quizQuestions.length) { finishQuiz(); return; }
          const q = quizQuestions[current];
          qEl.textContent = q.q;
          optsEl.innerHTML = "";
          feedbackEl.textContent = "";

          q.options.forEach((opt, i) => {
            const btn = document.createElement("button");
            btn.textContent = opt;
            btn.style.margin = "8px 4px";
            btn.style.padding = "18px 28px";
            btn.style.fontSize = "20px";
            btn.style.fontWeight = "bold";
            btn.style.background = "#222";
            btn.style.color = "#fff";
            btn.style.border = "2px solid #555";
            btn.style.borderRadius = "10px";
            btn.style.cursor = "pointer";
            btn.style.transition = "all 0.25s ease";

            // Hover effect
            btn.addEventListener("mouseenter", () => {
              btn.style.background = "#444";
            });
            btn.addEventListener("mouseleave", () => {
              if (!btn.disabled) btn.style.background = "#222";
            });

            btn.addEventListener("click", async () => {
              // Desabilita todos os botões após a escolha
              Array.from(optsEl.children).forEach(b => b.disabled = true);

              if (i === q.correct) {
                btn.style.background = "green";
                feedbackEl.textContent = "✅ Correto! +10 pontos";
                feedbackEl.style.color = "lightgreen";
                score += 10;
                await updateUserScore(10);
              } else {
                btn.style.background = "red";
                feedbackEl.textContent = "❌ Errado! -5 pontos";
                feedbackEl.style.color = "red";
                score -= 5;
                await updateUserScore(-5);

                // Marca a correta em verde
                optsEl.children[q.correct].style.background = "green";
              }

              current++;
              // feedback desaparece em 500ms
              setTimeout(() => {
                feedbackEl.textContent = "";
                showQuestion();
              }, 500);
            });

            optsEl.appendChild(btn);
          });
        }

        function finishQuiz() {
          clearInterval(timer);
          qEl.textContent = "Quiz finalizado!";
          optsEl.innerHTML = "";
          feedbackEl.textContent = `Pontuação final: ${score}`;
          feedbackEl.style.color = "#ffd700";
          updateUserProgress("1").then(updateProgressUI);

        }
        showQuestion();
      }
    }

    // Quiz completo do módulo 2
    if (id === '2') {
      const startBtn2 = document.getElementById("startQuizBtn2");
      const quizBox2 = document.getElementById("fullQuiz2");

      const quizQuestions2 = [
        { q: "Qual propriedade define se um som é longo ou curto?", options: ["Duração", "Altura", "Intensidade"], correct: 0 },
        { q: "A batida constante de uma música é chamada de:", options: ["Pulsação", "Timbre", "Altura"], correct: 0 },
        { q: "A organização de sons e silêncios no tempo é:", options: ["Ritmo", "Intensidade", "Duração"], correct: 0 },
        { q: "Se um som é muito forte ou muito fraco, estamos falando de:", options: ["Timbre", "Intensidade"], correct: 1 },
        { q: "Quando um som é grave ou agudo, falamos de:", options: ["Altura", "Duração"], correct: 0 },
        { q: "O que diferencia a mesma nota tocada no violão e no piano?", options: ["Intensidade", "Timbre", "Ritmo"], correct: 1 },
        { q: "O bumbo de bateria é percebido como:", options: ["Som de altura grave", "Som de altura aguda"], correct: 0 },
        { q: "Um apito é percebido como:", options: ["Som de altura aguda", "Som de altura grave"], correct: 0 },
        { q: "Um crescendo (ficar cada vez mais forte) é variação de:", options: ["Duração", "Intensidade"], correct: 1 },
        { q: "Se duas pessoas cantam a mesma nota, mas uma soa mais aguda e outra mais grave, isso é diferença de:", options: ["Altura", "Timbre"], correct: 0 }
      ];


      if (startBtn2) {
        startBtn2.addEventListener("click", () => {
          startBtn2.style.display = "none";
          quizBox2.style.display = "block";
          startFullQuiz2();
        });
      }


      function startFullQuiz2() {
        let current = 0;
        let score = 0;
        let timeLeft = 60;
        const timerEl = document.getElementById("quiz2-timer");
        const qEl = document.getElementById("quiz2-question");
        const optsEl = document.getElementById("quiz2-options");
        const feedbackEl = document.getElementById("quiz2-feedback");

        const timer = setInterval(() => {
          timeLeft--;
          timerEl.textContent = `Tempo restante: ${timeLeft}s`;
          if (timeLeft <= 0) { clearInterval(timer); finishQuiz2(); }
        }, 1000);

        function showQuestion() {
          if (current >= quizQuestions2.length) { finishQuiz2(); return; }
          const q = quizQuestions2[current];
          qEl.textContent = q.q;
          optsEl.innerHTML = "";
          feedbackEl.textContent = "";

          q.options.forEach((opt, i) => {
            const btn = document.createElement("button");
            btn.textContent = opt;
            btn.style.margin = "8px 4px";
            btn.style.padding = "18px 28px";
            btn.style.fontSize = "20px";
            btn.style.fontWeight = "bold";
            btn.style.background = "#222";
            btn.style.color = "#fff";
            btn.style.border = "2px solid #555";
            btn.style.borderRadius = "10px";
            btn.style.cursor = "pointer";
            btn.style.transition = "all 0.25s ease";

            btn.addEventListener("mouseenter", () => btn.style.background = "#444");
            btn.addEventListener("mouseleave", () => { if (!btn.disabled) btn.style.background = "#222"; });

            btn.addEventListener("click", async () => {
              Array.from(optsEl.children).forEach(b => b.disabled = true);

              if (i === q.correct) {
                btn.style.background = "green";
                feedbackEl.textContent = "✅ Correto! +10 pontos";
                feedbackEl.style.color = "lightgreen";
                score += 10;
                await updateUserScore(10);
              } else {
                btn.style.background = "red";
                feedbackEl.textContent = "❌ Errado! -5 pontos";
                feedbackEl.style.color = "red";
                score -= 5;
                await updateUserScore(-5);
                optsEl.children[q.correct].style.background = "green";
              }

              current++;
              setTimeout(() => {
                feedbackEl.textContent = "";
                showQuestion();
              }, 800);
            });

            optsEl.appendChild(btn);
          });
        }

        function finishQuiz2() {
          clearInterval(timer);
          qEl.textContent = "🎉 Quiz finalizado!";
          optsEl.innerHTML = "";
          feedbackEl.textContent = `Pontuação final: ${score}`;
          feedbackEl.style.color = "#ffd700";
          updateUserProgress("2").then(updateProgressUI);

        }

        showQuestion();
      }
    }

    // Quiz completo do módulo 3
    if (id === '3') {
      const startBtn3 = document.getElementById("startQuizBtn3");
      const quizBox3 = document.getElementById("fullQuiz3");

      const quizQuestions3 = [
        { q: "O que é ritmo na música?", options: ["A velocidade da música", "A organização dos sons no tempo"], correct: 1 },
        { q: "A batida constante que sentimos em uma música é chamada de:", options: ["Pulsação", "Timbre"], correct: 0 },
        { q: "O compasso serve para:", options: ["Organizar as pulsações em grupos", "Definir a altura do som"], correct: 0 },
        { q: "Se uma música tem 4 batidas por compasso, chamamos de:", options: ["Compasso quaternário", "Compasso ternário"], correct: 0 },
        { q: "As pausas fazem parte do ritmo?", options: ["Sim", "Não"], correct: 0 },
        { q: "Quando uma música acelera, dizemos que o:", options: ["Ritmo mudou", "Tempo mudou"], correct: 1 },
        { q: "O rap é conhecido por seu forte uso de:", options: ["Ritmo e rima", "Escalas maiores"], correct: 0 },
        { q: "As figuras rítmicas (semínima, colcheia, etc) representam:", options: ["A duração dos sons", "A altura dos sons"], correct: 0 },
        { q: "Quando várias pessoas batem palmas juntas seguindo a mesma batida, estão seguindo a:", options: ["Intensidade", "Pulsação"], correct: 1 },
        { q: "O ritmo é um elemento essencial especialmente no:", options: ["Hip hop", "Música clássica somente"], correct: 0 }
      ];

      if (startBtn3) {
        startBtn3.addEventListener("click", () => {
          startBtn3.style.display = "none";
          quizBox3.style.display = "block";
          startFullQuiz3();
        });
      }

      function startFullQuiz3() {
        let current = 0;
        let score = 0;
        let timeLeft = 60;
        const timerEl = document.getElementById("quiz3-timer");
        const qEl = document.getElementById("quiz3-question");
        const optsEl = document.getElementById("quiz3-options");
        const feedbackEl = document.getElementById("quiz3-feedback");

        const timer = setInterval(() => {
          timeLeft--;
          timerEl.textContent = `Tempo restante: ${timeLeft}s`;
          if (timeLeft <= 0) { clearInterval(timer); finishQuiz3(); }
        }, 1000);

        function showQuestion() {
          if (current >= quizQuestions3.length) { finishQuiz3(); return; }
          const q = quizQuestions3[current];
          qEl.textContent = q.q;
          optsEl.innerHTML = "";
          feedbackEl.textContent = "";

          q.options.forEach((opt, i) => {
            const btn = document.createElement("button");
            btn.textContent = opt;
            btn.style.margin = "8px 4px";
            btn.style.padding = "18px 28px";
            btn.style.fontSize = "20px";
            btn.style.fontWeight = "bold";
            btn.style.background = "#222";
            btn.style.color = "#fff";
            btn.style.border = "2px solid #555";
            btn.style.borderRadius = "10px";
            btn.style.cursor = "pointer";

            btn.addEventListener("click", async () => {
              Array.from(optsEl.children).forEach(b => b.disabled = true);

              if (i === q.correct) {
                btn.style.background = "green";
                feedbackEl.textContent = "✅ Correto! +10 pontos";
                feedbackEl.style.color = "lightgreen";
                score += 10;
                await updateUserScore(10);
              } else {
                btn.style.background = "red";
                feedbackEl.textContent = "❌ Errado! -5 pontos";
                feedbackEl.style.color = "red";
                score -= 5;
                await updateUserScore(-5);
                optsEl.children[q.correct].style.background = "green";
              }

              current++;
              setTimeout(() => {
                feedbackEl.textContent = "";
                showQuestion();
              }, 800);
            });

            optsEl.appendChild(btn);
          });
        }

        function finishQuiz3() {
          clearInterval(timer);
          qEl.textContent = "🎉 Quiz finalizado!";
          optsEl.innerHTML = "";
          feedbackEl.textContent = `Pontuação final: ${score}`;
          feedbackEl.style.color = "#ffd700";
          updateUserProgress("3").then(updateProgressUI);

        }

        showQuestion();
      }
    }

    if (id === '4') {
      const startBtn4 = document.getElementById("startQuizBtn4");
      const quizBox4 = document.getElementById("fullQuiz4");

      const quizQuestions4 = [
        { q: "O que é um semitom?", options: ["A menor distância entre notas", "Dois tons juntos"], correct: 0 },
        { q: "Um tom equivale a:", options: ["1 semitom", "2 semitons"], correct: 1 },
        { q: "Qual desses pares é separado por um semitom?", options: ["Dó → Ré", "Mi → Fá"], correct: 1 },
        { q: "Qual desses pares é separado por um tom?", options: ["Dó → Ré", "Si → Dó"], correct: 0 },
        { q: "Se Dó → Ré é um tom, então Dó → Ré♭ é:", options: ["Um semitom", "Um tom"], correct: 0 },
        { q: "O intervalo entre Fá → Sol é:", options: ["Tom", "Semitom"], correct: 0 },
        { q: "O intervalo entre Si → Dó é:", options: ["Semitom", "Tom"], correct: 0 },
        { q: "Para subir um tom de Dó, chegamos em:", options: ["Dó# (Dó sustenido)", "Ré"], correct: 1 },
        { q: "Para subir um semitom de Mi, chegamos em:", options: ["Fá", "Fá#"], correct: 0 },
        { q: "Tons e semitons são usados para:", options: ["Criar escalas e melodias", "Medir volume do som"], correct: 0 }
      ];

      if (startBtn4) {
        startBtn4.addEventListener("click", () => {
          startBtn4.style.display = "none";
          quizBox4.style.display = "block";
          startFullQuiz4();
        });
      }

      function startFullQuiz4() {
        let current = 0;
        let score = 0;
        let timeLeft = 60;
        const timerEl = document.getElementById("quiz4-timer");
        const qEl = document.getElementById("quiz4-question");
        const optsEl = document.getElementById("quiz4-options");
        const feedbackEl = document.getElementById("quiz4-feedback");

        const timer = setInterval(() => {
          timeLeft--;
          timerEl.textContent = `Tempo restante: ${timeLeft}s`;
          if (timeLeft <= 0) { clearInterval(timer); finishQuiz4(); }
        }, 1000);

        function showQuestion() {
          if (current >= quizQuestions4.length) { finishQuiz4(); return; }
          const q = quizQuestions4[current];
          qEl.textContent = q.q;
          optsEl.innerHTML = "";
          feedbackEl.textContent = "";

          q.options.forEach((opt, i) => {
            const btn = document.createElement("button");
            btn.textContent = opt;
            btn.style.margin = "8px 4px";
            btn.style.padding = "18px 28px";
            btn.style.fontSize = "20px";
            btn.style.fontWeight = "bold";
            btn.style.background = "#222";
            btn.style.color = "#fff";
            btn.style.border = "2px solid #555";
            btn.style.borderRadius = "10px";
            btn.style.cursor = "pointer";

            btn.addEventListener("click", async () => {
              Array.from(optsEl.children).forEach(b => b.disabled = true);
              if (i === q.correct) {
                btn.style.background = "green";
                feedbackEl.textContent = "✅ Correto! +10 pontos";
                feedbackEl.style.color = "lightgreen";
                score += 10;
                await updateUserScore(10);
              } else {
                btn.style.background = "red";
                feedbackEl.textContent = "❌ Errado! -5 pontos";
                feedbackEl.style.color = "red";
                score -= 5;
                await updateUserScore(-5);
                optsEl.children[q.correct].style.background = "green";
              }
              current++;
              setTimeout(() => {
                feedbackEl.textContent = "";
                showQuestion();
              }, 800);
            });
            optsEl.appendChild(btn);
          });
        }

        function finishQuiz4() {
          clearInterval(timer);
          qEl.textContent = "🎉 Quiz finalizado!";
          optsEl.innerHTML = "";
          feedbackEl.textContent = `Pontuação final: ${score}`;
          feedbackEl.style.color = "#ffd700";
          updateUserProgress("4").then(updateProgressUI);

        }

        showQuestion();
      }
    }

    if (id === '5') {
      const startBtn5 = document.getElementById("startQuizBtn5");
      const quizBox5 = document.getElementById("fullQuiz5");

      const quizQuestions5 = [
        { q: "Qual é o padrão da escala maior?", options: ["Tom – Tom – Semitom – Tom – Tom – Tom – Semitom", "Tom – Semitom – Tom – Tom – Semitom – Tom – Tom"], correct: 0 },
        { q: "Na escala de Dó maior, quais notas ela possui?", options: ["Dó, Ré, Mi, Fá, Sol, Lá, Si", "Dó, Ré, Mi, Fá#, Sol, Lá, Si"], correct: 0 },
        { q: "Qual intervalo existe entre Mi e Fá na escala de Dó maior?", options: ["Tom", "Semitom"], correct: 1 },
        { q: "Qual intervalo existe entre Ré e Mi na escala de Dó maior?", options: ["Tom", "Semitom"], correct: 0 },
        { q: "A escala de Dó maior usa somente...", options: ["Notas brancas do piano", "Notas pretas do piano"], correct: 0 },
        { q: "Qual é a 5ª nota da escala de Dó maior?", options: ["Sol", "Fá"], correct: 0 },
        { q: "Qual é a última nota da escala de Dó maior?", options: ["Si", "Dó"], correct: 1 },
        { q: "Quantos tons existem na escala maior?", options: ["5 tons e 2 semitons", "4 tons e 3 semitons"], correct: 0 },
        { q: "O intervalo entre Si e Dó é:", options: ["Tom", "Semitom"], correct: 1 },
        { q: "A escala maior é importante porque:", options: ["É base para músicas ocidentais", "É usada só no piano"], correct: 0 }
      ];

      if (startBtn5) {
        startBtn5.addEventListener("click", () => {
          startBtn5.style.display = "none";
          quizBox5.style.display = "block";
          startFullQuiz5();
        });
      }

      function startFullQuiz5() {
        let current = 0;
        let score = 0;
        let timeLeft = 60;
        const timerEl = document.getElementById("quiz5-timer");
        const qEl = document.getElementById("quiz5-question");
        const optsEl = document.getElementById("quiz5-options");
        const feedbackEl = document.getElementById("quiz5-feedback");

        const timer = setInterval(() => {
          timeLeft--;
          timerEl.textContent = `Tempo restante: ${timeLeft}s`;
          if (timeLeft <= 0) { clearInterval(timer); finishQuiz5(); }
        }, 1000);

        function showQuestion() {
          if (current >= quizQuestions5.length) { finishQuiz5(); return; }
          const q = quizQuestions5[current];
          qEl.textContent = q.q;
          optsEl.innerHTML = "";
          feedbackEl.textContent = "";

          q.options.forEach((opt, i) => {
            const btn = document.createElement("button");
            btn.textContent = opt;
            btn.style.margin = "8px 4px";
            btn.style.padding = "18px 28px";
            btn.style.fontSize = "20px";
            btn.style.fontWeight = "bold";
            btn.style.background = "#222";
            btn.style.color = "#fff";
            btn.style.border = "2px solid #555";
            btn.style.borderRadius = "10px";
            btn.style.cursor = "pointer";

            btn.addEventListener("click", async () => {
              Array.from(optsEl.children).forEach(b => b.disabled = true);
              if (i === q.correct) {
                btn.style.background = "green";
                feedbackEl.textContent = "✅ Correto! +10 pontos";
                feedbackEl.style.color = "lightgreen";
                score += 10;
                await updateUserScore(10);
              } else {
                btn.style.background = "red";
                feedbackEl.textContent = "❌ Errado! -5 pontos";
                feedbackEl.style.color = "red";
                score -= 5;
                await updateUserScore(-5);
                optsEl.children[q.correct].style.background = "green";
              }
              current++;
              setTimeout(() => {
                feedbackEl.textContent = "";
                showQuestion();
              }, 800);
            });
            optsEl.appendChild(btn);
          });
        }

        function finishQuiz5() {
          clearInterval(timer);
          qEl.textContent = "🎉 Quiz finalizado!";
          optsEl.innerHTML = "";
          feedbackEl.textContent = `Pontuação final: ${score}`;
          feedbackEl.style.color = "#ffd700";
          updateUserProgress("5").then(updateProgressUI);

        }

        showQuestion();
      }
    }

    if (id === '6') {
      const startBtn6 = document.getElementById("startQuizBtn6");
      const quizBox6 = document.getElementById("fullQuiz6");

      const quizQuestions6 = [
        { q: "Qual é o padrão da escala menor natural?", options: ["Tom – Semitom – Tom – Tom – Semitom – Tom – Tom", "Tom – Tom – Semitom – Tom – Tom – Tom – Semitom"], correct: 0 },
        { q: "Qual é a escala menor relativa da escala de Dó maior?", options: ["Lá menor", "Mi menor"], correct: 0 },
        { q: "A escala de Lá menor natural começa em:", options: ["Dó", "Lá"], correct: 1 },
        { q: "Entre Si e Dó temos:", options: ["Tom", "Semitom"], correct: 1 },
        { q: "Entre Mi e Fá temos:", options: ["Tom", "Semitom"], correct: 1 },
        { q: "Qual a sensação mais comum associada à escala menor?", options: ["Triste/melancólica", "Feliz/alegre"], correct: 0 },
        { q: "A escala de Lá menor natural usa as mesmas notas de:", options: ["Dó maior", "Sol maior"], correct: 0 },
        { q: "Quantos semitons existem na escala menor natural?", options: ["2", "3"], correct: 1 },
        { q: "Qual é a 5ª nota da escala de Lá menor?", options: ["Mi", "Ré"], correct: 0 },
        { q: "A diferença principal entre a escala maior e menor está:", options: ["Na ordem de tons e semitons", "Na velocidade da música"], correct: 0 }
      ];

      if (startBtn6) {
        startBtn6.addEventListener("click", () => {
          startBtn6.style.display = "none";
          quizBox6.style.display = "block";
          startFullQuiz6();
        });
      }

      function startFullQuiz6() {
        let current = 0;
        let score = 0;
        let timeLeft = 60;
        const timerEl = document.getElementById("quiz6-timer");
        const qEl = document.getElementById("quiz6-question");
        const optsEl = document.getElementById("quiz6-options");
        const feedbackEl = document.getElementById("quiz6-feedback");

        const timer = setInterval(() => {
          timeLeft--;
          timerEl.textContent = `Tempo restante: ${timeLeft}s`;
          if (timeLeft <= 0) { clearInterval(timer); finishQuiz6(); }
        }, 1000);

        function showQuestion() {
          if (current >= quizQuestions6.length) { finishQuiz6(); return; }
          const q = quizQuestions6[current];
          qEl.textContent = q.q;
          optsEl.innerHTML = "";
          feedbackEl.textContent = "";

          q.options.forEach((opt, i) => {
            const btn = document.createElement("button");
            btn.textContent = opt;
            btn.style.margin = "8px 4px";
            btn.style.padding = "18px 28px";
            btn.style.fontSize = "20px";
            btn.style.fontWeight = "bold";
            btn.style.background = "#222";
            btn.style.color = "#fff";
            btn.style.border = "2px solid #555";
            btn.style.borderRadius = "10px";
            btn.style.cursor = "pointer";

            btn.addEventListener("click", async () => {
              Array.from(optsEl.children).forEach(b => b.disabled = true);
              if (i === q.correct) {
                btn.style.background = "green";
                feedbackEl.textContent = "✅ Correto! +10 pontos";
                feedbackEl.style.color = "lightgreen";
                score += 10;
                await updateUserScore(10);
              } else {
                btn.style.background = "red";
                feedbackEl.textContent = "❌ Errado! -5 pontos";
                feedbackEl.style.color = "red";
                score -= 5;
                await updateUserScore(-5);
                optsEl.children[q.correct].style.background = "green";
              }
              current++;
              setTimeout(() => {
                feedbackEl.textContent = "";
                showQuestion();
              }, 800);
            });
            optsEl.appendChild(btn);
          });
        }

        function finishQuiz6() {
          clearInterval(timer);
          qEl.textContent = "🎉 Quiz finalizado!";
          optsEl.innerHTML = "";
          feedbackEl.textContent = `Pontuação final: ${score}`;
          feedbackEl.style.color = "#ffd700";
          updateUserProgress("6").then(updateProgressUI);

        }

        showQuestion();
      }
    }

    if (id === '7') {
      const startBtn7 = document.getElementById("startQuizBtn7");
      const quizBox7 = document.getElementById("fullQuiz7");

      const quizQuestions7 = [
        { q: "Quantos tempos dura a semibreve?", options: ["2 tempos", "4 tempos", "1 tempo"], correct: 1 },
        { q: "Qual figura dura 2 tempos?", options: ["Mínima", "Semínima", "Colcheia"], correct: 0 },
        { q: "A semínima corresponde a:", options: ["1 tempo", "2 tempos"], correct: 0 },
        { q: "A colcheia tem duração de:", options: ["1/2 tempo", "1 tempo"], correct: 0 },
        { q: "Qual parte da figura é a parte oval?", options: ["Cabeça", "Haste", "Colchete"], correct: 0 },
        { q: "O traço vertical que acompanha a cabeça da nota chama-se:", options: ["Cabeça", "Haste"], correct: 1 },
        { q: "As bandeirolas (colchetes) aparecem em figuras de:", options: ["Maior duração", "Menor duração"], correct: 1 },
        { q: "Qual é a figura de menor duração da tabela?", options: ["Semifusa", "Semicolcheia"], correct: 0 },
        { q: "O silêncio da mínima é representado por:", options: ["Um traço abaixo da linha", "Um traço acima da linha"], correct: 1 },
        { q: "Qual é a relação entre som e silêncio?", options: ["Cada figura de som possui um equivalente em silêncio", "São coisas totalmente diferentes"], correct: 0 }
      ];

      if (startBtn7) {
        startBtn7.addEventListener("click", () => {
          startBtn7.style.display = "none";
          quizBox7.style.display = "block";
          startFullQuiz7();
        });
      }

      function startFullQuiz7() {
        let current = 0;
        let score = 0;
        let timeLeft = 60;
        const timerEl = document.getElementById("quiz7-timer");
        const qEl = document.getElementById("quiz7-question");
        const optsEl = document.getElementById("quiz7-options");
        const feedbackEl = document.getElementById("quiz7-feedback");

        const timer = setInterval(() => {
          timeLeft--;
          timerEl.textContent = `Tempo restante: ${timeLeft}s`;
          if (timeLeft <= 0) { clearInterval(timer); finishQuiz7(); }
        }, 1000);

        function showQuestion() {
          if (current >= quizQuestions7.length) { finishQuiz7(); return; }
          const q = quizQuestions7[current];
          qEl.textContent = q.q;
          optsEl.innerHTML = "";
          feedbackEl.textContent = "";

          q.options.forEach((opt, i) => {
            const btn = document.createElement("button");
            btn.textContent = opt;
            btn.style.margin = "8px 4px";
            btn.style.padding = "18px 28px";
            btn.style.fontSize = "20px";
            btn.style.fontWeight = "bold";
            btn.style.background = "#222";
            btn.style.color = "#fff";
            btn.style.border = "2px solid #555";
            btn.style.borderRadius = "10px";
            btn.style.cursor = "pointer";

            btn.addEventListener("click", async () => {
              Array.from(optsEl.children).forEach(b => b.disabled = true);
              if (i === q.correct) {
                btn.style.background = "green";
                feedbackEl.textContent = "✅ Correto! +10 pontos";
                feedbackEl.style.color = "lightgreen";
                score += 10;
                await updateUserScore(10);
              } else {
                btn.style.background = "red";
                feedbackEl.textContent = "❌ Errado! -5 pontos";
                feedbackEl.style.color = "red";
                score -= 5;
                await updateUserScore(-5);
                optsEl.children[q.correct].style.background = "green";
              }
              current++;
              setTimeout(() => {
                feedbackEl.textContent = "";
                showQuestion();
              }, 800);
            });
            optsEl.appendChild(btn);
          });
        }

        function finishQuiz7() {
          clearInterval(timer);
          qEl.textContent = "🎉 Quiz finalizado!";
          optsEl.innerHTML = "";
          feedbackEl.textContent = `Pontuação final: ${score}`;
          feedbackEl.style.color = "#ffd700";
          updateUserProgress("7").then(updateProgressUI);

        }

        showQuestion();
      }
    }

    if (id === '8') {
      const startBtn8 = document.getElementById("startQuizBtn8");
      const quizBox8 = document.getElementById("fullQuiz8");

      const quizQuestions8 = [
        { q: "Quantos tempos dura a semínima?", options: ["1 tempo", "2 tempos", "1/2 tempo"], correct: 0 },
        { q: "Quantos tempos dura a semínima pontuada?", options: ["1 tempo", "1,5 tempos", "2 tempos"], correct: 1 },
        { q: "O ponto ao lado de uma figura aumenta sua duração em:", options: ["Metade do valor original", "O dobro do valor", "Não altera"], correct: 0 },
        { q: "Um compasso 4/4 é exemplo de:", options: ["Ritmo simples", "Ritmo composto"], correct: 0 },
        { q: "Um compasso 6/8 é exemplo de:", options: ["Ritmo simples", "Ritmo composto"], correct: 1 },
        { q: "Quantas colcheias cabem em 1 semínima?", options: ["2", "3", "4"], correct: 0 },
        { q: "Quantas colcheias cabem em 1 semínima pontuada?", options: ["2", "3", "4"], correct: 1 },
        { q: "A diferença entre ritmos simples e compostos está:", options: ["Na divisão do tempo (2 ou 3 partes)", "Na altura do som"], correct: 0 },
        { q: "Qual compasso é típico em valsas?", options: ["3/4", "4/4", "6/8"], correct: 0 },
        { q: "No hip hop, o compasso mais usado é:", options: ["3/4", "4/4", "6/8"], correct: 1 }
      ];

      if (startBtn8) {
        startBtn8.addEventListener("click", () => {
          startBtn8.style.display = "none";
          quizBox8.style.display = "block";
          startFullQuiz8();
        });
      }

      function startFullQuiz8() {
        let current = 0;
        let score = 0;
        let timeLeft = 60;
        const timerEl = document.getElementById("quiz8-timer");
        const qEl = document.getElementById("quiz8-question");
        const optsEl = document.getElementById("quiz8-options");
        const feedbackEl = document.getElementById("quiz8-feedback");

        const timer = setInterval(() => {
          timeLeft--;
          timerEl.textContent = `Tempo restante: ${timeLeft}s`;
          if (timeLeft <= 0) { clearInterval(timer); finishQuiz8(); }
        }, 1000);

        function showQuestion() {
          if (current >= quizQuestions8.length) { finishQuiz8(); return; }
          const q = quizQuestions8[current];
          qEl.textContent = q.q;
          optsEl.innerHTML = "";
          feedbackEl.textContent = "";

          q.options.forEach((opt, i) => {
            const btn = document.createElement("button");
            btn.textContent = opt;
            btn.style.margin = "8px 4px";
            btn.style.padding = "18px 28px";
            btn.style.fontSize = "20px";
            btn.style.fontWeight = "bold";
            btn.style.background = "#222";
            btn.style.color = "#fff";
            btn.style.border = "2px solid #555";
            btn.style.borderRadius = "10px";
            btn.style.cursor = "pointer";

            btn.addEventListener("click", async () => {
              Array.from(optsEl.children).forEach(b => b.disabled = true);
              if (i === q.correct) {
                btn.style.background = "green";
                feedbackEl.textContent = "✅ Correto! +10 pontos";
                feedbackEl.style.color = "lightgreen";
                score += 10;
                await updateUserScore(10);
              } else {
                btn.style.background = "red";
                feedbackEl.textContent = "❌ Errado! -5 pontos";
                feedbackEl.style.color = "red";
                score -= 5;
                await updateUserScore(-5);
                optsEl.children[q.correct].style.background = "green";
              }
              current++;
              setTimeout(() => {
                feedbackEl.textContent = "";
                showQuestion();
              }, 800);
            });
            optsEl.appendChild(btn);
          });
        }

        function finishQuiz8() {
          clearInterval(timer);
          qEl.textContent = "🎉 Quiz finalizado!";
          optsEl.innerHTML = "";
          feedbackEl.textContent = `Pontuação final: ${score}`;
          feedbackEl.style.color = "#ffd700";
          updateUserProgress("8").then(updateProgressUI);

        }

        showQuestion();
      }
    }

    if (id === '9') {
      const startBtn9 = document.getElementById("startQuizBtn9");
      const quizBox9 = document.getElementById("fullQuiz9");

      const quizQuestions9 = [
        { q: "Qual clave é mais usada para instrumentos agudos?", options: ["Clave de Sol", "Clave de Fá", "Clave de Dó"], correct: 0 },
        { q: "Em qual linha da pauta a Clave de Sol posiciona a nota Sol?", options: ["Primeira", "Segunda", "Terceira"], correct: 1 },
        { q: "Qual clave é usada para instrumentos graves, como contrabaixo?", options: ["Clave de Sol", "Clave de Fá"], correct: 1 },
        { q: "A clave de Dó pode aparecer em:", options: ["Diversas linhas", "Apenas na primeira linha"], correct: 0 },
        { q: "A clave de Fá posiciona a nota Fá em qual linha?", options: ["Quarta", "Segunda"], correct: 0 },
        { q: "O piano usa duas claves. Quais são elas?", options: ["Sol e Fá", "Sol e Dó", "Dó e Fá"], correct: 0 },
        { q: "A clave de Sol é mais usada para:", options: ["Instrumentos graves", "Instrumentos agudos"], correct: 1 },
        { q: "A clave de Dó é comum em qual instrumento?", options: ["Viola", "Violino"], correct: 0 },
        { q: "Qual clave posiciona a nota Sol na segunda linha?", options: ["Clave de Sol", "Clave de Fá"], correct: 0 },
        { q: "Qual clave é mais importante para iniciantes?", options: ["Clave de Sol", "Clave de Fá", "Clave de Dó"], correct: 0 }
      ];

      if (startBtn9) {
        startBtn9.addEventListener("click", () => {
          startBtn9.style.display = "none";
          quizBox9.style.display = "block";
          startFullQuiz9();
        });
      }

      function startFullQuiz9() {
        let current = 0;
        let score = 0;
        let timeLeft = 60;
        const timerEl = document.getElementById("quiz9-timer");
        const qEl = document.getElementById("quiz9-question");
        const optsEl = document.getElementById("quiz9-options");
        const feedbackEl = document.getElementById("quiz9-feedback");

        const timer = setInterval(() => {
          timeLeft--;
          timerEl.textContent = `Tempo restante: ${timeLeft}s`;
          if (timeLeft <= 0) { clearInterval(timer); finishQuiz9(); }
        }, 1000);

        function showQuestion() {
          if (current >= quizQuestions9.length) { finishQuiz9(); return; }
          const q = quizQuestions9[current];
          qEl.textContent = q.q;
          optsEl.innerHTML = "";
          feedbackEl.textContent = "";

          q.options.forEach((opt, i) => {
            const btn = document.createElement("button");
            btn.textContent = opt;
            btn.style.margin = "8px 4px";
            btn.style.padding = "18px 28px";
            btn.style.fontSize = "20px";
            btn.style.fontWeight = "bold";
            btn.style.background = "#222";
            btn.style.color = "#fff";
            btn.style.border = "2px solid #555";
            btn.style.borderRadius = "10px";
            btn.style.cursor = "pointer";

            btn.addEventListener("click", async () => {
              Array.from(optsEl.children).forEach(b => b.disabled = true);
              if (i === q.correct) {
                btn.style.background = "green";
                feedbackEl.textContent = "✅ Correto! +10 pontos";
                feedbackEl.style.color = "lightgreen";
                score += 10;
                await updateUserScore(10);
              } else {
                btn.style.background = "red";
                feedbackEl.textContent = "❌ Errado! -5 pontos";
                feedbackEl.style.color = "red";
                score -= 5;
                await updateUserScore(-5);
                optsEl.children[q.correct].style.background = "green";
              }
              current++;
              setTimeout(() => {
                feedbackEl.textContent = "";
                showQuestion();
              }, 800);
            });
            optsEl.appendChild(btn);
          });
        }

        function finishQuiz9() {
          clearInterval(timer);
          qEl.textContent = "🎉 Quiz finalizado!";
          optsEl.innerHTML = "";
          feedbackEl.textContent = `Pontuação final: ${score}`;
          feedbackEl.style.color = "#ffd700";
          updateUserProgress("9").then(updateProgressUI);

        }

        showQuestion();
      }
    }

    if (id === '10') {
      const startBtn10 = document.getElementById("startQuizBtn10");
      const quizBox10 = document.getElementById("fullQuiz10");

      const quizQuestions10 = [
        { q: "O que é o compasso na música?", options: ["Organização dos tempos", "Velocidade", "Intensidade"], correct: 0 },
        { q: "Qual compasso é chamado de quaternário?", options: ["3/4", "4/4", "2/4"], correct: 1 },
        { q: "No compasso 3/4, quantos tempos há?", options: ["2", "3", "4"], correct: 1 },
        { q: "O compasso 2/4 é considerado:", options: ["Binário", "Ternário", "Quaternário"], correct: 0 },
        { q: "Qual compasso é mais usado na música popular?", options: ["4/4", "3/4", "6/8"], correct: 0 },
        { q: "O compasso 6/8 é um exemplo de:", options: ["Binário", "Ternário composto", "Livre"], correct: 1 },
        { q: "O compasso ajuda a:", options: ["Organizar a pulsação", "Afinar instrumentos"], correct: 0 },
        { q: "No compasso 2/4, a unidade de tempo é geralmente:", options: ["Semínima", "Mínima", "Colcheia"], correct: 0 },
        { q: "Um compasso ternário tem:", options: ["3 tempos", "4 tempos", "2 tempos"], correct: 0 },
        { q: "Como o compasso é representado?", options: ["Por fração (ex: 4/4)", "Por símbolo gráfico", "Por acorde"], correct: 0 }
      ];

      if (startBtn10) {
        startBtn10.addEventListener("click", () => {
          startBtn10.style.display = "none";
          quizBox10.style.display = "block";
          startFullQuiz10();
        });
      }

      function startFullQuiz10() {
        let current = 0;
        let score = 0;
        let timeLeft = 60;
        const timerEl = document.getElementById("quiz10-timer");
        const qEl = document.getElementById("quiz10-question");
        const optsEl = document.getElementById("quiz10-options");
        const feedbackEl = document.getElementById("quiz10-feedback");

        const timer = setInterval(() => {
          timeLeft--;
          timerEl.textContent = `Tempo restante: ${timeLeft}s`;
          if (timeLeft <= 0) { clearInterval(timer); finishQuiz10(); }
        }, 1000);

        function showQuestion() {
          if (current >= quizQuestions10.length) { finishQuiz10(); return; }
          const q = quizQuestions10[current];
          qEl.textContent = q.q;
          optsEl.innerHTML = "";
          feedbackEl.textContent = "";

          q.options.forEach((opt, i) => {
            const btn = document.createElement("button");
            btn.textContent = opt;
            btn.style.margin = "8px 4px";
            btn.style.padding = "18px 28px";
            btn.style.fontSize = "20px";
            btn.style.fontWeight = "bold";
            btn.style.background = "#222";
            btn.style.color = "#fff";
            btn.style.border = "2px solid #555";
            btn.style.borderRadius = "10px";
            btn.style.cursor = "pointer";

            btn.addEventListener("click", async () => {
              Array.from(optsEl.children).forEach(b => b.disabled = true);
              if (i === q.correct) {
                btn.style.background = "green";
                feedbackEl.textContent = "✅ Correto! +10 pontos";
                feedbackEl.style.color = "lightgreen";
                score += 10;
                await updateUserScore(10);
              } else {
                btn.style.background = "red";
                feedbackEl.textContent = "❌ Errado! -5 pontos";
                feedbackEl.style.color = "red";
                score -= 5;
                await updateUserScore(-5);
                optsEl.children[q.correct].style.background = "green";
              }
              current++;
              setTimeout(() => {
                feedbackEl.textContent = "";
                showQuestion();
              }, 800);
            });
            optsEl.appendChild(btn);
          });
        }

        function finishQuiz10() {
          clearInterval(timer);
          qEl.textContent = "🎉 Quiz finalizado!";
          optsEl.innerHTML = "";
          feedbackEl.textContent = `Pontuação final: ${score}`;
          feedbackEl.style.color = "#ffd700";
          updateUserProgress("10").then(updateProgressUI);

        }

        showQuestion();
      }
    }

    if (id === '11') {
      const startBtn11 = document.getElementById("startQuizBtn11");
      const quizBox11 = document.getElementById("fullQuiz11");

      const quizQuestions11 = [
        { q: "O que faz o sustenido (♯)?", options: ["Abaixa a nota", "Eleva a nota", "Cancela alterações"], correct: 1 },
        { q: "O que faz o bemol (♭)?", options: ["Eleva a nota", "Abaixa a nota", "Cancela alterações"], correct: 1 },
        { q: "O que faz o bequadro (♮)?", options: ["Mantém o acidente", "Cancela o acidente", "Diminui a intensidade"], correct: 1 },
        { q: "Quantos semitons um sustenido altera?", options: ["1", "2", "0.5"], correct: 0 },
        { q: "Qual símbolo representa o bemol?", options: ["♯", "♭", "♮"], correct: 1 },
        { q: "Se temos um Fá♯, qual é a nota natural correspondente?", options: ["Fá", "Fá bemol", "Sol"], correct: 0 },
        { q: "Se temos um Si♭, qual é a nota natural correspondente?", options: ["Si", "Dó", "Lá"], correct: 0 },
        { q: "O bequadro é usado para:", options: ["Subir meio tom", "Descer meio tom", "Cancelar acidentes"], correct: 2 },
        { q: "Qual acidente transforma Dó em Dó♯?", options: ["Sustenido", "Bemol", "Bequadro"], correct: 0 },
        { q: "Quando um acidente está na armadura de clave, ele vale para:", options: ["Uma nota específica", "Todas as ocorrências dessa nota", "Apenas no compasso atual"], correct: 1 }
      ];

      if (startBtn11) {
        startBtn11.addEventListener("click", () => {
          startBtn11.style.display = "none";
          quizBox11.style.display = "block";
          startFullQuiz11();
        });
      }

      function startFullQuiz11() {
        let current = 0;
        let score = 0;
        let timeLeft = 60;
        const timerEl = document.getElementById("quiz11-timer");
        const qEl = document.getElementById("quiz11-question");
        const optsEl = document.getElementById("quiz11-options");
        const feedbackEl = document.getElementById("quiz11-feedback");

        const timer = setInterval(() => {
          timeLeft--;
          timerEl.textContent = `Tempo restante: ${timeLeft}s`;
          if (timeLeft <= 0) { clearInterval(timer); finishQuiz11(); }
        }, 1000);

        function showQuestion() {
          if (current >= quizQuestions11.length) { finishQuiz11(); return; }
          const q = quizQuestions11[current];
          qEl.textContent = q.q;
          optsEl.innerHTML = "";
          feedbackEl.textContent = "";

          q.options.forEach((opt, i) => {
            const btn = document.createElement("button");
            btn.textContent = opt;
            btn.style.margin = "8px 4px";
            btn.style.padding = "18px 28px";
            btn.style.fontSize = "20px";
            btn.style.fontWeight = "bold";
            btn.style.background = "#222";
            btn.style.color = "#fff";
            btn.style.border = "2px solid #555";
            btn.style.borderRadius = "10px";
            btn.style.cursor = "pointer";

            btn.addEventListener("click", async () => {
              Array.from(optsEl.children).forEach(b => b.disabled = true);
              if (i === q.correct) {
                btn.style.background = "green";
                feedbackEl.textContent = "✅ Correto! +10 pontos";
                feedbackEl.style.color = "lightgreen";
                score += 10;
                await updateUserScore(10);
              } else {
                btn.style.background = "red";
                feedbackEl.textContent = "❌ Errado! -5 pontos";
                feedbackEl.style.color = "red";
                score -= 5;
                await updateUserScore(-5);
                optsEl.children[q.correct].style.background = "green";
              }
              current++;
              setTimeout(() => {
                feedbackEl.textContent = "";
                showQuestion();
              }, 800);
            });
            optsEl.appendChild(btn);
          });
        }

        function finishQuiz11() {
          clearInterval(timer);
          qEl.textContent = "🎉 Quiz finalizado!";
          optsEl.innerHTML = "";
          feedbackEl.textContent = `Pontuação final: ${score}`;
          feedbackEl.style.color = "#ffd700";
          updateUserProgress("11").then(updateProgressUI);
        }

        showQuestion();
      }
    }
    if (id === '12') {
      const startBtn12 = document.getElementById("startQuizBtn12");
      const quizBox12 = document.getElementById("fullQuiz12");

      const quizQuestions12 = [
        {
          q: "Ordem dos sustenidos na armadura:", options: [
            "Fá♯, Dó♯, Sol♯, Ré♯, Lá♯, Mi♯, Si♯",
            "Si♭, Mi♭, Lá♭, Ré♭, Sol♭, Dó♭, Fá♭"
          ], correct: 0
        },
        {
          q: "Ordem dos bemóis na armadura:", options: [
            "Fá♯, Dó♯, Sol♯, Ré♯, Lá♯, Mi♯, Si♯",
            "Si♭, Mi♭, Lá♭, Ré♭, Sol♭, Dó♭, Fá♭"
          ], correct: 1
        },
        {
          q: "Como achar a tonalidade MAIOR com sustenidos?", options: [
            "Penúltimo sustenido",
            "Meio tom acima do último sustenido"
          ], correct: 1
        },
        {
          q: "Como achar a tonalidade MAIOR com bemóis?", options: [
            "Penúltimo bemol (exceto 1 ♭ → Fá Maior)",
            "Último bemol + meio tom"
          ], correct: 0
        },
        {
          q: "Sem acidentes na armadura, a tonalidade é:", options: [
            "Dó Maior / Lá menor",
            "Sol Maior / Mi menor"
          ], correct: 0
        },
        {
          q: "Ré Maior possui:", options: [
            "2 sustenidos (Fá♯, Dó♯)",
            "2 bemóis (Si♭, Mi♭)"
          ], correct: 0
        },
        {
          q: "Mi♭ Maior possui:", options: [
            "3 bemóis (Si♭, Mi♭, Lá♭)",
            "3 sustenidos (Fá♯, Dó♯, Sol♯)"
          ], correct: 0
        },
        {
          q: "Armadura com Fá♯, Dó♯, Sol♯ indica a tonalidade:", options: [
            "Mi Maior",
            "Lá Maior"
          ], correct: 1
        },
        {
          q: "Armadura com Si♭ e Mi♭ indica a tonalidade:", options: [
            "Si♭ Maior",
            "Fá Maior"
          ], correct: 0
        },
        {
          q: "Quando a armadura muda no meio da peça:", options: [
            "Passa a valer a partir do compasso onde aparece",
            "Só vale para o próximo sistema"
          ], correct: 0
        }
      ];

      if (startBtn12) {
        startBtn12.addEventListener("click", () => {
          startBtn12.style.display = "none";
          quizBox12.style.display = "block";
          startFullQuiz12();
        });
      }

      function startFullQuiz12() {
        let current = 0;
        let score = 0;
        let timeLeft = 60;
        const timerEl = document.getElementById("quiz12-timer");
        const qEl = document.getElementById("quiz12-question");
        const optsEl = document.getElementById("quiz12-options");
        const feedbackEl = document.getElementById("quiz12-feedback");

        const timer = setInterval(() => {
          timeLeft--;
          timerEl.textContent = `Tempo restante: ${timeLeft}s`;
          if (timeLeft <= 0) { clearInterval(timer); finishQuiz12(); }
        }, 1000);

        function showQuestion() {
          if (current >= quizQuestions12.length) { finishQuiz12(); return; }
          const q = quizQuestions12[current];
          qEl.textContent = q.q;
          optsEl.innerHTML = "";
          feedbackEl.textContent = "";

          q.options.forEach((opt, i) => {
            const btn = document.createElement("button");
            btn.textContent = opt;
            btn.style.margin = "8px 4px";
            btn.style.padding = "18px 28px";
            btn.style.fontSize = "20px";
            btn.style.fontWeight = "bold";
            btn.style.background = "#222";
            btn.style.color = "#fff";
            btn.style.border = "2px solid #555";
            btn.style.borderRadius = "10px";
            btn.style.cursor = "pointer";

            btn.addEventListener("click", async () => {
              Array.from(optsEl.children).forEach(b => b.disabled = true);
              if (i === q.correct) {
                btn.style.background = "green";
                feedbackEl.textContent = "✅ Correto! +10 pontos";
                feedbackEl.style.color = "lightgreen";
                score += 10;
                await updateUserScore(10);
              } else {
                btn.style.background = "red";
                feedbackEl.textContent = "❌ Errado! -5 pontos";
                feedbackEl.style.color = "red";
                score -= 5;
                await updateUserScore(-5);
                optsEl.children[q.correct].style.background = "green";
              }
              current++;
              setTimeout(() => {
                feedbackEl.textContent = "";
                showQuestion();
              }, 800);
            });
            optsEl.appendChild(btn);
          });
        }

        function finishQuiz12() {
          clearInterval(timer);
          qEl.textContent = "🎉 Quiz finalizado!";
          optsEl.innerHTML = "";
          feedbackEl.textContent = `Pontuação final: ${score}`;
          feedbackEl.style.color = "#ffd700";
          updateUserProgress("12").then(updateProgressUI);
        }

        showQuestion();
      }
    }

    if (id === '13') {
      const correctSequence = [
        "DÓ", "RÉ", "MI", "FÁ", "FÁ", "FÁ", "DÓ", "RÉ", "DÓ", "RÉ", "RÉ", "RÉ",
        "DÓ", "SOL", "FÁ", "MI", "MI", "MI", "DÓ", "RÉ", "MI", "FÁ", "FÁ", "FÁ"
      ];

      const noteOptions = ["DÓ", "RÉ", "MI", "FÁ", "SOL", "LÁ", "SI"];
      const selectionArea = document.getElementById("noteSelectionArea");

      if (selectionArea) {
        correctSequence.forEach((_, idx) => {
          const select = document.createElement("select");
          select.style.padding = "10px";
          select.style.fontSize = "16px";
          select.style.fontWeight = "bold";

          noteOptions.forEach(note => {
            const opt = document.createElement("option");
            opt.value = note;
            opt.textContent = note;
            select.appendChild(opt);
          });

          selectionArea.appendChild(select);
        });
      }

      const checkBtn = document.getElementById("checkNotesBtn");
      const feedback = document.getElementById("noteFeedback");

      if (checkBtn) {
        checkBtn.addEventListener("click", async () => {
          const selects = selectionArea.querySelectorAll("select");
          let correct = 0;

          selects.forEach((sel, i) => {
            if (sel.value === correctSequence[i]) {
              sel.style.border = "3px solid green";
              correct++;
            } else {
              sel.style.border = "3px solid red";
            }
          });

          feedback.textContent = `Você acertou ${correct} de ${correctSequence.length} notas! 🎵`;

          if (correct === correctSequence.length) {
            feedback.style.color = "lightgreen";
            feedback.textContent += " Parabéns, você concluiu o desafio final!";
            await updateUserScore(50); // bônus maior pelo desafio final
            await completeModule("13"); // marca como concluído no progresso
          } else {
            feedback.style.color = "red";
          }
        });
      }
    }


    lessonPanel.classList.remove('hidden');
    setTimeout(() => lessonPanel.classList.add('show'), 20);
  }

  if (lessonClose) {
    lessonClose.addEventListener('click', () => {
      lessonPanel.classList.remove('show');
      setTimeout(() => lessonPanel.classList.add('hidden'), 300);
    });
  }
  if (modulesRoot) {
    modulesRoot.querySelectorAll('.module-open').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.closest('.module-card').dataset.module;
        openLesson(id);
        completeModule(id);
      });
    });
    updateProgressUI();
  }
});

// --- Afinador ---
const tunerArc = document.getElementById("tunerArc");
const tunerNote = document.getElementById("tunerNote");
const tunerCents = document.getElementById("tunerCents");
const micToggle = document.getElementById("micToggle");
const micIcon = document.getElementById("micIcon");

let audioCtx = null;
let analyser = null;
let buffer = null;
let running = false;
let stream = null;
let markers = [];

function createMarkers() {
  if (!tunerArc) return;
  tunerArc.innerHTML = "";
  markers = [];
  for (let i = 0; i < 11; i++) {
    const marker = document.createElement("div");
    marker.classList.add("marker");
    if (i === 5) marker.classList.add("center");
    tunerArc.appendChild(marker);
    markers.push(marker);
  }
}
createMarkers();

function freqToNote(freq) {
  const A4 = 440;
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const noteNum = Math.round(12 * Math.log2(freq / A4) + 69);
  const note = noteNames[(noteNum % 12 + 12) % 12];
  const octave = Math.floor(noteNum / 12) - 1;
  const noteFreq = A4 * Math.pow(2, (noteNum - 69) / 12);
  const cents = Math.round(1200 * Math.log2(freq / noteFreq));
  return { note, octave, cents };
}

function updateTunerDisplay(note, octave, cents) {
  tunerNote.textContent = note; // mostra só a nota base
  if (tunerCents) tunerCents.textContent = `${cents > 0 ? '+' : ''}${cents} cents`;
  markers.forEach(m => m.style.background = "#2b2b2b");
  if (Math.abs(cents) < 5) {
    markers[5].style.background = "#ffffff";
  } else {
    const steps = Math.min(5, Math.floor(Math.abs(cents) / 10));
    for (let i = 1; i <= steps; i++) {
      const idx = cents < 0 ? 5 - i : 5 + i;
      if (markers[idx]) markers[idx].style.background = i <= 2 ? "#999" : "#666";
    }
  }
}
function resetTuner() {
  tunerNote.textContent = "--";
  markers.forEach(m => m.style.background = "#555");
}

let lastFreq = null;
function smoothFreq(freq) {
  if (lastFreq === null) { lastFreq = freq; return freq; }
  const alpha = 0.2;
  lastFreq = alpha * freq + (1 - alpha) * lastFreq;
  return lastFreq;
}

function detectPitch() {
  if (!running) return;
  analyser.getFloatTimeDomainData(buffer);
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.01) { resetTuner(); requestAnimationFrame(detectPitch); return; }
  let bestOffset = -1, bestCorr = 0;
  for (let offset = 20; offset < 1000; offset++) {
    let corr = 0;
    for (let i = 0; i < buffer.length - offset; i++) corr += buffer[i] * buffer[i + offset];
    if (corr > bestCorr) { bestCorr = corr; bestOffset = offset; }
  }
  if (bestOffset > -1) {
    const rawFreq = audioCtx.sampleRate / bestOffset;
    const freq = smoothFreq(rawFreq);
    const { note, octave, cents } = freqToNote(freq);
    updateTunerDisplay(note, octave, cents);
  }
  requestAnimationFrame(detectPitch);
}

async function startMic() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    buffer = new Float32Array(analyser.fftSize);
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    running = true;
    detectPitch();
  } catch (err) { console.error("Erro ao acessar microfone:", err); }
}
function stopMic() {
  running = false;
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
  resetTuner();
}

micToggle.addEventListener("click", () => {
  if (!running) {
    micIcon.src = "imgs/mic_on_icon.png";
    startMic();
  } else {
    micIcon.src = "imgs/mic_off_icon.png";
    stopMic();
  }
});


// ---------------- Login Google ----------------
const authUI = document.getElementById("auth-ui");
function renderUser(user) {
  if (!user) {
    if (authUI) authUI.innerHTML = `
      <button id="google-login-btn">
        <img src="imgs/gmail.png" alt="Google Logo"> Entrar com Google
      </button>`;
    const btn = document.getElementById("google-login-btn");
    if (btn) btn.addEventListener("click", googleLogin);
  } else {
    if (authUI) {
      authUI.innerHTML = `
        <div id="user-info">
          <img src="${user.photoURL || 'imgs/user.png'}" alt="Foto">
          <span>${user.displayName || "Usuário"}</span>
          <button id="logout-btn">Sair</button>
        </div>`;
      const logoutBtn = document.getElementById("logout-btn");
      if (logoutBtn) logoutBtn.addEventListener("click", googleLogout);
    }
  }
}
async function googleLogin() {
  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    if (firebase.firestore) {
      const db = firebase.firestore();
      await db.collection("users").doc(user.uid).set({
        name: user.displayName,
        email: user.email,
        photo: user.photoURL,
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
    renderUser(user);
  } catch (err) { console.error("Erro no login:", err); }
}
async function googleLogout() {
  try { await auth.signOut(); renderUser(null); }
  catch (err) { console.error("Erro no logout:", err); }
}
auth.onAuthStateChanged(user => renderUser(user));
updateProgressUI();

let unsubscribeRanking = null;

// Atualiza a pontuação do usuário
async function updateUserScore(delta) {
  if (!currentUser) return;

  try {
    // Atualiza na coleção 'users'
    const userRef = db.collection('users').doc(currentUser.uid);
    const userDoc = await userRef.get();
    let newPoints = delta;

    if (userDoc.exists) {
      const userData = userDoc.data();
      newPoints = (userData.points || 0) + delta;
      await userRef.update({ points: newPoints });
    } else {
      await userRef.set({ points: newPoints });
    }

    // Atualiza na coleção 'ranking'
    const rankingRef = db.collection('ranking').doc(currentUser.uid);
    await rankingRef.set({
      name: currentUser.displayName || 'Anônimo',
      photo: currentUser.photoURL || 'imgs/user.png',
      points: newPoints
    }, { merge: true });

    // Atualiza display de pontos na página
    const pointsEl = document.querySelector('.user-points');
    if (pointsEl) pointsEl.textContent = `${newPoints} pts`;

  } catch (error) {
    console.error('Erro ao atualizar pontuação:', error);
  }
}

// Inicializa ranking na home
function initRanking() {
  if (unsubscribeRanking) return;

  const rankingQuery = db.collection('ranking')
    .orderBy('points', 'desc')
    .limit(10);

  unsubscribeRanking = rankingQuery.onSnapshot((snapshot) => {
    const homeTbody = document.querySelector("#homeRankingTable tbody");
    if (!homeTbody) return;
    homeTbody.innerHTML = "";

    if (snapshot.empty) {
      homeTbody.innerHTML = "<tr><td colspan='3'>Nenhum dado disponível</td></tr>";
      return;
    }

    snapshot.forEach((doc, index) => {
      const data = doc.data();
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>
          <img src="${data.photo}" style="width:24px; border-radius:50%; margin-right:8px;">
          ${data.name}
        </td>
        <td>${data.points}</td>
      `;
      homeTbody.appendChild(row);
    });
  }, (error) => {
    console.error("Erro ao carregar ranking:", error);
    const homeTbody = document.querySelector("#homeRankingTable tbody");
    if (homeTbody) homeTbody.innerHTML = "<tr><td colspan='3'>Erro ao carregar dados</td></tr>";
  });
}

// Observa estado de login
auth.onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    document.getElementById('user-photo').src = user.photoURL || 'imgs/user.png';
    document.getElementById('user-name').textContent = user.displayName || user.email;
    document.getElementById('user-info').style.display = 'block';
    initRanking(); // inicia ranking
  } else {
    currentUser = null;
    if (unsubscribeRanking) {
      unsubscribeRanking();
      unsubscribeRanking = null;
    }
    document.getElementById('user-info').style.display = 'none';
  }
});

// Exemplo de botões de teste para adicionar/remover pontos
document.getElementById('btn-plus')?.addEventListener('click', () => updateUserScore(1));
document.getElementById('btn-minus')?.addEventListener('click', () => updateUserScore(-1));



function initRanking() {
  // 1. Se já existe um ouvinte, não cria outro.
  if (unsubscribeRanking) {
    return;
  }

  const rankingQuery = db.collection("ranking")
    .orderBy("score", "desc")
    .limit(10);

  // 2. Guarda a função para "desligar" o ouvinte depois
  unsubscribeRanking = rankingQuery.onSnapshot((snap) => {
    // 3. Seleciona o corpo de AMBAS as tabelas
    const rankingTbody = document.querySelector("#ranking-table tbody");
    const homeTbody = document.querySelector("#homeRankingTable tbody");

    if (!rankingTbody || !homeTbody) return;

    // Limpa as tabelas
    rankingTbody.innerHTML = "";
    homeTbody.innerHTML = "";

    if (snap.empty) {
      const emptyRow = `<tr><td colspan="3">Nenhum dado disponível</td></tr>`;
      rankingTbody.innerHTML = emptyRow;
      homeTbody.innerHTML = emptyRow;
      return;
    }

    snap.forEach((doc, index) => {
      const data = doc.data();

      // Cria a linha da tabela uma vez
      const row = document.createElement("tr");

      const pos = `<td>${index + 1}</td>`;
      const user = `<td><img src="${data.photo || 'imgs/user.png'}" class="user-avatar"> ${data.name || 'Anônimo'}</td>`;
      const score = `<td>${data.score || 0}</td>`;

      // Monta a linha completa
      // OBS: A tabela do ranking completo tem 3 colunas (Pos, Usuário, Pontos)
      // A tabela da home tem um formato diferente (Usuário com foto embutida)
      // Vamos adaptar:
      const fullRankingRow = `<tr><td>${index + 1}</td><td><img src="${data.photo || 'imgs/user.png'}" class="user-avatar"></td><td>${data.name || 'Anônimo'}</td><td>${data.score || 0}</td></tr>`;
      const homeRankingRow = `<tr><td>${index + 1}</td><td><img src="${data.photo || 'imgs/user.png'}" class="user-avatar" style="width:24px; border-radius:50%; margin-right: 8px;">${data.name || 'Anônimo'}</td><td>${data.score || 0}</td></tr>`;

      // Adiciona a linha em cada tabela
      rankingTbody.innerHTML += fullRankingRow; // Adaptar as colunas se necessário
      homeTbody.innerHTML += homeRankingRow;
    });

  }, (error) => {
    console.error("Erro no ranking:", error);
    const errorRow = `<tr><td colspan="3">Erro ao carregar dados</td></tr>`;
    document.querySelector("#ranking-table tbody").innerHTML = errorRow;
    document.querySelector("#homeRankingTable tbody").innerHTML = errorRow;
  });
}

// Chame a função para "desligar" o ouvinte quando o usuário fizer logout
auth.onAuthStateChanged(async (user) => {
  renderAuthUi(user);
  if (user) {
    currentUser = user;
    // ... (seu código de verificação de usuário)
    initRanking(); // Inicia o listener do ranking após login
  } else {
    currentUser = null;
    // Se o usuário deslogou e o ouvinte existe, desative-o
    if (unsubscribeRanking) {
      unsubscribeRanking();
      unsubscribeRanking = null; // Reseta a variável
    }
  }
});

// Adiciona o ouvinte de clique CORRIGIDO para atividades (antigo ranking)
document.querySelector('.tab-btn[data-tab="atividades"]')?.addEventListener("click", () => {
  // Apenas garante que a função seja chamada se o usuário já estiver logado
  if (currentUser) {
    initRanking();
  }
});

// ===== FUNCIONALIDADE DO TONEARM =====
if (tonearm) {
  tonearm.addEventListener('click', () => {
    isPaused = !isPaused;
    if (isPaused) {
      tonearm.classList.add('paused');
    } else {
      tonearm.classList.remove('paused');
    }
  });
}

// ===== SISTEMA DE QUIZ =====
class QuizSystem {
  constructor() {
    this.currentQuiz = null;
    this.currentQuestion = 0;
    this.score = 0;
    this.timeLeft = 0;
    this.timer = null;
    this.selectedAnswer = null;
  }

  // Dados de exemplo para os quizzes
  getQuizData(moduleId) {
    const quizzes = {
      1: {
        title: "Sons agudos e graves",
        questions: [
          {
            question: "O que é altura na música?",
            options: ["A intensidade do som", "A frequência do som", "A duração do som", "O timbre do som"],
            correct: 1
          },
          {
            question: "Qual é a diferença entre som agudo e grave?",
            options: ["Agudo é mais forte", "Grave tem maior frequência", "Agudo tem maior frequência", "Não há diferença"],
            correct: 2
          }
        ]
      },
      2: {
        title: "Propriedades do Som",
        questions: [
          {
            question: "Quantas propriedades do som existem?",
            options: ["3", "4", "5", "6"],
            correct: 1
          },
          {
            question: "O que é timbre?",
            options: ["A altura do som", "A qualidade que diferencia os instrumentos", "A intensidade", "A duração"],
            correct: 1
          }
        ]
      }
      // Adicione mais quizzes conforme necessário
    };
    return quizzes[moduleId] || null;
  }

  startQuiz(moduleId) {
    const quizData = this.getQuizData(moduleId);
    if (!quizData) return;

    this.currentQuiz = quizData;
    this.currentQuiz.moduleId = moduleId; // Adicionar moduleId ao quiz
    this.currentQuestion = 0;
    this.score = 0;
    this.timeLeft = 30; // 30 segundos por pergunta

    this.showQuizInterface();
    this.showQuestion();
    this.startTimer();
  }

  showQuizInterface() {
    const lessonPanel = document.getElementById('lessonPanel');
    if (!lessonPanel) return;

    // Criar interface do quiz (substitui todo o conteúdo)
    const quizHTML = `
      <div class="quiz-container active">
        <div class="quiz-header">
          <div class="quiz-progress">Pergunta ${this.currentQuestion + 1} de ${this.currentQuiz.questions.length}</div>
          <div class="quiz-timer">⏱️ ${this.timeLeft}s</div>
        </div>
        <div class="quiz-question" id="quizQuestion"></div>
        <div class="quiz-options" id="quizOptions"></div>
        <div class="quiz-feedback" id="quizFeedback" style="display: none;"></div>
        <div class="quiz-buttons">
          <button class="quiz-btn" id="nextBtn" style="display: none;">Próxima Pergunta</button>
          <button class="quiz-btn" id="finishBtn" style="display: none;">Finalizar Quiz</button>
        </div>
      </div>
    `;

    lessonPanel.innerHTML = quizHTML;
    this.attachQuizEvents();
  }

  showQuestion() {
    const question = this.currentQuiz.questions[this.currentQuestion];
    const questionEl = document.getElementById('quizQuestion');
    const optionsEl = document.getElementById('quizOptions');
    const feedbackEl = document.getElementById('quizFeedback');
    const nextBtn = document.getElementById('nextBtn');
    const finishBtn = document.getElementById('finishBtn');

    if (!questionEl || !optionsEl) return;

    questionEl.textContent = question.question;

    optionsEl.innerHTML = '';
    question.options.forEach((option, index) => {
      const optionEl = document.createElement('div');
      optionEl.className = 'quiz-option';
      optionEl.textContent = option;
      optionEl.addEventListener('click', () => this.selectAnswer(index));
      optionsEl.appendChild(optionEl);
    });

    // Esconder feedback e botões
    feedbackEl.style.display = 'none';
    nextBtn.style.display = 'none';
    finishBtn.style.display = 'none';
    this.selectedAnswer = null;
  }

  selectAnswer(index) {
    if (this.selectedAnswer !== null) return; // Já respondeu

    this.selectedAnswer = index;
    const options = document.querySelectorAll('.quiz-option');
    const question = this.currentQuiz.questions[this.currentQuestion];

    // Marcar opção selecionada
    options.forEach((option, i) => {
      option.classList.remove('selected', 'correct', 'incorrect');
      if (i === index) {
        option.classList.add('selected');
      }
    });

    // Verificar resposta
    const isCorrect = index === question.correct;
    if (isCorrect) {
      this.score++;
      options[index].classList.add('correct');
    } else {
      options[index].classList.add('incorrect');
      options[question.correct].classList.add('correct');
    }

    // Mostrar feedback
    this.showFeedback(isCorrect);

    // Mostrar botão apropriado
    const nextBtn = document.getElementById('nextBtn');
    const finishBtn = document.getElementById('finishBtn');

    if (this.currentQuestion < this.currentQuiz.questions.length - 1) {
      nextBtn.style.display = 'block';
    } else {
      finishBtn.style.display = 'block';
    }

    // Parar timer
    this.stopTimer();
  }

  showFeedback(isCorrect) {
    const feedbackEl = document.getElementById('quizFeedback');
    if (!feedbackEl) return;

    feedbackEl.style.display = 'block';
    feedbackEl.className = `quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
    feedbackEl.textContent = isCorrect ? '✅ Correto!' : '❌ Incorreto!';
  }

  nextQuestion() {
    this.currentQuestion++;
    if (this.currentQuestion < this.currentQuiz.questions.length) {
      this.timeLeft = 30;
      this.showQuestion();
      this.startTimer();
    }
  }

  async finishQuiz() {
    const lessonPanel = document.getElementById('lessonPanel');
    if (!lessonPanel) return;

    const percentage = Math.round((this.score / this.currentQuiz.questions.length) * 100);
    const passed = percentage >= 70;

    // Salvar progresso se passou no quiz
    if (passed && currentUser) {
      try {
        await updateUserProgress(this.currentQuiz.moduleId);
        await updateProgressUI();
      } catch (error) {
        console.error('Erro ao salvar progresso:', error);
      }
    }

    lessonPanel.innerHTML = `
      <div class="quiz-container active">
        <h2>Quiz Finalizado!</h2>
        <div class="quiz-results">
          <p>Pontuação: ${this.score}/${this.currentQuiz.questions.length}</p>
          <p>Porcentagem: ${percentage}%</p>
          <p class="${passed ? 'correct' : 'incorrect'}">
            ${passed ? 'Parabéns! Você passou!' : 'Tente novamente!'}
          </p>
          ${passed ? '<p>✅ Módulo concluído com sucesso!</p>' : ''}
        </div>
        <div class="quiz-buttons">
          <button class="quiz-btn" onclick="document.getElementById('lessonPanel').classList.remove('show')">Fechar</button>
        </div>
      </div>
    `;
  }

  startTimer() {
    this.timer = setInterval(() => {
      this.timeLeft--;
      const timerEl = document.querySelector('.quiz-timer');
      if (timerEl) {
        timerEl.textContent = `⏱️ ${this.timeLeft}s`;
      }

      if (this.timeLeft <= 0) {
        this.timeUp();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  timeUp() {
    this.stopTimer();
    this.showFeedback(false);

    const nextBtn = document.getElementById('nextBtn');
    const finishBtn = document.getElementById('finishBtn');

    if (this.currentQuestion < this.currentQuiz.questions.length - 1) {
      nextBtn.style.display = 'block';
    } else {
      finishBtn.style.display = 'block';
    }
  }

  attachQuizEvents() {
    const nextBtn = document.getElementById('nextBtn');
    const finishBtn = document.getElementById('finishBtn');

    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextQuestion());
    }

    if (finishBtn) {
      finishBtn.addEventListener('click', () => this.finishQuiz());
    }
  }
}

// Instanciar sistema de quiz
const quizSystem = new QuizSystem();

// Função para abrir módulo (restaurada)
function openModule(moduleId) {
  const lessonPanel = document.getElementById('lessonPanel');
  if (!lessonPanel) return;

  lessonPanel.classList.add('show');

  const lessonContent = document.getElementById('lessonContent');
  if (lessonContent) {
    // Conteúdo do módulo baseado no ID
    const moduleContent = getModuleContent(moduleId);
    lessonContent.innerHTML = `
      <h2>${moduleContent.title}</h2>
      <div class="module-description">
        ${moduleContent.description}
      </div>
      <div class="module-lesson">
        ${moduleContent.content}
      </div>
      <div style="margin-top: 20px;">
        <button class="quiz-btn" onclick="quizSystem.startQuiz(${moduleId})">Iniciar Quiz</button>
      </div>
    `;
  }
}

// Função para obter conteúdo dos módulos
function getModuleContent(moduleId) {
  const modules = {
    1: {
      title: "Módulo 1 — Sons agudos e graves",
      description: "Iniciação à teoria musical: o que é altura, timbre e intensidade.",
      content: `
        <h3>Conceitos Básicos</h3>
        <p>A música é composta por sons que possuem diferentes características. Vamos aprender sobre:</p>
        <ul>
          <li><strong>Altura:</strong> Diferencia sons agudos (altos) de graves (baixos)</li>
          <li><strong>Timbre:</strong> Característica que diferencia os instrumentos</li>
          <li><strong>Intensidade:</strong> Volume do som (forte ou fraco)</li>
        </ul>
        <h3>Exemplos Práticos</h3>
        <p>• Som agudo: apito de trem<br>
        • Som grave: tambor<br>
        • Timbre: diferença entre piano e violão</p>
      `
    },
    2: {
      title: "Módulo 2 — Propriedades do Som",
      description: "Duração, pulsação, ritmo, intensidade e timbre.",
      content: `
        <h3>As 4 Propriedades do Som</h3>
        <ol>
          <li><strong>Altura:</strong> Frequência do som</li>
          <li><strong>Duração:</strong> Tempo que o som permanece</li>
          <li><strong>Intensidade:</strong> Volume (forte/fraco)</li>
          <li><strong>Timbre:</strong> Qualidade sonora</li>
        </ol>
        <h3>Ritmo e Pulsação</h3>
        <p>O ritmo é a organização temporal dos sons. A pulsação é o "coração" da música.</p>
      `
    }
    // Adicione mais módulos conforme necessário
  };

  return modules[moduleId] || {
    title: `Módulo ${moduleId}`,
    description: "Conteúdo em desenvolvimento",
    content: "<p>Este módulo está sendo desenvolvido. Em breve terá conteúdo completo!</p>"
  };
}

// ===== INSTRUMENTOS =====
let currentInstrument = 'piano';
let sampler = null;

async function switchInstrument(inst) {
  currentInstrument = inst;
  if (sampler) sampler.dispose();

  if (inst === 'piano') {
    sampler = new Tone.Sampler({
      urls: {
        "A0": "A0.mp3", "C1": "C1.mp3", "D#1": "Ds1.mp3", "F#1": "Fs1.mp3", "A1": "A1.mp3",
        "C2": "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3", "A2": "A2.mp3", "C3": "C3.mp3",
        "D#3": "Ds3.mp3", "F#3": "Fs3.mp3", "A3": "A3.mp3", "C4": "C4.mp3", "D#4": "Ds4.mp3",
        "F#4": "Fs4.mp3", "A4": "A4.mp3", "C5": "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3",
        "A5": "A5.mp3", "C6": "C6.mp3"
      },
      release: 1,
      baseUrl: "https://tonejs.github.io/audio/salamander/"
    }).toDestination();
  } else if (inst === 'guitar') {
    sampler = new Tone.Sampler({
      urls: {
        "C3": "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3", "A3": "A3.mp3",
        "C4": "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3", "A4": "A4.mp3",
        "C5": "C5.mp3"
      },
      release: 2,
      baseUrl: "https://tonejs.github.io/audio/berklee/guitar-acoustic/"
    }).toDestination();
  }
  else if (inst === 'drums') {
    sampler = new Tone.Sampler({
      urls: { "C1": "kick.mp3", "D1": "snare.mp3", "E1": "hihat.mp3" },
      baseUrl: "https://tonejs.github.io/audio/drum-samples/CR78/"
    }).toDestination();
  } else if (inst === 'flute') {
    sampler = new Tone.Sampler({
      urls: { "C4": "C4.mp3", "E4": "E4.mp3", "G4": "G4.mp3", "C5": "C5.mp3" },
      release: 2,
      baseUrl: "https://tonejs.github.io/audio/berklee/flute/"
    }).toDestination();
  }
}

// Tocar/parar nota
function playNote(note) { if (sampler) sampler.triggerAttack(note); }
function stopNote(note) { if (sampler) sampler.triggerRelease(note); }

// ===== TECLADO VIRTUAL =====
let isMouseDown = false;
let lastKey = null;

function activateKey(key) {
  if (!key) return;
  const note = key.dataset.note;
  if (lastKey && lastKey !== key) {
    stopNote(lastKey.dataset.note);
    lastKey.classList.remove("active");
  }
  playNote(note);
  key.classList.add("active");
  lastKey = key;
}

function deactivateKey(key) {
  if (!key) return;
  stopNote(key.dataset.note);
  key.classList.remove("active");
  lastKey = null;
}

function attachKeyHandlers() {
  document.querySelectorAll("#virtual-piano .key").forEach(key => {
    key.addEventListener("mousedown", () => { isMouseDown = true; activateKey(key); });
    key.addEventListener("mouseenter", () => { if (isMouseDown) activateKey(key); });
    key.addEventListener("mouseup", () => { deactivateKey(key); isMouseDown = false; });
    key.addEventListener("mouseleave", () => { if (!isMouseDown) deactivateKey(key); });
  });
  window.addEventListener("mouseup", () => { if (lastKey) deactivateKey(lastKey); isMouseDown = false; });
}

// Criar UI de instrumentos
function renderInstrumentUI(inst) {
  const instrumentArea = document.getElementById('instrument-area');
  if (!instrumentArea) return;
  instrumentArea.innerHTML = ''; // limpa o que tinha antes

  // --- PIANO ---
  if (inst === 'piano' || inst === 'flute') {
    const scroll = document.createElement('div');
    scroll.id = 'piano-scroll';
    const vp = document.createElement('div');
    vp.id = 'virtual-piano';
    const white = document.createElement('div'); white.className = 'white-keys';
    const black = document.createElement('div'); black.className = 'black-keys';
    vp.appendChild(white);
    vp.appendChild(black);
    scroll.appendChild(vp);
    instrumentArea.appendChild(scroll);
    buildKeyboard();
    attachKeyHandlers();
  }

  // --- VIOLÃO ---
  if (inst === 'guitar') {
    const fretboard = document.createElement('div');
    fretboard.id = 'fretboard';

    // cordas do violão padrão (EADGBE)
    const strings = ["E2", "A2", "D3", "G3", "B3", "E4"];

    strings.forEach(openNote => {
      const stringEl = document.createElement('div');
      stringEl.className = 'string';

      for (let fret = 0; fret <= 12; fret++) {
        const note = Tone.Frequency(openNote).transpose(fret).toNote();
        const fretEl = document.createElement('div');
        fretEl.className = 'fret';
        fretEl.dataset.note = note;
        fretEl.textContent = fret === 0 ? "0" : fret;
        fretEl.addEventListener("mousedown", () => {
          playNote(note);
          fretEl.classList.add("active");
        });
        fretEl.addEventListener("mouseup", () => {
          stopNote(note);
          fretEl.classList.remove("active");
        });
        stringEl.appendChild(fretEl);
      }

      fretboard.appendChild(stringEl);
    });

    instrumentArea.appendChild(fretboard);
  }

  // --- BATERIA ---
  if (inst === 'drums') {
    const grid = document.createElement('div');
    grid.id = 'drum-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(3, 100px)';
    grid.style.gap = '12px';

    const pads = [
      { label: 'Kick', note: 'C1' },
      { label: 'Snare', note: 'D1' },
      { label: 'HiHat', note: 'E1' }
    ];

    pads.forEach(p => {
      const b = document.createElement('button');
      b.textContent = p.label;
      b.style.padding = '16px';
      b.style.background = '#1a1a1a';
      b.style.color = '#fff';
      b.style.border = '1px solid #262626';
      b.style.cursor = 'pointer';
      b.addEventListener('mousedown', () => {
        sampler.triggerAttackRelease(p.note, '8n');
      });
      grid.appendChild(b);
    });

    instrumentArea.appendChild(grid);
  }
}

// Construir teclado com várias oitavas
function buildKeyboard() {
  const white = document.querySelector('#virtual-piano .white-keys');
  const black = document.querySelector('#virtual-piano .black-keys');
  if (!white || !black) return;
  white.innerHTML = ''; black.innerHTML = '';

  const startOctave = 2;  // agora começa no C2
  const endOctave = 6;    // até C6
  const whiteOrder = ["C", "D", "E", "F", "G", "A", "B"];
  const blackOrder = ["C#", "D#", "", "F#", "G#", "A#"];

  let keyIndex = 0;
  for (let octave = startOctave; octave <= endOctave; octave++) {
    whiteOrder.forEach((note) => {
      const key = document.createElement('div');
      key.classList.add('key', 'white');
      key.dataset.note = `${note}${octave}`;
      key.style.left = `${keyIndex * 40}px`;

      const label = document.createElement('div');
      label.className = 'note-label';
      label.textContent = `${note}${octave}`;
      key.appendChild(label);

      white.appendChild(key);
      keyIndex++;
    });

    blackOrder.forEach((note, i) => {
      if (!note) return;
      const key = document.createElement('div');
      key.classList.add('key', 'black');
      key.dataset.note = `${note}${octave}`;
      key.style.left = `${40 * (i + (octave - startOctave) * 7) + 26}px`;

      const label = document.createElement('div');
      label.className = 'note-label';
      label.textContent = `${note}${octave}`;
      key.appendChild(label);

      black.appendChild(key);
    });
  }
}

// ===== ATALHOS DE TECLADO (PC) =====
const keyMap = {
  "z": "C3", "s": "C#3", "x": "D3", "d": "D#3", "c": "E3",
  "v": "F3", "g": "F#3", "b": "G3", "h": "G#3", "n": "A3", "j": "A#3", "m": "B3",
  ",": "C4", "l": "C#4", ".": "D4", ";": "D#4", "/": "E4",
  "q": "F4", "2": "F#4", "w": "G4", "3": "G#4", "e": "A4", "4": "A#4", "r": "B4",
  "t": "C5", "6": "C#5", "y": "D5", "7": "D#5", "u": "E5",
  "i": "F5", "9": "F#5", "o": "G5", "0": "G#5", "p": "A5", "-": "A#5", "[": "B5"
};

document.addEventListener("keydown", (e) => {
  if (keyMap[e.key]) {
    const note = keyMap[e.key];
    const keyEl = [...document.querySelectorAll(".key")].find(k => k.dataset.note === note);
    if (keyEl && !keyEl.classList.contains("active")) activateKey(keyEl);
  }
});

document.addEventListener("keyup", (e) => {
  if (keyMap[e.key]) {
    const note = keyMap[e.key];
    const keyEl = [...document.querySelectorAll(".key")].find(k => k.dataset.note === note);
    if (keyEl) deactivateKey(keyEl);
  }
});

// Inicializar com piano
switchInstrument("piano");
renderInstrumentUI("piano");


// Inicialização do sistema
document.addEventListener('DOMContentLoaded', () => {
  // Event listeners para os botões de módulo
  document.querySelectorAll('.module-open').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const moduleCard = e.target.closest('.module-card');
      const moduleId = parseInt(moduleCard.dataset.module);
      openModule(moduleId);
    });
  });

  // Event listeners para o modal de perfil
  const profileModal = document.getElementById('profileModal');
  const closeModalBtn = document.getElementById('closeProfileModal');
  const cancelBtn = document.getElementById('cancelProfile');
  const profileForm = document.getElementById('profileForm');
  const uploadBtn = document.getElementById('uploadPicture');
  const pictureInput = document.getElementById('pictureInput');

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeProfileModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeProfileModal);
  }

  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = {
        displayName: document.getElementById('displayName').value,
        currentPassword: document.getElementById('currentPassword').value,
        newPassword: document.getElementById('newPassword').value,
        confirmPassword: document.getElementById('confirmPassword').value
      };

      // Validar senhas
      if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
        alert('As senhas não coincidem!');
        return;
      }

      await saveProfileChanges(formData);
    });
  }

  if (uploadBtn && pictureInput) {
    uploadBtn.addEventListener('click', () => {
      pictureInput.click();
    });

    pictureInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          document.getElementById('profilePicture').src = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Fechar modal clicando fora dele
  if (profileModal) {
    profileModal.addEventListener('click', (e) => {
      if (e.target === profileModal) {
        closeProfileModal();
      }
    });
  }

  // Inicializar sistema de autenticação
  auth.onAuthStateChanged((user) => {
    renderAuthUi(user);
    if (user) {
      updateProgressUI();
    }
  });

  // Event listener para mudança de abas
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabId = e.target.dataset.tab;

      // Inicializar piano quando a aba instrumentos for ativada
      if (tabId === 'instrumentos' && !virtualPiano) {
        virtualPiano = new VirtualPiano();
      }
    });
  });

  // Event listener para seletor de instrumentos
  document.querySelectorAll('.inst-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const instrument = e.target.dataset.inst;

      // Ativar piano virtual quando selecionado
      if (instrument === 'piano' && !virtualPiano) {
        virtualPiano = new VirtualPiano();
      }
    });
  });
});

/// ----- Acessibilidade -----
const accToggle = document.getElementById("accessibility-toggle");
const accOptions = document.getElementById("accessibility-options");

accToggle.addEventListener("click", () => {
  accOptions.classList.toggle("hidden");
});

// ----- Acessibilidade: controle de fonte -----
let fontSizeMultiplier = 1;

// Salva tamanhos originais
document.querySelectorAll("*").forEach(el => {
  const style = window.getComputedStyle(el);
  if (style.fontSize) {
    el.dataset.baseFontSize = style.fontSize;
  }
});

function applyFontSize() {
  document.querySelectorAll("*").forEach(el => {
    if (el.dataset.baseFontSize) {
      const base = parseFloat(el.dataset.baseFontSize);
      const unit = el.dataset.baseFontSize.replace(/[0-9.]/g, "") || "px";
      el.style.fontSize = (base * fontSizeMultiplier) + unit;
    }
  });
}

// Aumentar fonte
document.getElementById("font-increase").addEventListener("click", () => {
  fontSizeMultiplier = Math.min(fontSizeMultiplier + 0.1, 2); // até 200%
  applyFontSize();
});

// Diminuir fonte
document.getElementById("font-decrease").addEventListener("click", () => {
  fontSizeMultiplier = Math.max(fontSizeMultiplier - 0.1, 0.7); // até 70%
  applyFontSize();
});

// ----- Acessibilidade: Leitor de tela -----
let synth = window.speechSynthesis;
let readerActive = false;

function getElementText(el) {
  if (el.innerText && el.innerText.trim().length > 0) {
    return el.innerText;
  }
  if (el.alt) {
    return el.alt;
  }
  if (el.getAttribute("aria-label")) {
    return el.getAttribute("aria-label");
  }
  if (el.title) {
    return el.title;
  }
  return null;
}

document.getElementById("screen-reader").addEventListener("click", () => {
  readerActive = !readerActive;

  if (readerActive) {
    // Ativa leitura contínua
    document.addEventListener("mouseover", handleRead);
    document.addEventListener("focusin", handleRead); // também para teclado/tab
  } else {
    // Desativa leitura
    document.removeEventListener("mouseover", handleRead);
    document.removeEventListener("focusin", handleRead);
    if (synth.speaking) synth.cancel();
  }
});

function handleRead(e) {
  let text = getElementText(e.target);

  if (text) {
    if (synth.speaking) synth.cancel();

    let utter = new SpeechSynthesisUtterance(text);
    utter.lang = "pt-BR"; // voz em português
    synth.speak(utter);
  }
}

// Filtros para daltonismo
const filters = [
  "none",                // normal
  "grayscale(100%)",     // simulação monocromática
  "contrast(150%) saturate(120%)", // deuteranopia aproximada
  "invert(100%)",        // contraste alto
];
let currentFilter = 0;

document.getElementById("colorblind-toggle").addEventListener("click", () => {
  currentFilter = (currentFilter + 1) % filters.length;
  document.body.style.filter = filters[currentFilter];
});

// ===== BOTÕES DE INSTRUMENTOS =====
document.querySelectorAll(".instrument-selector .inst-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const inst = btn.dataset.inst;

    // Remove active de todos os botões
    document.querySelectorAll(".instrument-selector .inst-btn").forEach(b => b.classList.remove("active"));
    // Ativa o botão clicado
    btn.classList.add("active");

    // Troca o sampler e a UI do instrumento
    switchInstrument(inst);
    renderInstrumentUI(inst);
  });
});

// ================== ATIVIDADES ==================

// Abre uma atividade
function openActivity(id) {
  const modal = document.getElementById("activityModal");
  const inner = document.getElementById("activityInner");

  if (id === "agudoGrave") {
    inner.innerHTML = `
      <h2>Atividade: Agudo ou Grave</h2>
      <p>Um som será tocado. Clique na opção correta!</p>
      <div style="margin-top:20px;">
        <button onclick="checkAgudoGrave('agudo')" class="ans-btn">Agudo</button>
        <button onclick="checkAgudoGrave('grave')" class="ans-btn">Grave</button>
      </div>
      <p id="agudoGraveFeedback" style="margin-top:15px;"></p>
    `;

    // 🔹 Já começa com um som
    playAgudoGrave();
  }

  modal.classList.remove("hidden");
}

// Fecha o modal
function closeActivity() {
  document.getElementById("activityModal").classList.add("hidden");
  document.getElementById("activityInner").innerHTML = "";
}

// ================== AGUDO X GRAVE ==================
let currentSoundType = null;

function playAgudoGrave() {
  const synth = new Tone.Synth().toDestination();

  // Notas possíveis (grave e agudo)
  const graveNotes = ["C2", "E2", "G2", "A1"];
  const agudoNotes = ["C6", "E6", "G6", "A5"];

  if (Math.random() > 0.5) {
    // Agudo
    const note = agudoNotes[Math.floor(Math.random() * agudoNotes.length)];
    synth.triggerAttackRelease(note, "1n");
    currentSoundType = "agudo";
  } else {
    // Grave
    const note = graveNotes[Math.floor(Math.random() * graveNotes.length)];
    synth.triggerAttackRelease(note, "1n");
    currentSoundType = "grave";
  }
}

async function checkAgudoGrave(answer) {
  const feedback = document.getElementById("agudoGraveFeedback");

  if (answer === currentSoundType) {
    feedback.textContent = "✅ Correto! +10 pontos";
    feedback.style.color = "lightgreen";
    await addUserPoints(10);

    // 🔹 Gera novo som automaticamente depois de 1,5s
    setTimeout(() => {
      feedback.textContent = "";
      playAgudoGrave();
    }, 1500);
  } else {
    feedback.textContent = "❌ Errado! Tente novamente.";
    feedback.style.color = "red";
  }
}

// ================== PONTUAÇÃO DE ATIVIDADE ==================
async function completeActivity(activityId) {
  if (!currentUser) return alert("Faça login para ganhar pontos!");

  try {
    const userRef = db.collection("users").doc(currentUser.uid);
    await userRef.update({
      points: firebase.firestore.FieldValue.increment(20)
    });
    userPoints += 20;

    // Atualiza exibição
    const pointsElement = document.querySelector(".user-points");
    if (pointsElement) pointsElement.textContent = `${userPoints} pts`;

    console.log(`Atividade ${activityId} concluída! +20 pontos`);
  } catch (err) {
    console.error("Erro ao atualizar pontos:", err);
  }
}

// Helper para somar pontos adicionais (usado no Agudo/Grave)
async function addUserPoints(amount) {
  if (!currentUser) return;

  try {
    const userRef = db.collection("users").doc(currentUser.uid);
    await userRef.update({
      points: firebase.firestore.FieldValue.increment(amount)
    });
    userPoints += amount;

    // Atualiza UI
    const pointsElement = document.querySelector(".user-points");
    if (pointsElement) pointsElement.textContent = `${userPoints} pts`;
  } catch (err) {
    console.error("Erro ao adicionar pontos:", err);
  }

}






