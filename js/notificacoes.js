/* ═══════════════════════════════════════════════════════════════
   MURAL DE NOTIFICAÇÕES — histórico das notificações enviadas
   Sino flutuante (visível quando logado) + painel com as últimas
   notificações, contador de não lidas. Arquiva cada notificação
   urgente na coleção "notificacoes".
═══════════════════════════════════════════════════════════════ */
(function () {
  var TIPO_COR = {
    vermelho: ['#ff4f4f', '🚨'], amarelo: ['#ffab00', '⚠️'],
    verde: ['#00e676', '📢'], azul: ['#3d8bff', 'ℹ️']
  };

  function fmtData(ts) {
    if (!ts) return '';
    try { return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  }

  function renderMural(lista) {
    var cont = document.getElementById('mural-lista');
    if (!cont) return;
    if (!lista.length) {
      cont.innerHTML = '<div class="mural-vazio">Nenhuma notificação ainda.</div>';
    } else {
      cont.innerHTML = lista.map(function (n) {
        var c = TIPO_COR[n.tipo] || TIPO_COR.verde;
        return '<div class="mural-item" style="border-left:3px solid ' + c[0] + ';">' +
          '<div class="mural-item-top"><span class="mural-item-titulo">' + c[1] + ' ' +
          escapar(n.titulo || 'Notificação') + '</span>' +
          '<span class="mural-item-data">' + fmtData(n.ts) + '</span></div>' +
          '<div class="mural-item-msg">' + escapar(n.msg || '') + '</div></div>';
      }).join('');
    }
    // Contador de não lidas
    var visto = parseInt(localStorage.getItem('mural_ultimo_visto') || '0', 10);
    var naoLidas = lista.filter(function (n) { return (n.ts || 0) > visto; }).length;
    var badge = document.getElementById('mural-badge');
    if (badge) {
      badge.textContent = naoLidas > 9 ? '9+' : String(naoLidas);
      badge.style.display = naoLidas > 0 ? 'flex' : 'none';
    }
    window._muralMaxTs = lista.reduce(function (m, n) { return Math.max(m, n.ts || 0); }, 0);
  }

  function escapar(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function ouvirMural() {
    try {
      _db.collection('notificacoes').orderBy('ts', 'desc').limit(30)
        .onSnapshot(function (snap) {
          var lista = [];
          snap.forEach(function (d) { lista.push(d.data()); });
          renderMural(lista);
        }, function (err) { console.warn('mural onSnapshot:', err.code || err); });
    } catch (e) { console.warn('mural:', e); }
  }

  window.abrirMural = function () {
    var p = document.getElementById('mural-painel');
    if (p) p.classList.add('aberto');
    localStorage.setItem('mural_ultimo_visto', String(window._muralMaxTs || Date.now()));
    var badge = document.getElementById('mural-badge');
    if (badge) badge.style.display = 'none';
  };
  window.fecharMural = function () {
    var p = document.getElementById('mural-painel');
    if (p) p.classList.remove('aberto');
  };

  function atualizarVisibilidadeMural() {
    var btn = document.getElementById('mural-btn');
    var logado = document.getElementById('tela-logado');
    if (!btn || !logado) return;
    var visivel = getComputedStyle(logado).display !== 'none';
    btn.style.display = visivel ? 'flex' : 'none';
    if (!visivel) window.fecharMural();
  }

  function montar() {
    if (document.getElementById('mural-btn')) return;

    var btn = document.createElement('button');
    btn.id = 'mural-btn';
    btn.className = 'mural-btn';
    btn.title = 'Notificações';
    btn.innerHTML = '🔔<span class="mural-badge" id="mural-badge" style="display:none;">0</span>';
    btn.onclick = window.abrirMural;
    document.body.appendChild(btn);

    var painel = document.createElement('div');
    painel.id = 'mural-painel';
    painel.className = 'mural-painel';
    painel.innerHTML =
      '<div class="mural-cab"><span>🔔 Notificações</span>' +
      '<button class="mural-x" onclick="fecharMural()">✕</button></div>' +
      '<div id="mural-lista" class="mural-lista"></div>';
    document.body.appendChild(painel);

    atualizarVisibilidadeMural();

    // Mostra/esconde o sino conforme a tela
    var origIr = window.ir;
    window.ir = function () {
      var r = (typeof origIr === 'function') ? origIr.apply(this, arguments) : undefined;
      try { atualizarVisibilidadeMural(); } catch (e) {}
      return r;
    };

    // Arquiva cada notificação urgente no mural
    var origSalvar = window.salvarNotificacaoUrgente;
    window.salvarNotificacaoUrgente = async function () {
      var r = (typeof origSalvar === 'function') ? await origSalvar.apply(this, arguments) : undefined;
      try {
        var cfg = getConfig();
        if (cfg.notifUrgente && cfg.notifUrgente.ativo) {
          await _db.collection('notificacoes').add({
            titulo: cfg.notifUrgente.titulo || '',
            msg: cfg.notifUrgente.msg || '',
            tipo: cfg.notifUrgente.tipo || 'verde',
            ts: cfg.notifUrgente.ts || Date.now()
          });
          if (typeof auditLog === 'function') auditLog('notificacao_enviada', cfg.notifUrgente.titulo || '');
        }
      } catch (e) { console.warn('arquivar notificação:', e); }
      return r;
    };

    // Começa a ouvir o mural só depois da autenticação
    if (typeof garantirAuth === 'function') garantirAuth().then(ouvirMural).catch(ouvirMural);
    else ouvirMural();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
