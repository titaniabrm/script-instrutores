/* ═══════════════════════════════════════════════════════════════
   BUSCA / FILTRO — Material de Apoio
   Injeta um campo de busca no topo da tela de pastas e filtra os
   cards. A busca cobre o título/descrição do card E todo o texto
   interno da pasta correspondente (ex.: "blacklist", "medalha").
═══════════════════════════════════════════════════════════════ */
(function () {
  function norm(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  var indice = null;
  function construirIndice() {
    indice = [];
    document.querySelectorAll('#tela-pastas .pasta-card').forEach(function (card) {
      var oc = card.getAttribute('onclick') || '';
      var m = oc.match(/abrirPasta\('([^']+)'\)/);
      var id = m ? m[1] : '';
      var alvo = id ? document.getElementById('tela-pasta-' + id) : null;
      var texto = card.innerText + ' ' + (alvo ? alvo.innerText : '');
      indice.push({ card: card, texto: norm(texto) });
    });
  }
  // Permite que outros módulos (edição de conteúdo) reconstruam o índice
  window._reindexarBusca = construirIndice;

  function filtrar(q) {
    if (!indice) construirIndice();
    var nq = norm((q || '').trim());
    var visiveis = 0;
    indice.forEach(function (it) {
      var ok = !nq || it.texto.indexOf(nq) !== -1;
      it.card.style.display = ok ? '' : 'none';
      if (ok) visiveis++;
    });
    var vazio = document.getElementById('busca-sem-resultado');
    if (vazio) vazio.style.display = (visiveis === 0 && nq) ? 'block' : 'none';
  }

  function montar() {
    var wrap = document.querySelector('#tela-pastas .pastas-wrapper');
    var intro = document.querySelector('#tela-pastas .pastas-intro');
    var grid = document.querySelector('#tela-pastas .pastas-grid');
    if (!wrap || !grid || document.getElementById('busca-pastas')) return;

    var box = document.createElement('div');
    box.className = 'busca-box';
    box.innerHTML =
      '<span class="busca-icone">🔍</span>' +
      '<input id="busca-pastas" class="busca-input" type="text" ' +
      'placeholder="Buscar em todo o material (ex: blacklist, exílio, medalha)…" autocomplete="off">' +
      '<button id="busca-limpar" class="busca-limpar" title="Limpar" style="display:none;">✕</button>';
    if (intro && intro.parentNode === wrap) wrap.insertBefore(box, intro.nextSibling);
    else wrap.insertBefore(box, grid);

    var vazio = document.createElement('div');
    vazio.id = 'busca-sem-resultado';
    vazio.className = 'busca-sem-resultado';
    vazio.style.display = 'none';
    vazio.textContent = '🔎 Nenhuma pasta encontrada para a sua busca.';
    grid.parentNode.insertBefore(vazio, grid.nextSibling);

    var input = document.getElementById('busca-pastas');
    var limpar = document.getElementById('busca-limpar');
    input.addEventListener('input', function () {
      limpar.style.display = input.value ? 'block' : 'none';
      filtrar(input.value);
    });
    limpar.addEventListener('click', function () {
      input.value = '';
      limpar.style.display = 'none';
      filtrar('');
      input.focus();
    });

    // Atalho "/" foca a busca quando o Material de Apoio está aberto
    document.addEventListener('keydown', function (e) {
      var telaPastas = document.getElementById('tela-pastas');
      if (e.key === '/' && telaPastas && telaPastas.classList.contains('visivel') &&
          document.activeElement !== input) {
        e.preventDefault();
        input.focus();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
