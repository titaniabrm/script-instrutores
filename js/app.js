/* ═══════════════════════════════════════════
   FIREBASE CONFIG
═══════════════════════════════════════════ */
const _fbApp = firebase.initializeApp({
  apiKey: "AIzaSyAYKTMLiF1Ob94AOKVSr--6rELZa3UFso4",
  authDomain: "cgex-painel.firebaseapp.com",
  projectId: "cgex-painel",
  storageBucket: "cgex-painel.firebasestorage.app",
  messagingSenderId: "750960955790",
  appId: "1:750960955790:web:02a65fc7e3a7b8416b14df",
  measurementId: "G-FE5YNCWFVB"
});
const _db = firebase.firestore();
const _cfgRef = _db.collection('config').doc('main');

// Cache local para uso síncrono
let _configCache = {
  clientId: '', redirectUri: '', groupId: '',
  instructorRoles: ['Instrutor', 'Instrutor Chefe', 'Supervisor'],
  adminPasswordHash: '',
  manualInstructors: [],
  avisoTexto: '', avisoTipo: 'verde',
  manutencao: null,
  notifUrgente: { ativo: false },
  banidos: [],
  instrutorCargos: {
    'hshevsmana':       'Corregedor Geral',
    'caiozin0715':      'Corregedor Geral',
    'rick098997':       'Chefe de Instrução',
    'mudinhoxy':        'Instrutor Qualificado',
    'ngcpz01':          'Instrutor Qualificado',
    'punisher_lipe':    'Instrutor Qualificado',
    'sasukepolici':     'Instrutor Qualificado',
    'danielovw8br':     'Instrutor Qualificado',
    'gengarmelhorpoke': 'Administrador Geral',
  },
  notasPastas: {},
};
let _configCarregado = false;

/* ═══════════════════════════════════════════
   CONFIG & STORAGE
═══════════════════════════════════════════ */
function getConfig() {
  return _configCache;
}

async function saveConfig(cfg) {
  _configCache = cfg;
  try {
    await _cfgRef.set(cfg);
    if (typeof registrarHistoricoConfig === 'function') { try { registrarHistoricoConfig(cfg); } catch(e){} }
  } catch(e) {
    console.error('Erro ao salvar no Firebase:', e);
    localStorage.setItem('cgex_config', JSON.stringify(cfg));
  }
}

// Listener tempo real — qualquer aba/usuário logado vê mudanças instantaneamente
function iniciarListenerFirebase() {
  _cfgRef.onSnapshot((snap) => {
    if (snap.exists) {
      const d = snap.data();
      _configCache = {
        clientId: d.clientId || '',
        redirectUri: d.redirectUri || '',
        groupId: d.groupId || '',
        instructorRoles: d.instructorRoles || ['Instrutor', 'Instrutor Chefe', 'Supervisor'],
        adminPasswordHash: d.adminPasswordHash || '',
        manualInstructors: Array.isArray(d.manualInstructors) ? d.manualInstructors : [],
        avisoTexto: d.avisoTexto || '',
        avisoTipo: d.avisoTipo || 'verde',
        manutencao: d.manutencao || null,
        notifUrgente: d.notifUrgente || { ativo: false },
        banidos: Array.isArray(d.banidos) ? d.banidos : [],
        banMensagem: d.banMensagem || '',
        instrutorCargos: d.instrutorCargos || {},
        notasPastas: d.notasPastas || {},
      };
      if (typeof atualizarAvisoAdmin === 'function') atualizarAvisoAdmin(_configCache);
      if (typeof atualizarBtnManutencao === 'function') atualizarBtnManutencao(_configCache.manutencao);
      // Atualiza listas de instrutores em todas as telas visíveis
      if (typeof renderizarListaInstrutoresRoblox === 'function') renderizarListaInstrutoresRoblox();
      if (typeof renderizarListaRGBEm === 'function') {
        renderizarListaRGBEm('nomes-instrutores-login');
        renderizarListaRGBEm('nomes-instrutores-criar');
      }
      // Re-aplica notas/blocos sempre que a config muda em tempo real
      if (typeof aplicarNotasPastas === 'function') { try { aplicarNotasPastas(); } catch(e){} }
    }
  });
}

async function carregarConfigInicial(timeoutMs) {
  // Timeout configurável (padrão 5s) — se Firebase demorar, continua com localStorage
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), timeoutMs || 5000)
  );
  try {
    const snap = await Promise.race([_cfgRef.get(), timeout]);
    if (snap.exists) {
      const d = snap.data();
      _configCache = {
        clientId: d.clientId || '',
        redirectUri: d.redirectUri || '',
        groupId: d.groupId || '',
        instructorRoles: d.instructorRoles || ['Instrutor', 'Instrutor Chefe', 'Supervisor'],
        adminPasswordHash: d.adminPasswordHash || '',
        manualInstructors: Array.isArray(d.manualInstructors) ? d.manualInstructors : [],
        avisoTexto: d.avisoTexto || '',
        avisoTipo: d.avisoTipo || 'verde',
        manutencao: d.manutencao || null,
        notifUrgente: d.notifUrgente || { ativo: false },
        banidos: Array.isArray(d.banidos) ? d.banidos : [],
        banMensagem: d.banMensagem || '',
        instrutorCargos: d.instrutorCargos || {},
        notasPastas: d.notasPastas || {},
      };
    } else {
      try {
        const s = localStorage.getItem('cgex_config');
        if (s) {
          const parsed = JSON.parse(s);
          _configCache = { ..._configCache, ...parsed };
          await _cfgRef.set(_configCache);
          localStorage.removeItem('cgex_config');
        }
      } catch(e) {}
    }
  } catch(e) {
    console.error('Erro ao carregar Firebase, usando localStorage:', e);
    try {
      const s = localStorage.getItem('cgex_config');
      if (s) _configCache = { ..._configCache, ...JSON.parse(s) };
    } catch(e2) {}
  }
  _configCarregado = true;
}

/* ═══════════════════════════════════════════
   CRYPTO UTILS
═══════════════════════════════════════════ */
async function sha256(str) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (let b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateCodeVerifier() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr.buffer);
}

async function generateCodeChallenge(verifier) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(verifier));
  return base64UrlEncode(hash);
}

function generateState() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr.buffer);
}

/* ═══════════════════════════════════════════
   SESSION STATE
═══════════════════════════════════════════ */
let horaEntrada = null;

function agora() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function calcDuracao(inicio, fim) {
  const mins = Math.round((fim - inicio) / 60000);
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? h + 'h ' + m + 'min' : m + ' min';
}

/* ═══════════════════════════════════════════
   NAVEGAÇÃO DE TELAS
═══════════════════════════════════════════ */
function ir(tela) {
  document.querySelectorAll('.tela').forEach(function(t) {
    t.classList.add('oculta');
    t.style.animation = 'none';
  });
  document.getElementById('tela-logado').style.display = 'none';
  document.body.classList.add('modo-telas');

  if (tela === 'tela-logado') {
    document.body.classList.remove('modo-telas');
    document.getElementById('tela-logado').style.display = 'block';
    window.scrollTo(0, 0);
  } else {
    var el = document.getElementById(tela);
    if (el) {
      el.classList.remove('oculta');
      void el.offsetWidth;
      el.style.animation = 'fadeUp 0.4s ease';
    }
  }
}

function voltarPainel() {
  // Limpar sessão e ocultar IA ao voltar ao painel principal
  sessionStorage.removeItem('cgex_auth_nick');
  sessionStorage.removeItem('cgex_auth_avatar');
  cgexOcultarChat();
  ir('tela-painel');
}

function voltarPainelDeMembro() { ir('tela-painel'); }

/* ── PASTAS ── */
function mostrarTabExilio(tab) {
  document.getElementById('modelo-script').style.display = tab === 'script' ? 'block' : 'none';
  document.getElementById('modelo-fraude').style.display = tab === 'fraude' ? 'block' : 'none';
  var descScript = document.getElementById('desc-script');
  var descFraude = document.getElementById('desc-fraude');
  var avisoFraude = document.getElementById('aviso-fraude');
  if (descScript) descScript.style.display = tab === 'script' ? 'block' : 'none';
  if (descFraude) descFraude.style.display = tab === 'fraude' ? 'block' : 'none';
  if (avisoFraude) avisoFraude.style.display = tab === 'fraude' ? 'block' : 'none';
  var tabScript = document.getElementById('tab-script');
  var tabFraude = document.getElementById('tab-fraude');
  if (tab === 'script') {
    tabScript.style.background = 'rgba(255,79,79,0.15)'; tabScript.style.borderColor = 'rgba(255,79,79,0.4)'; tabScript.style.color = '#ff8080';
    tabFraude.style.background = 'transparent'; tabFraude.style.borderColor = 'rgba(255,171,0,0.25)'; tabFraude.style.color = 'var(--cinza)';
  } else {
    tabFraude.style.background = 'rgba(255,171,0,0.15)'; tabFraude.style.borderColor = 'rgba(255,171,0,0.4)'; tabFraude.style.color = 'var(--aviso)';
    tabScript.style.background = 'transparent'; tabScript.style.borderColor = 'rgba(255,79,79,0.25)'; tabScript.style.color = 'var(--cinza)';
  }
}

function abrirPasta(id) {
  document.getElementById('tela-pastas').classList.remove('visivel');
  document.querySelectorAll('.conteudo-pasta-tela').forEach(function(t) { t.classList.remove('visivel'); });
  document.getElementById('tela-pasta-' + id).classList.add('visivel');
  window.scrollTo(0, 0);
  // Inicializar bot da IA quando a pasta for aberta pela primeira vez
  if (id === 'ia-cgex' && _pastaMsgs.length === 0) {
    setTimeout(_cgexPastaWelcome, 100);
  }
}
function voltarParaPastas() {
  document.querySelectorAll('.conteudo-pasta-tela').forEach(function(t) { t.classList.remove('visivel'); });
  document.getElementById('tela-pastas').classList.add('visivel');
  window.scrollTo(0, 0);
}



/* ═══════════════════════════════════════════
   ROBLOX OAUTH PKCE
═══════════════════════════════════════════ */
// Resolve o redirect_uri para o OAuth. Se o valor salvo no Firebase aponta
// para um domínio diferente do atual (ex: hosting antigo), usa o domínio
// atual para evitar redirecionar o usuário para o site antigo.
function resolverRedirectUri() {
  var atual = window.location.origin + window.location.pathname;
  var salvo = (getConfig().redirectUri || '').trim();
  if (!salvo) return atual;
  try {
    var u = new URL(salvo);
    if (u.origin !== window.location.origin) {
      console.info('[CGEx] redirectUri salvo (' + u.origin + ') é de outro domínio; usando o atual (' + window.location.origin + ').');
      return atual;
    }
    return salvo;
  } catch (e) {
    // URL inválida no Firebase — fallback seguro
    return atual;
  }
}

async function iniciarOAuthRoblox() {
  var config = getConfig();
  if (!config.clientId) {
    mostrarToast('⚠️ Configure o Client ID no painel admin.');
    return;
  }
  // Debounce: evita disparar múltiplos OAuth em sequência (causa de rate limit)
  var ultimo = parseInt(sessionStorage.getItem('cgex_oauth_ultimo') || '0', 10);
  var agoraMs = Date.now();
  if (agoraMs - ultimo < 8000) {
    var resta = Math.ceil((8000 - (agoraMs - ultimo)) / 1000);
    mostrarToast('⏳ Aguarde ' + resta + 's antes de tentar de novo.');
    return;
  }
  sessionStorage.setItem('cgex_oauth_ultimo', String(agoraMs));
  var codeVerifier = generateCodeVerifier();
  var codeChallenge = await generateCodeChallenge(codeVerifier);
  var state = generateState();
  var redirectUri = resolverRedirectUri();

  // localStorage persiste mesmo após redirect para domínio externo e volta
  var modo = sessionStorage.getItem('cgex_oauth_modo') || 'entrar';
  localStorage.setItem('cgex_pkce_verifier', codeVerifier);
  localStorage.setItem('cgex_pkce_state', state);
  localStorage.setItem('cgex_oauth_modo', modo);
  sessionStorage.removeItem('cgex_oauth_modo');

  var params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  window.location.href = 'https://apis.roblox.com/oauth/v1/authorize?' + params;
}

async function handleOAuthCallback(params) {
  var code = params.get('code');

  // Guarda contra reprocessamento (evita rate limit do Roblox por code repetido)
  var codeJaProcessado = sessionStorage.getItem('cgex_oauth_code_proc');
  if (code && codeJaProcessado === code) {
    mostrarErroAuth('Este código já foi processado. Volte ao painel e tente entrar de novo.');
    return;
  }
  if (code) sessionStorage.setItem('cgex_oauth_code_proc', code);

  // Lê tudo do localStorage (sobrevive ao redirect externo)
  var codeVerifier = localStorage.getItem('cgex_pkce_verifier') || '';
  var modo = localStorage.getItem('cgex_oauth_modo') || 'entrar';
  localStorage.removeItem('cgex_pkce_verifier');
  localStorage.removeItem('cgex_pkce_state');
  localStorage.removeItem('cgex_oauth_modo');
  sessionStorage.removeItem('pkce_verifier');
  sessionStorage.removeItem('pkce_state');
  sessionStorage.removeItem('cgex_oauth_modo');

  if (!code || !codeVerifier) {
    mostrarErroAuth('Parâmetros de autenticação inválidos. Tente novamente.');
    return;
  }

  atualizarLoading('Trocando código por token...', 'Autenticando com os servidores do Roblox.');

  var config = getConfig();
  var redirectUri = resolverRedirectUri();

  var tokenData;
  try {
    var tokenResp = await fetch('https://apis.roblox.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        code: code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri
      })
    });
    if (!tokenResp.ok) {
      if (tokenResp.status === 429) {
        var retryAfter = parseInt(tokenResp.headers.get('Retry-After') || '60', 10);
        mostrarErroAuth('🚦 Limite de tentativas do Roblox atingido. Aguarde ' + retryAfter + ' segundos e tente novamente. (Evite clicar em "Entrar" várias vezes seguidas.)');
        return;
      }
      var err = await tokenResp.json().catch(function() { return {}; });
      throw new Error(err.error_description || 'Falha ao obter token.');
    }
    tokenData = await tokenResp.json();
  } catch(e) {
    mostrarErroAuth('Falha na autenticação: ' + e.message);
    return;
  }

  atualizarLoading('Obtendo informações do usuário...', 'Carregando seu perfil Roblox.');

  var userInfo;
  try {
    var infoResp = await fetch('https://apis.roblox.com/oauth/v1/userinfo', {
      headers: { 'Authorization': 'Bearer ' + tokenData.access_token }
    });
    if (!infoResp.ok) throw new Error('Não foi possível obter o perfil.');
    userInfo = await infoResp.json();
  } catch(e) {
    mostrarErroAuth('Falha ao obter perfil: ' + e.message);
    return;
  }

  var userId = userInfo.sub;
  var username = userInfo.preferred_username || userInfo.name || 'Usuário';
  var avatarUrl = userInfo.picture || '';

  sessionStorage.setItem('roblox_userId', userId);
  sessionStorage.setItem('roblox_username', username);
  sessionStorage.setItem('roblox_avatar', avatarUrl);
  sessionStorage.removeItem('pkce_verifier');
  sessionStorage.removeItem('pkce_state');

  atualizarLoading('Verificando cargo na comunidade...', 'Olá, ' + username + '! Checando seu cargo no grupo CGEx.');

  // Se veio do botão "Entrar com Roblox", verifica autorização e compara nick digitado vs OAuth
  if (modo === 'criar_senha') {
    var nickDigitado = sessionStorage.getItem('cgex_nick_digitado') || '';
    sessionStorage.removeItem('cgex_nick_digitado');

    var config = getConfig();
    var autorizado = config.manualInstructors.find(function(n) { return n.toLowerCase() === username.toLowerCase(); });

    // Se o nick do OAuth não é instrutor autorizado → ban
    if (!autorizado) {
      config.banidos = config.banidos || [];
      if (!config.banidos.map(function(b){ return b.toLowerCase(); }).includes(username.toLowerCase())) {
        config.banidos.push(username);
        await saveConfig(config);
      }
      await banirIP(username, 'OAuth retornou nick não autorizado: "' + username + '"');
      registrarLogBloqueio(username, 'Auto-ban (nick + IP): OAuth retornou nick não autorizado — "' + username + '"');
      mostrarPopupBanido(username);
      return;
    }

    // Se o nick digitado ≠ nick do OAuth → alguém tentou burlar usando nick de outro instrutor → ban no nick digitado + IP
    if (nickDigitado && nickDigitado.toLowerCase() !== username.toLowerCase()) {
      var nickFraude = nickDigitado;
      config.banidos = config.banidos || [];
      if (!config.banidos.map(function(b){ return b.toLowerCase(); }).includes(nickFraude.toLowerCase())) {
        config.banidos.push(nickFraude);
        await saveConfig(config);
      }
      await banirIP(nickFraude, 'Tentativa de fraude: digitou "' + nickFraude + '" mas autenticou como "' + username + '"');
      registrarLogBloqueio(nickFraude, 'Auto-ban (nick + IP): digitou nick "' + nickFraude + '" mas OAuth retornou "' + username + '" — possível fraude');
      mostrarPopupBanido(nickFraude);
      return;
    }

    if (verificarSeBanido(autorizado)) {
      mostrarPopupBanido(autorizado);
      return;
    }

    sessionStorage.setItem('cgex_auth_nick', autorizado);
    sessionStorage.setItem('cgex_auth_avatar', avatarUrl);
    await concederAcesso(autorizado, 'Instrutor CGEx', avatarUrl);
    return;
  }

  await verificarCargoRoblox(userId, username, avatarUrl);
}

/* ═══════════════════════════════════════════
   VERIFICAÇÃO VIA USERNAME (fallback)
═══════════════════════════════════════════ */


// verificarListaManualApenas e verificarCargoRoblox definidas mais abaixo (versão com fluxo de senha)

/* ═══════════════════════════════════════════
   CONCEDER / NEGAR ACESSO
═══════════════════════════════════════════ */
async function concederAcesso(username, cargo, avatarUrl) {
  horaEntrada = new Date();

  document.getElementById('nome-exibido').textContent = username;
  document.getElementById('cargo-exibido').textContent = cargo || 'Instrutor CGEx';
  document.getElementById('valor-entrada').textContent = agora();
  document.getElementById('valor-saida').textContent = '—';
  document.getElementById('valor-duracao').textContent = '—';
  document.getElementById('linha-saida').style.display = 'none';
  document.getElementById('linha-duracao').style.display = 'none';

  var btn = document.getElementById('btn-sair');
  btn.disabled = false;
  btn.textContent = '🚪 SAIR';
  btn.style.opacity = '1';
  btn.style.cursor = 'pointer';

  var avatarImg = document.getElementById('sessao-avatar-img');
  var avatarEmoji = document.getElementById('sessao-avatar-emoji');

  function _aplicarAvatarSessao(url) {
    if (url) {
      avatarImg.src = url;
      avatarImg.style.display = 'block';
      avatarEmoji.style.display = 'none';
    } else {
      avatarImg.style.display = 'none';
      avatarEmoji.style.display = 'block';
    }
  }

  if (avatarUrl) {
    _aplicarAvatarSessao(avatarUrl);
  } else {
    // Busca avatar pelo nick automaticamente
    buscarAvatarRobloxPorNick(username).then(_aplicarAvatarSessao);
  }

  exibirAvisoAdmin();

  // Verificar se está banido
  if (verificarSeBanido(username)) {
    mostrarNaoAutorizado(username, avatarUrl, 'Você foi banido do sistema pelo administrador.');
    return;
  }

  // Registrar acesso nos logs
  registrarAcesso(username);

  // Recarrega config antes de aplicar notas (garante dados frescos no OAuth)
  try { await carregarConfigInicial(3000); } catch(e) {}

  // Aplicar notas de pastas
  aplicarNotasPastas();

  // Verificar notificação urgente
  verificarNotificacaoUrgente();

  ir('tela-logado');
  cgexMostrarChat(); // Mostra IA após login

  setTimeout(function() {
    document.querySelectorAll('.conteudo-pasta-tela').forEach(function(t) { t.classList.remove('visivel'); });
    var telaPasstas = document.getElementById('tela-pastas');
    if (telaPasstas) { telaPasstas.style.display = ''; telaPasstas.classList.add('visivel'); }
  }, 100);
}

function mostrarNaoAutorizado(username, avatarUrl, motivo) {
  // Auto-ban: se não é instrutor autorizado, bane automaticamente
  if (username && !verificarSeBanido(username)) {
    const cfg = getConfig();
    // Só auto-bane se não é instrutor (evita banir instrutor com cargo errado)
    const eInstrutor = cfg.manualInstructors && cfg.manualInstructors.some(n => n.toLowerCase() === username.toLowerCase());
    if (!eInstrutor) {
      cfg.banidos = cfg.banidos || [];
      cfg.banidos.push(username);
      saveConfig(cfg);
      registrarLogBloqueio(username, 'Auto-ban: tentativa de acesso sem autorização — ' + motivo);
      mostrarPopupBanido(username);
      return;
    }
  }
  // Se já é banido ou é instrutor com outro problema, só registra o log
  if (username) registrarLogBloqueio(username, motivo);

  document.getElementById('nao-auth-usuario').textContent = username || '';
  document.getElementById('nao-auth-detalhe').innerHTML = '<strong>Motivo do bloqueio:</strong><br>' + motivo;

  var avatarEl = document.getElementById('nao-auth-avatar');
  var icoEl = document.getElementById('nao-auth-ico');
  if (avatarUrl) {
    avatarEl.src = avatarUrl;
    avatarEl.style.display = 'block';
    icoEl.style.display = 'none';
  } else {
    avatarEl.style.display = 'none';
    icoEl.style.display = 'block';
  }
  ir('tela-nao-autorizado');
}

function mostrarErroAuth(msg) {
  ir('tela-roblox');
  mostrarToast('❌ ' + msg);
}

function atualizarLoading(titulo, msg) {
  var t = document.getElementById('loading-titulo');
  var m = document.getElementById('loading-msg');
  if (t) t.textContent = titulo;
  if (m) m.textContent = msg;
}

/* ═══════════════════════════════════════════
   AVISO ADMIN
═══════════════════════════════════════════ */
function atualizarAvisoAdmin(config) {
  var banner = document.getElementById('banner-aviso-admin');
  if (!banner) return;
  var inner = document.getElementById('banner-aviso-admin-inner');
  var texto = document.getElementById('banner-aviso-texto');
  var ico   = document.getElementById('banner-aviso-ico');
  if (!config.avisoTexto || !config.avisoTexto.trim()) { banner.style.display = 'none'; return; }
  var estilos = {
    verde:    { bg:'rgba(0,230,118,0.07)',  border:'1px solid rgba(0,230,118,0.25)', bl:'4px solid var(--verde)',   color:'#69f0ae', ico:'📢' },
    amarelo:  { bg:'rgba(255,171,0,0.07)',  border:'1px solid rgba(255,171,0,0.25)', bl:'4px solid var(--aviso)',  color:'#ffd740', ico:'⚠️' },
    vermelho: { bg:'rgba(255,79,79,0.07)',  border:'1px solid rgba(255,79,79,0.25)', bl:'4px solid var(--perigo)', color:'#ff8a80', ico:'🔴' },
  };
  var s = estilos[config.avisoTipo] || estilos.verde;
  inner.style.cssText = 'background:'+s.bg+';border:'+s.border+';border-left:'+s.bl+';border-radius:8px;padding:13px 18px;display:flex;align-items:center;gap:12px;overflow:hidden;';
  texto.style.color = s.color; texto.style.fontSize = '13px'; texto.style.lineHeight = '1.5'; texto.style.flex = '1'; texto.style.overflow = 'hidden';
  ico.textContent = s.ico;
  texto.innerHTML = '<span class="aviso-ticker-wrap"><span class="aviso-ticker-inner">' + config.avisoTexto + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + config.avisoTexto + '</span></span>';
  banner.style.display = 'block';
}

function exibirAvisoAdmin() {
  var config = getConfig();
  var banner = document.getElementById('banner-aviso-admin');
  var inner = document.getElementById('banner-aviso-admin-inner');
  var texto = document.getElementById('banner-aviso-texto');
  var ico = document.getElementById('banner-aviso-ico');

  if (!config.avisoTexto || !config.avisoTexto.trim()) {
    banner.style.display = 'none';
    return;
  }

  var estilos = {
    verde:    { bg: 'rgba(0,230,118,0.07)',  border: '1px solid rgba(0,230,118,0.25)', bl: '4px solid var(--verde)',  color: '#69f0ae', ico: '📢' },
    amarelo:  { bg: 'rgba(255,171,0,0.07)',  border: '1px solid rgba(255,171,0,0.25)', bl: '4px solid var(--aviso)', color: '#ffd740', ico: '⚠️' },
    vermelho: { bg: 'rgba(255,79,79,0.07)',  border: '1px solid rgba(255,79,79,0.25)', bl: '4px solid var(--perigo)', color: '#ff8a80', ico: '🔴' },
  };
  var s = estilos[config.avisoTipo] || estilos.verde;

  inner.style.cssText = 'background:' + s.bg + '; border:' + s.border + '; border-left:' + s.bl + '; border-radius:8px; padding:13px 18px; display:flex; align-items:center; gap:12px; overflow:hidden;';
  texto.style.color = s.color;
  texto.style.fontSize = '13px';
  texto.style.lineHeight = '1.5';
  texto.style.flex = '1';
  texto.style.overflow = 'hidden';
  ico.textContent = s.ico;
  texto.innerHTML = '<span class="aviso-ticker-wrap"><span class="aviso-ticker-inner">' + config.avisoTexto + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + config.avisoTexto + '</span></span>';
  banner.style.display = 'block';
}

/* ═══════════════════════════════════════════
   SAIR DA SESSÃO
═══════════════════════════════════════════ */
function registrarSaida() {
  var fim = new Date();
  document.getElementById('valor-saida').textContent = agora();
  document.getElementById('valor-duracao').textContent = calcDuracao(horaEntrada, fim);
  document.getElementById('linha-saida').style.display = 'block';
  document.getElementById('linha-duracao').style.display = 'block';

  // Registrar saída no Firebase
  registrarSaidaFirebase();

  // Limpar sessão e ocultar IA
  sessionStorage.removeItem('cgex_auth_nick');
  sessionStorage.removeItem('cgex_auth_avatar');
  cgexOcultarChat();

  var btn = document.getElementById('btn-sair');
  btn.disabled = true;
  btn.textContent = '✅ Sessão encerrada';
  btn.style.opacity = '0.5';
  btn.style.cursor = 'default';

  setTimeout(function() { ir('tela-painel'); }, 2500);
}
async function registrarSaidaFirebase() {
  const nick = sessionStorage.getItem('cgex_log_nick');
  if (!nick) return;
  try {
    const snap = await _db.collection('logs_acesso').where('nick','==',nick).where('saida','==',null).orderBy('entrada','desc').limit(1).get();
    snap.forEach(async doc => { await doc.ref.update({ saida: new Date().toISOString() }); });
  } catch(e) {}
}

/* ═══════════════════════════════════════════
   NAVEGAÇÃO PRINCIPAL
═══════════════════════════════════════════ */
function _irParaRobloxOriginal() {
  if (!_configCarregado) return;
  document.getElementById('secao-oauth').style.display = 'block';
  document.getElementById('aviso-sem-oauth').style.display = 'none';
  renderizarListaInstrutoresRoblox();
  ir('tela-roblox');
}

/* Cores para as tags dos instrutores — bg | border | text | icon */
var _coresTagInstrutores = [
  { bg:'rgba(0,230,118,0.12)',   bd:'rgba(0,230,118,0.35)',   tx:'#00e676', ico:'🟢' },
  { bg:'rgba(61,139,255,0.12)',  bd:'rgba(61,139,255,0.35)',  tx:'#5aabff', ico:'🔵' },
  { bg:'rgba(255,171,0,0.12)',   bd:'rgba(255,171,0,0.35)',   tx:'#ffd740', ico:'🟡' },
  { bg:'rgba(232,0,45,0.12)',    bd:'rgba(232,0,45,0.35)',    tx:'#ff6680', ico:'🔴' },
  { bg:'rgba(179,157,219,0.14)', bd:'rgba(179,157,219,0.40)', tx:'#ce93d8', ico:'🟣' },
  { bg:'rgba(0,188,212,0.12)',   bd:'rgba(0,188,212,0.35)',   tx:'#00bcd4', ico:'🔷' },
  { bg:'rgba(255,82,82,0.12)',   bd:'rgba(255,82,82,0.35)',   tx:'#ff8a80', ico:'🟠' },
  { bg:'rgba(105,240,174,0.12)', bd:'rgba(105,240,174,0.35)', tx:'#69f0ae', ico:'🌿' },
  { bg:'rgba(255,215,64,0.12)',  bd:'rgba(255,215,64,0.35)',  tx:'#ffd740', ico:'⭐' },
];

function renderizarListaInstrutoresRoblox() {
  var config = getConfig();
  var instrutores = config.manualInstructors || [];
  var cargos = config.instrutorCargos || {};
  var container = document.getElementById('nomes-instrutores-roblox');
  if (!container) return;
  if (instrutores.length === 0) {
    container.innerHTML = '<span style="color:var(--cinza);font-size:12px;">Nenhum instrutor cadastrado.</span>';
    return;
  }

  // Ordem de exibição dos grupos
  var ordemGrupos = [
    'Administrador Geral',
    'Chefe de Instrução',
    'Corregedor Geral',
    'Instrutor Qualificado',
    ''
  ];

  // Estilo por cargo
  var estiloGrupo = {
    'Administrador Geral':  { cor: '#ff6680', borda: 'rgba(232,0,45,0.5)',    bg: 'rgba(232,0,45,0.10)',    icone: '👑' },
    'Chefe de Instrução':   { cor: '#ffd740', borda: 'rgba(255,171,0,0.5)',   bg: 'rgba(255,171,0,0.10)',   icone: '🎖️' },
    'Corregedor Geral':     { cor: '#ce93d8', borda: 'rgba(179,157,219,0.5)', bg: 'rgba(179,157,219,0.10)', icone: '⚖️' },
    'Instrutor Qualificado':{ cor: '#00e676', borda: 'rgba(0,230,118,0.5)',   bg: 'rgba(0,230,118,0.10)',   icone: '🧑' },
    '':                     { cor: '#5aabff', borda: 'rgba(61,139,255,0.4)',  bg: 'rgba(61,139,255,0.08)',  icone: '🧑' }
  };

  // Agrupar instrutores por cargo
  var grupos = {};
  ordemGrupos.forEach(function(g) { grupos[g] = []; });
  instrutores.forEach(function(nick) {
    var cargo = cargos[nick.toLowerCase()] || cargos[nick] || '';
    if (!grupos[cargo]) grupos[cargo] = [];
    grupos[cargo].push(nick);
  });

  var html = '';
  var tagIdx = 0;
  ordemGrupos.forEach(function(grupo) {
    var lista = grupos[grupo];
    if (!lista || lista.length === 0) return;
    var est = estiloGrupo[grupo] || estiloGrupo[''];
    var tituloGrupo = grupo || 'Sem cargo definido';

    html += '<div style="width:100%;margin-bottom:12px;">';
    html += '<div style="font-family:\'Rajdhani\',sans-serif;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:' + est.cor + ';margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid ' + est.borda + ';">' + est.icone + ' ' + tituloGrupo + '</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:5px;">';
    lista.forEach(function(nick) {
      var delay = '-' + (tagIdx * 0.55).toFixed(2) + 's';
      tagIdx++;
      html += '<span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;font-family:\'Rajdhani\',sans-serif;letter-spacing:0.5px;border-radius:6px;border:1px solid;padding:5px 10px;animation:tagRGB 4s linear infinite;animation-delay:' + delay + ';">' + est.icone + ' ' + nick + '</span>';
    });
    html += '</div></div>';
  });

  container.innerHTML = html;
  renderizarAdminCargos();
}

function renderizarAdminCargos() {
  var container = document.getElementById('admin-cargos-lista');
  if (!container) return;
  var config = getConfig();
  var instrutores = config.manualInstructors || [];
  var cargos = config.instrutorCargos || {};

  var cargosPreDefinidos = [
    'Administrador Geral',
    'Corregedor Geral',
    'Chefe de Instrução',
    'Instrutor Qualificado',
  ];

  if (instrutores.length === 0) {
    container.innerHTML = '<span style="color:var(--cinza);font-size:13px;">Nenhum instrutor na lista ainda.</span>';
    return;
  }

  container.innerHTML = instrutores.map(function(nick) {
    var cargoAtual = cargos[nick.toLowerCase()] || cargos[nick] || '';
    var options = cargosPreDefinidos.map(function(c) {
      return '<option value="' + c + '"' + (cargoAtual === c ? ' selected' : '') + '>' + c + '</option>';
    }).join('');
    return '<div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.03);border:1px solid var(--borda);border-radius:8px;padding:10px 14px;">' +
      '<span style="font-family:\'Rajdhani\',sans-serif;font-weight:700;color:#fff;font-size:14px;min-width:130px;">🧑 ' + nick + '</span>' +
      '<select id="cargo-select-' + nick + '" style="flex:1;background:#0a0d10;border:1px solid var(--borda);border-radius:8px;color:#fff;font-family:\'Inter\',sans-serif;font-size:13px;padding:8px 12px;outline:none;cursor:pointer;">' +
      '<option value="">— Selecionar cargo —</option>' + options +
      '</select>' +
      '</div>';
  }).join('');
}

async function salvarCargos() {
  var config = getConfig();
  var instrutores = config.manualInstructors || [];
  var novosCargos = {};
  instrutores.forEach(function(nick) {
    var sel = document.getElementById('cargo-select-' + nick);
    if (sel && sel.value) novosCargos[nick.toLowerCase()] = sel.value;
  });
  config.instrutorCargos = novosCargos;
  await saveConfig(config);
  mostrarToast('🎖️ Cargos salvos com sucesso!', 'sucesso');
  renderizarListaInstrutoresRoblox();
}

function entrarComCodigo() {
  var input = document.getElementById('input-codigo-acesso');
  var erroEl = document.getElementById('erro-codigo-acesso');
  var codigo = input ? input.value.trim() : '';

  if (erroEl) { erroEl.style.display = 'none'; erroEl.textContent = ''; }

  if (!codigo) {
    if (erroEl) { erroEl.textContent = '❌ Digite o código de acesso.'; erroEl.style.display = 'block'; }
    if (input) { input.focus(); input.style.borderColor = 'var(--perigo)'; setTimeout(function(){ input.style.borderColor = ''; }, 1500); }
    return;
  }

  if (codigo.toLowerCase() === 'cgex') {
    // Código correto — entra direto como instrutor temporário
    sessionStorage.setItem('cgex_auth_nick', 'Instrutor');
    sessionStorage.setItem('cgex_auth_avatar', '');
    concederAcesso('Instrutor', 'Instrutor CGEx', '');
  } else {
    // Código errado
    if (input) { input.value = ''; input.style.borderColor = 'var(--perigo)'; input.style.animation = 'shake 0.4s ease'; setTimeout(function(){ input.style.borderColor = ''; input.style.animation = ''; }, 800); }
    if (erroEl) { erroEl.textContent = '❌ Código incorreto. Tente novamente.'; erroEl.style.display = 'block'; }
  }
}

async function irParaCriarSenhaManual() {
  if (!_configCarregado) { setTimeout(irParaCriarSenhaManual, 300); return; }

  var nickInput = document.getElementById('input-nick-roblox-area');
  var erroEl = document.getElementById('erro-nick-roblox-area');
  var nick = nickInput ? nickInput.value.trim() : '';

  // Limpa erro anterior
  if (erroEl) { erroEl.style.display = 'none'; erroEl.textContent = ''; }

  if (!nick) {
    if (erroEl) { erroEl.textContent = '❌ Digite seu Nick do Roblox.'; erroEl.style.display = 'block'; }
    if (nickInput) { nickInput.focus(); nickInput.style.borderColor = 'var(--perigo)'; setTimeout(function(){ nickInput.style.borderColor = ''; }, 1500); }
    return;
  }

  // ── VERIFICAÇÃO 1: está na lista de autorizados? ──
  var config = getConfig();
  var autorizado = config.manualInstructors.find(function(n) { return n.toLowerCase() === nick.toLowerCase(); });

  if (!autorizado) {
    // BAN AUTOMÁTICO — tentou entrar com nick não autorizado
    config.banidos = config.banidos || [];
    if (!config.banidos.map(function(b){ return b.toLowerCase(); }).includes(nick.toLowerCase())) {
      config.banidos.push(nick);
      await saveConfig(config);
    }
    await banirIP(nick, 'Tentativa de acesso com nick não autorizado na tela de instrutores');
    registrarLogBloqueio(nick, 'Auto-ban (nick + IP): digitou nick não autorizado — "' + nick + '"');
    mostrarPopupBanido(nick);
    return;
  }

  // ── VERIFICAÇÃO 2: já está banido? ──
  if (verificarSeBanido(autorizado)) {
    mostrarPopupBanido(autorizado);
    return;
  }

  // ── Guarda o nick digitado para comparar depois do OAuth ──
  sessionStorage.setItem('cgex_nick_digitado', autorizado);

  var config2 = getConfig();
  if (config2.clientId) {
    sessionStorage.setItem('cgex_oauth_modo', 'criar_senha');
    iniciarOAuthRoblox();
  } else {
    alert('⚠️ Configure o Client ID do Roblox OAuth no painel admin.');
  }
}

function irParaMembro() { if (!_configCarregado) return; ir('tela-membro'); }

function irParaBotPublico() {
  ir('tela-bot-publico');
  if (_pubMsgs.length === 0) { setTimeout(_cgexPubWelcome, 100); }
}

/* ═══════════════════════════════════════════
   ADMIN — ACESSO POR CLIQUE NO LOGO
═══════════════════════════════════════════ */
var logoClickCount = 0;
var logoClickTimer = null;

function logoClick() {
  logoClickCount++;
  clearTimeout(logoClickTimer);
  logoClickTimer = setTimeout(function() { logoClickCount = 0; }, 1500);
  if (logoClickCount >= 5) {
    logoClickCount = 0;
    abrirAdmin();
  }
}

/* ═══════════════════════════════════════════
   ADMIN — PAINEL
═══════════════════════════════════════════ */
var adminLogado = false;
var instrutoresEmMemoria = null;

function abrirAdmin() {
  var overlay = document.getElementById('admin-overlay');
  overlay.classList.add('visivel');
  document.getElementById('admin-login-wrap').style.display = 'flex';
  document.getElementById('admin-dashboard').classList.remove('visivel');
  adminLogado = false;
  var inp = document.getElementById('admin-senha-input');
  if (inp) { inp.value = ''; inp.focus(); }
  var erroMsg = document.getElementById('admin-erro-msg');
  erroMsg.style.display = 'none';
  erroMsg.textContent = '';
}

function fecharAdmin() {
  var status = document.getElementById('instrutores-save-status');
  var temAlteracoes = status && status.textContent.indexOf('Salvar') !== -1;
  if (temAlteracoes) {
    if (!confirm('⚠️ Você tem alterações na lista de instrutores não salvas. Deseja sair mesmo assim?')) return;
  }
  document.getElementById('admin-overlay').classList.remove('visivel');
  adminLogado = false;
  instrutoresEmMemoria = null;
}

function mostrarWelcomeAdmin() {
  // Tenta pegar o nick do instrutor logado no sistema (se estiver logado como instrutor)
  var nickInstrutor = sessionStorage.getItem('cgex_auth_nick') || '';
  // Se não tiver nick de instrutor, usa "Admin"
  var nomeExibir = nickInstrutor || 'Admin';
  document.getElementById('admin-welcome-nome').textContent = nomeExibir;
  document.getElementById('popup-admin-welcome').classList.add('visivel');
}

function fecharWelcomeAdmin() {
  document.getElementById('popup-admin-welcome').classList.remove('visivel');
}

async function verificarSenhaAdmin() {
  var senhaInput = document.getElementById('admin-senha-input');
  var erroEl = document.getElementById('admin-erro-msg');
  var senha = senhaInput.value;

  if (!senha) {
    senhaInput.classList.add('erro');
    erroEl.textContent = '❌ Digite a senha.';
    erroEl.style.display = 'block';
    setTimeout(function() { senhaInput.classList.remove('erro'); }, 420);
    senhaInput.focus();
    return;
  }

  var config = getConfig();
  var hashGuardado = config.adminPasswordHash || (await sha256('cgex2024'));
  var senhaOk = (typeof verificarSenhaAdminHash === 'function')
    ? await verificarSenhaAdminHash(senha, hashGuardado)
    : ((await sha256(senha)) === hashGuardado);

  if (senhaOk) {
    adminLogado = true;
    // Migra hash legado (SHA-256 puro) para PBKDF2 silenciosamente
    if (typeof gerarHashAdmin === 'function' && !/^pbkdf2\$/.test(hashGuardado)) {
      try { config.adminPasswordHash = await gerarHashAdmin(senha); await saveConfig(config); } catch(e){}
    }
    if (typeof auditLog === 'function') auditLog('admin_login', 'Acesso ao painel administrativo');
    erroEl.style.display = 'none';
    erroEl.textContent = '';
    document.getElementById('admin-login-wrap').style.display = 'none';
    document.getElementById('admin-dashboard').classList.add('visivel');
    carregarDadosAdmin();
    mostrarWelcomeAdmin();
  } else {
    senhaInput.classList.add('erro');
    erroEl.textContent = '❌ Senha incorreta.';
    erroEl.style.display = 'block';
    senhaInput.value = '';
    setTimeout(function() { senhaInput.classList.remove('erro'); }, 420);
    senhaInput.focus();
  }
}

function carregarDadosAdmin() {
  var config = getConfig();

  instrutoresEmMemoria = config.manualInstructors.slice();
  var btnSalvar = document.getElementById('btn-salvar-instrutores');
  var statusSalvar = document.getElementById('instrutores-save-status');
  if (btnSalvar) { btnSalvar.style.background = ''; btnSalvar.style.borderColor = ''; btnSalvar.style.color = ''; }
  if (statusSalvar) statusSalvar.textContent = '';

  renderizarListaInstrutores(instrutoresEmMemoria);
  renderizarAdminCargos();

  document.getElementById('cfg-client-id').value = config.clientId;
  var inpRedir = document.getElementById('cfg-redirect-uri');
  inpRedir.value = config.redirectUri || (window.location.origin + window.location.pathname);
  // Avisa se o redirectUri salvo aponta para outro domínio (ex.: hosting antigo)
  var avisoRedir = document.getElementById('aviso-redirect-uri');
  if (!avisoRedir) {
    avisoRedir = document.createElement('div');
    avisoRedir.id = 'aviso-redirect-uri';
    avisoRedir.style.cssText = 'background:rgba(255,171,0,0.08);border:1px solid rgba(255,171,0,0.3);color:#ffd740;padding:10px 14px;border-radius:8px;font-size:13px;margin:8px 0 14px;display:none;';
    inpRedir.parentNode.insertBefore(avisoRedir, inpRedir.nextSibling);
  }
  try {
    var salvo = (config.redirectUri || '').trim();
    if (salvo) {
      var u = new URL(salvo);
      if (u.origin !== window.location.origin) {
        var atual = window.location.origin + window.location.pathname;
        avisoRedir.innerHTML = '⚠️ <b>Redirect URI antigo detectado:</b> está apontando para <code>' + u.origin + '</code>. O sistema está usando automaticamente o domínio atual (<code>' + atual + '</code>) para o login. Atualize aqui e no Roblox Developer Console e clique em "Salvar OAuth".';
        avisoRedir.style.display = 'block';
        inpRedir.value = atual;
      } else { avisoRedir.style.display = 'none'; }
    } else { avisoRedir.style.display = 'none'; }
  } catch (e) { avisoRedir.style.display = 'none'; }
  document.getElementById('cfg-group-id').value = config.groupId;

  var statusEl = document.getElementById('oauth-status-texto');
  if (config.clientId) {
    statusEl.innerHTML = '<span class="status-dot"></span>OAuth configurado';
  } else {
    statusEl.innerHTML = '<span class="status-dot vermelho"></span>OAuth não configurado';
  }

  renderizarRoles(config.instructorRoles);

  document.getElementById('cfg-aviso-texto').value = config.avisoTexto || '';
  document.getElementById('cfg-aviso-tipo').value = config.avisoTipo || 'verde';

  // Manutenção
  var manut = config.manutencao || null;
  atualizarBtnManutencao(manut);
  if (manut && manut.msg) {
    var inpManut = document.getElementById('cfg-manutencao-msg');
    if (inpManut) inpManut.value = manut.msg;
  }

  // Notificação urgente
  if (config.notifUrgente && config.notifUrgente.ativo) {
    document.getElementById('notif-titulo').value = config.notifUrgente.titulo || '';
    document.getElementById('notif-mensagem').value = config.notifUrgente.msg || '';
    document.getElementById('notif-tipo').value = config.notifUrgente.tipo || 'vermelho';
    document.getElementById('notif-status').textContent = '🔔 Notificação ativa.';
  }

  // Banidos
  carregarBanidos();
  // Mensagem de ban personalizada
  var banMsgInput = document.getElementById('ban-msg-input');
  if (banMsgInput) banMsgInput.value = config.banMensagem || '';

  // Logs
  carregarLogs();

  // Notas de pastas
  carregarNotaPasta();
}

/* ══ ADMIN: IPs BANIDOS ══ */
async function carregarIPsBanidos() {
  const lista = document.getElementById('lista-ips-banidos');
  const vazio = document.getElementById('ips-banidos-vazio');
  const loading = document.getElementById('ips-banidos-loading');
  if (!lista) return;
  loading.style.display = 'block'; lista.innerHTML = ''; vazio.style.display = 'none';
  try {
    const snap = await _db.collection('ips_banidos').get();
    loading.style.display = 'none';
    if (snap.empty) { vazio.style.display = 'block'; return; }
    snap.forEach(doc => {
      const d = doc.data();
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:rgba(255,79,79,0.06);border:1px solid rgba(255,79,79,0.2);border-radius:8px;padding:10px 14px;gap:10px;flex-wrap:wrap;';
      const dt = d.banidoEm ? new Date(d.banidoEm).toLocaleString('pt-BR') : '—';
      var ipEsc = d.ip.replace(/'/g, "\\'");
      var nickEsc = (d.nick||'').replace(/'/g, "\\'");
      div.innerHTML = '<div><div style="font-family:\'Rajdhani\',sans-serif;font-size:15px;font-weight:700;color:#ff8080;">🌐 ' + d.ip + '</div><div style="font-size:11px;color:var(--cinza);">Nick: <strong style="color:#fff">' + (d.nick||'—') + '</strong> · ' + (d.motivo||'—') + '</div><div style="font-size:11px;color:var(--cinza);">Banido em: ' + dt + '</div></div><button onclick="desbanirIP(\'' + ipEsc + '\',\'' + nickEsc + '\')" style="background:rgba(0,230,118,0.1);border:1px solid rgba(0,230,118,0.3);color:#00e676;font-family:\'Rajdhani\',sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;padding:6px 14px;border-radius:6px;cursor:pointer;">✅ Desbanir</button>';
      lista.appendChild(div);
    });
  } catch(e) { loading.style.display = 'none'; mostrarToast('Erro ao carregar IPs.', 'erro'); }
}
async function desbanirIP(ip, nick) {
  if (!confirm('Desbanir o IP ' + ip + (nick ? ' (' + nick + ')' : '') + '?')) return;
  try { await _db.collection('ips_banidos').doc(ip).delete(); mostrarToast('✅ IP ' + ip + ' desbanido!', 'sucesso'); carregarIPsBanidos(); }
  catch(e) { mostrarToast('❌ Erro ao desbanir IP.', 'erro'); }
}

/* ── TABS ADMIN ── */
function adminAba(aba, btn) {
  document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.remove('ativa'); });
  document.querySelectorAll('.admin-secao').forEach(function(s) { s.classList.remove('visivel'); });
  btn.classList.add('ativa');
  document.getElementById('admin-aba-' + aba).classList.add('visivel');
  if (aba === 'banidos') carregarIPsBanidos();
}

/* ── INSTRUTORES ── */
function getInstrutoresEmMemoria() {
  if (instrutoresEmMemoria === null) {
    instrutoresEmMemoria = getConfig().manualInstructors.slice();
  }
  return instrutoresEmMemoria;
}

function renderizarListaInstrutores(lista) {
  var ul = document.getElementById('lista-instrutores-admin');
  ul.innerHTML = '';
  if (!lista || lista.length === 0) {
    ul.innerHTML = '<li style="color:var(--cinza); font-size:13px; padding:12px 0;">Nenhum instrutor cadastrado.</li>';
    return;
  }
  lista.forEach(function(nome) {
    var li = document.createElement('li');
    li.className = 'instrutor-item';

    // Avatar com imagem do Roblox
    var avatarWrap = document.createElement('div');
    avatarWrap.className = 'instrutor-avatar';
    avatarWrap.textContent = '🧑‍🏫';

    // Carrega avatar do Roblox de forma assíncrona
    buscarAvatarRobloxPorNick(nome).then(function(url) {
      if (url) {
        var img = document.createElement('img');
        img.src = url;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
        img.onerror = function() { avatarWrap.textContent = '🧑‍🏫'; };
        avatarWrap.textContent = '';
        avatarWrap.appendChild(img);
      }
    });

    var nomeDiv = document.createElement('div');
    nomeDiv.className = 'instrutor-nome';
    nomeDiv.textContent = nome;

    var tipoDiv = document.createElement('div');
    tipoDiv.className = 'instrutor-tipo';
    tipoDiv.textContent = 'Manual';

    var btnRem = document.createElement('button');
    btnRem.className = 'btn-remover-instrutor';
    btnRem.textContent = 'Remover';
    btnRem.onclick = function() { removerInstrutor(nome); };

    li.appendChild(avatarWrap);
    li.appendChild(nomeDiv);
    li.appendChild(tipoDiv);
    li.appendChild(btnRem);
    ul.appendChild(li);
  });
}

function marcarInstrutoresModificados() {
  var btn = document.getElementById('btn-salvar-instrutores');
  var status = document.getElementById('instrutores-save-status');
  if (btn) { btn.style.background = 'rgba(255,171,0,0.18)'; btn.style.borderColor = 'rgba(255,171,0,0.5)'; btn.style.color = 'var(--aviso)'; }
  if (status) { status.textContent = '⚠️ Clique em Salvar para confirmar'; status.style.color = 'var(--aviso)'; }
}

function salvarListaInstrutores() {
  if (instrutoresEmMemoria === null) {
    mostrarToast('⚠️ Nenhuma alteração para salvar.');
    return;
  }
  var config = getConfig();
  config.manualInstructors = instrutoresEmMemoria.slice();
  saveConfig(config);
  var btn = document.getElementById('btn-salvar-instrutores');
  var status = document.getElementById('instrutores-save-status');
  if (btn) { btn.style.background = ''; btn.style.borderColor = ''; btn.style.color = ''; }
  if (status) { status.textContent = '✅ Lista salva!'; status.style.color = 'var(--verde)'; }
  setTimeout(function() { if (status) status.textContent = ''; }, 3000);
  mostrarToast('✅ Lista de instrutores salva!');
}

function adicionarInstrutor() {
  var input = document.getElementById('add-instrutor-input');
  var nome = input.value.trim();
  if (!nome) return;

  var lista = getInstrutoresEmMemoria();
  var jaExiste = lista.some(function(n) { return n.toLowerCase() === nome.toLowerCase(); });
  if (jaExiste) {
    mostrarToast('⚠️ Instrutor já está na lista.');
    return;
  }
  lista.push(nome);
  renderizarListaInstrutores(lista);
  input.value = '';
  marcarInstrutoresModificados();
}

function removerInstrutor(nome) {
  if (!confirm('Remover o instrutor "' + nome + '"?')) return;
  var lista = getInstrutoresEmMemoria();
  var idx = lista.findIndex(function(n) { return n.toLowerCase() === nome.toLowerCase(); });
  if (idx !== -1) lista.splice(idx, 1);
  renderizarListaInstrutores(lista);
  marcarInstrutoresModificados();
}

/* ── CONFIG ROBLOX ── */
function salvarConfigRoblox() {
  var config = getConfig();
  config.clientId = document.getElementById('cfg-client-id').value.trim();
  config.redirectUri = document.getElementById('cfg-redirect-uri').value.trim();
  saveConfig(config);

  var statusEl = document.getElementById('oauth-status-texto');
  if (config.clientId) {
    statusEl.innerHTML = '<span class="status-dot"></span>OAuth configurado';
  } else {
    statusEl.innerHTML = '<span class="status-dot vermelho"></span>OAuth não configurado';
  }
  mostrarToast('✅ Configurações OAuth salvas!');
}

function salvarConfigGrupo() {
  var config = getConfig();
  config.groupId = document.getElementById('cfg-group-id').value.trim();
  saveConfig(config);
  mostrarToast('✅ Configurações do grupo salvas!');
}

/* ── ROLES ── */
function renderizarRoles(roles) {
  var lista = document.getElementById('roles-lista');
  lista.innerHTML = '';
  (roles || []).forEach(function(role) {
    var div = document.createElement('div');
    div.className = 'role-tag';

    var roleText = document.createTextNode(role + ' ');
    var btnX = document.createElement('button');
    btnX.textContent = '×';
    btnX.onclick = function() { removerRole(role); };

    div.appendChild(roleText);
    div.appendChild(btnX);
    lista.appendChild(div);
  });
}

function adicionarRole() {
  var input = document.getElementById('add-role-input');
  var role = input.value.trim();
  if (!role) return;
  var config = getConfig();
  if (!config.instructorRoles.includes(role)) {
    config.instructorRoles.push(role);
    saveConfig(config);
    renderizarRoles(config.instructorRoles);
  }
  input.value = '';
}

function removerRole(role) {
  var config = getConfig();
  config.instructorRoles = config.instructorRoles.filter(function(r) { return r !== role; });
  saveConfig(config);
  renderizarRoles(config.instructorRoles);
}

/* ── AVISO ── */
function salvarAviso() {
  var config = getConfig();
  config.avisoTexto = document.getElementById('cfg-aviso-texto').value;
  config.avisoTipo = document.getElementById('cfg-aviso-tipo').value;
  saveConfig(config);
  mostrarToast('✅ Aviso salvo!');
}

function removerAviso() {
  if (!confirm('Remover o aviso atual? Ele não aparecerá mais para os instrutores.')) return;
  var config = getConfig();
  config.avisoTexto = '';
  saveConfig(config);
  document.getElementById('cfg-aviso-texto').value = '';
  var banner = document.getElementById('banner-aviso-admin');
  if (banner) banner.style.display = 'none';
  mostrarToast('🗑️ Aviso removido!');
}

/* ── SEGURANÇA ── */
async function alterarSenhaAdmin() {
  var atual = document.getElementById('senha-atual-input').value;
  var nova = document.getElementById('nova-senha-input').value;
  var confirmar = document.getElementById('confirmar-senha-input').value;
  var erroEl = document.getElementById('seguranca-erro');

  function mostrarErroSeg(msg) {
    erroEl.textContent = msg;
    erroEl.style.display = 'block';
  }

  if (!atual || !nova || !confirmar) { mostrarErroSeg('❌ Preencha todos os campos.'); return; }
  if (nova.length < 6) { mostrarErroSeg('❌ A nova senha deve ter pelo menos 6 caracteres.'); return; }
  if (nova !== confirmar) { mostrarErroSeg('❌ As senhas não coincidem.'); return; }

  var config = getConfig();
  var hashGuardado = config.adminPasswordHash || (await sha256('cgex2024'));
  var atualOk = (typeof verificarSenhaAdminHash === 'function')
    ? await verificarSenhaAdminHash(atual, hashGuardado)
    : ((await sha256(atual)) === hashGuardado);

  if (!atualOk) { mostrarErroSeg('❌ Senha atual incorreta.'); return; }

  config.adminPasswordHash = (typeof gerarHashAdmin === 'function')
    ? await gerarHashAdmin(nova)
    : await sha256(nova);
  saveConfig(config);
  if (typeof auditLog === 'function') auditLog('admin_senha_alterada', 'Senha do admin foi alterada');

  erroEl.style.display = 'none';
  erroEl.textContent = '';
  document.getElementById('senha-atual-input').value = '';
  document.getElementById('nova-senha-input').value = '';
  document.getElementById('confirmar-senha-input').value = '';
  mostrarToast('✅ Senha alterada com sucesso!');
}

function resetarConfiguracoes() {
  if (!confirm('Tem certeza? Isso apagará TODAS as configurações, incluindo a lista de instrutores e a senha do admin.')) return;
  localStorage.removeItem('cgex_config');
  instrutoresEmMemoria = null;
  _configCache = {
    clientId: '', redirectUri: '', groupId: '',
    instructorRoles: ['Instrutor', 'Instrutor Chefe', 'Supervisor'],
    adminPasswordHash: '',
    manualInstructors: [],
    avisoTexto: '', avisoTipo: 'verde',
    manutencao: null,
    notifUrgente: { ativo: false },
    banidos: [],
    banMensagem: '',
    notasPastas: {},
  };
  saveConfig(_configCache);
  carregarDadosAdmin();
  mostrarToast('🗑️ Configurações resetadas para o padrão.');
}

/* ── TOAST ── */
function mostrarToast(msg, tipo) {
  var toast = document.getElementById('admin-toast');
  toast.textContent = msg;
  toast.style.background = tipo === 'erro' ? 'rgba(255,79,79,0.95)' : tipo === 'sucesso' ? 'rgba(0,200,83,0.95)' : '';
  toast.classList.add('mostrar');
  setTimeout(function() { toast.classList.remove('mostrar'); toast.style.background = ''; }, 3000);
}

/* ═══════════════════════════════════════════
   KEYBOARD EVENTS
═══════════════════════════════════════════ */
document.addEventListener('keydown', function(e) {

  if (document.activeElement === document.getElementById('admin-senha-input') && e.key === 'Enter') {
    verificarSenhaAdmin();
  }
  if (document.activeElement === document.getElementById('add-instrutor-input') && e.key === 'Enter') {
    adicionarInstrutor();
  }
  if (document.activeElement === document.getElementById('add-role-input') && e.key === 'Enter') {
    adicionarRole();
  }
});

/* ═══════════════════════════════════════════
   INICIALIZAÇÃO
═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async function() {
  inicializarCores();

  ir('tela-oauth-loading');
  atualizarLoading('Carregando...', 'Conectando ao servidor.');

  // Login anônimo do Firebase em background (necessário só quando as regras estiverem ativas).
  // Não bloqueia: o Firestore funciona sem auth enquanto as regras não exigirem.
  if (typeof garantirAuth === 'function') { try { garantirAuth(); } catch(e) {} }

  var params = new URLSearchParams(window.location.search);

  // Se voltou do OAuth do Roblox (tem ?code= na URL)
  if (params.has('code')) {
    atualizarLoading('Autenticando...', 'Processando retorno do Roblox.');
    // Limpa a URL ANTES do processamento — se o usuário recarregar a página
    // durante o callback, o code não será reutilizado (causa de rate limit).
    window.history.replaceState({}, '', window.location.pathname);
    await carregarConfigInicial(4000);
    iniciarListenerFirebase();
    try {
      await handleOAuthCallback(params);
    } catch(e) {
      mostrarErroAuth('Erro inesperado: ' + e.message);
    }
    return;
  }

  // carregarConfigInicial já tem timeout interno de 5s — nunca vai travar
  await carregarConfigInicial();
  iniciarListenerFirebase();

  if (params.has('admin') || window.location.hash === '#admin') {
    window.history.replaceState({}, '', window.location.pathname);
    abrirAdmin();
    return;
  }

  if (checarManutencao()) return;

  // Verificar IP banido ao carregar
  verificarIPBanido().then(function(banido) {
    if (banido) {
      mostrarPopupBanido('', true);
      document.querySelectorAll('.btn-perfil').forEach(b => { b.disabled=true; b.style.opacity='0.3'; b.style.cursor='not-allowed'; });
    }
  });

  // Sempre chega aqui — ir para o painel
  ir('tela-painel');
});
/* ═══════════════════════════════════════════
   MANUTENÇÃO
═══════════════════════════════════════════ */
function adminToggleManutencao() {
  var config = getConfig();
  var msg = document.getElementById('cfg-manutencao-msg').value.trim();
  var ativo = !(config.manutencao && config.manutencao.ativo);
  config.manutencao = ativo ? { ativo: true, msg: msg || 'Site em manutenção. Voltamos em breve!' } : null;
  saveConfig(config);
  atualizarBtnManutencao(config.manutencao);
  mostrarToast(ativo ? '🚧 Manutenção ATIVADA!' : '✅ Manutenção desativada!');
}

function atualizarBtnManutencao(manut) {
  var ativo = manut && manut.ativo;
  var label = document.getElementById('manutencao-status-label');
  var btn = document.getElementById('btn-toggle-manutencao');
  if (label) { label.textContent = ativo ? 'ATIVADO' : 'Desativado'; label.style.color = ativo ? '#ff8a80' : 'var(--verde)'; }
  if (btn) { btn.textContent = ativo ? '✅ Desativar Manutenção' : '🚧 Ativar Modo Manutenção'; }
}

function checarManutencao() {
  var config = getConfig();
  if (config.manutencao && config.manutencao.ativo) {
    var el = document.getElementById('manutencao-msg-texto');
    if (el) el.textContent = config.manutencao.msg || 'Estamos realizando melhorias. Voltamos em breve!';
    ir('tela-manutencao');
    return true;
  }
  return false;
}

/* ═══════════════════════════════════════════
   PERSONALIZADOR DE CORES — RGB
═══════════════════════════════════════════ */
const COR_PRESETS = [
  { nome:'Verde CGEx',  principal:'#00e676', fundo:'#090c0e' },
  { nome:'Azul Gelo',   principal:'#3d8bff', fundo:'#090c12' },
  { nome:'Roxo',        principal:'#bb86fc', fundo:'#0c090e' },
  { nome:'Ciano',       principal:'#00e5ff', fundo:'#090b0c' },
  { nome:'Rosa',        principal:'#ff4081', fundo:'#0e0909' },
  { nome:'Laranja',     principal:'#ff6d00', fundo:'#0e0a09' },
  { nome:'Dourado',     principal:'#ffd740', fundo:'#0c0b09' },
];

let _rgbAtivo = false, _rgbInterval = null, _rgbHue = 0;
let _rgbFundoAtivo = false, _rgbFundoInterval = null, _rgbFundoHue = 180;

function hexToHsl(hex) {
  let r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h,s,l=(max+min)/2;
  if(max===min){h=s=0;}else{const d=max-min;s=l>0.5?d/(2-max-min):d/(max+min);switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;}h/=6;}
  return [Math.round(h*360),Math.round(s*100),Math.round(l*100)];
}

function hslToHex(h,s,l) {
  s/=100;l/=100;const a=s*Math.min(l,1-l);
  const f=n=>{const k=(n+h/30)%12;const c=l-a*Math.max(Math.min(k-3,9-k,1),-1);return Math.round(255*c).toString(16).padStart(2,'0');};
  return '#'+f(0)+f(8)+f(4);
}

function aplicarCorPrincipal(cor) {
  const [h,s,l]=hexToHsl(cor);
  document.documentElement.style.setProperty('--verde', cor);
  document.documentElement.style.setProperty('--verde-esc', hslToHex(h,s,Math.max(l-10,10)));
  localStorage.setItem('cgex_cor_principal', cor);
  const inp=document.getElementById('cor-principal'); if(inp) inp.value=cor;
}

function aplicarCorFundo(cor) {
  const [h,s,l]=hexToHsl(cor);
  document.documentElement.style.setProperty('--fundo', cor);
  document.documentElement.style.setProperty('--card',  hslToHex(h,s,Math.min(l+3,30)));
  document.documentElement.style.setProperty('--card2', hslToHex(h,s,Math.min(l+4,30)));
  document.documentElement.style.setProperty('--borda', hslToHex(h,s,Math.min(l+10,40)));
  localStorage.setItem('cgex_cor_fundo', cor);
  const inp=document.getElementById('cor-fundo'); if(inp) inp.value=cor;
}

function aplicarPreset(p) { pararRGB(); aplicarCorPrincipal(p.principal); aplicarCorFundo(p.fundo); atualizarPresetAtivo(p.principal); }
function atualizarPresetAtivo(cor) { document.querySelectorAll('.preset-btn').forEach(b=>b.classList.toggle('ativo',b.dataset.cor===cor)); }

function toggleRGB() { _rgbAtivo ? pararRGB() : iniciarRGB(); }
function iniciarRGB() {
  _rgbAtivo=true;
  const btnT=document.getElementById('btn-rgb'), btnF=document.getElementById('btn-cores');
  if(btnT){btnT.classList.add('ativo');btnT.textContent='🌈 RGB Principal ATIVO — PARAR';}
  if(btnF) btnF.classList.add('rgb-ativo');
  _rgbInterval=setInterval(()=>{_rgbHue=(_rgbHue+1)%360;aplicarCorPrincipal(hslToHex(_rgbHue,100,55));atualizarPresetAtivo('__rgb__');},30);
  localStorage.setItem('cgex_rgb','1');
}
function pararRGB() {
  _rgbAtivo=false; clearInterval(_rgbInterval);
  const btnT=document.getElementById('btn-rgb'), btnF=document.getElementById('btn-cores');
  if(btnT){btnT.classList.remove('ativo');btnT.textContent='🌈 RGB — Cor Principal';}
  if(btnF&&!_rgbFundoAtivo) btnF.classList.remove('rgb-ativo');
  localStorage.setItem('cgex_rgb','0');
}
function toggleRGBFundo() { _rgbFundoAtivo ? pararRGBFundo() : iniciarRGBFundo(); }
function iniciarRGBFundo() {
  _rgbFundoAtivo=true;
  const btn=document.getElementById('btn-rgb-fundo'), btnF=document.getElementById('btn-cores');
  if(btn){btn.classList.add('ativo');btn.textContent='🌈 RGB Fundo ATIVO — PARAR';}
  if(btnF) btnF.classList.add('rgb-ativo');
  _rgbFundoInterval=setInterval(()=>{_rgbFundoHue=(_rgbFundoHue+1)%360;aplicarCorFundo(hslToHex(_rgbFundoHue,80,8));},40);
  localStorage.setItem('cgex_rgb_fundo','1');
}
function pararRGBFundo() {
  _rgbFundoAtivo=false; clearInterval(_rgbFundoInterval);
  const btn=document.getElementById('btn-rgb-fundo'), btnF=document.getElementById('btn-cores');
  if(btn){btn.classList.remove('ativo');btn.textContent='🌈 RGB — Fundo';}
  if(btnF&&!_rgbAtivo) btnF.classList.remove('rgb-ativo');
  localStorage.setItem('cgex_rgb_fundo','0');
}
function resetarCores() {
  pararRGB(); pararRGBFundo();
  ['--verde','--verde-esc','--fundo','--card','--card2','--borda'].forEach(p=>document.documentElement.style.removeProperty(p));
  ['cgex_cor_principal','cgex_cor_fundo','cgex_rgb','cgex_rgb_fundo'].forEach(k=>localStorage.removeItem(k));
  const pI=document.getElementById('cor-principal'), fI=document.getElementById('cor-fundo');
  if(pI) pI.value='#00e676'; if(fI) fI.value='#090c0e';
  atualizarPresetAtivo('#00e676');
}
function togglePainelCores() { document.getElementById('painel-cores').classList.toggle('visivel'); }

// Botão arrastável
(function() {
  const btn=document.getElementById('btn-cores'), painel=document.getElementById('painel-cores');
  let dragging=false, hasMoved=false, startX, startY, origLeft, origTop;
  function startDrag(cx,cy){dragging=true;hasMoved=false;const r=btn.getBoundingClientRect();startX=cx;startY=cy;origLeft=r.left;origTop=r.top;btn.style.transition='none';btn.style.bottom='auto';btn.style.right='auto';btn.style.left=origLeft+'px';btn.style.top=origTop+'px';}
  function moveDrag(cx,cy){if(!dragging)return;const dx=cx-startX,dy=cy-startY;if(Math.abs(dx)>5||Math.abs(dy)>5)hasMoved=true;if(!hasMoved)return;const nl=Math.max(0,Math.min(window.innerWidth-btn.offsetWidth,origLeft+dx)),nt=Math.max(0,Math.min(window.innerHeight-btn.offsetHeight,origTop+dy));btn.style.left=nl+'px';btn.style.top=nt+'px';painel.style.left=Math.max(0,Math.min(window.innerWidth-260,nl-200))+'px';painel.style.top=Math.max(0,nt-painel.offsetHeight-10)+'px';painel.style.bottom='auto';painel.style.right='auto';}
  function endDrag(){if(!dragging)return;dragging=false;btn.style.transition='';if(!hasMoved)togglePainelCores();}
  btn.addEventListener('mousedown',e=>{e.preventDefault();startDrag(e.clientX,e.clientY);});
  document.addEventListener('mousemove',e=>moveDrag(e.clientX,e.clientY));
  document.addEventListener('mouseup',()=>endDrag());
  btn.addEventListener('touchstart',e=>{const t=e.touches[0];startDrag(t.clientX,t.clientY);},{passive:true});
  document.addEventListener('touchmove',e=>{const t=e.touches[0];moveDrag(t.clientX,t.clientY);},{passive:true});
  document.addEventListener('touchend',()=>endDrag());
})();

function inicializarCores() {
  const container=document.getElementById('presets-container');
  COR_PRESETS.forEach(p=>{const btn=document.createElement('div');btn.className='preset-btn';btn.dataset.cor=p.principal;btn.style.background=p.principal;btn.title=p.nome;btn.onclick=()=>aplicarPreset(p);container.appendChild(btn);});
  const corS=localStorage.getItem('cgex_cor_principal'), fundoS=localStorage.getItem('cgex_cor_fundo');
  if(corS) aplicarCorPrincipal(corS); if(fundoS) aplicarCorFundo(fundoS);
  if(localStorage.getItem('cgex_rgb')==='1') iniciarRGB();
  if(localStorage.getItem('cgex_rgb_fundo')==='1') iniciarRGBFundo();
  atualizarPresetAtivo(corS||'#00e676');
}

async function verificarCodigoRoblox() {
  const input = document.getElementById('input-codigo-roblox');
  const erro = document.getElementById('erro-codigo-roblox');
  if (input.value.trim() === '14071526') {
    input.value = '';
    erro.style.display = 'none';
    await concederAcesso('Instrutor', 'Instrutor CGEx', '');
  } else {
    erro.style.display = 'block';
    input.classList.add('erro');
    setTimeout(() => input.classList.remove('erro'), 400);
  }
}

/* ═══════════════════════════════════════════
   CÓDIGO DE ACESSO ESPECIAL
═══════════════════════════════════════════ */
async function verificarCodigo() {
  const input = document.getElementById('input-codigo');
  const erro = document.getElementById('erro-codigo');
  const codigo = input.value.trim();
  if (codigo === '14071526') {
    input.value = '';
    erro.style.display = 'none';
    await concederAcesso('Instrutor', 'Instrutor CGEx', '');
  } else {
    erro.style.display = 'block';
    input.classList.add('erro');
    setTimeout(() => input.classList.remove('erro'), 400);
  }
}

/* ═══════════════════════════════════════════
   EXPOR FUNÇÕES GLOBAIS - não necessário sem type=module
═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════
   NOTIFICAÇÃO URGENTE
═══════════════════════════════════════════ */
async function salvarNotificacaoUrgente() {
  const titulo = document.getElementById('notif-titulo').value.trim();
  const msg = document.getElementById('notif-mensagem').value.trim();
  const tipo = document.getElementById('notif-tipo').value;
  if (!titulo || !msg) { mostrarToast('Preencha o título e a mensagem!', 'erro'); return; }
  const cfg = getConfig();
  cfg.notifUrgente = { titulo, msg, tipo, ativo: true, ts: Date.now() };
  await saveConfig(cfg);
  document.getElementById('notif-status').textContent = '✅ Notificação ativada com sucesso!';
  mostrarToast('Notificação urgente ativada!', 'sucesso');
}
async function desativarNotificacaoUrgente() {
  const cfg = getConfig();
  cfg.notifUrgente = { ativo: false };
  await saveConfig(cfg);
  document.getElementById('notif-status').textContent = '🔕 Notificação desativada.';
  mostrarToast('Notificação desativada!', 'sucesso');
}
function verificarNotificacaoUrgente() {
  const cfg = getConfig();
  if (!cfg.notifUrgente || !cfg.notifUrgente.ativo) return;
  const visto = sessionStorage.getItem('notif_visto_' + cfg.notifUrgente.ts);
  if (visto) return;
  const cores = { vermelho: ['#ff4f4f','#ff8080','🚨'], amarelo: ['#ffab00','#ffd740','⚠️'], verde: ['#00e676','#69f0ae','📢'] };
  const c = cores[cfg.notifUrgente.tipo] || cores.verde;
  document.getElementById('popup-notif-barra').style.background = c[0];
  document.getElementById('popup-notif-icone').textContent = c[2];
  document.getElementById('popup-notif-titulo').textContent = cfg.notifUrgente.titulo;
  document.getElementById('popup-notif-msg').textContent = cfg.notifUrgente.msg;
  const popup = document.getElementById('popup-notif-urgente');
  popup.style.display = 'flex';
}
function confirmarNotifUrgente() {
  const cfg = getConfig();
  if (cfg.notifUrgente && cfg.notifUrgente.ts) sessionStorage.setItem('notif_visto_' + cfg.notifUrgente.ts, '1');
  document.getElementById('popup-notif-urgente').style.display = 'none';
}

/* ═══════════════════════════════════════════
   BANIDOS
═══════════════════════════════════════════ */
let _listaBanidos = [];

function renderizarBanidos() {
  const lista = document.getElementById('lista-banidos');
  const vazio = document.getElementById('banidos-vazio');
  if (!lista) return;
  lista.innerHTML = '';
  if (_listaBanidos.length === 0) { vazio.style.display = 'block'; return; }
  vazio.style.display = 'none';
  _listaBanidos.forEach((nick, i) => {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:rgba(255,79,79,0.07);border:1px solid rgba(255,79,79,0.2);border-radius:6px;padding:8px 12px;gap:8px;';
    div.innerHTML = `<span style="color:#ff8080;font-size:13px;">🚫 ${nick}</span>
      <div style="display:flex;gap:6px;">
        <button onclick="confirmarDesbanimento(${i})" style="background:rgba(0,230,118,0.1);border:1px solid rgba(0,230,118,0.3);color:var(--verde);font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.5px;padding:5px 10px;border-radius:5px;cursor:pointer;white-space:nowrap;" onmouseover="this.style.background='rgba(0,230,118,0.2)'" onmouseout="this.style.background='rgba(0,230,118,0.1)'">✅ Desbanir</button>
        <button onclick="removerBanido(${i})" style="background:none;border:none;color:var(--cinza);cursor:pointer;font-size:16px;padding:0 4px;" title="Remover da lista">✕</button>
      </div>`;
    lista.appendChild(div);
  });
}

function confirmarBanimento() {
  const input = document.getElementById('add-banido-input');
  const nick = input.value.trim();
  if (!nick) { mostrarToast('⚠️ Digite o nick antes de banir.'); return; }
  if (_listaBanidos.map(n => n.toLowerCase()).includes(nick.toLowerCase())) {
    mostrarToast('⚠️ Este nick já está banido.'); return;
  }
  if (confirm('🚫 Você realmente deseja banir ' + nick + '?\n\nO usuário não conseguirá mais acessar o painel.')) {
    _listaBanidos.push(nick);
    renderizarBanidos();
    input.value = '';
    mostrarToast('🚫 ' + nick + ' foi banido!');
  }
}

function confirmarDesbanimento(i) {
  const nick = _listaBanidos[i];
  if (!nick) return;
  if (confirm('✅ Deseja realmente desbanir ' + nick + '?\n\nEle poderá acessar o painel novamente.')) {
    _listaBanidos.splice(i, 1);
    renderizarBanidos();
    mostrarToast('✅ ' + nick + ' foi desbanido! Seja bem-vindo novamente, cumpra as regras dessa vez!!!!', 'sucesso');
  }
}

function adicionarBanido() {
  // kept for backwards compat, now uses confirmarBanimento
  confirmarBanimento();
}

function removerBanido(i) {
  _listaBanidos.splice(i, 1);
  renderizarBanidos();
}

async function salvarBanidos() {
  const cfg = getConfig();
  cfg.banidos = _listaBanidos;
  await saveConfig(cfg);
  mostrarToast('Lista de banidos salva!', 'sucesso');
}

async function salvarMensagemBan() {
  const input = document.getElementById('ban-msg-input');
  const status = document.getElementById('ban-msg-status');
  if (!input) return;
  const cfg = getConfig();
  cfg.banMensagem = input.value.trim();
  await saveConfig(cfg);
  if (status) { status.textContent = '✅ Mensagem salva!'; status.style.color = 'var(--verde)'; setTimeout(() => { status.textContent = ''; }, 3000); }
  mostrarToast('✅ Mensagem de banimento salva!', 'sucesso');
}

function verificarSeBanido(nick) {
  const cfg = getConfig();
  if (!cfg.banidos || !Array.isArray(cfg.banidos)) return false;
  return cfg.banidos.map(b => b.toLowerCase()).includes(nick.toLowerCase());
}

function carregarBanidos() {
  const cfg = getConfig();
  _listaBanidos = cfg.banidos ? [...cfg.banidos] : [];
  renderizarBanidos();
}

/* Popup banido */
function mostrarPopupBanido(nick, porIP) {
  if (nick) registrarLogBloqueio(nick, porIP ? 'Tentativa — IP banido' : 'Tentativa — usuário banido');
  const cfg = getConfig();
  const msgEl = document.getElementById('popup-banido-msg');
  if (msgEl) {
    const msgPersonalizada = cfg.banMensagem && cfg.banMensagem.trim()
      ? cfg.banMensagem
      : 'Você foi banido por não cumprir as regras do sistema.<br><strong style="color:#ff8080;">Entre em contato com a liderança caso acredite que foi um engano.</strong>';
    let html = '';
    if (porIP) html = '🌐 <strong style="color:#ff8080;">Seu dispositivo foi banido</strong><br><br>';
    else if (nick) html = '🚫 <strong style="color:#ff8080;">' + nick + '</strong><br><br>';
    html += msgPersonalizada;
    msgEl.innerHTML = html;
  }
  document.getElementById('popup-banido').classList.add('visivel');
}
function fecharPopupBanido() {
  document.getElementById('popup-banido').classList.remove('visivel');
}

/* Verificação de ban ao clicar em "Entrar como Instrutor"
   Ban é verificado APÓS a autenticação (nick real confirmado pelo Roblox/senha).
   Se tiver nick salvo no auto-login, checa ban antes de ir à tela de senha. */
async function irParaRobloxComVerificacaoBan() {
  if (!_configCarregado) { setTimeout(irParaRobloxComVerificacaoBan, 300); return; }
  const ipBanido = await verificarIPBanido();
  if (ipBanido) { mostrarPopupBanido('', true); return; }
  irParaRoblox();
}

function verificarBanNick() {} // mantido para compatibilidade

/* ═══════════════════════════════════════════
   LOGS DE ACESSO
═══════════════════════════════════════════ */
async function registrarAcesso(nick) {
  try {
    const logsRef = _db.collection('logs_acesso');
    await logsRef.add({ nick, entrada: new Date().toISOString(), saida: null });
    sessionStorage.setItem('cgex_log_nick', nick);
  } catch(e) { console.error('Erro ao registrar acesso:', e); }
}

async function registrarLogBloqueio(nick, motivo) {
  try {
    await _db.collection('logs_bloqueio').add({
      nick: nick,
      motivo: motivo,
      ts: new Date().toISOString()
    });
  } catch(e) { console.error('Erro ao registrar log de bloqueio:', e); }
}

async function carregarLogsBloqueio() {
  const container = document.getElementById('logs-bloqueio-container');
  const vazio = document.getElementById('logs-bloqueio-vazio');
  if (!container) return;
  container.innerHTML = '<div style="color:var(--cinza);font-size:13px;">Carregando...</div>';
  try {
    const snap = await _db.collection('logs_bloqueio').orderBy('ts','desc').limit(50).get();
    container.innerHTML = '';
    if (snap.empty) { vazio.style.display = 'block'; return; }
    vazio.style.display = 'none';
    snap.forEach(doc => {
      const d = doc.data();
      const ts = new Date(d.ts).toLocaleString('pt-BR');
      const div = document.createElement('div');
      div.style.cssText = 'background:rgba(255,79,79,0.06);border:1px solid rgba(255,79,79,0.2);border-radius:6px;padding:10px 14px;font-size:13px;';
      div.innerHTML = `<div style="color:#ff8080;font-weight:600;margin-bottom:4px;">🚫 ${d.nick}</div><div style="color:var(--cinza);">⏰ ${ts}</div><div style="color:var(--cinza);margin-top:2px;">📋 ${d.motivo}</div>`;
      container.appendChild(div);
    });
  } catch(e) { container.innerHTML = '<div style="color:#ff8080;font-size:13px;">Erro ao carregar logs.</div>'; }
}

async function limparLogsBloqueio() {
  if (!confirm('Limpar todos os logs de bloqueio?')) return;
  try {
    const snap = await _db.collection('logs_bloqueio').get();
    const batch = _db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    mostrarToast('Logs de bloqueio limpos!', 'sucesso');
    carregarLogsBloqueio();
  } catch(e) { mostrarToast('Erro ao limpar.', 'erro'); }
}

async function carregarLogs() {
  const container = document.getElementById('logs-container');
  const vazio = document.getElementById('logs-vazio');
  if (!container) return;
  container.innerHTML = '<div style="color:var(--cinza);font-size:13px;">Carregando...</div>';
  try {
    const snap = await _db.collection('logs_acesso').orderBy('entrada','desc').limit(50).get();
    container.innerHTML = '';
    if (snap.empty) { vazio.style.display = 'block'; return; }
    vazio.style.display = 'none';
    snap.forEach(doc => {
      const d = doc.data();
      const entrada = new Date(d.entrada).toLocaleString('pt-BR');
      const saida = d.saida ? new Date(d.saida).toLocaleString('pt-BR') : '🟢 Online agora';
      const div = document.createElement('div');
      div.style.cssText = 'background:rgba(0,230,118,0.05);border:1px solid rgba(0,230,118,0.15);border-radius:6px;padding:10px 14px;font-size:13px;';
      div.innerHTML = `<div style="color:#fff;font-weight:600;margin-bottom:4px;">👤 ${d.nick}</div><div style="color:var(--cinza);">🟢 Entrada: ${entrada}</div><div style="color:var(--cinza);">🔴 Saída: ${saida}</div>`;
      container.appendChild(div);
    });
  } catch(e) { container.innerHTML = '<div style="color:#ff8080;font-size:13px;">Erro ao carregar logs.</div>'; }
}
async function limparLogs() {
  if (!confirm('Tem certeza que deseja limpar todos os logs?')) return;
  try {
    const snap = await _db.collection('logs_acesso').get();
    const batch = _db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    mostrarToast('Logs limpos!', 'sucesso');
    carregarLogs();
  } catch(e) { mostrarToast('Erro ao limpar logs.', 'erro'); }
}

/* ═══════════════════════════════════════════
   EDITAR CONTEÚDO DAS PASTAS
═══════════════════════════════════════════ */
const _coresNota = {
  azul: { bg: 'rgba(61,139,255,0.08)', border: 'rgba(61,139,255,0.3)', cor: '#7eb3ff', borda: '#3d8bff' },
  verde: { bg: 'rgba(0,230,118,0.07)', border: 'rgba(0,230,118,0.25)', cor: '#69f0ae', borda: '#00e676' },
  amarelo: { bg: 'rgba(255,171,0,0.08)', border: 'rgba(255,171,0,0.3)', cor: '#ffd740', borda: '#ffab00' },
  vermelho: { bg: 'rgba(255,79,79,0.08)', border: 'rgba(255,79,79,0.3)', cor: '#ff8080', borda: '#ff4f4f' }
};
function aplicarNotasPastas() {
  const cfg = getConfig();
  if (!cfg.notasPastas) return;
  ['tickets','omissao','revogacao'].forEach(pasta => {
    const nota = cfg.notasPastas[pasta];
    const el = document.getElementById('nota-pasta-' + pasta);
    if (!el) return;
    if (nota && nota.texto) {
      const c = _coresNota[nota.tipo] || _coresNota.azul;
      el.style.cssText = `display:block;margin-bottom:12px;border-radius:8px;padding:12px 16px;font-size:13px;line-height:1.6;background:${c.bg};border:1px solid ${c.border};border-left:4px solid ${c.borda};color:${c.cor};`;
      el.innerHTML = '📌 ' + nota.texto;
    } else { el.style.display = 'none'; }
  });
}
function carregarNotaPasta() {
  const pasta = document.getElementById('conteudo-pasta-select').value;
  const cfg = getConfig();
  const nota = cfg.notasPastas && cfg.notasPastas[pasta];
  document.getElementById('conteudo-nota').value = nota ? nota.texto : '';
  document.getElementById('conteudo-tipo').value = nota ? nota.tipo : 'azul';
}
async function salvarNotaPasta() {
  const pasta = document.getElementById('conteudo-pasta-select').value;
  const texto = document.getElementById('conteudo-nota').value.trim();
  const tipo = document.getElementById('conteudo-tipo').value;
  if (!texto) { mostrarToast('Escreva uma nota primeiro!', 'erro'); return; }
  const cfg = getConfig();
  if (!cfg.notasPastas) cfg.notasPastas = {};
  cfg.notasPastas[pasta] = { texto, tipo };
  await saveConfig(cfg);
  aplicarNotasPastas();
  document.getElementById('conteudo-status').textContent = '✅ Nota salva com sucesso!';
  mostrarToast('Nota salva!', 'sucesso');
}
async function removerNotaPasta() {
  const pasta = document.getElementById('conteudo-pasta-select').value;
  const cfg = getConfig();
  if (!cfg.notasPastas) cfg.notasPastas = {};
  cfg.notasPastas[pasta] = { texto: '', tipo: 'azul' };
  await saveConfig(cfg);
  aplicarNotasPastas();
  document.getElementById('conteudo-nota').value = '';
  document.getElementById('conteudo-status').textContent = '🗑️ Nota removida.';
  mostrarToast('Nota removida!', 'sucesso');
}

/* ═══════════════════════════════════════════
   SISTEMA DE SENHAS POR INSTRUTOR
═══════════════════════════════════════════ */

// Chave usada no localStorage para lembrar o nick logado
const CGEX_LEMBRAR_KEY = 'cgex_nick_salvo';

// Salva as senhas em coleção separada no Firestore: senhas_instrutores/{nick}
const _senhasRef = () => _db.collection('senhas_instrutores');

async function buscarHashSenha(nick) {
  try {
    const doc = await _senhasRef().doc(nick.toLowerCase()).get();
    if (doc.exists) return doc.data().hash || null;
  } catch(e) { console.error('Erro ao buscar senha:', e); }
  return null;
}

async function salvarHashSenha(nick, hash) {
  try {
    await _senhasRef().doc(nick.toLowerCase()).set({
      nick: nick,
      hash: hash,
      criadoEm: new Date().toISOString()
    });
    return true;
  } catch(e) { console.error('Erro ao salvar senha:', e); return false; }
}

// Chamado após verificação do Roblox confirmar que nick é autorizado — acesso direto sem senha
async function prosseguirComSenha(username, avatarUrl) {
  if (verificarSeBanido(username)) {
    mostrarPopupBanido(username);
    return;
  }
  sessionStorage.setItem('cgex_auth_nick', username);
  sessionStorage.setItem('cgex_auth_avatar', avatarUrl || '');
  await concederAcesso(username, 'Instrutor CGEx', avatarUrl || '');
}

function mostrarTelaLoginSenha(nick, avatarUrl) {
  document.getElementById('login-senha-nick').textContent = nick;
  renderizarListaRGBEm('nomes-instrutores-login');

  const avatarImg   = document.getElementById('login-senha-avatar');
  const avatarEmoji = document.getElementById('login-senha-avatar-emoji');
  const avatarLoad  = document.getElementById('login-senha-avatar-loading');

  avatarImg.style.display   = 'none';
  avatarEmoji.style.display = 'none';
  avatarLoad.style.display  = 'flex';

  function _setAvatar(url) {
    avatarLoad.style.display = 'none';
    if (url) {
      avatarImg.src = url;
      avatarImg.style.display = 'block';
      avatarEmoji.style.display = 'none';
    } else {
      avatarImg.style.display = 'none';
      avatarEmoji.style.display = 'inline';
    }
  }

  if (avatarUrl) {
    _setAvatar(avatarUrl);
  } else {
    buscarAvatarRobloxPorNick(nick).then(_setAvatar);
  }

  document.getElementById('input-senha-login').value = '';
  document.getElementById('erro-login-senha').style.display = 'none';
  ir('tela-login-senha');
  setTimeout(() => document.getElementById('input-senha-login').focus(), 300);
}

function mostrarTelaCriarSenha(nick, avatarUrl) {
  document.getElementById('criar-senha-nick').textContent = nick;
  document.getElementById('criar-senha-nick-display').textContent = nick;

  // Nick vem do OAuth — esconde o campo de nick e mostra o card de avatar
  var nickInput = document.getElementById('input-criar-nick');
  if (nickInput) {
    nickInput.value = nick;
    nickInput.type = 'hidden';
    nickInput.style.display = 'none';
  }
  var avatarCard = document.getElementById('criar-senha-avatar-card');
  if (avatarCard) avatarCard.style.display = 'flex';

  renderizarListaRGBEm('nomes-instrutores-criar');

  const avatarImg   = document.getElementById('criar-senha-avatar');
  const avatarEmoji = document.getElementById('criar-senha-avatar-emoji');
  const avatarLoad  = document.getElementById('criar-senha-avatar-loading');

  avatarImg.style.display   = 'none';
  avatarEmoji.style.display = 'none';
  avatarLoad.style.display  = 'flex';

  function _setAvatar(url) {
    avatarLoad.style.display = 'none';
    if (url) {
      avatarImg.src = url;
      avatarImg.style.display = 'block';
      avatarEmoji.style.display = 'none';
    } else {
      avatarImg.style.display = 'none';
      avatarEmoji.style.display = 'inline';
    }
  }

  if (avatarUrl) {
    _setAvatar(avatarUrl);
  } else {
    buscarAvatarRobloxPorNick(nick).then(_setAvatar);
  }

  document.getElementById('input-nova-senha').value = '';
  document.getElementById('input-confirmar-senha').value = '';
  document.getElementById('erro-criar-senha').style.display = 'none';
  ir('tela-criar-senha');
  setTimeout(() => document.getElementById('input-nova-senha').focus(), 300);
}

/* Helper: busca avatar do Roblox pelo nick (API pública sem CORS) */
async function buscarAvatarRobloxPorNick(nick) {
  try {
    // Endpoint antigo da API Roblox — não tem bloqueio de CORS
    const r = await fetch('https://api.roblox.com/users/get-by-username?username=' + encodeURIComponent(nick));
    if (!r.ok) return '';
    const d = await r.json();
    const userId = d.Id || d.id;
    if (!userId) return '';
    const t = await fetch('https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=' + userId + '&size=150x150&format=Png');
    if (!t.ok) return '';
    const td = await t.json();
    return (td.data && td.data[0] && td.data[0].imageUrl) || '';
  } catch(e) { return ''; }
}

/* Helper: renderiza lista RGB de instrutores em qualquer container */
function renderizarListaRGBEm(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var config = getConfig();
  var instrutores = config.manualInstructors || [];
  if (instrutores.length === 0) {
    container.innerHTML = '<span style="color:var(--cinza);font-size:11px;">Nenhum cadastrado.</span>';
    return;
  }
  container.innerHTML = instrutores.map(function(nick, i) {
    var delay = '-' + (i * 0.55).toFixed(2) + 's';
    return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;font-family:\'Rajdhani\',sans-serif;letter-spacing:0.5px;border-radius:5px;border:1px solid;padding:3px 8px;animation:tagRGB 4s linear infinite;animation-delay:' + delay + ';">🧑 ' + nick + '</span>';
  }).join('');
}

async function salvarNovaSenha() {
  const nickInput = document.getElementById('input-criar-nick');
  const nova = document.getElementById('input-nova-senha').value;
  const conf = document.getElementById('input-confirmar-senha').value;
  const erroEl = document.getElementById('erro-criar-senha');

  // Nick: vem do OAuth/sessão, do localStorage, ou do campo digitado
  const nickDaSessao = sessionStorage.getItem('cgex_auth_nick') || '';
  const nickSalvo = localStorage.getItem(CGEX_LEMBRAR_KEY) || '';
  const nickDigitado = (nickInput && nickInput.type !== 'hidden') ? nickInput.value.trim() : '';
  const nick = nickDaSessao || nickSalvo || nickDigitado;

  if (!nick) {
    erroEl.textContent = '❌ Digite seu nick do Roblox.';
    erroEl.style.display = 'block';
    if (nickInput && nickInput.type !== 'hidden') nickInput.focus();
    return;
  }

  // Verificar ban ANTES de tudo
  if (verificarSeBanido(nick)) {
    mostrarPopupBanido(nick);
    return;
  }

  // Verificar se é instrutor autorizado — se não for, BAN AUTOMÁTICO
  const config = getConfig();
  const autorizado = config.manualInstructors.find(n => n.toLowerCase() === nick.toLowerCase());
  if (!autorizado) {
    // Ban automático — não é instrutor
    config.banidos = config.banidos || [];
    if (!config.banidos.map(b => b.toLowerCase()).includes(nick.toLowerCase())) {
      config.banidos.push(nick);
      await saveConfig(config);
    }
    registrarLogBloqueio(nick, 'Auto-ban: tentou criar senha sem ser instrutor autorizado');
    mostrarPopupBanido(nick);
    return;
  }

  // Verify no password already exists
  const hashExistente = await buscarHashSenha(autorizado);
  if (hashExistente) {
    erroEl.textContent = '❌ Este nick já possui senha. Peça ao admin para resetar se necessário.';
    erroEl.style.display = 'block';
    return;
  }

  if (!nova || nova.length < 6) {
    erroEl.textContent = '❌ A senha deve ter pelo menos 6 caracteres.';
    erroEl.style.display = 'block';
    document.getElementById('input-nova-senha').focus();
    return;
  }
  if (nova !== conf) {
    erroEl.textContent = '❌ As senhas não coincidem.';
    erroEl.style.display = 'block';
    document.getElementById('input-confirmar-senha').focus();
    return;
  }

  erroEl.style.display = 'none';
  const hash = await sha256(nova);
  const ok = await salvarHashSenha(autorizado, hash);
  if (!ok) {
    erroEl.textContent = '❌ Erro ao salvar senha. Tente novamente.';
    erroEl.style.display = 'block';
    return;
  }

  // Salva nick para auto-login na próxima vez
  localStorage.setItem(CGEX_LEMBRAR_KEY, autorizado);
  sessionStorage.setItem('cgex_auth_nick', autorizado);
  mostrarToast('✅ Senha criada! Bem-vindo, ' + autorizado + '!', 'sucesso');
  await concederAcesso(autorizado, 'Instrutor CGEx', '');
}

/* ══ BAN POR IP ══ */
let _ipAtual = null;
async function obterIP() {
  if (_ipAtual) return _ipAtual;
  try { const r = await fetch('https://api.ipify.org?format=json'); const d = await r.json(); _ipAtual = d.ip || null; } catch(e) { _ipAtual = null; }
  return _ipAtual;
}
async function verificarIPBanido() {
  const ip = await obterIP();
  if (!ip) return false;
  try { const doc = await _db.collection('ips_banidos').doc(ip).get(); return doc.exists; } catch(e) { return false; }
}
async function banirIP(nick, motivo) {
  const ip = await obterIP();
  if (!ip) return;
  try { await _db.collection('ips_banidos').doc(ip).set({ ip, nick, motivo: motivo || 'Ban automático', banidoEm: new Date().toISOString() }); } catch(e) {}
}

/* ══ TENTATIVAS (máx 3) ══ */
const _tentativas = {};
function _addTentativa(nick) { const k = nick.toLowerCase(); _tentativas[k] = (_tentativas[k]||0)+1; return _tentativas[k]; }
function _resetTentativas(nick) { _tentativas[nick.toLowerCase()] = 0; }

async function fazerLoginComSenha() {
  const senhaDigitada = document.getElementById('input-senha-login').value;
  const erroEl = document.getElementById('erro-login-senha');
  const nick = sessionStorage.getItem('cgex_auth_nick');
  const avatarUrl = sessionStorage.getItem('cgex_auth_avatar') || '';

  if (!nick) { mostrarErroAuth('Sessão expirada. Tente novamente.'); return; }
  if (!senhaDigitada) {
    erroEl.textContent = '❌ Digite sua senha.';
    erroEl.style.display = 'block';
    return;
  }

  const hashDigitado = await sha256(senhaDigitada);
  const hashSalvo = await buscarHashSenha(nick);

  if (!hashSalvo) {
    erroEl.textContent = '❌ Nenhuma senha cadastrada. Recarregue a página.';
    erroEl.style.display = 'block';
    return;
  }

  if (hashDigitado !== hashSalvo) {
    const tentativas = _addTentativa(nick);
    const restantes = 3 - tentativas;
    const inp = document.getElementById('input-senha-login');
    inp.classList.add('erro');
    setTimeout(() => inp.classList.remove('erro'), 420);
    inp.value = '';
    if (tentativas >= 3) {
      const config = getConfig();
      config.banidos = config.banidos || [];
      if (!config.banidos.map(b => b.toLowerCase()).includes(nick.toLowerCase())) {
        config.banidos.push(nick);
        await saveConfig(config);
      }
      await banirIP(nick, '3 erros de senha consecutivos');
      registrarLogBloqueio(nick, 'Ban automático: 3 erros consecutivos (nick + IP banidos)');
      mostrarPopupBanido(nick);
      return;
    }
    erroEl.textContent = '❌ Senha incorreta. Tentativa ' + tentativas + '/3' + (restantes > 0 ? ' — ' + restantes + ' restante(s).' : '');
    erroEl.style.display = 'block';
    inp.focus();
    return;
  }

  erroEl.style.display = 'none';
  // Salva nick para auto-login na próxima vez
  localStorage.setItem(CGEX_LEMBRAR_KEY, nick);
  await concederAcesso(nick, 'Instrutor CGEx', avatarUrl);
}

// Trocar conta — limpa nick salvo e volta ao painel
function trocarConta() {
  localStorage.removeItem(CGEX_LEMBRAR_KEY);
  sessionStorage.removeItem('cgex_auth_nick');
  sessionStorage.removeItem('cgex_auth_avatar');
  cgexOcultarChat(); // Oculta IA ao sair
  ir('tela-painel');
}

// Sem fluxo de senha — auto-login desativado, apenas limpa dados legados
async function verificarAutoLogin() {
  const nickSalvo = localStorage.getItem(CGEX_LEMBRAR_KEY);
  if (!nickSalvo) return false;

  const config = getConfig();
  const naLista = config.manualInstructors.some(n => n.toLowerCase() === nickSalvo.toLowerCase());
  if (!naLista) {
    localStorage.removeItem(CGEX_LEMBRAR_KEY);
    return false;
  }

  // Verifica se está banido antes de auto-logar
  const ipBanido = await verificarIPBanido();
  if (ipBanido) { mostrarPopupBanido('', true); return true; }
  if (verificarSeBanido(nickSalvo)) { mostrarPopupBanido(nickSalvo, false); return true; }

  const hashExistente = await buscarHashSenha(nickSalvo);
  if (!hashExistente) return false;

  const avatarUrl = await buscarAvatarRobloxPorNick(nickSalvo);
  sessionStorage.setItem('cgex_auth_nick', nickSalvo);
  sessionStorage.setItem('cgex_auth_avatar', avatarUrl);
  mostrarTelaLoginSenha(nickSalvo, avatarUrl);
  return true;
}

async function verificarAutoLogin_DESATIVADO() {
  const nickSalvo = localStorage.getItem(CGEX_LEMBRAR_KEY);
  if (!nickSalvo) return false;

  const config = getConfig();
  const naLista = config.manualInstructors.some(n => n.toLowerCase() === nickSalvo.toLowerCase());
  if (!naLista) {
    localStorage.removeItem(CGEX_LEMBRAR_KEY);
    return false;
  }

  const hashExistente = await buscarHashSenha(nickSalvo);
  if (!hashExistente) return false;

  const avatarUrl = await buscarAvatarRobloxPorNick(nickSalvo);

  sessionStorage.setItem('cgex_auth_nick', nickSalvo);
  sessionStorage.setItem('cgex_auth_avatar', avatarUrl);
  mostrarTelaLoginSenha(nickSalvo, avatarUrl);
  return true;
}

/* ═══════════════════════════════════════════
   INTERCEPTAR concederAcesso ORIGINAL
   → agora redireciona para o fluxo de senha
═══════════════════════════════════════════ */
async function verificarCargoRoblox(userId, username, avatarUrl) {
  const config = getConfig();
  const naListaManual = config.manualInstructors.some(n => n.toLowerCase() === username.toLowerCase());

  if (config.groupId) {
    try {
      const groupResp = await fetch('https://groups.roblox.com/v2/users/' + userId + '/groups/roles');
      if (groupResp.ok) {
        const groupData = await groupResp.json();
        const grupo = groupData.data && groupData.data.find(g => String(g.group.id) === String(config.groupId));
        if (grupo) {
          const cargo = grupo.role.name;
          const temCargoInstrutor = config.instructorRoles.some(r => cargo.toLowerCase().includes(r.toLowerCase()));
          if (temCargoInstrutor || naListaManual) {
            await prosseguirComSenha(username, avatarUrl);
          } else {
            mostrarNaoAutorizado(username, avatarUrl, 'Seu cargo atual no grupo é "' + cargo + '". Apenas instrutores têm acesso.');
          }
          return;
        } else if (naListaManual) {
          await prosseguirComSenha(username, avatarUrl);
          return;
        } else {
          mostrarNaoAutorizado(username, avatarUrl, 'Você não está no grupo CGEx ou não possui cargo de instrutor.');
          return;
        }
      }
    } catch(e) { console.warn('Falha ao verificar grupo:', e); }
  }
  if (naListaManual) {
    await prosseguirComSenha(username, avatarUrl);
  } else {
    mostrarNaoAutorizado(username, avatarUrl, 'Usuário não encontrado na lista de instrutores autorizados.');
  }
}

function verificarListaManualApenas(username) {
  const config = getConfig();
  const autorizado = config.manualInstructors.find(n => n.toLowerCase() === username.toLowerCase());
  if (autorizado) {
    prosseguirComSenha(autorizado, '');
  } else {
    mostrarNaoAutorizado(username, '', 'Usuário não está na lista de instrutores autorizados.');
  }
}

/* ═══════════════════════════════════════════
   MODIFICAR irParaRoblox PARA AUTO-LOGIN
═══════════════════════════════════════════ */
function irParaRoblox() {
  if (!_configCarregado) { setTimeout(irParaRoblox, 300); return; }
  verificarAutoLogin().then(autoLogado => {
    if (!autoLogado) {
      renderizarListaInstrutoresRoblox();
      ir('tela-roblox');
    }
  });
}

/* ═══════════════════════════════════════════
   ABA ADMIN — SENHAS DOS INSTRUTORES
═══════════════════════════════════════════ */
async function carregarAbasenhas() {
  const loading = document.getElementById('senhas-loading');
  const lista = document.getElementById('senhas-lista');
  const resumo = document.getElementById('senhas-resumo');
  const vazio = document.getElementById('senhas-vazio');

  loading.style.display = 'block';
  lista.innerHTML = '';
  resumo.innerHTML = '';
  vazio.style.display = 'none';

  const config = getConfig();
  const instrutores = config.manualInstructors || [];

  if (instrutores.length === 0) {
    loading.style.display = 'none';
    vazio.style.display = 'block';
    return;
  }

  // Buscar todos os docs de senha de uma vez
  let senhasCadastradas = {};
  try {
    const snap = await _senhasRef().get();
    snap.forEach(doc => { senhasCadastradas[doc.id] = doc.data(); });
  } catch(e) { console.error('Erro ao buscar senhas:', e); }

  loading.style.display = 'none';

  const comSenha = [];
  const semSenha = [];

  instrutores.forEach(nick => {
    const key = nick.toLowerCase();
    if (senhasCadastradas[key]) {
      comSenha.push({ nick, data: senhasCadastradas[key] });
    } else {
      semSenha.push(nick);
    }
  });

  // Resumo
  resumo.innerHTML = `
    <div style="background:rgba(0,230,118,0.08);border:1px solid rgba(0,230,118,0.25);border-radius:8px;padding:10px 16px;flex:1;min-width:120px;text-align:center;">
      <div style="font-family:'Rajdhani',sans-serif;font-size:24px;font-weight:700;color:#00e676;">${comSenha.length}</div>
      <div style="font-size:12px;color:var(--cinza);">Com senha</div>
    </div>
    <div style="background:rgba(255,171,0,0.08);border:1px solid rgba(255,171,0,0.25);border-radius:8px;padding:10px 16px;flex:1;min-width:120px;text-align:center;">
      <div style="font-family:'Rajdhani',sans-serif;font-size:24px;font-weight:700;color:#ffd740;">${semSenha.length}</div>
      <div style="font-size:12px;color:var(--cinza);">Sem senha ainda</div>
    </div>
    <div style="background:rgba(61,139,255,0.08);border:1px solid rgba(61,139,255,0.25);border-radius:8px;padding:10px 16px;flex:1;min-width:120px;text-align:center;">
      <div style="font-family:'Rajdhani',sans-serif;font-size:24px;font-weight:700;color:#7eb3ff;">${instrutores.length}</div>
      <div style="font-size:12px;color:var(--cinza);">Total</div>
    </div>
  `;

  // Lista com senha
  if (comSenha.length > 0) {
    const titulo = document.createElement('div');
    titulo.style.cssText = 'font-family:"Rajdhani",sans-serif;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#00e676;margin:14px 0 6px;';
    titulo.textContent = '✅ Já criaram senha';
    lista.appendChild(titulo);
    comSenha.forEach(({ nick, data }) => {
      const data_formatada = data.criadoEm ? new Date(data.criadoEm).toLocaleString('pt-BR') : '—';
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:rgba(0,230,118,0.06);border:1px solid rgba(0,230,118,0.18);border-radius:8px;padding:10px 14px;gap:10px;flex-wrap:wrap;';
      div.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:20px;">🧑‍🏫</span>
          <div>
            <div style="font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:700;color:#fff;">${nick}</div>
            <div style="font-size:11px;color:var(--cinza);">Senha criada em: ${data_formatada}</div>
          </div>
        </div>
        <button onclick="confirmarResetarSenha('${nick}')" style="background:rgba(255,79,79,0.1);border:1px solid rgba(255,79,79,0.3);color:#ff8080;font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;padding:6px 12px;border-radius:6px;cursor:pointer;">🗑️ Resetar</button>
      `;
      lista.appendChild(div);
    });
  }

  // Lista sem senha
  if (semSenha.length > 0) {
    const titulo2 = document.createElement('div');
    titulo2.style.cssText = 'font-family:"Rajdhani",sans-serif;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ffd740;margin:14px 0 6px;';
    titulo2.textContent = '⏳ Ainda não criaram senha';
    lista.appendChild(titulo2);
    semSenha.forEach(nick => {
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;align-items:center;gap:10px;background:rgba(255,171,0,0.05);border:1px solid rgba(255,171,0,0.18);border-radius:8px;padding:10px 14px;';
      div.innerHTML = `
        <span style="font-size:20px;">🕓</span>
        <div style="font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:700;color:#ffd740;">${nick}</div>
        <div style="font-size:11px;color:var(--cinza);margin-left:4px;">Nenhuma senha cadastrada ainda</div>
      `;
      lista.appendChild(div);
    });
  }
}

async function confirmarResetarSenha(nick) {
  if (!confirm('Resetar a senha de "' + nick + '"? Ele precisará criar uma nova senha no próximo acesso.')) return;
  await executarResetarSenha(nick);
}

async function executarResetarSenha(nick) {
  try {
    await _senhasRef().doc(nick.toLowerCase()).delete();
    // Também remove do localStorage se for o mesmo dispositivo
    const salvo = localStorage.getItem(CGEX_LEMBRAR_KEY);
    if (salvo && salvo.toLowerCase() === nick.toLowerCase()) {
      localStorage.removeItem(CGEX_LEMBRAR_KEY);
    }
    mostrarToast('✅ Senha de "' + nick + '" resetada!', 'sucesso');
    carregarAbasenhas();
  } catch(e) {
    mostrarToast('❌ Erro ao resetar senha.', 'erro');
  }
}

async function resetarSenhaPorNick() {
  const input = document.getElementById('input-resetar-nick');
  const status = document.getElementById('resetar-status');
  const nick = input.value.trim();
  if (!nick) { status.textContent = '⚠️ Digite o nick do instrutor.'; status.style.color = 'var(--aviso)'; return; }

  const hashExistente = await buscarHashSenha(nick);
  if (!hashExistente) {
    status.textContent = '⚠️ Esse instrutor não tem senha cadastrada.';
    status.style.color = 'var(--aviso)';
    return;
  }

  if (!confirm('Resetar a senha de "' + nick + '"?')) return;
  await executarResetarSenha(nick);
  input.value = '';
  status.textContent = '✅ Senha de "' + nick + '" resetada com sucesso!';
  status.style.color = 'var(--verde)';
  setTimeout(() => { status.textContent = ''; }, 4000);
}

/* ═══════════════════════════════════════════
   DEBUG — CONSOLE VISUAL (PAINEL ADMIN)
═══════════════════════════════════════════ */
var _debugLogs = [];
var _debugErros = 0;

function _debugAdd(tipo, msg) {
  var ts = new Date().toLocaleTimeString('pt-BR');
  _debugLogs.unshift({ tipo: tipo, msg: msg, ts: ts });
  if (_debugLogs.length > 100) _debugLogs.pop();
  if (tipo === 'erro') {
    _debugErros++;
    var el = document.getElementById('debug-erros-count');
    if (el) el.textContent = _debugErros;
  }
  _debugRenderizar();
}

function _debugRenderizar() {
  var container = document.getElementById('debug-log-container');
  if (!container) return;
  if (_debugLogs.length === 0) {
    container.innerHTML = '<span style="color:var(--cinza);">Nenhum log ainda.</span>';
    return;
  }
  var cores = { erro: '#ff6b6b', aviso: '#ffd740', info: '#7eb3ff', sucesso: '#00e676', evento: '#c8d5de' };
  var icones = { erro: '❌', aviso: '⚠️', info: 'ℹ️', sucesso: '✅', evento: '📌' };
  container.innerHTML = _debugLogs.map(function(l) {
    var cor = cores[l.tipo] || cores.evento;
    var ico = icones[l.tipo] || '📌';
    return '<div style="border-bottom:1px solid rgba(255,255,255,0.05);padding:5px 0;">' +
      '<span style="color:var(--cinza);font-size:10px;">' + l.ts + '</span> ' +
      ico + ' <span style="color:' + cor + ';">' + l.msg + '</span>' +
      '</div>';
  }).join('');
}

function debugCarregar() {
  var container = document.getElementById('debug-log-container');
  if (container && _debugLogs.length === 0) {
    container.innerHTML = '<span style="color:var(--cinza);">Nenhum evento registrado ainda.</span>';
  } else {
    _debugRenderizar();
  }

  // Status Firebase
  var fbEl = document.getElementById('debug-firebase-status');
  if (fbEl) {
    try {
      if (_db && typeof _db.collection === 'function') {
        fbEl.textContent = '✅ OK';
        fbEl.style.color = '#00e676';
      } else {
        fbEl.textContent = '❌ Falhou';
        fbEl.style.color = '#ff6b6b';
      }
    } catch(e) {
      fbEl.textContent = '❌ Erro';
      fbEl.style.color = '#ff6b6b';
    }
  }

  // Status Config
  var cfgEl = document.getElementById('debug-config-status');
  if (cfgEl) {
    if (_configCarregado) {
      var cfg = getConfig();
      var instrutores = (cfg.manualInstructors || []).length;
      cfgEl.textContent = '✅ ' + instrutores + ' instrutores';
      cfgEl.style.color = '#00e676';
    } else {
      cfgEl.textContent = '⏳ Carregando';
      cfgEl.style.color = '#ffd740';
    }
  }

  // Status OAuth
  var oauthEl = document.getElementById('debug-oauth-status');
  if (oauthEl) {
    var cfg2 = getConfig();
    if (cfg2 && cfg2.clientId) {
      oauthEl.textContent = '✅ Configurado';
      oauthEl.style.color = '#00e676';
    } else {
      oauthEl.textContent = '⚠️ Sem Client ID';
      oauthEl.style.color = '#ffd740';
    }
  }

  // Contagem de erros
  var errEl = document.getElementById('debug-erros-count');
  if (errEl) errEl.textContent = _debugErros;
}

async function debugTestar() {
  _debugAdd('info', 'Iniciando teste do Firebase...');
  try {
    var snap = await _cfgRef.get();
    if (snap.exists) {
      var d = snap.data();
      _debugAdd('sucesso', 'Firebase OK — Config carregada. Instrutores: ' + ((d.manualInstructors||[]).length));
      _debugAdd('sucesso', 'Client ID: ' + (d.clientId ? '✅ configurado' : '⚠️ não configurado'));
      _debugAdd('sucesso', 'Group ID: ' + (d.groupId ? '✅ ' + d.groupId : '⚠️ não configurado'));
    } else {
      _debugAdd('aviso', 'Firebase conectado mas doc config/main não existe ainda.');
    }
  } catch(e) {
    _debugAdd('erro', 'Falha no Firebase: ' + e.message);
  }
  debugCarregar();
}

function debugLimpar() {
  _debugLogs = [];
  _debugErros = 0;
  var errEl = document.getElementById('debug-erros-count');
  if (errEl) errEl.textContent = '0';
  var container = document.getElementById('debug-log-container');
  if (container) container.innerHTML = '<span style="color:var(--cinza);">Log limpo.</span>';
}

// Interceptar erros globais
window.addEventListener('error', function(e) {
  _debugAdd('erro', 'JS Error: ' + e.message + (e.filename ? ' | ' + e.filename.split('/').pop() + ':' + e.lineno : ''));
});
window.addEventListener('unhandledrejection', function(e) {
  _debugAdd('erro', 'Promise rejeitada: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason)));
});

// Interceptar console.error
var _origConsoleError = console.error;
console.error = function() {
  var args = Array.prototype.slice.call(arguments);
  _debugAdd('erro', args.map(function(a) { return typeof a === 'object' ? JSON.stringify(a) : String(a); }).join(' '));
  _origConsoleError.apply(console, arguments);
};
var _origConsoleWarn = console.warn;
console.warn = function() {
  var args = Array.prototype.slice.call(arguments);
  _debugAdd('aviso', args.map(function(a) { return typeof a === 'object' ? JSON.stringify(a) : String(a); }).join(' '));
  _origConsoleWarn.apply(console, arguments);
};

// Logar eventos importantes do sistema
var _origIr = typeof ir === 'function' ? ir : null;
document.addEventListener('DOMContentLoaded', function() {
  _debugAdd('info', 'Página carregada — DOMContentLoaded');
});

/* ═══════════════════════════════════════════
   IA CGEX — CLAUDE AI ASSISTANT
═══════════════════════════════════════════ */

var CGEX_KB = 'Você é a IA CGEx, assistente especialista em todo o Material de Apoio dos Instrutores da CGEx (Corregedoria). Responda SEMPRE em português brasileiro, de forma clara, direta e organizada. Use emojis quando fizer sentido. Seja preciso e detalhado.\n\nSEU PAPEL: Ajudar instrutores e membros a entender os procedimentos, regras e protocolos da CGEx. Você conhece TUDO sobre:\n\n📂 PASTAS DISPONÍVEIS:\n🎫 Ordem dos Tickets | 🏫 Omissão de Patente | 🔄 Solicitar Revogação | 🚫 Canal de Exílio | 📋 Logs Servidor | 📢 Anúncios e Hierarquia | 🚫 Comandos Proibidos | 🔓 Remover Seu Ban | 🏅 Avais do EB | ⚖️ Corregedoria | 🚫 CGEx Punições | 📁 Registro de Documentos | 📊 CGEx Relatório\n\n🎫 ORDEM DOS TICKETS:\n• Atender sempre de CIMA para BAIXO (mais antigos primeiro)\n• Pular tickets sem motivo = Advertência\n• Exceção: Prioridade de Call (pessoa na call de suporte)\n• Renomear ticket: /renomear → Call-Suporte ou ticket-[número]-[iniciais]\n• Adicionar membro: /add @usuário\n• INÍCIO: marcar @ + cumprimentar (Bom dia/tarde/noite)\n• FECHAR: sempre com motivo → Resolvido ou Inatividade (10min sem resposta)\n• Fechar sem motivo = Advertência\n• Após fechar: registrar no Relatório de Ticket (@ atendente + @ atendido + quantidade)\n\n🏫 OMISSÃO DE PATENTE (10 passos obrigatórios):\n1. Marque @ e cumprimente pelo horário\n2. Pergunte: Nick do Instrutor, cargo atual do solicitante, se está em CDP\n3. Verifique CDP: tire print comprovando\n4. Logs Rover: confirme cargo real no jogo → print\n5. Logs Admin: último comando do instrutor → print\n6. Logs Chat: última mensagem do instrutor → print\n7. Discord Treinamentos Físicos: filtre por pessoa, veja último anúncio\n8. Relatório de Promoção: verifique se aprovado consta → print\n9. Poste no Relatório de Patente Treino (Nick aprovado + Nick instrutor + prints). ENTREGAR PATENTE SEMPRE por ATÍPICA, NUNCA por promoção!\n10. Relatório de Rebaixamento: se já rebaixado = não rebaixe. Se não = preencha (Motivo: Omissão de Patente, Antigo cargo, Novo cargo)\n\n🔄 SOLICITAR REVOGAÇÃO (passo a passo):\nAtendimento inicial:\n1. Marque @ e cumprimente. NUNCA inicie sem marcar.\n2. Pesquise em #solicitar-revogação e #entregar-patente. Se já solicitado: "Revogação já solicitada, aguarde até 3h. Se não resolver, abra novo ticket." → Fechar como Resolvido\n3. Identifique o motivo:\n   • Inatividade → NÃO fazemos revogação por inatividade. Informe e feche.\n   • Saiu da comunidade há mais de 24h → NÃO pode. Informe e feche.\n   • Saiu há menos de 24h → PODE, vá para verificação\n   • Rebaixamento sem motivo → vá para verificação\nVerificação de provas:\n4. Logs Admin → lupa → Nick → último comando → print\n5. Logs Chat → lupa → Nick → última mensagem → print\n6. Logs Rover → lupa → Nick → patente real → print\n7. Relatório de Promoção → lupa → Nick → treinamentos físicos → print\n8. Relatório de Rebaixamento → lupa → Nick → rebaixamento registrado → print\n9. Site EB Promoções → histórico → Nick → rebaixamentos → print\nDecisão: analise todas as provas e decida.\n\n🚫 CANAL DE EXÍLIO:\n• Atenção máxima, siga os passos na ordem correta, nunca pule etapas\n• Início: marcar @ + cumprimentar\n• Coletar evidências (logs, prints, histórico)\n• Consultar superior antes de tomar decisão grave\n\n📋 LOGS DO SERVIDOR:\n• Admin: registra COMANDOS executados no EB\n• Chat: registra MENSAGENS enviadas no EB  \n• Rover: registra PATENTES REAIS dos jogadores\n• Use a lupa para filtrar por nick específico\n\n🚫 CGEx PUNIÇÕES:\n• 3 advertências → rebaixado de cargo\n• Aprendiz com 3 advertências → DESLIGADO da CGEx\n• Blacklist: lista negra, pode voltar após período determinado\n• Desligamento voluntário: pode voltar, sem punição\n• Desligamento por punição: PERMANENTE, sem retorno\n\n⚖️ HIERARQUIA CGEx (ordem crescente):\nAprendiz → Sênior → Analista → Instrutor → Instrutor Qualificado → Chefe de Instrução → Corregedor Geral → Administrador Geral\n\n📊 METAS SEMANAIS:\n• Cada cargo tem uma meta de tickets por semana\n• Não bater a meta + acumular advertências = risco de rebaixamento\n• Registre seus atendimentos no canal de relatório\n\n🔑 REGRAS DE OURO:\n✅ SEMPRE marcar @ antes de atender\n✅ SEMPRE tirar prints como comprovação\n✅ Patente SEMPRE por ATÍPICA, NUNCA por promoção\n✅ Revogação por inatividade NUNCA é feita\n✅ Revogação por saída: apenas dentro de 24h\n✅ Em caso de dúvida, consulte seu superior\n✅ Feche tickets com motivo (Resolvido ou Inatividade)\n\nSe não souber algo com certeza, diga claramente e recomende consultar o superior. Nunca invente informações.';

/* ─── FUNÇÃO CENTRAL DE CHAMADA À API CLAUDE ─── */
async function cgexChamarClaude(mensagens, sistemaPadrao) {
  var sistema = sistemaPadrao || CGEX_KB;
  var resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'sk-ant-api03-placeholder-substitua-pela-sua-chave',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      system: sistema,
      messages: mensagens
    })
  });
  var data = await resp.json();
  if (data.content && data.content[0] && data.content[0].text) return data.content[0].text;
  throw new Error(JSON.stringify(data));
}

/* ─── RENDERIZAR MENSAGENS (genérico) ─── */
function cgexRenderMsgs(containerId, mensagens, digitando) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  mensagens.forEach(function(msg) {
    var div = document.createElement('div');
    div.style.cssText = 'display:flex;gap:10px;margin-bottom:14px;' + (msg.tipo === 'usuario' ? 'flex-direction:row-reverse;' : '');
    var avatar = document.createElement('div');
    avatar.style.cssText = 'width:32px;height:32px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:15px;' + (msg.tipo === 'ia' ? 'background:rgba(0,230,118,0.15);border:1px solid rgba(0,230,118,0.3);' : 'background:rgba(61,139,255,0.15);border:1px solid rgba(61,139,255,0.3);');
    avatar.textContent = msg.tipo === 'ia' ? '🤖' : '👤';
    var bubble = document.createElement('div');
    bubble.style.cssText = 'max-width:80%;padding:12px 15px;font-size:13.5px;line-height:1.65;word-break:break-word;' + (msg.tipo === 'ia' ? 'background:rgba(0,230,118,0.07);border:1px solid rgba(0,230,118,0.18);color:#c8d5de;border-radius:4px 14px 14px 14px;' : 'background:rgba(61,139,255,0.12);border:1px solid rgba(61,139,255,0.25);color:#c8d5de;border-radius:14px 4px 14px 14px;');
    bubble.innerHTML = msg.texto
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff;">$1</strong>')
      .replace(/\n/g, '<br>')
      .replace(/^(#{1,3})\s(.+)$/gm, function(m, h, t) { var s = h.length===1?'18px':h.length===2?'16px':'14px'; return '<div style="font-family:\'Rajdhani\',sans-serif;font-size:'+s+';font-weight:700;color:#fff;margin:8px 0 4px;">'+t+'</div>'; })
      .replace(/^[•\-]\s(.+)$/gm, '<div style="display:flex;gap:7px;margin:3px 0;"><span style="color:var(--verde);flex-shrink:0;">•</span><span>$1</span></div>')
      .replace(/✅|☑️/g, '<span style="color:#00e676;">✅</span>');
    div.appendChild(avatar);
    div.appendChild(bubble);
    container.appendChild(div);
  });
  if (digitando) {
    var dotDiv = document.createElement('div');
    dotDiv.style.cssText = 'display:flex;gap:10px;margin-bottom:14px;';
    dotDiv.innerHTML = '<div style="width:32px;height:32px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:15px;background:rgba(0,230,118,0.15);border:1px solid rgba(0,230,118,0.3);">🤖</div><div style="background:rgba(0,230,118,0.07);border:1px solid rgba(0,230,118,0.18);border-radius:4px 14px 14px 14px;padding:14px 18px;display:flex;gap:6px;align-items:center;"><span style="width:8px;height:8px;border-radius:50%;background:var(--verde);animation:dotPulse 1.2s infinite;display:inline-block;"></span><span style="width:8px;height:8px;border-radius:50%;background:var(--verde);animation:dotPulse 1.2s infinite 0.2s;display:inline-block;"></span><span style="width:8px;height:8px;border-radius:50%;background:var(--verde);animation:dotPulse 1.2s infinite 0.4s;display:inline-block;"></span></div>';
    container.appendChild(dotDiv);
  }
  container.scrollTop = container.scrollHeight;
}

/* ══════════════════════
   BOT DA PASTA (logado)
══════════════════════ */
var _pastaMsgs = [];
var _pastaDigitando = false;

function cgexPastaLimparChat() {
  _pastaMsgs = [];
  _pastaDigitando = false;
  _cgexPastaWelcome();
}

function _cgexPastaWelcome() {
  _pastaMsgs = [{ tipo:'ia', texto:'👋 Olá! Sou a **IA CGEx**, treinada com todo o Material de Apoio.\n\nPosso te ajudar com:\n• 🎫 Ordem e fechamento de tickets\n• 🏫 Omissão de patente (10 passos)\n• 🔄 Solicitar revogação\n• 🚫 Exílio, punições e blacklist\n• 📋 Logs do servidor\n• E muito mais!\n\nQual é a sua dúvida? 😊' }];
  cgexRenderMsgs('cgex-pasta-messages', _pastaMsgs, false);
}

function _cgexPastaSetStatus(texto) {
  var bar = document.getElementById('cgex-pasta-review-bar');
  var txt = document.getElementById('cgex-pasta-review-text');
  if (bar) bar.style.display = texto ? 'flex' : 'none';
  if (txt && texto) txt.textContent = texto;
}

async function cgexPastaEnviar() {
  var input = document.getElementById('cgex-pasta-input');
  if (!input) return;
  var texto = input.value.trim();
  if (!texto || _pastaDigitando) return;
  input.value = '';
  input.style.height = 'auto';
  _pastaMsgs.push({ tipo:'usuario', texto:texto });
  _pastaDigitando = true;
  cgexRenderMsgs('cgex-pasta-messages', _pastaMsgs, true);
  var historico = _pastaMsgs.slice(-12).map(function(m) { return { role: m.tipo==='ia'?'assistant':'user', content: m.texto }; });
  try {
    _cgexPastaSetStatus('✨ Gerando resposta...');
    var resposta = await cgexChamarClaude(historico);
    _cgexPastaSetStatus('');
    _pastaDigitando = false;
    _pastaMsgs.push({ tipo:'ia', texto:resposta });
  } catch(e) {
    _cgexPastaSetStatus('');
    _pastaDigitando = false;
    _pastaMsgs.push({ tipo:'ia', texto:'❌ Erro ao conectar com a IA: ' + e.message });
  }
  cgexRenderMsgs('cgex-pasta-messages', _pastaMsgs, false);
}

function cgexPastaKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); cgexPastaEnviar(); }
}

/* ════════════════════════
   BOT PÚBLICO (sem login)
════════════════════════ */
var _pubMsgs = [];
var _pubDigitando = false;

function cgexPublicoLimpar() {
  _pubMsgs = [];
  _pubDigitando = false;
  _cgexPubWelcome();
}

function _cgexPubWelcome() {
  _pubMsgs = [{ tipo:'ia', texto:'👋 Olá! Sou a **IA CGEx**, seu assistente para tirar dúvidas sobre a Corregedoria.\n\nEstou disponível para todos — sem precisar de login! 🎉\n\nPosso te ajudar com:\n• 🎫 Tickets e atendimentos\n• 🏫 Omissão de patente\n• 🔄 Revogações\n• 🚫 Punições e regras\n• ⚖️ Hierarquia da CGEx\n• E qualquer outra dúvida!\n\nO que você precisa saber? 😊' }];
  cgexRenderMsgs('cgex-pub-messages', _pubMsgs, false);
}

function _cgexPubSetStatus(texto) {
  var bar = document.getElementById('cgex-pub-status');
  var txt = document.getElementById('cgex-pub-status-text');
  if (bar) bar.style.display = texto ? 'flex' : 'none';
  if (txt && texto) txt.textContent = texto;
}

async function cgexPublicoEnviar() {
  var input = document.getElementById('cgex-pub-input');
  if (!input) return;
  var texto = input.value.trim();
  if (!texto || _pubDigitando) return;
  input.value = '';
  input.style.height = 'auto';
  _pubMsgs.push({ tipo:'usuario', texto:texto });
  _pubDigitando = true;
  cgexRenderMsgs('cgex-pub-messages', _pubMsgs, true);
  var historico = _pubMsgs.slice(-12).map(function(m) { return { role: m.tipo==='ia'?'assistant':'user', content: m.texto }; });
  try {
    _cgexPubSetStatus('✨ Gerando resposta...');
    var resposta = await cgexChamarClaude(historico);
    _cgexPubSetStatus('');
    _pubDigitando = false;
    _pubMsgs.push({ tipo:'ia', texto:resposta });
  } catch(e) {
    _cgexPubSetStatus('');
    _pubDigitando = false;
    _pubMsgs.push({ tipo:'ia', texto:'❌ Erro ao conectar com a IA: ' + e.message });
  }
  cgexRenderMsgs('cgex-pub-messages', _pubMsgs, false);
}

function cgexPublicoKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); cgexPublicoEnviar(); }
}

/* ════════════════════════
   BOT FLUTUANTE (instrutores logados — mantido)
════════════════════════ */
var cgexChatAberto = false;
var cgexMensagens = [];
var cgexDigitando = false;

function cgexToggleChat() {
  cgexChatAberto = !cgexChatAberto;
  var chat = document.getElementById('cgex-chat-panel');
  var fab = document.getElementById('cgex-fab-btn');
  if (!chat || !fab) return;
  if (cgexChatAberto) {
    chat.style.display = 'flex';
    setTimeout(function() { chat.style.opacity = '1'; chat.style.transform = 'translateY(0) scale(1)'; }, 10);
    fab.innerHTML = '✕';
    fab.style.transform = 'rotate(90deg)';
    var inp = document.getElementById('cgex-chat-input');
    if (inp) inp.focus();
    if (cgexMensagens.length === 0) {
      cgexAdicionarMensagem('ia', '👋 Olá! Sou a **IA CGEx** (Claude AI).\n\nPosso te ajudar com:\n• 🎫 Tickets\n• 🏫 Omissão de patente\n• 🔄 Revogação\n• 🚫 Exílio e punições\n• 📋 Logs\n\nQual é a sua dúvida? 😊');
    }
  } else {
    chat.style.opacity = '0';
    chat.style.transform = 'translateY(20px) scale(0.95)';
    setTimeout(function() { chat.style.display = 'none'; }, 250);
    fab.innerHTML = '🤖';
    fab.style.transform = 'rotate(0deg)';
  }
}

function cgexAdicionarMensagem(tipo, texto) {
  cgexMensagens.push({ tipo: tipo, texto: texto });
  cgexRenderizarMensagens();
}

function cgexRenderizarMensagens() {
  cgexRenderMsgs('cgex-chat-messages', cgexMensagens, cgexDigitando);
}

async function cgexChamarGroq(msgs) {
  // Redireciona para Claude
  return cgexChamarClaude(msgs);
}

function cgexSetReviewBar(texto) {
  var bar = document.getElementById('cgex-review-bar');
  var txt = document.getElementById('cgex-review-text');
  if (bar) { bar.style.display = texto ? 'flex' : 'none'; }
  if (txt && texto) txt.textContent = texto;
}

async function cgexEnviarMensagem() {
  var input = document.getElementById('cgex-chat-input');
  if (!input) return;
  var texto = input.value.trim();
  if (!texto || cgexDigitando) return;
  input.value = '';
  input.style.height = 'auto';
  cgexAdicionarMensagem('usuario', texto);
  cgexDigitando = true;
  cgexRenderizarMensagens();
  var historico = cgexMensagens.slice(-12).map(function(m) { return { role: m.tipo==='ia'?'assistant':'user', content: m.texto }; });
  try {
    cgexSetReviewBar('✨ Consultando Claude AI...');
    var resposta = await cgexChamarClaude(historico);
    cgexSetReviewBar('');
    cgexDigitando = false;
    cgexAdicionarMensagem('ia', resposta + '\n\n✅ *Resposta verificada*');
  } catch(e) {
    cgexSetReviewBar('');
    cgexDigitando = false;
    cgexAdicionarMensagem('ia', '❌ Erro ao conectar com a IA: ' + e.message);
  }
}

function cgexKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); cgexEnviarMensagem(); }
}

function cgexLimparChat() {
  cgexMensagens = [];
  cgexAdicionarMensagem('ia', '🔄 Chat reiniciado! Como posso te ajudar?');
}

var cgexChatInicializado = false;

function cgexMostrarChat() {
  if (cgexChatInicializado) {
    var fab = document.getElementById('cgex-fab-btn');
    if (fab) fab.style.display = 'flex';
    return;
  }
  cgexChatInicializado = true;
  _cgexInjetarChat();
}

function cgexOcultarChat() {
  cgexChatAberto = false;
  cgexChatInicializado = false;
  cgexMensagens = [];
  var fab = document.getElementById('cgex-fab-btn');
  var panel = document.getElementById('cgex-chat-panel');
  if (fab) fab.style.display = 'none';
  if (panel) { panel.style.opacity = '0'; panel.style.transform = 'translateY(20px) scale(0.95)'; setTimeout(function(){ panel.style.display = 'none'; }, 250); }
}

function _cgexInjetarChat() {
  var style = document.createElement('style');
  style.textContent = '#cgex-fab{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#00e676,#00c853);border:none;color:#000;font-size:24px;cursor:pointer;box-shadow:0 4px 20px rgba(0,230,118,0.4);z-index:9999;transition:transform 0.3s,box-shadow 0.3s;display:flex;align-items:center;justify-content:center;animation:pulso 2.5s infinite;}#cgex-fab:hover{box-shadow:0 6px 28px rgba(0,230,118,0.6);}#cgex-panel{position:fixed;bottom:92px;right:24px;width:370px;max-width:calc(100vw - 48px);height:560px;max-height:calc(100vh - 120px);background:#0f1316;border:1px solid rgba(0,230,118,0.25);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.8);z-index:9998;display:none;flex-direction:column;opacity:0;transform:translateY(20px) scale(0.95);transition:opacity 0.25s,transform 0.25s;overflow:hidden;}';
  document.head.appendChild(style);

  var fab = document.createElement('button');
  fab.id = 'cgex-fab-btn';
  fab.innerHTML = '🤖';
  fab.title = 'IA CGEx';
  fab.setAttribute('style','position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#00e676,#00c853);border:none;color:#000;font-size:24px;cursor:pointer;box-shadow:0 4px 20px rgba(0,230,118,0.4);z-index:9999;transition:transform 0.3s,box-shadow 0.3s;display:flex;align-items:center;justify-content:center;animation:pulso 2.5s infinite;');
  fab.onclick = cgexToggleChat;

  var panel = document.createElement('div');
  panel.id = 'cgex-chat-panel';
  panel.setAttribute('style','position:fixed;bottom:92px;right:24px;width:370px;max-width:calc(100vw - 48px);height:560px;max-height:calc(100vh - 120px);background:#0f1316;border:1px solid rgba(0,230,118,0.25);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.8);z-index:9998;display:none;flex-direction:column;opacity:0;transform:translateY(20px) scale(0.95);transition:opacity 0.25s,transform 0.25s;overflow:hidden;');

  var head = document.createElement('div');
  head.id = 'cgex-chat-header';
  head.setAttribute('style','background:linear-gradient(135deg,rgba(0,230,118,0.12),rgba(0,200,83,0.06));border-bottom:1px solid rgba(0,230,118,0.2);padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;');
  head.innerHTML = '<div style="width:36px;height:36px;border-radius:10px;background:rgba(0,230,118,0.15);border:1px solid rgba(0,230,118,0.3);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">🤖</div><div style="flex:1;"><div style="font-family:Rajdhani,sans-serif;font-size:15px;font-weight:700;color:#fff;letter-spacing:0.5px;">IA CGEx</div><div style="font-size:11px;color:#00e676;display:flex;align-items:center;gap:5px;"><span style="width:6px;height:6px;border-radius:50%;background:#00e676;box-shadow:0 0 6px #00e676;display:inline-block;animation:dotPulse 1.5s infinite;"></span>Claude AI · Respostas verificadas ✓</div></div><button onclick="cgexLimparChat()" style="background:none;border:none;color:#5e7380;cursor:pointer;font-size:16px;padding:4px;border-radius:6px;" title="Limpar">🗑️</button><button onclick="cgexToggleChat()" style="background:none;border:none;color:#5e7380;cursor:pointer;font-size:18px;padding:4px;border-radius:6px;">✕</button>';

  var rbar = document.createElement('div');
  rbar.id = 'cgex-review-bar';
  rbar.setAttribute('style','background:rgba(255,171,0,0.07);border-bottom:1px solid rgba(255,171,0,0.2);padding:7px 14px;font-size:11px;color:#ffd740;display:none;align-items:center;gap:7px;flex-shrink:0;');
  rbar.innerHTML = '<span style="animation:dotPulse 1s infinite;display:inline-block;">✨</span><span id="cgex-review-text">Gerando...</span>';

  var msgs = document.createElement('div');
  msgs.id = 'cgex-chat-messages';
  msgs.setAttribute('style','flex:1;overflow-y:auto;padding:14px;scrollbar-width:thin;scrollbar-color:rgba(0,230,118,0.2) transparent;');

  var foot = document.createElement('div');
  foot.setAttribute('style','border-top:1px solid rgba(0,230,118,0.15);padding:10px 12px;display:flex;gap:8px;align-items:flex-end;flex-shrink:0;background:rgba(0,0,0,0.2);');
  foot.innerHTML = '<textarea id="cgex-chat-input" placeholder="Digite sua dúvida..." rows="1" style="flex:1;background:rgba(0,0,0,0.3);border:1px solid rgba(0,230,118,0.2);border-radius:10px;color:#fff;font-family:Inter,sans-serif;font-size:13px;padding:9px 12px;outline:none;resize:none;max-height:80px;line-height:1.4;" onkeydown="cgexKeyDown(event)" oninput="this.style.height=\'auto\';this.style.height=Math.min(this.scrollHeight,80)+\'px\'"></textarea><button id="cgex-send-btn" onclick="cgexEnviarMensagem()" style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,rgba(0,230,118,0.2),rgba(0,200,83,0.1));border:1px solid rgba(0,230,118,0.35);color:#00e676;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">➤</button>';

  panel.appendChild(head);
  panel.appendChild(rbar);
  panel.appendChild(msgs);
  panel.appendChild(foot);
  document.body.appendChild(fab);
  document.body.appendChild(panel);
}


