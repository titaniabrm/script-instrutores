/* ═══════════════════════════════════════════════════════════════
   IA CGEx — Histórico por usuário + "Perguntar sobre esta pasta"
   + sugestão proativa de passos críticos
   - Salva/retoma a conversa atual por nick (Firestore: ia_conversas/{nick})
   - Guarda sessões anteriores (até 20) acessíveis num painel de histórico
   - Botão em pastas de procedimento abre a IA já com contexto daquele assunto
   - Ao entrar via esse contexto, a IA manda um aviso proativo dos passos
     críticos daquele procedimento (reforço, não substitui o checklist)
═══════════════════════════════════════════════════════════════ */
(function () {
  var MAX_SESSOES = 20;
  var _sessoesCache = [];
  var _saveTimer = null;

  function nickAtual() {
    var n = sessionStorage.getItem('cgex_auth_nick') || sessionStorage.getItem('roblox_username') || '';
    return n.toLowerCase().trim();
  }
  function docRef() {
    var n = nickAtual();
    return n ? _db.collection('ia_conversas').doc(n) : null;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmt(ts) { try { return new Date(ts).toLocaleString('pt-BR'); } catch (e) { return ''; } }

  /* ─── Persistência da conversa atual (resumo automático) ─── */
  function salvarAtualDebounced() {
    var ref = docRef();
    if (!ref) return;
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(function () {
      ref.set({ atual: _pastaMsgs, atualizadoEm: Date.now() }, { merge: true }).catch(function (e) {
        console.warn('ia-historico salvarAtual:', e.code || e);
      });
    }, 800);
  }

  async function carregarAtualSalva() {
    var ref = docRef();
    if (!ref) return null;
    try {
      var doc = await ref.get();
      if (doc.exists) {
        var d = doc.data();
        return Array.isArray(d.atual) ? d.atual : null;
      }
    } catch (e) { console.warn('ia-historico carregarAtual:', e.code || e); }
    return null;
  }

  /* ─── Arquivar sessão concluída no histórico ─── */
  async function arquivarSessaoAtual() {
    var ref = docRef();
    if (!ref || !window._pastaMsgs || _pastaMsgs.length <= 1) return; // só welcome, nada a guardar
    var primeiraDoUsuario = _pastaMsgs.find(function (m) { return m.tipo === 'usuario'; });
    var titulo = primeiraDoUsuario ? primeiraDoUsuario.texto.slice(0, 60) : 'Conversa sem título';
    var nova = { id: 'sess_' + Date.now(), titulo: titulo, ts: Date.now(), mensagens: _pastaMsgs.slice() };
    try {
      var doc = await ref.get();
      var sessoes = (doc.exists && Array.isArray(doc.data().sessoes)) ? doc.data().sessoes : [];
      sessoes.unshift(nova);
      if (sessoes.length > MAX_SESSOES) sessoes = sessoes.slice(0, MAX_SESSOES);
      await ref.set({ sessoes: sessoes, atual: [] }, { merge: true });
      _sessoesCache = sessoes;
    } catch (e) { console.warn('ia-historico arquivar:', e.code || e); }
  }

  /* ─── Painel de histórico ─── */
  function montarPainelHistorico() {
    if (document.getElementById('ia-hist-painel')) return;
    var p = document.createElement('div');
    p.id = 'ia-hist-painel';
    p.className = 'ia-hist-painel';
    p.innerHTML =
      '<div class="ia-hist-cab"><span>📜 Histórico de Conversas</span>' +
      '<button class="mural-x" onclick="fecharHistoricoIA()">✕</button></div>' +
      '<div id="ia-hist-lista" class="ia-hist-lista"></div>';
    document.body.appendChild(p);
  }

  function renderHistorico() {
    var lista = document.getElementById('ia-hist-lista');
    if (!lista) return;
    if (!_sessoesCache.length) {
      lista.innerHTML = '<div class="ia-hist-vazio">Nenhuma conversa salva ainda. Converse com a IA e clique em 🗑️ para arquivar a sessão atual.</div>';
      return;
    }
    lista.innerHTML = _sessoesCache.map(function (s, i) {
      return '<div class="ia-hist-item" onclick="abrirSessaoIA(' + i + ')">' +
        '<div class="ia-hist-titulo">' + esc(s.titulo) + '</div>' +
        '<div class="ia-hist-data">' + fmt(s.ts) + ' · ' + s.mensagens.length + ' mensagens</div>' +
        '</div>';
    }).join('');
  }

  window.abrirHistoricoIA = async function () {
    montarPainelHistorico();
    var ref = docRef();
    if (ref) {
      try {
        var doc = await ref.get();
        _sessoesCache = (doc.exists && Array.isArray(doc.data().sessoes)) ? doc.data().sessoes : [];
      } catch (e) { console.warn('abrirHistoricoIA:', e.code || e); }
    }
    renderHistorico();
    document.getElementById('ia-hist-painel').classList.add('aberto');
  };
  window.fecharHistoricoIA = function () {
    var p = document.getElementById('ia-hist-painel');
    if (p) p.classList.remove('aberto');
  };
  window.abrirSessaoIA = function (i) {
    var s = _sessoesCache[i];
    if (!s) return;
    _pastaMsgs = s.mensagens.slice();
    cgexRenderMsgs('cgex-pasta-messages', _pastaMsgs, false);
    window.fecharHistoricoIA();
  };

  /* ─── "Perguntar à IA sobre esta pasta" + sugestão proativa ─── */
  var CONTEXTO_PASTAS = {
    tickets: {
      nome: 'Ordem dos Tickets',
      proativo: '🎫 Você veio da pasta **Ordem dos Tickets**. Lembre-se dos pontos críticos: atenda sempre **de cima para baixo**, feche sempre **com motivo** (Resolvido ou Inatividade) e registre no **Relatório de Ticket** depois de fechar. Em que posso ajudar especificamente?'
    },
    omissao: {
      nome: 'Omissão de Patente',
      proativo: '🏫 Você veio da pasta **Omissão de Patente**. Pontos que mais geram erro: confirmar **CDP** e os **logs Rover/Admin/Chat** antes de qualquer coisa, e entregar a patente sempre por **ATÍPICA**, nunca por promoção. Qual passo você quer revisar?'
    },
    revogacao: {
      nome: 'Solicitar Revogação',
      proativo: '🔄 Você veio da pasta **Solicitar Revogação**. Lembre-se: **não fazemos revogação por inatividade**, e revogação por saída só vale se foi **há menos de 24h**. Já verificou se a revogação foi solicitada antes (#solicitar-revogação)?'
    },
    exilio: {
      nome: 'Canal de Exílio',
      proativo: '🚫 Você veio da pasta **Canal de Exílio**. Antes de qualquer decisão: colete as evidências, confira se o exílio já foi solicitado e, em casos graves, **consulte seu superior**. Quer ajuda com o modelo certo de exílio (Script/Fraude)?'
    }
  };

  window.perguntarIaSobrePasta = function (pastaId) {
    sessionStorage.setItem('cgex_ia_contexto_pasta', pastaId);
    if (typeof abrirPasta === 'function') abrirPasta('ia-cgex');
  };

  function injetarBotoesContexto() {
    Object.keys(CONTEXTO_PASTAS).forEach(function (id) {
      var tela = document.getElementById('tela-pasta-' + id);
      if (!tela || document.getElementById('btn-ia-contexto-' + id)) return;
      var alvo = document.getElementById('conteudo-extra-' + id) || tela.querySelector('main') || tela;
      var btn = document.createElement('button');
      btn.id = 'btn-ia-contexto-' + id;
      btn.className = 'btn-ia-contexto';
      btn.innerHTML = '🤖 Perguntar à IA sobre isto';
      btn.onclick = function () { window.perguntarIaSobrePasta(id); };
      alvo.parentNode.insertBefore(btn, alvo.nextSibling && alvo.nextSibling !== alvo ? alvo : alvo.nextSibling);
      if (!btn.parentNode) tela.appendChild(btn); // fallback de segurança
    });
  }

  /* ─── Hooks no fluxo existente da IA ─── */

  // Resume a última conversa salva (se houver) ou aplica contexto proativo
  var origWelcome = window._cgexPastaWelcome;
  window._cgexPastaWelcome = async function () {
    var contexto = sessionStorage.getItem('cgex_ia_contexto_pasta');
    sessionStorage.removeItem('cgex_ia_contexto_pasta');
    if (contexto && CONTEXTO_PASTAS[contexto]) {
      _pastaMsgs = [{ tipo: 'ia', texto: CONTEXTO_PASTAS[contexto].proativo }];
      cgexRenderMsgs('cgex-pasta-messages', _pastaMsgs, false);
      return;
    }
    var salva = await carregarAtualSalva();
    if (salva && salva.length > 0) {
      _pastaMsgs = salva;
      cgexRenderMsgs('cgex-pasta-messages', _pastaMsgs, false);
      return;
    }
    return (typeof origWelcome === 'function') ? origWelcome.apply(this, arguments) : undefined;
  };

  // Salva a conversa automaticamente após cada resposta da IA
  var origEnviar = window.cgexPastaEnviar;
  window.cgexPastaEnviar = async function () {
    var r = await origEnviar.apply(this, arguments);
    salvarAtualDebounced();
    return r;
  };

  // Ao limpar, arquiva a sessão anterior antes de zerar
  var origLimpar = window.cgexPastaLimparChat;
  window.cgexPastaLimparChat = async function () {
    await arquivarSessaoAtual();
    return (typeof origLimpar === 'function') ? origLimpar.apply(this, arguments) : undefined;
  };

  // Botão de histórico ao lado do botão de limpar, na pasta IA CGEx
  function injetarBotaoHistorico() {
    var tela = document.getElementById('tela-pasta-ia-cgex');
    if (!tela || document.getElementById('btn-ia-historico')) return;
    var btnLimpar = tela.querySelector('button[onclick*="cgexPastaLimparChat"]');
    if (!btnLimpar) return;
    var btn = document.createElement('button');
    btn.id = 'btn-ia-historico';
    btn.title = 'Histórico de conversas';
    btn.setAttribute('aria-label', 'Histórico de conversas');
    btn.className = btnLimpar.className;
    btn.style.cssText = btnLimpar.getAttribute('style') || '';
    btn.textContent = '📜';
    btn.onclick = window.abrirHistoricoIA;
    btnLimpar.parentNode.insertBefore(btn, btnLimpar);
  }

  function montar() {
    injetarBotoesContexto();
    injetarBotaoHistorico();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
