/* ═══════════════════════════════════════════════════════════════
   SEGURANÇA — login anônimo, hash forte (PBKDF2) e níveis de admin
   Carregado após app.js. Usa funções globais: sha256, getConfig.
═══════════════════════════════════════════════════════════════ */

/* ── 1. LOGIN ANÔNIMO DO FIREBASE ──────────────────────────────
   As regras do Firestore exigem request.auth != null. Abrimos uma
   sessão anônima ao carregar. Requer "Anonymous" ativado no console
   (Authentication > Sign-in method). Ver SECURITY.md. */
let _authPromise = null;
function garantirAuth() {
  try {
    if (!firebase || !firebase.auth) return Promise.resolve(null);
  } catch (e) { return Promise.resolve(null); }
  if (_authPromise) return _authPromise;
  _authPromise = new Promise(function (resolve) {
    var feito = false;
    function pronto(v) { if (!feito) { feito = true; resolve(v); } }
    // Nunca trava o carregamento do app: resolve após 4s no máximo
    var timer = setTimeout(function () { pronto(null); }, 4000);
    var auth = firebase.auth();
    if (auth.currentUser) { clearTimeout(timer); pronto(auth.currentUser); return; }
    var off = auth.onAuthStateChanged(function (u) {
      if (u) { clearTimeout(timer); if (off) off(); pronto(u); }
    });
    auth.signInAnonymously().catch(function (err) {
      console.warn('signInAnonymously falhou (ative Anonymous no console):', err.code || err);
      clearTimeout(timer); pronto(null);
    });
  });
  return _authPromise;
}

/* ── 2. HASH FORTE DA SENHA DE ADMIN (PBKDF2-SHA256) ─────────────
   Formato: pbkdf2$<iteracoes>$<saltBase64>$<hashBase64>
   Compatível com hashes legados (SHA-256 hex de 64 chars). */
const _PBKDF2_ITER = 150000;

function _bytesToB64(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function _b64ToBytes(b64) {
  var bin = atob(b64);
  var a = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}
async function _derivar(senha, saltBytes, iteracoes) {
  var enc = new TextEncoder();
  var km = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
  var bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: iteracoes, hash: 'SHA-256' },
    km, 256
  );
  return new Uint8Array(bits);
}
async function gerarHashAdmin(senha) {
  var salt = crypto.getRandomValues(new Uint8Array(16));
  var hash = await _derivar(senha, salt, _PBKDF2_ITER);
  return 'pbkdf2$' + _PBKDF2_ITER + '$' + _bytesToB64(salt) + '$' + _bytesToB64(hash);
}
async function verificarSenhaAdminHash(senha, guardado) {
  if (typeof guardado !== 'string' || !guardado) return false;
  if (guardado.indexOf('pbkdf2$') === 0) {
    var p = guardado.split('$');           // ['pbkdf2', iter, salt, hash]
    var iter = parseInt(p[1], 10) || _PBKDF2_ITER;
    var salt = _b64ToBytes(p[2]);
    var calc = await _derivar(senha, salt, iter);
    return _bytesToB64(calc) === p[3];
  }
  // Legado: SHA-256 em hex (migrado para PBKDF2 no próximo login bem-sucedido)
  return (await sha256(senha)) === guardado;
}

/* ── 3. NÍVEIS DE ACESSO DE ADMIN ───────────────────────────────
   O nível depende do cargo do usuário logado (instrutorCargos).
   - total    → acesso completo (Administrador/Corregedor Geral, ou
                acesso só por senha sem instrutor identificado).
   - conteudo → conteúdo, avisos, notificações, leitura de logs.
   - leitura  → apenas visualização (sem botões de salvar). */
const _CARGOS_TOTAL = ['administrador geral', 'corregedor geral', 'admin', 'dono'];
const _CARGOS_CONTEUDO = ['chefe de instrução', 'chefe de instrucao', 'corregedor', 'supervisor', 'instrutor chefe'];

// Abas permitidas por nível (chave = argumento de adminAba)
const _ABAS_CONTEUDO = ['aviso', 'notificacao', 'conteudo', 'logs', 'notificacoes', 'auditoria', 'historico'];
const _ABAS_LEITURA = ['logs', 'auditoria', 'historico'];

function cargoUsuarioAtual() {
  var nick = (sessionStorage.getItem('cgex_auth_nick') || '').toLowerCase().trim();
  if (!nick) return '';
  var cargos = (getConfig() && getConfig().instrutorCargos) || {};
  for (var k in cargos) {
    if (k.toLowerCase().trim() === nick) return String(cargos[k] || '').toLowerCase().trim();
  }
  return '';
}
function nivelAdmin() {
  var c = cargoUsuarioAtual();
  if (!c) return 'total';                       // acesso só por senha = dono
  if (_CARGOS_TOTAL.indexOf(c) !== -1) return 'total';
  if (_CARGOS_CONTEUDO.indexOf(c) !== -1) return 'conteudo';
  return 'leitura';
}
function podeEditar(area) {
  var n = nivelAdmin();
  if (n === 'total') return true;
  if (n === 'leitura') return false;
  return _ABAS_CONTEUDO.indexOf(area) !== -1; // conteudo
}

function _chaveDaAba(btn) {
  var oc = btn.getAttribute('onclick') || '';
  var m = oc.match(/adminAba\(\s*'([^']+)'/);
  return m ? m[1] : '';
}

// Aplica o nível: esconde abas não permitidas e (no nível leitura) desabilita botões.
function aplicarNivelAdmin() {
  var nivel = nivelAdmin();
  var tabs = document.querySelectorAll('.admin-nav .admin-tab');
  var primeiraPermitida = null;

  tabs.forEach(function (btn) {
    var chave = _chaveDaAba(btn);
    var permitido = true;
    if (nivel === 'conteudo') permitido = _ABAS_CONTEUDO.indexOf(chave) !== -1;
    else if (nivel === 'leitura') permitido = _ABAS_LEITURA.indexOf(chave) !== -1;
    btn.style.display = permitido ? '' : 'none';
    if (permitido && !primeiraPermitida) primeiraPermitida = btn;
  });

  // Badge de nível no cabeçalho do admin
  var nav = document.querySelector('.admin-nav');
  if (nav) {
    var badge = document.getElementById('admin-nivel-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'admin-nivel-badge';
      badge.style.cssText = 'width:100%;font-family:Rajdhani,sans-serif;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--cinza);margin-bottom:6px;';
      nav.parentNode.insertBefore(badge, nav);
    }
    var rotulo = nivel === 'total' ? '🟢 Acesso total' : (nivel === 'conteudo' ? '🟡 Editor de conteúdo' : '🔵 Somente leitura');
    var cargo = cargoUsuarioAtual();
    badge.textContent = 'Nível: ' + rotulo + (cargo ? '  •  ' + cargo : '');
  }

  // Se a aba ativa foi escondida, ativa a primeira permitida
  var ativa = document.querySelector('.admin-nav .admin-tab.ativa');
  if ((!ativa || ativa.style.display === 'none') && primeiraPermitida) {
    primeiraPermitida.click();
  }

  // Nível leitura: desabilita todos os controles de escrita
  var travar = (nivel === 'leitura');
  document.querySelectorAll('.admin-content button, .admin-content input, .admin-content textarea, .admin-content select')
    .forEach(function (el) {
      if (el.classList.contains('admin-tab')) return;
      if (travar) { el.setAttribute('disabled', 'disabled'); el.style.opacity = '0.5'; }
      else { /* não reabilita à força aqui para não interferir em estados próprios */ }
    });
}

/* Hook: depois que o dashboard do admin carrega, aplica o nível. */
(function () {
  var orig = window.carregarDadosAdmin;
  window.carregarDadosAdmin = function () {
    var r = (typeof orig === 'function') ? orig.apply(this, arguments) : undefined;
    try { aplicarNivelAdmin(); } catch (e) { console.warn('aplicarNivelAdmin:', e); }
    return r;
  };
})();
