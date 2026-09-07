
/* ==========================================================================
   БАЗА — the brief: two steps, live budget fork, honest validation.
   No games here on purpose: this is where the visitor converts.
   ========================================================================== */
(function (w, d) {
  'use strict';
  var B = w.BAZA, E = B.env, D = B.data;
  var $ = B.$, $$ = B.$$, on = B.on, el = B.el, clamp = B.clamp;

  var form = $('#briefForm');
  if (!form) return;

  var state = { wants: [], when: '', pain: [] };

  /* ------------------------------------------------------------- chips -- */

  function chips(host, items, multi, key) {
    if (!host) return;
    items.forEach(function (it) {
      var b = el('button', 'chip');
      b.type = 'button';
      b.dataset.id = it.id;
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = '<i aria-hidden="true"></i><span>' + it.t + '</span>';
      on(b, 'click', function () {
        if (multi) {
          var i = state[key].indexOf(it.id);
          if (i > -1) state[key].splice(i, 1); else state[key].push(it.id);
        } else {
          state[key] = state[key] === it.id ? '' : it.id;
          $$('.chip', host).forEach(function (o) {
            o.classList.remove('is-on'); o.setAttribute('aria-pressed', 'false');
          });
        }
        var onNow = multi ? state[key].indexOf(it.id) > -1 : state[key] === it.id;
        b.classList.toggle('is-on', onNow);
        b.setAttribute('aria-pressed', onNow ? 'true' : 'false');
        B.audio.sfx('blip');
        calc();
      });
      host.appendChild(b);
    });
  }

  chips($('#brWants'), D.wants, true, 'wants');
  chips($('#brWhen'), D.when, false, 'when');
  chips($('#brPain'), D.pains, true, 'pain');

  /* -------------------------------------------------------------- calc -- */

  var fromEl = $('#brFrom'), toEl = $('#brTo'), termEl = $('#brTerm'), hintEl = $('#brHint');

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

  function calc() {
    if (!state.wants.length) {
      if (fromEl) fromEl.textContent = '—';
      if (toEl) toEl.textContent = '—';
      if (termEl) termEl.textContent = '—';
      if (hintEl) hintEl.textContent = 'Отметьте, что нужно — цифра появится сразу.';
      return;
    }
    var base = 0, wk = 0;
    state.wants.forEach(function (id) {
      var it = D.wants.filter(function (x) { return x.id === id; })[0];
      if (it) { base += it.base; wk += it.wk; }
    });
    // several tracks in parallel cost less than the sum of their parts
    if (state.wants.length > 1) { base = Math.round(base * 0.92); wk = Math.round(wk * 0.78); }

    var k = 1;
    var wsel = D.when.filter(function (x) { return x.id === state.when; })[0];
    if (wsel) k = wsel.k;

    // more pain points means more to untangle up front
    var pk = 1 + Math.min(state.pain.length, 5) * 0.045;

    var lo = Math.round(base * k * pk / 10) * 10;
    var hi = Math.round(lo * 2.15 / 10) * 10;
    var weeks = Math.max(2, wk + (state.pain.length > 2 ? 1 : 0));

    if (fromEl) fromEl.textContent = fmt(lo * 1000);
    if (toEl) toEl.textContent = fmt(hi * 1000);
    if (termEl) termEl.textContent = weeks + '–' + (weeks + 2) + ' нед.';
    if (hintEl) hintEl.textContent =
      'Это вилка, а не счёт. Точную цифру называем после разбора — и она уже не меняется по дороге.';
  }
  calc();

  /* ------------------------------------------------------------- steps -- */

  var steps = $$('.br__step', form);
  var dots = $$('.br__steps i', form);
  var cur = 1;

  function go(n) {
    cur = n;
    steps.forEach(function (s) {
      var isOn = +s.dataset.step === n;
      s.classList.toggle('is-on', isOn);
      // keep the hidden step out of the tab order
      s.querySelectorAll('input,button,a').forEach(function (f) {
        if (isOn) f.removeAttribute('tabindex'); else f.setAttribute('tabindex', '-1');
      });
    });
    dots.forEach(function (dt, i) { dt.classList.toggle('is-on', i < n); });
    if (n === 2) {
      var f = $('#brName');
      if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 340);
    }
  }
  go(1);

  on($('#brNext'), 'click', function () {
    if (!state.wants.length) {
      err('Отметьте хотя бы одну задачу — иначе нам нечего считать.');
      return;
    }
    err('');
    go(2);
  });
  on($('#brBack'), 'click', function () { err(''); go(1); });

  /* ---------------------------------------------------------- validate -- */

  var errEl = $('#brErr');
  function err(msg) {
    if (!errEl) return;
    errEl.textContent = msg || '';
    errEl.hidden = !msg;
    if (msg) {
      errEl.classList.remove('is-pop'); void errEl.offsetWidth; errEl.classList.add('is-pop');
    }
  }

  // light phone mask: keeps digits, formats as the visitor types
  var phone = $('#brPhone');
  on(phone, 'input', function () {
    var v = phone.value.replace(/\D/g, '');
    if (v[0] === '8') v = '7' + v.slice(1);
    if (v[0] !== '7') v = '7' + v;
    v = v.slice(0, 11);
    var out = '+7';
    if (v.length > 1) out += ' ' + v.slice(1, 4);
    if (v.length > 4) out += ' ' + v.slice(4, 7);
    if (v.length > 7) out += '-' + v.slice(7, 9);
    if (v.length > 9) out += '-' + v.slice(9, 11);
    phone.value = out;
  });

  /* Момент открытия шага с контактами. Человек не заполнит форму за две
     секунды, бот — заполнит; это половина антиспама, вторая половина —
     honeypot в разметке. Ни то, ни другое не спрашивает ничего у человека. */
  var openedAt = Date.now();
  on($('#brNext'), 'click', function () { openedAt = Date.now(); });

  function labelsOf(list, ids) {
    return (ids || []).map(function (id) {
      var it = list.filter(function (x) { return x.id === id; })[0];
      return it ? it.t : '';
    }).filter(Boolean);
  }

  function showDone(res) {
    steps.forEach(function (s) { s.classList.remove('is-on'); s.hidden = true; });
    $$('.br__steps', form).forEach(function (n) { n.hidden = true; });

    var done = $('#brDone');
    if (!done) return;

    /* Если ни один канал не принял заявку, она уже лежит в очереди и уйдёт
       при следующем заходе — но говорить человеку «отправлено» в этот момент
       нечестно. Показываем прямой путь: одно нажатие, и заявка у нас. */
    if (res.status !== 'sent') {
      var h = $('h3', done), pEl = $('p', done), a = $('a', done);
      if (h) h.textContent = 'Связь подвела.';
      if (pEl) {
        pEl.textContent = 'Заявка сохранена и уйдёт сама, как только сеть вернётся. ' +
          'Если ждать не хочется — одно нажатие, и она у нас прямо сейчас.';
      }
      if (a) {
        a.href = B.lead.manualLink(res.payload);
        var sp = a.querySelector('span:last-child');
        if (sp) sp.textContent = 'Отправить в Telegram сейчас';
      }
      done.classList.add('is-warn');
    }

    done.hidden = false;
    requestAnimationFrame(function () { done.classList.add('is-on'); });
    B.audio.sfx('powerup');
    B.buzz(18);
    B.scrollToEl(done, 120);
  }

  on(form, 'submit', function (ev) {
    ev.preventDefault();
    var name = ($('#brName') || {}).value || '';
    var tel = ($('#brPhone') || {}).value || '';
    var agree = ($('#brAgree') || {}).checked;

    if (name.trim().length < 2) { err('Напишите, как к вам обращаться.'); return; }
    if (tel.replace(/\D/g, '').length < 11) { err('Проверьте номер — не хватает цифр.'); return; }
    if (!agree) { err('Нужно согласие на обработку данных — без него не отправим.'); return; }
    err('');

    // honeypot: заполнить его человек не может, поэтому роняем молча
    if (B.lead.isTrap(form)) { showDone({ status: 'sent' }); return; }
    // а вот подозрительно быстрое заполнение заявку не роняет — только метит
    var speed = B.lead.fillSpeed(openedAt);

    var btn = $('#brSend');
    if (btn) { btn.classList.add('is-sending'); btn.disabled = true; }

    var fromTxt = (($('#brFrom') || {}).textContent || '').trim();
    var toTxt = (($('#brTo') || {}).textContent || '').trim();

    B.track && B.track('form_sent');

    B.lead.submit({
      name: name.trim(),
      phone: tel,
      msg: (($('#brMsg') || {}).value || '').trim(),
      wants: labelsOf(D.wants, state.wants),
      pain: labelsOf(D.pains, state.pain),
      when: (D.when.filter(function (x) { return x.id === state.when; })[0] || {}).t || '',
      budget: fromTxt && fromTxt !== '—' ? fromTxt + ' — ' + toTxt + ' ₽' : '',
      term: (($('#brTerm') || {}).textContent || '').trim(),
      trail: (B.trail || []).slice(-14).join(' → '),
      fastFill: speed && speed < 2500 ? speed : 0
    }).then(function (res) {
      if (btn) { btn.classList.remove('is-sending'); btn.disabled = false; }
      showDone(res);
    });
  });

  /* --------------------------------------------- внутренний адвокат ----
     Законы 117-121: не убеждать всех, а вооружить того одного, кто будет
     защищать проект внутри. Пересказ по памяти теряет половину смысла. */
  on($('#advCopy'), 'click', function () {
    var names = state.wants.map(function (id) {
      var it = D.wants.filter(function (x) { return x.id === id; })[0];
      return it ? it.t.toLowerCase() : '';
    }).filter(Boolean);

    var lines = [
      'Коротко, зачем нам подрядчик по цифре.',
      '',
      'Что болит сейчас:'
    ];
    if (state.pain.length) {
      state.pain.forEach(function (id) {
        var it = D.pains.filter(function (x) { return x.id === id; })[0];
        if (it) lines.push('— ' + it.t.toLowerCase());
      });
    } else {
      lines.push('— заявки теряются, всё держится на ручной работе');
    }
    lines.push('');
    lines.push('Что предлагается сделать:');
    lines.push(names.length ? '— ' + names.join('\n— ') : '— сайт и автоматизация приёма заявок');
    lines.push('');
    var from = ($('#brFrom') || {}).textContent || '';
    var to = ($('#brTo') || {}).textContent || '';
    var term = ($('#brTerm') || {}).textContent || '';
    if (from && from !== '—') {
      lines.push('Ориентир по бюджету: ' + from + '—' + to + ' ₽. Срок: ' + term + '.');
      lines.push('Это вилка, а не счёт: точная цифра называется после разбора и дальше не меняется.');
    } else {
      lines.push('Ориентир по бюджету и срок называются после короткого разбора.');
    }
    lines.push('');
    lines.push('Начинаем не с договора на всё, а с разбора — это отдельная небольшая работа.');
    lines.push('Если делаем проект, её стоимость уходит в счёт проекта.');
    lines.push('');
    lines.push('Подрядчик: БАЗА — lllbaza.ru');

    var text = lines.join('\n');
    var okMsg = 'Текст скопирован — можно отправлять';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { B.toast(okMsg, 3200); },
        function () { B.toast('Не вышло скопировать — выделите текст вручную'); });
    } else {
      B.toast('Скопируйте текст из консоли браузера');
      if (w.console) console.log(text);
    }
    B.audio.sfx('blip');
  });

  /* -------------------------------------------------------- scene hook -- */
  B.scene({ el: '#brief', name: 'brief', bg: '[data-bg="brief"]', margin: 0.4 });
})(window, document);


