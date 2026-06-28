/* ═══════════════════════════════════════════════════════════════
   ACESSIBILIDADE (a11y)
   - Adiciona aria-labels em botões só com emoji
   - Permite Enter/Space ativarem cards de pasta (já são divs)
   - Garante role apropriado em controles personalizados
═══════════════════════════════════════════════════════════════ */
(function () {
  function texto(el) {
    return (el.textContent || '').trim();
  }
  function temAriaLabel(el) {
    return !!(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby'));
  }

  // Heurística: se um botão tem só 1-3 caracteres (provavelmente emoji), descreve
  function rotularBotoes() {
    document.querySelectorAll('button, [role="button"]').forEach(function (b) {
      if (temAriaLabel(b)) return;
      var t = texto(b);
      // Considera emoji-only se for curto E não houver palavras comuns
      if (!t || t.length > 4) return;
      // Tenta extrair contexto do título ou irmão próximo
      var ctx = b.getAttribute('title') || '';
      if (!ctx) {
        var par = b.closest('[data-label]');
        if (par) ctx = par.getAttribute('data-label');
      }
      // Mapeamento simples de emojis comuns para labels
      var m = {
        '🔍': 'Buscar', '✕': 'Fechar', '✖': 'Fechar',
        '🗑️': 'Remover', '🗑': 'Remover', '+': 'Adicionar',
        '➕': 'Adicionar', '🔄': 'Atualizar', '💾': 'Salvar',
        '🔔': 'Notificações', '🎨': 'Personalizar cores',
        '✏️': 'Editar', '⚙️': 'Configurações', '➤': 'Enviar',
        '←': 'Voltar', '›': 'Avançar', '🚧': 'Manutenção'
      };
      b.setAttribute('aria-label', m[t] || ctx || t);
    });
  }

  // Cards de pasta: ativáveis por Enter/Space
  function tornarCardsAcessiveis() {
    document.querySelectorAll('#tela-pastas .pasta-card').forEach(function (card) {
      if (card.getAttribute('tabindex') == null) card.setAttribute('tabindex', '0');
      if (!card.getAttribute('role')) card.setAttribute('role', 'button');
      var titulo = card.querySelector('.pasta-titulo');
      if (titulo && !card.getAttribute('aria-label')) {
        card.setAttribute('aria-label', 'Abrir pasta ' + titulo.textContent.trim());
      }
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });
  }

  // Adiciona um "skip link" para o conteúdo principal
  function adicionarSkipLink() {
    if (document.getElementById('cgex-skip-link')) return;
    var a = document.createElement('a');
    a.id = 'cgex-skip-link';
    a.className = 'cgex-skip-link';
    a.href = '#tela-pastas';
    a.textContent = 'Pular para o conteúdo';
    document.body.insertBefore(a, document.body.firstChild);
  }

  // Aplica TODOS os hooks em qualquer mudança relevante de DOM
  function aplicar() {
    rotularBotoes();
    tornarCardsAcessiveis();
    adicionarSkipLink();
  }

  // Reaplica após navegações (busca, abrir pasta, etc.)
  var origAbrirPasta = window.abrirPasta;
  if (typeof origAbrirPasta === 'function') {
    window.abrirPasta = function () { var r = origAbrirPasta.apply(this, arguments); setTimeout(aplicar, 50); return r; };
  }
  var origIr = window.ir;
  if (typeof origIr === 'function') {
    window.ir = function () { var r = origIr.apply(this, arguments); setTimeout(aplicar, 50); return r; };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar);
  else aplicar();
})();
