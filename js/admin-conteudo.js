/* ═══════════════════════════════════════════════════════════════
   EDIÇÃO DE CONTEÚDO PELO PAINEL ADMIN
   - Expande o seletor de pastas para TODAS as pastas
   - Mantém as "notas/avisos" (config.notasPastas) em todas elas
   - Adiciona BLOCOS de conteúdo personalizados por pasta, salvos na
     coleção "conteudo" do Firestore (fora do config/main)
═══════════════════════════════════════════════════════════════ */
(function () {
  var COR = {
    azul:    { bg: 'rgba(61,139,255,0.08)',  borda: '#3d8bff', cor: '#7eb3ff', border: 'rgba(61,139,255,0.28)' },
    verde:   { bg: 'rgba(0,230,118,0.08)',   borda: '#00e676', cor: '#69f0ae', border: 'rgba(0,230,118,0.28)' },
    amarelo: { bg: 'rgba(255,171,0,0.08)',   borda: '#ffab00', cor: '#ffd740', border: 'rgba(255,171,0,0.28)' },
    vermelho:{ bg: 'rgba(255,79,79,0.08)',   borda: '#ff4f4f', cor: '#ff8080', border: 'rgba(255,79,79,0.28)' }
  };
  var _conteudoCache = {};   // pasta -> [blocos]

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function listaPastas() {
    var arr = [];
    document.querySelectorAll('#tela-pastas .pasta-card').forEach(function (card) {
      var m = (card.getAttribute('onclick') || '').match(/abrirPasta\('([^']+)'\)/);
      if (!m || m[1] === 'ia-cgex') return;
      var t = card.querySelector('.pasta-titulo');
      var ic = card.querySelector('.pasta-icone');
      arr.push({ id: m[1], nome: (ic ? ic.textContent.trim() + ' ' : '') + (t ? t.textContent.trim() : m[1]) });
    });
    return arr;
  }

  /* ── Renderiza nota + blocos no topo de cada pasta ──────────────── */
  function aplicarConteudoPastas() {
    var cfg = (typeof getConfig === 'function') ? getConfig() : {};
    listaPastas().forEach(function (p) {
      var tela = document.getElementById('tela-pasta-' + p.id);
      if (!tela) return;
      var cont = document.getElementById('conteudo-extra-' + p.id);
      if (!cont) {
        cont = document.createElement('div');
        cont.id = 'conteudo-extra-' + p.id;
        cont.className = 'conteudo-extra-wrap';
        var ref = tela.firstElementChild;
        if (ref && ref.nextSibling) tela.insertBefore(cont, ref.nextSibling);
        else tela.insertBefore(cont, tela.firstChild);
      }
      var html = '';
      var nota = cfg.notasPastas && cfg.notasPastas[p.id];
      if (nota && nota.texto) {
        var cn = COR[nota.tipo] || COR.azul;
        html += '<div class="bloco-conteudo" style="background:' + cn.bg + ';border:1px solid ' + cn.border +
          ';border-left:4px solid ' + cn.borda + ';color:' + cn.cor + ';">📌 ' + esc(nota.texto) + '</div>';
      }
      (_conteudoCache[p.id] || []).forEach(function (b) {
        var cb = COR[b.tipo] || COR.azul;
        html += '<div class="bloco-conteudo" style="background:' + cb.bg + ';border:1px solid ' + cb.border +
          ';border-left:4px solid ' + cb.borda + ';color:' + cb.cor + ';">' +
          (b.titulo ? '<div class="bloco-conteudo-tit">' + esc(b.titulo) + '</div>' : '') +
          '<div>' + esc(b.corpo || '').replace(/\n/g, '<br>') + '</div></div>';
      });
      cont.innerHTML = html;
      cont.style.display = html ? 'block' : 'none';
    });
    if (typeof window._reindexarBusca === 'function') { try { window._reindexarBusca(); } catch (e) {} }
  }
  // Substitui a versão antiga (que só tratava 3 pastas)
  window.aplicarNotasPastas = aplicarConteudoPastas;
  window.aplicarConteudoPastas = aplicarConteudoPastas;

  /* ── Listener da coleção de conteúdo ────────────────────────────── */
  function ouvirConteudo() {
    try {
      _db.collection('conteudo').onSnapshot(function (snap) {
        _conteudoCache = {};
        snap.forEach(function (d) { _conteudoCache[d.id] = (d.data().blocos) || []; });
        aplicarConteudoPastas();
        var sel = document.getElementById('conteudo-pasta-select');
        if (sel) renderBlocosAdmin(sel.value);
      }, function (err) { console.warn('conteudo onSnapshot:', err.code || err); });
    } catch (e) { console.warn('ouvirConteudo:', e); }
  }

  /* ── Admin: expande o select e injeta o gerenciador de blocos ───── */
  function expandirSelect() {
    var sel = document.getElementById('conteudo-pasta-select');
    if (!sel) return;
    var atual = sel.value;
    sel.innerHTML = listaPastas().map(function (p) {
      return '<option value="' + p.id + '">' + esc(p.nome) + '</option>';
    }).join('');
    if (atual) sel.value = atual;
  }

  function injetarGerenciador() {
    var aba = document.getElementById('admin-aba-conteudo');
    if (!aba || document.getElementById('blocos-card')) return;
    var card = document.createElement('div');
    card.className = 'admin-card';
    card.id = 'blocos-card';
    card.style.marginTop = '16px';
    card.innerHTML =
      '<div class="admin-card-titulo">➕ Blocos de Conteúdo</div>' +
      '<div class="admin-card-subtitulo">Adicione blocos extras (avisos, instruções, links) no topo da pasta selecionada acima. Ficam salvos no Firestore.</div>' +
      '<label class="admin-label" style="margin-top:14px;">Título (opcional)</label>' +
      '<input class="admin-input" id="bloco-titulo" type="text" placeholder="Ex: Atualização importante">' +
      '<label class="admin-label" style="margin-top:10px;">Conteúdo</label>' +
      '<textarea class="admin-input" id="bloco-corpo" rows="4" placeholder="Texto do bloco (quebras de linha são mantidas)…" style="resize:vertical;"></textarea>' +
      '<label class="admin-label" style="margin-top:10px;">Cor</label>' +
      '<select class="admin-input" id="bloco-tipo" style="cursor:pointer;">' +
      '<option value="azul">🔵 Azul</option><option value="verde">✅ Verde</option>' +
      '<option value="amarelo">⚠️ Amarelo</option><option value="vermelho">🔴 Vermelho</option></select>' +
      '<div style="margin-top:14px;"><button class="btn-admin-salvar" onclick="salvarConteudoBloco()">➕ Adicionar Bloco</button></div>' +
      '<div style="font-size:12px;color:var(--cinza);letter-spacing:1px;text-transform:uppercase;margin:18px 0 8px;">Blocos atuais</div>' +
      '<div id="blocos-lista" style="display:flex;flex-direction:column;gap:8px;"></div>';
    aba.appendChild(card);
  }

  function renderBlocosAdmin(pasta) {
    var lista = document.getElementById('blocos-lista');
    if (!lista) return;
    var blocos = _conteudoCache[pasta] || [];
    if (!blocos.length) { lista.innerHTML = '<div style="color:var(--cinza);font-size:13px;">Nenhum bloco nesta pasta.</div>'; return; }
    lista.innerHTML = blocos.map(function (b, i) {
      return '<div class="bloco-admin-item"><div style="flex:1;min-width:0;">' +
        '<b>' + (b.titulo ? esc(b.titulo) : '(sem título)') + '</b>' +
        '<div style="color:var(--cinza);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(b.corpo || '') + '</div></div>' +
        '<button class="btn-bloco-rm" onclick="removerConteudoBloco(' + i + ')">🗑️</button></div>';
    }).join('');
  }

  window.salvarConteudoBloco = async function () {
    var sel = document.getElementById('conteudo-pasta-select');
    var pasta = sel ? sel.value : '';
    var titulo = (document.getElementById('bloco-titulo').value || '').trim();
    var corpo = (document.getElementById('bloco-corpo').value || '').trim();
    var tipo = document.getElementById('bloco-tipo').value;
    if (!pasta) { mostrarToast('Selecione uma pasta!', 'erro'); return; }
    if (!corpo) { mostrarToast('Escreva o conteúdo do bloco!', 'erro'); return; }
    try {
      var novo = (_conteudoCache[pasta] || []).slice();
      novo.push({ titulo: titulo, corpo: corpo, tipo: tipo, ts: Date.now() });
      await _db.collection('conteudo').doc(pasta).set({ blocos: novo }, { merge: true });
      document.getElementById('bloco-titulo').value = '';
      document.getElementById('bloco-corpo').value = '';
      if (typeof auditLog === 'function') auditLog('conteudo_adicionado', pasta + (titulo ? ': ' + titulo : ''));
      mostrarToast('Bloco adicionado!', 'sucesso');
    } catch (e) { mostrarToast('Erro ao salvar: ' + (e.code || e.message), 'erro'); }
  };

  window.removerConteudoBloco = async function (idx) {
    var sel = document.getElementById('conteudo-pasta-select');
    var pasta = sel ? sel.value : '';
    if (!pasta) return;
    try {
      var novo = (_conteudoCache[pasta] || []).slice();
      novo.splice(idx, 1);
      await _db.collection('conteudo').doc(pasta).set({ blocos: novo }, { merge: true });
      if (typeof auditLog === 'function') auditLog('conteudo_removido', pasta);
      mostrarToast('Bloco removido!', 'sucesso');
    } catch (e) { mostrarToast('Erro ao remover: ' + (e.code || e.message), 'erro'); }
  };

  // Quando troca a pasta no select, recarrega nota (app.js) + blocos
  var origCarregarNota = window.carregarNotaPasta;
  window.carregarNotaPasta = function () {
    var r = (typeof origCarregarNota === 'function') ? origCarregarNota.apply(this, arguments) : undefined;
    var sel = document.getElementById('conteudo-pasta-select');
    if (sel) renderBlocosAdmin(sel.value);
    return r;
  };

  // Auditoria ao salvar nota (função do app.js)
  var origSalvarNota = window.salvarNotaPasta;
  if (typeof origSalvarNota === 'function') {
    window.salvarNotaPasta = async function () {
      var r = await origSalvarNota.apply(this, arguments);
      var sel = document.getElementById('conteudo-pasta-select');
      if (typeof auditLog === 'function') auditLog('conteudo_editado', sel ? sel.value : '');
      return r;
    };
  }

  function montar() {
    expandirSelect();
    injetarGerenciador();
    if (typeof garantirAuth === 'function') garantirAuth().then(ouvirConteudo).catch(ouvirConteudo);
    else ouvirConteudo();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
