/* ═══════════════════════════════════════════════════════════════
   CARGOS — DRAG & DROP por hierarquia
   - Renderiza os instrutores agrupados por cargo
   - Arraste um nick para outro cargo para mudar
   - Salva ao soltar (Firestore via saveConfig)
═══════════════════════════════════════════════════════════════ */
(function () {
  var HIERARQUIA = [
    { id: 'Administrador Geral', cor: '#ff8080', icone: '👑' },
    { id: 'Corregedor Geral',    cor: '#ce93d8', icone: '⚖️' },
    { id: 'Chefe de Instrução',  cor: '#ffd740', icone: '🎖️' },
    { id: 'Instrutor Qualificado', cor: '#69f0ae', icone: '🧑‍🏫' },
    { id: '',                    cor: 'var(--cinza)', icone: '❓', rotulo: 'Sem cargo' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function renderDnD() {
    var container = document.getElementById('admin-cargos-lista');
    if (!container) return;
    var cfg = getConfig();
    var instrutores = (cfg.manualInstructors || []).slice();
    var cargos = cfg.instrutorCargos || {};

    if (instrutores.length === 0) {
      container.innerHTML = '<span style="color:var(--cinza);font-size:13px;">Nenhum instrutor na lista ainda.</span>';
      return;
    }

    // Agrupa por cargo
    var grupos = {};
    HIERARQUIA.forEach(function (h) { grupos[h.id] = []; });
    instrutores.forEach(function (nick) {
      var c = cargos[nick.toLowerCase()] || cargos[nick] || '';
      if (!(c in grupos)) c = '';
      grupos[c].push(nick);
    });

    var html =
      '<div class="dnd-aviso">💡 Arraste um instrutor para outro cargo para mudar — salvamento automático. ' +
      '<button class="dnd-toggle" onclick="window._cargosToggleClassico()">Modo clássico</button></div>';
    HIERARQUIA.forEach(function (h) {
      var rotulo = h.rotulo || h.id;
      html += '<div class="cargo-grupo" data-cargo="' + esc(h.id) + '" ' +
              'ondragover="event.preventDefault(); this.classList.add(\'sobre\');" ' +
              'ondragleave="this.classList.remove(\'sobre\');" ' +
              'ondrop="window._cargosDrop(event, \'' + esc(h.id).replace(/'/g, "\\'") + '\')">' +
        '<div class="cargo-grupo-titulo" style="border-color:' + h.cor + ';color:' + h.cor + ';">' +
          h.icone + ' ' + esc(rotulo) + ' <span class="cargo-count">' + grupos[h.id].length + '</span>' +
        '</div>' +
        '<div class="cargo-grupo-itens">';
      if (grupos[h.id].length === 0) {
        html += '<div class="cargo-vazio">— solte aqui —</div>';
      } else {
        grupos[h.id].forEach(function (nick) {
          html += '<div class="cargo-chip" draggable="true" ' +
            'ondragstart="event.dataTransfer.setData(\'text/plain\', \'' + esc(nick).replace(/'/g, "\\'") + '\'); this.classList.add(\'arrastando\');" ' +
            'ondragend="this.classList.remove(\'arrastando\'); document.querySelectorAll(\'.cargo-grupo\').forEach(g=>g.classList.remove(\'sobre\'));" ' +
            'tabindex="0" ' +
            'role="button" aria-label="Arrastar instrutor ' + esc(nick) + '">' +
            '🧑 ' + esc(nick) +
            '</div>';
        });
      }
      html += '</div></div>';
    });
    container.innerHTML = html;
  }

  window._cargosDrop = async function (e, novoCargo) {
    e.preventDefault();
    var nick = e.dataTransfer.getData('text/plain');
    if (!nick) return;
    var cfg = getConfig();
    cfg.instrutorCargos = Object.assign({}, cfg.instrutorCargos || {});
    if (novoCargo) cfg.instrutorCargos[nick.toLowerCase()] = novoCargo;
    else delete cfg.instrutorCargos[nick.toLowerCase()];
    try {
      await saveConfig(cfg);
      if (typeof auditLog === 'function') auditLog('cargo_alterado', nick + ' → ' + (novoCargo || 'sem cargo'));
      mostrarToast('🎖️ ' + nick + ' agora é ' + (novoCargo || 'sem cargo'), 'sucesso');
      renderDnD();
      if (typeof renderizarListaInstrutoresRoblox === 'function') renderizarListaInstrutoresRoblox();
    } catch (err) {
      mostrarToast('Erro ao salvar: ' + (err.code || err.message), 'erro');
    }
  };

  // Alterna entre o modo DnD novo e o select clássico do app.js
  var _modoClassico = false;
  window._cargosToggleClassico = function () {
    _modoClassico = !_modoClassico;
    if (_modoClassico && _origRender) _origRender();
    else renderDnD();
  };

  // Sobrescreve a função de renderização do app.js
  var _origRender = window.renderizarAdminCargos;
  window.renderizarAdminCargos = function () {
    if (_modoClassico && typeof _origRender === 'function') return _origRender.apply(this, arguments);
    renderDnD();
  };
})();
