/* ═══════════════════════════════════════════════════════════════
   AGENDAMENTO DE NOTIFICAÇÃO URGENTE
   - Adiciona campo "Agendar para" na aba "🔔 Notificação Urgente"
   - Se preenchido, a notificação só fica ativa após a hora marcada
   - Hook em verificarNotificacaoUrgente: ignora notificações futuras
═══════════════════════════════════════════════════════════════ */
(function () {
  function injetarCampoAgenda() {
    var aba = document.getElementById('admin-aba-notificacao');
    if (!aba || document.getElementById('notif-agendar-input')) return;
    var notifTipo = document.getElementById('notif-tipo');
    if (!notifTipo) return;
    var lab = document.createElement('label');
    lab.className = 'admin-label';
    lab.style.marginTop = '14px';
    lab.htmlFor = 'notif-agendar-input';
    lab.textContent = 'Agendar para (opcional — deixe em branco para enviar agora)';
    var inp = document.createElement('input');
    inp.id = 'notif-agendar-input';
    inp.className = 'admin-input';
    inp.type = 'datetime-local';
    inp.style.marginBottom = '0';
    var ajuda = document.createElement('div');
    ajuda.className = 'admin-help';
    ajuda.style.marginTop = '6px';
    ajuda.textContent = '⏰ Se definido, a notificação só aparecerá para os instrutores a partir dessa data/hora.';
    // insere antes do botão "Salvar e Ativar"
    var botoes = notifTipo.parentNode.querySelector('div[style*="margin-top:18px"]');
    if (botoes) {
      notifTipo.parentNode.insertBefore(lab, botoes);
      notifTipo.parentNode.insertBefore(inp, botoes);
      notifTipo.parentNode.insertBefore(ajuda, botoes);
    } else {
      notifTipo.parentNode.appendChild(lab);
      notifTipo.parentNode.appendChild(inp);
      notifTipo.parentNode.appendChild(ajuda);
    }
  }

  function lerInputAgendamento() {
    var inp = document.getElementById('notif-agendar-input');
    if (!inp || !inp.value) return 0;
    var t = new Date(inp.value).getTime();
    return isNaN(t) ? 0 : t;
  }
  function escreverInputAgendamento(ts) {
    var inp = document.getElementById('notif-agendar-input');
    if (!inp) return;
    if (!ts) { inp.value = ''; return; }
    // Formata para datetime-local
    var d = new Date(ts);
    var pad = function (n) { return String(n).padStart(2, '0'); };
    inp.value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
                'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  // Carrega valor agendado salvo na config quando o admin abre
  function refletirAgendamento() {
    var cfg = getConfig();
    var ag = cfg.notifUrgente && cfg.notifUrgente.agendarPara;
    escreverInputAgendamento(ag || 0);
  }

  // Envolve salvarNotificacaoUrgente para gravar também agendarPara
  var orig = window.salvarNotificacaoUrgente;
  window.salvarNotificacaoUrgente = async function () {
    var agendarPara = lerInputAgendamento();
    var r = await orig.apply(this, arguments);
    // Após orig salvar, complementa com agendarPara
    var cfg = getConfig();
    if (cfg.notifUrgente && cfg.notifUrgente.ativo) {
      cfg.notifUrgente.agendarPara = agendarPara || 0;
      await saveConfig(cfg);
      if (agendarPara > Date.now()) {
        var quando = new Date(agendarPara).toLocaleString('pt-BR');
        mostrarToast('⏰ Notificação agendada para ' + quando, 'sucesso');
      }
      if (typeof auditLog === 'function') {
        auditLog('notificacao_agendada', agendarPara > Date.now()
          ? 'agendada para ' + new Date(agendarPara).toLocaleString('pt-BR')
          : 'enviada agora');
      }
    }
    return r;
  };

  // Envolve verificarNotificacaoUrgente: ignora notificações futuras
  var origVerificar = window.verificarNotificacaoUrgente;
  window.verificarNotificacaoUrgente = function () {
    var cfg = getConfig();
    if (cfg.notifUrgente && cfg.notifUrgente.ativo && cfg.notifUrgente.agendarPara
        && cfg.notifUrgente.agendarPara > Date.now()) {
      // ainda não chegou a hora — silencia
      return;
    }
    return (typeof origVerificar === 'function') ? origVerificar.apply(this, arguments) : undefined;
  };

  // Quando o admin troca para a aba de notificação, reflete o valor agendado
  var origAdminAba = window.adminAba;
  window.adminAba = function (aba, btn) {
    var r = (typeof origAdminAba === 'function') ? origAdminAba.apply(this, arguments) : undefined;
    if (aba === 'notificacao') setTimeout(refletirAgendamento, 50);
    return r;
  };

  function montar() {
    injetarCampoAgenda();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
