/* ═══════════════════════════════════════════════════════════════
   HISTÓRICO DE BANIMENTOS COM MOTIVO
   - Coleção "banimentos" guarda metadados (motivo, evidência, autor)
   - Lista atual cfg.banidos (string[]) continua funcionando — usada
     pelo verificarSeBanido para o check rápido. Sincronizamos as duas.
   - UI nova injetada na aba "🚫 Banidos" do painel admin
═══════════════════════════════════════════════════════════════ */
(function () {
  var _historico = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmt(ts) { try { return new Date(ts).toLocaleString('pt-BR'); } catch (e) { return ''; } }
  function usuarioAtual() {
    return sessionStorage.getItem('cgex_auth_nick') ||
           sessionStorage.getItem('roblox_username') || 'admin (senha)';
  }

  function ouvirHistorico() {
    try {
      _db.collection('banimentos').orderBy('ts', 'desc').limit(200)
        .onSnapshot(function (snap) {
          _historico = [];
          snap.forEach(function (d) { _historico.push(Object.assign({ id: d.id }, d.data())); });
          renderHistorico();
        }, function (err) { console.warn('banimentos onSnapshot:', err.code || err); });
    } catch (e) { console.warn('ouvirHistorico:', e); }
  }

  function injetarUI() {
    var aba = document.getElementById('admin-aba-banidos');
    if (!aba || document.getElementById('ban-card-novo')) return;

    // Formulário de novo banimento (com motivo)
    var formCard = document.createElement('div');
    formCard.className = 'admin-card';
    formCard.id = 'ban-card-novo';
    formCard.style.marginTop = '16px';
    formCard.innerHTML =
      '<div class="admin-card-titulo">📝 Banir com motivo</div>' +
      '<div class="admin-card-subtitulo">Registra o banimento com motivo, evidência e autor. O nick também é adicionado à lista atual.</div>' +
      '<label class="admin-label" style="margin-top:14px;">Nick a banir</label>' +
      '<input class="admin-input" id="ban-novo-nick" type="text" placeholder="Nick do Roblox" />' +
      '<label class="admin-label" style="margin-top:10px;">Motivo</label>' +
      '<select class="admin-input" id="ban-novo-tipo" style="cursor:pointer;">' +
      '<option value="script">Uso de Script</option>' +
      '<option value="fraude">Fraude</option>' +
      '<option value="desrespeito">Desrespeito</option>' +
      '<option value="abuso">Abuso de cargo</option>' +
      '<option value="reincidente">Reincidente</option>' +
      '<option value="outro">Outro</option></select>' +
      '<label class="admin-label" style="margin-top:10px;">Descrição</label>' +
      '<textarea class="admin-input" id="ban-novo-desc" rows="3" placeholder="Explicação do banimento…" style="resize:vertical;"></textarea>' +
      '<label class="admin-label" style="margin-top:10px;">Evidência (link opcional)</label>' +
      '<input class="admin-input" id="ban-novo-evidencia" type="text" placeholder="https://discord.com/..." />' +
      '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">' +
      '<button class="btn-admin-salvar" onclick="banirComMotivo()" style="background:rgba(255,79,79,0.15);border:1px solid rgba(255,79,79,0.4);color:#ff8080;">🚫 Banir</button>' +
      '</div>' +
      '<div id="ban-novo-status" style="font-size:13px;color:var(--cinza);margin-top:10px;"></div>';
    aba.appendChild(formCard);

    // Histórico de banimentos
    var histCard = document.createElement('div');
    histCard.className = 'admin-card';
    histCard.id = 'ban-card-hist';
    histCard.style.marginTop = '16px';
    histCard.innerHTML =
      '<div class="admin-card-titulo">📜 Histórico de Banimentos</div>' +
      '<div class="admin-card-subtitulo">Todos os banimentos registrados com motivo. O desbanir aqui também remove da lista atual.</div>' +
      '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;align-items:center;">' +
      '<input class="admin-input" id="ban-hist-busca" placeholder="Filtrar por nick…" style="flex:1;min-width:200px;margin-bottom:0;" oninput="window._filtrarHistBan && window._filtrarHistBan(this.value)" />' +
      '<select class="admin-input" id="ban-hist-status" style="margin-bottom:0;cursor:pointer;width:auto;" onchange="window._filtrarHistBan && window._filtrarHistBan()">' +
      '<option value="todos">Todos</option><option value="ativo">Ativos</option><option value="desbanido">Desbanidos</option>' +
      '</select></div>' +
      '<div id="ban-hist-lista" style="margin-top:14px;display:flex;flex-direction:column;gap:8px;max-height:480px;overflow-y:auto;"></div>' +
      '<div id="ban-hist-vazio" style="color:var(--cinza);font-size:13px;margin-top:10px;display:none;">Nenhum registro.</div>';
    aba.appendChild(histCard);
  }

  function renderHistorico() {
    var lista = document.getElementById('ban-hist-lista');
    var vazio = document.getElementById('ban-hist-vazio');
    if (!lista) return;
    var busca = (document.getElementById('ban-hist-busca') || {}).value || '';
    var statusF = (document.getElementById('ban-hist-status') || {}).value || 'todos';
    var nq = busca.toLowerCase().trim();
    var filtrados = _historico.filter(function (b) {
      if (nq && (b.nick || '').toLowerCase().indexOf(nq) === -1) return false;
      if (statusF === 'ativo' && b.status !== 'ativo') return false;
      if (statusF === 'desbanido' && b.status !== 'desbanido') return false;
      return true;
    });
    if (filtrados.length === 0) { lista.innerHTML = ''; if (vazio) vazio.style.display = 'block'; return; }
    if (vazio) vazio.style.display = 'none';
    lista.innerHTML = filtrados.map(function (b) {
      var ativoBadge = b.status === 'desbanido'
        ? '<span class="ban-badge desbanido">✅ desbanido</span>'
        : '<span class="ban-badge ativo">🚫 ativo</span>';
      var btnAcao = b.status === 'desbanido'
        ? ''
        : '<button class="btn-ban-acao desbanir" onclick="desbanirRegistro(\'' + b.id + '\')">✅ Desbanir</button>';
      var evidencia = b.evidencia
        ? '<div class="ban-linha"><b>Evidência:</b> <a href="' + esc(b.evidencia) + '" target="_blank" rel="noopener">abrir link</a></div>'
        : '';
      var desbanInfo = b.status === 'desbanido' && b.desbanidoPor
        ? '<div class="ban-linha"><b>Desbanido por:</b> ' + esc(b.desbanidoPor) + ' em ' + fmt(b.desbanidoEm) + '</div>'
        : '';
      return '<div class="ban-item">' +
        '<div class="ban-topo">' +
          '<span class="ban-nick">🚫 ' + esc(b.nick) + '</span>' +
          ativoBadge +
          '<span class="ban-data">' + fmt(b.ts) + '</span>' +
        '</div>' +
        '<div class="ban-linha"><b>Motivo:</b> ' + esc(b.tipo || '—') + (b.descricao ? ' — ' + esc(b.descricao) : '') + '</div>' +
        '<div class="ban-linha"><b>Banido por:</b> ' + esc(b.banidoPor || '—') + '</div>' +
        evidencia + desbanInfo +
        (btnAcao ? '<div class="ban-acoes">' + btnAcao + '</div>' : '') +
        '</div>';
    }).join('');
  }
  window._filtrarHistBan = renderHistorico;

  /* ─── Ações ─── */

  window.banirComMotivo = async function () {
    var nick = (document.getElementById('ban-novo-nick').value || '').trim();
    var tipo = document.getElementById('ban-novo-tipo').value;
    var desc = (document.getElementById('ban-novo-desc').value || '').trim();
    var evidencia = (document.getElementById('ban-novo-evidencia').value || '').trim();
    var status = document.getElementById('ban-novo-status');
    if (!nick) { mostrarToast('⚠️ Digite o nick.', 'erro'); return; }
    var cfg = getConfig();
    var lower = (cfg.banidos || []).map(function (n) { return n.toLowerCase(); });
    if (lower.indexOf(nick.toLowerCase()) !== -1) {
      mostrarToast('⚠️ Este nick já está banido.', 'erro'); return;
    }
    try {
      // 1) Salva no histórico
      await _db.collection('banimentos').add({
        nick: nick, tipo: tipo, descricao: desc, evidencia: evidencia,
        banidoPor: usuarioAtual(), ts: Date.now(), status: 'ativo'
      });
      // 2) Adiciona à lista atual (mantém compatibilidade com verificarSeBanido)
      var cfg2 = getConfig();
      var bans = Array.isArray(cfg2.banidos) ? cfg2.banidos.slice() : [];
      bans.push(nick);
      cfg2.banidos = bans;
      await saveConfig(cfg2);
      if (typeof _listaBanidos !== 'undefined') { _listaBanidos.push(nick); if (typeof renderizarBanidos === 'function') renderizarBanidos(); }
      if (typeof auditLog === 'function') auditLog('banimento', nick + ' (' + tipo + ')');
      document.getElementById('ban-novo-nick').value = '';
      document.getElementById('ban-novo-desc').value = '';
      document.getElementById('ban-novo-evidencia').value = '';
      if (status) { status.textContent = '✅ Banimento registrado!'; setTimeout(function () { status.textContent = ''; }, 3000); }
      mostrarToast('🚫 ' + nick + ' foi banido.', 'sucesso');
    } catch (e) {
      mostrarToast('Erro ao banir: ' + (e.code || e.message), 'erro');
    }
  };

  window.desbanirRegistro = async function (id) {
    var reg = _historico.find(function (b) { return b.id === id; });
    if (!reg) return;
    if (!confirm('Desbanir ' + reg.nick + '?')) return;
    try {
      // 1) Marca como desbanido no histórico (não apaga — auditoria)
      await _db.collection('banimentos').doc(id).update({
        status: 'desbanido', desbanidoPor: usuarioAtual(), desbanidoEm: Date.now()
      });
      // 2) Remove da lista atual
      var cfg = getConfig();
      var bans = Array.isArray(cfg.banidos) ? cfg.banidos.slice() : [];
      cfg.banidos = bans.filter(function (n) { return n.toLowerCase() !== reg.nick.toLowerCase(); });
      await saveConfig(cfg);
      if (typeof _listaBanidos !== 'undefined') {
        for (var i = _listaBanidos.length - 1; i >= 0; i--) {
          if (_listaBanidos[i].toLowerCase() === reg.nick.toLowerCase()) _listaBanidos.splice(i, 1);
        }
        if (typeof renderizarBanidos === 'function') renderizarBanidos();
      }
      if (typeof auditLog === 'function') auditLog('desbanimento', reg.nick);
      mostrarToast('✅ ' + reg.nick + ' desbanido.', 'sucesso');
    } catch (e) {
      mostrarToast('Erro ao desbanir: ' + (e.code || e.message), 'erro');
    }
  };

  function montar() {
    injetarUI();
    if (typeof garantirAuth === 'function') garantirAuth().then(ouvirHistorico).catch(ouvirHistorico);
    else ouvirHistorico();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
