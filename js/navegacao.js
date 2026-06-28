/* ═══════════════════════════════════════════════════════════════
   NAVEGAÇÃO — Breadcrumb + Indicador de progresso de leitura
   Envolve abrirPasta()/voltarParaPastas() para manter o caminho
   atualizado e exibe uma barra de progresso conforme a rolagem.
═══════════════════════════════════════════════════════════════ */
(function () {

  function infoPasta(id) {
    var dados = { titulo: id, icone: '📁' };
    document.querySelectorAll('#tela-pastas .pasta-card').forEach(function (card) {
      var oc = card.getAttribute('onclick') || '';
      var m = oc.match(/abrirPasta\('([^']+)'\)/);
      if (m && m[1] === id) {
        var t = card.querySelector('.pasta-titulo');
        var ic = card.querySelector('.pasta-icone');
        if (t) dados.titulo = t.textContent.trim();
        if (ic) dados.icone = ic.textContent.trim();
      }
    });
    return dados;
  }

  function atualizarBreadcrumb(id) {
    var bc = document.getElementById('cgex-breadcrumb');
    if (!bc) return;
    if (!id || id === 'pastas') {
      bc.innerHTML = '<span class="bc-atual">📂 Material de Apoio</span>';
    } else {
      var info = infoPasta(id);
      bc.innerHTML =
        '<a class="bc-link" onclick="voltarParaPastas()">📂 Material de Apoio</a>' +
        '<span class="bc-sep">›</span>' +
        '<span class="bc-atual">' + info.icone + ' ' + info.titulo + '</span>';
    }
  }
  window.atualizarBreadcrumb = atualizarBreadcrumb;

  function atualizarProgressoScroll() {
    var fill = document.getElementById('progresso-fill');
    if (!fill) return;
    var bar = fill.parentNode;
    var logado = document.getElementById('tela-logado');
    var emLogado = logado && getComputedStyle(logado).display !== 'none';
    if (!emLogado) { bar.style.opacity = '0'; return; }
    bar.style.opacity = '1';
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    var p = max > 0 ? (h.scrollTop || document.body.scrollTop) / max : 0;
    fill.style.width = (Math.max(0, Math.min(1, p)) * 100) + '%';
  }

  function montar() {
    var logado = document.getElementById('tela-logado');
    if (!logado || document.getElementById('cgex-breadcrumb')) return;

    var bc = document.createElement('div');
    bc.id = 'cgex-breadcrumb';
    bc.className = 'breadcrumb-bar';
    var header = logado.querySelector('header');
    if (header) logado.insertBefore(bc, header.nextSibling);
    else logado.insertBefore(bc, logado.firstChild);
    atualizarBreadcrumb(null);

    var pb = document.createElement('div');
    pb.className = 'progresso-leitura';
    pb.innerHTML = '<div class="progresso-leitura-fill" id="progresso-fill"></div>';
    document.body.appendChild(pb);

    window.addEventListener('scroll', atualizarProgressoScroll, { passive: true });
    window.addEventListener('resize', atualizarProgressoScroll, { passive: true });
    atualizarProgressoScroll();

    // Envolve as funções de navegação do app
    var origAbrir = window.abrirPasta;
    window.abrirPasta = function (id) {
      var r = (typeof origAbrir === 'function') ? origAbrir.apply(this, arguments) : undefined;
      try { atualizarBreadcrumb(id); setTimeout(atualizarProgressoScroll, 60); } catch (e) {}
      return r;
    };
    var origVoltar = window.voltarParaPastas;
    window.voltarParaPastas = function () {
      var r = (typeof origVoltar === 'function') ? origVoltar.apply(this, arguments) : undefined;
      try { atualizarBreadcrumb(null); setTimeout(atualizarProgressoScroll, 60); } catch (e) {}
      return r;
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
