/* ═══════════════════════════════════════════════════════════════
   SESSÃO DO ADMIN — bloqueio temporário + expiração por inatividade
   - 3 tentativas erradas → bloqueia por 5 min (por dispositivo)
   - Sessão expira após 30 min sem interação no painel admin
═══════════════════════════════════════════════════════════════ */
(function () {
  var MAX_TENT = 3;
  var BLOQUEIO_MS = 5 * 60 * 1000;          // 5 minutos
  var SESSAO_INATIVA_MS = 30 * 60 * 1000;   // 30 minutos
  var AVISO_FALTANDO_MS = 2 * 60 * 1000;    // avisa 2 min antes

  var KEYS = { tent: 'cgex_admin_tent', blq: 'cgex_admin_blq_ate' };

  function agora() { return Date.now(); }

  /* ─── BLOQUEIO POR TENTATIVAS ─── */

  function bloqueadoAte() {
    return parseInt(localStorage.getItem(KEYS.blq) || '0', 10) || 0;
  }
  function estaBloqueado() { return bloqueadoAte() > agora(); }
  function tempoRestanteSeg() { return Math.max(0, Math.ceil((bloqueadoAte() - agora()) / 1000)); }
  function registrarTentativaErrada() {
    var t = (parseInt(localStorage.getItem(KEYS.tent) || '0', 10) || 0) + 1;
    localStorage.setItem(KEYS.tent, String(t));
    if (t >= MAX_TENT) {
      localStorage.setItem(KEYS.blq, String(agora() + BLOQUEIO_MS));
      localStorage.removeItem(KEYS.tent);
      if (typeof auditLog === 'function') auditLog('admin_bloqueio', MAX_TENT + ' tentativas erradas — bloqueado por 5 min');
    }
    return { tentativas: t, bloqueou: t >= MAX_TENT };
  }
  function limparTentativas() {
    localStorage.removeItem(KEYS.tent);
    localStorage.removeItem(KEYS.blq);
  }

  // UI do aviso de bloqueio (na tela de login admin)
  function atualizarAvisoBloqueio() {
    var wrap = document.getElementById('admin-login-wrap');
    if (!wrap) return;
    var av = document.getElementById('admin-bloqueio-aviso');
    if (!av) {
      av = document.createElement('div');
      av.id = 'admin-bloqueio-aviso';
      av.className = 'admin-bloqueio-aviso';
      var card = wrap.querySelector('.admin-card, .login-card, form, div');
      (card || wrap).appendChild(av);
    }
    if (estaBloqueado()) {
      av.style.display = 'block';
      av.innerHTML = '🔒 <b>Bloqueado por excesso de tentativas.</b><br>' +
        'Tente novamente em <span id="bloq-countdown">' + tempoRestanteSeg() + '</span>s.';
      var inp = document.getElementById('admin-senha-input');
      if (inp) { inp.disabled = true; inp.placeholder = 'Bloqueado…'; }
      var btn = wrap.querySelector('button[onclick*="verificarSenhaAdmin"]');
      if (btn) btn.disabled = true;
    } else {
      av.style.display = 'none';
      var inp2 = document.getElementById('admin-senha-input');
      if (inp2) inp2.disabled = false;
      var btn2 = wrap.querySelector('button[onclick*="verificarSenhaAdmin"]');
      if (btn2) btn2.disabled = false;
    }
  }
  var _bloqInterval = null;
  function iniciarCountdownBloqueio() {
    if (_bloqInterval) clearInterval(_bloqInterval);
    _bloqInterval = setInterval(function () {
      if (!estaBloqueado()) { clearInterval(_bloqInterval); _bloqInterval = null; atualizarAvisoBloqueio(); return; }
      var el = document.getElementById('bloq-countdown');
      if (el) el.textContent = tempoRestanteSeg();
    }, 1000);
  }

  // Envolve verificarSenhaAdmin: bloqueia, conta tentativas, limpa após sucesso
  var origVerificar = window.verificarSenhaAdmin;
  window.verificarSenhaAdmin = async function () {
    if (estaBloqueado()) {
      var inp = document.getElementById('admin-senha-input');
      var erro = document.getElementById('admin-erro-msg');
      if (erro) { erro.textContent = '🔒 Bloqueado. Tente em ' + tempoRestanteSeg() + 's.'; erro.style.display = 'block'; }
      if (inp) inp.value = '';
      atualizarAvisoBloqueio();
      iniciarCountdownBloqueio();
      return;
    }
    var dashAntes = document.getElementById('admin-dashboard');
    var jaLogado = dashAntes && dashAntes.classList.contains('visivel');
    var r = await origVerificar.apply(this, arguments);
    // Sucesso: dashboard ficou visível
    var dashDepois = document.getElementById('admin-dashboard');
    var sucesso = !jaLogado && dashDepois && dashDepois.classList.contains('visivel');
    if (sucesso) {
      limparTentativas();
      iniciarSessao();
    } else {
      var info = registrarTentativaErrada();
      var erro2 = document.getElementById('admin-erro-msg');
      if (info.bloqueou) {
        if (erro2) { erro2.textContent = '🔒 Bloqueado por 5 min após 3 tentativas erradas.'; erro2.style.display = 'block'; }
        atualizarAvisoBloqueio();
        iniciarCountdownBloqueio();
      } else if (erro2) {
        var restam = MAX_TENT - info.tentativas;
        erro2.textContent = '❌ Senha incorreta. ' + restam + ' tentativa(s) antes do bloqueio.';
        erro2.style.display = 'block';
      }
    }
    return r;
  };

  // Quando o overlay do admin abre, mostra o estado de bloqueio
  var origAbrirAdmin = window.abrirAdmin;
  window.abrirAdmin = function () {
    var r = (typeof origAbrirAdmin === 'function') ? origAbrirAdmin.apply(this, arguments) : undefined;
    setTimeout(function () { atualizarAvisoBloqueio(); if (estaBloqueado()) iniciarCountdownBloqueio(); }, 50);
    return r;
  };

  /* ─── EXPIRAÇÃO POR INATIVIDADE ─── */

  var _ultimoUso = 0;
  var _sessaoTimer = null;
  var _avisoTimer = null;

  function registrarUso() { _ultimoUso = agora(); }

  function iniciarSessao() {
    registrarUso();
    if (_sessaoTimer) clearInterval(_sessaoTimer);
    _sessaoTimer = setInterval(verificarSessao, 30 * 1000);
    document.addEventListener('mousemove', registrarUso, { passive: true });
    document.addEventListener('keydown', registrarUso);
    document.addEventListener('click', registrarUso);
  }
  function pararSessao() {
    if (_sessaoTimer) { clearInterval(_sessaoTimer); _sessaoTimer = null; }
    document.removeEventListener('mousemove', registrarUso);
    document.removeEventListener('keydown', registrarUso);
    document.removeEventListener('click', registrarUso);
    esconderAvisoSessao();
  }
  function verificarSessao() {
    var dash = document.getElementById('admin-dashboard');
    if (!dash || !dash.classList.contains('visivel')) { pararSessao(); return; }
    var inativo = agora() - _ultimoUso;
    if (inativo >= SESSAO_INATIVA_MS) {
      pararSessao();
      esconderAvisoSessao();
      if (typeof auditLog === 'function') auditLog('admin_logout_auto', 'Sessão expirou por inatividade');
      if (typeof fecharAdmin === 'function') fecharAdmin();
      if (typeof mostrarToast === 'function') mostrarToast('🔒 Sessão admin expirou por inatividade.');
      return;
    }
    if (inativo >= SESSAO_INATIVA_MS - AVISO_FALTANDO_MS) {
      mostrarAvisoSessao(Math.ceil((SESSAO_INATIVA_MS - inativo) / 1000));
    } else {
      esconderAvisoSessao();
    }
  }
  function mostrarAvisoSessao(seg) {
    var av = document.getElementById('sessao-aviso');
    if (!av) {
      av = document.createElement('div');
      av.id = 'sessao-aviso';
      av.className = 'sessao-aviso';
      av.innerHTML = '⏳ Sua sessão admin expira em <span id="sessao-seg"></span>s. ' +
        '<button onclick="window._renovarSessaoAdmin()">Continuar</button>';
      document.body.appendChild(av);
    }
    av.style.display = 'flex';
    var s = document.getElementById('sessao-seg'); if (s) s.textContent = seg;
  }
  function esconderAvisoSessao() {
    var av = document.getElementById('sessao-aviso'); if (av) av.style.display = 'none';
  }
  window._renovarSessaoAdmin = function () { registrarUso(); esconderAvisoSessao(); };

  // Quando fecha o admin manualmente, para o timer
  var origFecharAdmin = window.fecharAdmin;
  window.fecharAdmin = function () {
    pararSessao();
    return (typeof origFecharAdmin === 'function') ? origFecharAdmin.apply(this, arguments) : undefined;
  };

  // expõe para debug / dev
  window._admSessao = {
    bloqueadoAte: bloqueadoAte, estaBloqueado: estaBloqueado,
    limparTentativas: limparTentativas, registrarTentativaErrada: registrarTentativaErrada,
    iniciarSessao: iniciarSessao, pararSessao: pararSessao
  };
})();
