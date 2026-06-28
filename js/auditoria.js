/* ═══════════════════════════════════════════════════════════════
   AUDITORIA + HISTÓRICO DE CONFIG
   - auditLog(acao, detalhe): registra ações relevantes (append-only)
   - registrarHistoricoConfig(cfg): salva snapshots de configuração
   - Injeta as abas "Auditoria" e "Histórico" no painel admin
═══════════════════════════════════════════════════════════════ */
(function () {

  function usuarioAtual() {
    return sessionStorage.getItem('cgex_auth_nick') ||
           sessionStorage.getItem('roblox_username') ||
           'admin (senha)';
  }

  /* ── Registro de auditoria ───────────────────────────────────── */
  window.auditLog = function (acao, detalhe) {
    try {
      _db.collection('auditoria').add({
        acao: acao || 'evento',
        detalhe: detalhe || '',
        usuario: usuarioAtual(),
        ts: Date.now()
      });
    } catch (e) { console.warn('auditLog:', e); }
  };

  /* ── Histórico de configuração (com throttle) ────────────────── */
  var _ultimoHist = 0;
  window.registrarHistoricoConfig = function (cfg) {
    var agora = Date.now();
    if (agora - _ultimoHist < 2000) return;   // evita spam de gravações
    _ultimoHist = agora;
    try {
      var clone = JSON.parse(JSON.stringify(cfg || {}));
      if (clone.adminPasswordHash) clone.adminPasswordHash = '[protegido]';
      _db.collection('config_historico').add({
        dados: JSON.stringify(clone).slice(0, 8000),
        usuario: usuarioAtual(),
        ts: agora
      });
    } catch (e) { console.warn('histórico config:', e); }
  };

  /* ── Render ──────────────────────────────────────────────────── */
  var ICON = {
    admin_login: '🔓', admin_senha_alterada: '🔑', banimento: '🚫',
    desbanimento: '✅', notificacao_enviada: '🔔', config_alterada: '⚙️',
    conteudo_editado: '✏️', conteudo_adicionado: '➕', conteudo_removido: '🗑️'
  };
  function fmt(ts) {
    try { return new Date(ts).toLocaleString('pt-BR'); } catch (e) { return ''; }
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  window.carregarAuditoria = async function () {
    var cont = document.getElementById('auditoria-container');
    if (!cont) return;
    cont.innerHTML = '<div class="aud-vazio">Carregando…</div>';
    try {
      var snap = await _db.collection('auditoria').orderBy('ts', 'desc').limit(100).get();
      if (snap.empty) { cont.innerHTML = '<div class="aud-vazio">Nenhuma ação registrada ainda.</div>'; return; }
      var html = '';
      snap.forEach(function (d) {
        var a = d.data();
        html += '<div class="aud-item"><span class="aud-ic">' + (ICON[a.acao] || '•') + '</span>' +
          '<div class="aud-corpo"><div class="aud-linha1"><b>' + esc(a.acao) + '</b> ' + esc(a.detalhe) + '</div>' +
          '<div class="aud-linha2">' + esc(a.usuario) + ' · ' + fmt(a.ts) + '</div></div></div>';
      });
      cont.innerHTML = html;
    } catch (e) {
      cont.innerHTML = '<div class="aud-vazio">Erro ao carregar (verifique login anônimo/regras): ' + esc(e.code || e.message) + '</div>';
    }
  };

  window.carregarHistoricoConfig = async function () {
    var cont = document.getElementById('historico-container');
    if (!cont) return;
    cont.innerHTML = '<div class="aud-vazio">Carregando…</div>';
    try {
      var snap = await _db.collection('config_historico').orderBy('ts', 'desc').limit(50).get();
      if (snap.empty) { cont.innerHTML = '<div class="aud-vazio">Nenhuma alteração registrada ainda.</div>'; return; }
      var html = '';
      snap.forEach(function (d) {
        var h = d.data();
        html += '<div class="aud-item"><span class="aud-ic">⚙️</span>' +
          '<div class="aud-corpo"><div class="aud-linha1">Configuração salva por <b>' + esc(h.usuario) + '</b></div>' +
          '<div class="aud-linha2">' + fmt(h.ts) + '</div>' +
          '<details class="aud-det"><summary>ver dados</summary><pre>' + esc(h.dados) + '</pre></details>' +
          '</div></div>';
      });
      cont.innerHTML = html;
    } catch (e) {
      cont.innerHTML = '<div class="aud-vazio">Erro ao carregar: ' + esc(e.code || e.message) + '</div>';
    }
  };

  /* ── Injeção das abas no painel admin ────────────────────────── */
  function injetarAbas() {
    var nav = document.querySelector('.admin-nav');
    var content = document.querySelector('.admin-content');
    if (!nav || !content || document.getElementById('admin-aba-auditoria')) return;

    function addTab(label, chave, fn) {
      var b = document.createElement('button');
      b.className = 'admin-tab';
      b.setAttribute('onclick', "adminAba('" + chave + "', this); " + fn + "()");
      b.textContent = label;
      // insere antes da aba Debug, se existir
      var debug = Array.prototype.find.call(nav.querySelectorAll('.admin-tab'), function (t) {
        return (t.getAttribute('onclick') || '').indexOf("'debug'") !== -1;
      });
      if (debug) nav.insertBefore(b, debug); else nav.appendChild(b);
    }
    function addSecao(chave, titulo, sub, contId, fn) {
      var div = document.createElement('div');
      div.id = 'admin-aba-' + chave;
      div.className = 'admin-secao';
      div.innerHTML =
        '<div class="admin-card"><div class="admin-card-titulo">' + titulo + '</div>' +
        '<div class="admin-card-subtitulo">' + sub + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">' +
        '<button class="btn-admin-salvar" onclick="' + fn + '()" style="background:rgba(61,139,255,0.15);border:1px solid rgba(61,139,255,0.4);color:#7eb3ff;">🔄 Atualizar</button></div>' +
        '<div id="' + contId + '" class="aud-lista" style="margin-top:16px;"></div></div>';
      content.appendChild(div);
    }

    addTab('🕵️ Auditoria', 'auditoria', 'carregarAuditoria');
    addTab('🕘 Histórico', 'historico', 'carregarHistoricoConfig');
    addSecao('auditoria', '🕵️ Auditoria de Ações',
      'Registro de logins de admin, banimentos, notificações, alterações e edições de conteúdo.',
      'auditoria-container', 'carregarAuditoria');
    addSecao('historico', '🕘 Histórico de Configuração',
      'Snapshots de cada alteração salva nas configurações do sistema.',
      'historico-container', 'carregarHistoricoConfig');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injetarAbas);
  else injetarAbas();
})();
