export function initializeWebsite() {
  'use strict';
   var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
   $('#year').textContent = new Date().getFullYear();
   /* ---------------- Mobile menu ---------------- */
  var menuToggle = $('#menuToggle');
  var mobileMenu = $('#mobileMenu');
   function setMenu(open) {
    mobileMenu.setAttribute('data-open', String(open));
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    $('use', menuToggle).setAttribute('href', open ? '#i-close' : '#i-menu');
  }
  menuToggle.addEventListener('click', function () {
    setMenu(mobileMenu.getAttribute('data-open') !== 'true');
  });
  $$('#mobileMenu a').forEach(function (a) {
    a.addEventListener('click', function () { setMenu(false); });
  });
   /* ---------------- Field validation helpers (§33, §54) ---------------- */
  function showError(input, errId, message) {
    var box = $('#' + errId);
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', errId);
    $('span', box).textContent = message;
    box.setAttribute('data-show', 'true');
  }
  function clearError(input, errId) {
    var box = $('#' + errId);
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
    box.setAttribute('data-show', 'false');
  }
  function validText(input, errId, message) {
    if (!input.value.trim()) { showError(input, errId, message); return false; }
    clearError(input, errId); return true;
  }
  function validPhone(input, errId) {
    var digits = input.value.replace(/\D/g, '');
    if (!input.value.trim()) { showError(input, errId, 'Please enter your phone number.'); return false; }
    if (digits.length < 10 || digits.length > 11) {
      showError(input, errId, 'Please enter a valid 10-digit phone number, like (773) 555-0123.');
      return false;
    }
    clearError(input, errId); return true;
  }
  function validEmail(input, errId) {
    if (!input.value.trim()) { showError(input, errId, 'Please enter your email address.'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim())) {
      showError(input, errId, 'Please enter a valid email address, like name@example.com.');
      return false;
    }
    clearError(input, errId); return true;
  }
  function focusFirstInvalid(scope) {
    var bad = $('[aria-invalid="true"]', scope);
    if (bad) bad.focus();
  }
   /* ---------------- Google Sheet ---------------- */
  // The Apps Script web app URL (ends in /exec) from google-sheet/Code.gs. While it's empty the
  // forms only pretend to send, and the booking confirmation says so.
  var SHEET_URL = 'https://script.google.com/macros/s/AKfycbw2dijPBDTW9bt3axURjnhwtDTOZDsqXOlkjIxiLuVxPNIOr2F9Dppqen2rYDWpwiq9/exec';

  // A plain-text body keeps this a "simple" request, so the browser skips the CORS preflight
  // that Apps Script can't answer.
  function sendToSheet(data) {
    if (!SHEET_URL) {
      console.warn('SHEET_URL is not set in src/site.js, so this form was not saved.');
      return new Promise(function (resolve) { window.setTimeout(resolve, 900); });
    }
    return fetch(SHEET_URL, { method: 'POST', body: JSON.stringify(data) })
      .then(function (res) { return res.json(); })
      .then(function (out) {
        if (!out.ok) throw new Error(out.error || 'The sheet did not accept the form.');
      });
  }
  $('.demo-note').hidden = Boolean(SHEET_URL);
   /* ---------------- Quote form (§35, §55) ---------------- */
  var quoteForm = $('#quoteForm');
  var quoteSubmit = $('#quoteSubmit');
  var quoteStatus = $('#quoteStatus');
  var quoteError = $('#quoteError');
   quoteForm.addEventListener('submit', function (e) {
    e.preventDefault();
    quoteStatus.setAttribute('data-show', 'false');
    quoteError.setAttribute('data-show', 'false');
    var ok = true;
    ok = validText($('#q-name'), 'err-q-name', 'Please enter your name.') && ok;
    ok = validPhone($('#q-phone'), 'err-q-phone') && ok;
    ok = validEmail($('#q-email'), 'err-q-email') && ok;
    ok = validText($('#q-service'), 'err-q-service', 'Please choose a service.') && ok;
     if (!ok) { focusFirstInvalid(quoteForm); return; }
     quoteSubmit.disabled = true;
    quoteSubmit.textContent = 'Sending…';
     sendToSheet({
      form: 'quote',
      name: $('#q-name').value,
      phone: $('#q-phone').value,
      email: $('#q-email').value,
      service: $('#q-service').value,
      count: $('#q-count').value,
      date: $('#q-date').value,
      message: $('#q-message').value
    }).then(function () {
      quoteStatus.setAttribute('data-show', 'true');
      quoteForm.reset();
      quoteStatus.scrollIntoView({ block: 'nearest' });
    }, function (err) {
      console.error(err);
      quoteError.setAttribute('data-show', 'true');
      quoteError.scrollIntoView({ block: 'nearest' });
    }).then(function () {
      quoteSubmit.disabled = false;
      quoteSubmit.textContent = 'Get My Quote';
    });
  });
   /* ---------------- Booking modal ---------------- */
  var modal = $('#bookingModal');
  var panel = $('.modal__panel', modal);
  var stepBar = $('#stepBar');
  var btnBack = $('#btnBack');
  var btnNext = $('#btnNext');
  var modalFoot = $('#modalFoot');
  var lastFocus = null;
  var step = 1;
   // Phones show one thing at a time, so scroll the next part of the booking into view for them.
  var phoneQuery = window.matchMedia('(max-width: 599px)');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function reveal(el, block) {
    el.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: block || 'nearest' });
  }
   var state = { service: 'Carpet Cleaning', date: null, time: null, isSameDay: false };
   var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var SLOTS = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'];
   var today = new Date(); today.setHours(0, 0, 0, 0);
  var view = new Date(today.getFullYear(), today.getMonth(), 1);
   function sameDay(a, b) {
    return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function longDate(d) {
    return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
  }
  // Available full week (Monday through Sunday); no same-day or past bookings for online schedule.
  function unavailable(d) {
    return d < today || d.getTime() === today.getTime();
  }
   function setSameDayMode(isSameDay) {
    state.isSameDay = isSameDay;
    var sameWrap = $('#sameDayWrap');
    var futureWrap = $('#futureBookingWrap');
    var tabSame = $('#tabSameDay');
    var tabFuture = $('#tabFutureDate');
     if (sameWrap) sameWrap.hidden = !isSameDay;
    if (futureWrap) futureWrap.hidden = isSameDay;
    if (tabSame) tabSame.setAttribute('aria-pressed', String(isSameDay));
    if (tabFuture) tabFuture.setAttribute('aria-pressed', String(!isSameDay));
    if (step === 2) btnNext.hidden = isSameDay;
  }
   var tabSameDayBtn = $('#tabSameDay');
  if (tabSameDayBtn) tabSameDayBtn.addEventListener('click', function () { setSameDayMode(true); });
  var tabFutureBtn = $('#tabFutureDate');
  if (tabFutureBtn) tabFutureBtn.addEventListener('click', function () { setSameDayMode(false); });
  var backToFutureBtn = $('#btnBackToFuture');
  if (backToFutureBtn) backToFutureBtn.addEventListener('click', function () { setSameDayMode(false); });
   function renderCalendar() {
    $('#calMonth').textContent = MONTHS[view.getMonth()] + ' ' + view.getFullYear();
    $('#calPrev').disabled = (view.getFullYear() === today.getFullYear() && view.getMonth() === today.getMonth());
     var grid = $('#calGrid');
    grid.innerHTML = '';
     var firstDow = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
    var total = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
     for (var b = 0; b < firstDow; b++) {
      var blank = document.createElement('div');
      blank.className = 'day day--blank';
      grid.appendChild(blank);
    }
     for (var n = 1; n <= total; n++) {
      var d = new Date(view.getFullYear(), view.getMonth(), n);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'day';
      btn.textContent = String(n);
       if (sameDay(d, today)) {
        btn.setAttribute('data-today', 'true');
        btn.setAttribute('aria-label', longDate(d) + ': Today (Click to book by phone)');
        btn.setAttribute('title', 'Today: Call for same-day service');
        btn.addEventListener('click', function () {
          setSameDayMode(true);
        });
      } else if (unavailable(d)) {
        btn.disabled = true;
        btn.setAttribute('aria-label', longDate(d) + ' (unavailable)');
      } else {
        btn.setAttribute('aria-pressed', String(sameDay(d, state.date)));
        btn.setAttribute('aria-label', longDate(d));
        (function (picked) {
          btn.addEventListener('click', function () {
            state.date = picked;
            state.time = null;
            renderCalendar();
            renderTimes();
            $('#err-datetime').setAttribute('data-show', 'false');
            // The time slots sit below the fold on phones.
            if (phoneQuery.matches) reveal($('#timeSection'), 'start');
          });
        })(d);
      }
      grid.appendChild(btn);
    }
  }
   function renderTimes() {
    var grid = $('#timeGrid');
    var lead = $('#timeLead');
    grid.innerHTML = '';
     if (!state.date) {
      lead.textContent = 'Pick a date first.';
      return;
    }
    lead.textContent = 'Available times on ' + longDate(state.date) + ' (8:00 AM – 4:00 PM).';
     SLOTS.forEach(function (t) {
      var label = document.createElement('label');
      label.className = 'choice slot';
       var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'time';
      input.value = t;
      input.checked = (state.time === t);
      input.addEventListener('change', function () {
        state.time = t;
        $('#err-datetime').setAttribute('data-show', 'false');
      });
       var span = document.createElement('span');
      span.textContent = t;
       label.appendChild(input);
      label.appendChild(span);
      grid.appendChild(label);
    });
  }
   $('#calPrev').addEventListener('click', function () {
    view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
    renderCalendar();
  });
  $('#calNext').addEventListener('click', function () {
    view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
    renderCalendar();
  });
   /* Service switch reveals the matching detail question (§31) */
  function syncServiceDetails() {
    var picked = $('input[name="service"]:checked').value;
    state.service = picked;
    $('#detailCarpet').hidden = picked !== 'Carpet Cleaning';
    $('#detailRug').hidden = picked !== 'Rug Cleaning';
    $('#detailSofa').hidden = (picked !== 'Upholstery' && picked !== 'Upholstery Cleaning' && picked !== 'Sofa Cleaning');
  }
  $$('input[name="service"]').forEach(function (r) {
    r.addEventListener('change', syncServiceDetails);
  });
   /* Carpet Area Checkbox Toggles & Stepper Logic */
  var carpetAreaConfigs = [
    { chk: '#ca_bedroom', wrap: '#qtyWrap_bedroom', row: '#row_bedroom' },
    { chk: '#ca_living', wrap: '#qtyWrap_living', row: '#row_living', extra: '#diningComboWrap' },
    { chk: '#ca_hallway', wrap: '#qtyWrap_hallway', row: '#row_hallway' },
    { chk: '#ca_stairs', wrap: '#qtyWrap_stairs', row: '#row_stairs' }
  ];
   carpetAreaConfigs.forEach(function (cfg) {
    var el = $(cfg.chk);
    var wrp = $(cfg.wrap);
    var row = $(cfg.row);
    var extra = cfg.extra ? $(cfg.extra) : null;
     function syncRowState() {
      if (wrp) wrp.hidden = !el.checked;
      if (extra) extra.style.display = el.checked ? 'flex' : 'none';
      if (row) row.setAttribute('data-checked', String(el.checked));
    }
     if (el) {
      el.addEventListener('change', syncRowState);
    }
     if (row) {
      row.addEventListener('click', function (e) {
        // Do not toggle checkbox if clicking stepper controls or note/attached prompt
        if (e.target.closest('.area-row__stepper') || e.target.closest('.area-row__note')) {
          return;
        }
        // If direct click on label/input, standard browser click will handle it
        if (e.target === el || e.target.closest('label') === el.closest('label')) {
          return;
        }
        el.checked = !el.checked;
        syncRowState();
      });
    }
  });
   /* Sofa & Furniture Area Checkbox Toggles & Stepper Logic */
  var sofaConfigs = [
    { chk: '#uph_sectional', wrap: '#qtyWrap_uph_sectional', row: '#row_uph_sectional' },
    { chk: '#uph_sofa', wrap: '#qtyWrap_uph_sofa', row: '#row_uph_sofa' },
    { chk: '#uph_recliner', wrap: '#qtyWrap_uph_recliner', row: '#row_uph_recliner' },
    { chk: '#uph_armchair', wrap: '#qtyWrap_uph_armchair', row: '#row_uph_armchair' },
    { chk: '#uph_wingback', wrap: '#qtyWrap_uph_wingback', row: '#row_uph_wingback' },
    { chk: '#uph_dining_chair', wrap: '#qtyWrap_uph_dining_chair', row: '#row_uph_dining_chair' }
  ];
   sofaConfigs.forEach(function (cfg) {
    var el = $(cfg.chk);
    var wrp = $(cfg.wrap);
    var row = $(cfg.row);
     function syncRowState() {
      if (wrp) wrp.hidden = !el.checked;
      if (row) row.setAttribute('data-checked', String(el.checked));
    }
     if (el) {
      el.addEventListener('change', syncRowState);
    }
     if (row) {
      row.addEventListener('click', function (e) {
        if (e.target.closest('.area-row__stepper') || e.target.closest('.area-row__note')) {
          return;
        }
        if (e.target === el || e.target.closest('label') === el.closest('label')) {
          return;
        }
        el.checked = !el.checked;
        syncRowState();
      });
    }
  });
   $$('.stepper-btn, .qty-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetId = btn.getAttribute('data-target');
      var dir = parseInt(btn.getAttribute('data-dir'), 10) || 1;
      var input = $('#' + targetId);
      if (input) {
        var val = parseInt(input.value, 10) || 1;
        var min = parseInt(input.min, 10) || 1;
        var max = parseInt(input.max, 10) || 100;
        var next = val + dir;
        if (next >= min && next <= max) {
          input.value = next;
        }
      }
    });
  });
   /* Rug Size & Material "Other" toggle */
  $$('input[name="rugSize"]').forEach(function (r) {
    r.addEventListener('change', function () {
      var isOther = (r.value === 'Other' && r.checked);
      $('#rugSizeOtherWrap').hidden = !isOther;
      if (isOther) $('#rugSizeOtherInput').focus();
    });
  });
   $$('input[name="rugMaterial"]').forEach(function (r) {
    r.addEventListener('change', function () {
      var isOther = (r.value === 'Other' && r.checked);
      $('#rugMaterialOtherWrap').hidden = !isOther;
      if (isOther) $('#rugMaterialOtherInput').focus();
    });
  });
   function detailText() {
    if (state.service === 'Carpet Cleaning') {
      var items = [];
      if ($('#ca_bedroom') && $('#ca_bedroom').checked) {
        var bQty = parseInt($('#qty_bedroom').value, 10) || 1;
        items.push(bQty + ' ' + (bQty === 1 ? 'Bedroom' : 'Bedrooms'));
      }
      if ($('#ca_living') && $('#ca_living').checked) {
        var lQty = parseInt($('#qty_living').value, 10) || 1;
        var isDiningCombo = $('#ca_dining_attached') && $('#ca_dining_attached').checked;
        if (isDiningCombo) {
          items.push(lQty + ' ' + (lQty === 1 ? 'Living & Dining Room Combo' : 'Living & Dining Combos'));
        } else {
          items.push(lQty + ' ' + (lQty === 1 ? 'Living Room' : 'Living Rooms'));
        }
      }
      if ($('#ca_hallway') && $('#ca_hallway').checked) {
        var hQty = parseInt($('#qty_hallway').value, 10) || 1;
        items.push(hQty + ' ' + (hQty === 1 ? 'Hallway' : 'Hallways'));
      }
      if ($('#ca_stairs') && $('#ca_stairs').checked) {
        var sQty = parseInt($('#qty_stairs').value, 10) || 13;
        items.push('Stairs (' + sQty + ' steps)');
      }
      return items.length ? items.join(', ') : '1 Bedroom';
    }
    if (state.service === 'Rug Cleaning') {
      var rugs = $('input[name="rugs"]:checked') ? $('input[name="rugs"]:checked').value : '1';
      var rugCount = rugs + (rugs === '1' ? ' rug' : ' rugs');
       var sizeRadio = $('input[name="rugSize"]:checked');
      var sizeVal = sizeRadio ? sizeRadio.value : '2x4';
      if (sizeVal === 'Other') {
        var customSize = $('#rugSizeOtherInput').value.trim();
        sizeVal = customSize ? customSize : 'Custom Size';
      }
       var matRadio = $('input[name="rugMaterial"]:checked');
      var matVal = matRadio ? matRadio.value : 'Synthetic (Nylon / Polyester)';
      if (matVal === 'Other') {
        var customMat = $('#rugMaterialOtherInput').value.trim();
        matVal = customMat ? customMat : 'Custom Material';
      }
       return rugCount + ' · ' + sizeVal + ' · ' + matVal;
    }
    if (state.service === 'Upholstery' || state.service === 'Upholstery Cleaning' || state.service === 'Sofa Cleaning') {
      var uItems = [];
      if ($('#uph_sectional') && $('#uph_sectional').checked) {
        var secQty = parseInt($('#qty_uph_sectional').value, 10) || 1;
        uItems.push(secQty + ' ' + (secQty === 1 ? 'Sectional Sofa' : 'Sectional Sofas'));
      }
      if ($('#uph_sofa') && $('#uph_sofa').checked) {
        var sofQty = parseInt($('#qty_uph_sofa').value, 10) || 1;
        uItems.push(sofQty + ' ' + (sofQty === 1 ? '3-Seater Sofa' : '3-Seater Sofas'));
      }
      if ($('#uph_recliner') && $('#uph_recliner').checked) {
        var recQty = parseInt($('#qty_uph_recliner').value, 10) || 1;
        uItems.push(recQty + ' ' + (recQty === 1 ? 'Recliner' : 'Recliners'));
      }
      if ($('#uph_armchair') && $('#uph_armchair').checked) {
        var armQty = parseInt($('#qty_uph_armchair').value, 10) || 1;
        uItems.push(armQty + ' ' + (armQty === 1 ? 'Armchair & Ottoman' : 'Armchairs & Ottomans'));
      }
      if ($('#uph_wingback') && $('#uph_wingback').checked) {
        var winQty = parseInt($('#qty_uph_wingback').value, 10) || 1;
        uItems.push(winQty + ' ' + (winQty === 1 ? 'Wingback Chair' : 'Wingback Chairs'));
      }
      if ($('#uph_dining_chair') && $('#uph_dining_chair').checked) {
        var dcQty = parseInt($('#qty_uph_dining_chair').value, 10) || 4;
        uItems.push(dcQty + ' ' + (dcQty === 1 ? 'Dining Chair' : 'Dining Chairs'));
      }
      var uphMat = $('input[name="uphMaterial"]:checked') ? $('input[name="uphMaterial"]:checked').value : 'Fabric / Microfiber';
      var furnSummary = uItems.length ? uItems.join(', ') : '1 Sofa';
      return furnSummary + ' (' + uphMat + ')';
    }
    return 'Not specified';
  }
   function fillSummary() {
    $('#sumService').textContent = state.service;
    $('#sumDetails').textContent = detailText();
    $('#sumDate').textContent = state.date ? longDate(state.date) : '-';
    $('#sumTime').textContent = state.time || '-';
  }
   function setStep(n) {
    step = n;
    $$('[data-step]', modal).forEach(function (sec) {
      sec.hidden = Number(sec.getAttribute('data-step')) !== n;
    });
    $$('li', stepBar).forEach(function (li, i) {
      var idx = i + 1;
      li.setAttribute('data-state', idx === n ? 'active' : (idx < n ? 'done' : ''));
    });
     stepBar.hidden = (n === 4);
    modalFoot.hidden = (n === 4);
    btnBack.hidden = (n === 1 || n === 4);
    btnNext.textContent = (n === 3) ? 'Confirm Booking' : 'Continue';
     if (n === 2) {
      setSameDayMode(state.isSameDay);
      renderCalendar();
      renderTimes();
    }
    if (n === 3) fillSummary();
     panel.scrollIntoView({ block: 'start' });
    modal.scrollTop = 0;
  }
   btnBack.addEventListener('click', function () {
    if (step === 2 && state.isSameDay) {
      setSameDayMode(false);
    }
    if (step > 1) setStep(step - 1);
  });
   btnNext.addEventListener('click', function () {
    if (step === 1) { syncServiceDetails(); setStep(2); return; }
     if (step === 2) {
      if (state.isSameDay) return;
      var err = $('#err-datetime');
      if (!state.date) {
        $('span', err).textContent = 'Please choose an appointment date.';
        err.setAttribute('data-show', 'true');
        reveal(err);
        return;
      }
      if (!state.time) {
        $('span', err).textContent = 'Please choose an appointment time.';
        err.setAttribute('data-show', 'true');
        reveal(err);
        return;
      }
      err.setAttribute('data-show', 'false');
      setStep(3);
      return;
    }
     // Step 3: validate, then submit (§52 loading state, no double submits)
    var form = $('#bookingForm');
    var ok = true;
    ok = validText($('#b-first'), 'err-b-first', 'Please enter your first name.') && ok;
    ok = validText($('#b-last'), 'err-b-last', 'Please enter your last name.') && ok;
    ok = validPhone($('#b-phone'), 'err-b-phone') && ok;
    ok = validEmail($('#b-email'), 'err-b-email') && ok;
    ok = validText($('#b-address'), 'err-b-address', 'Please enter the service address.') && ok;
     if (!ok) { focusFirstInvalid(form); return; }
     var bookingError = $('#err-booking');
    bookingError.setAttribute('data-show', 'false');
    btnNext.disabled = true;
    btnBack.disabled = true;
    btnNext.textContent = 'Booking…';
     sendToSheet({
      form: 'booking',
      firstName: $('#b-first').value,
      lastName: $('#b-last').value,
      phone: $('#b-phone').value,
      email: $('#b-email').value,
      address: $('#b-address').value,
      service: state.service,
      details: detailText(),
      date: longDate(state.date) + ', ' + state.date.getFullYear(),
      time: state.time,
      notes: $('#b-notes').value
    }).then(function () {
      $('#cnfService').textContent = state.service;
      $('#cnfDetails').textContent = detailText();
      $('#cnfDate').textContent = longDate(state.date);
      $('#cnfTime').textContent = state.time;
      $('#cnfName').textContent = $('#b-first').value.trim() + ' ' + $('#b-last').value.trim();
      setStep(4);
    }, function (err) {
      console.error(err);
      btnNext.textContent = 'Confirm Booking';
      bookingError.setAttribute('data-show', 'true');
      reveal(bookingError);
    }).then(function () {
      btnNext.disabled = false;
      btnBack.disabled = false;
    });
  });
   /* ---------------- Open / close ---------------- */
  function openModal(service) {
    lastFocus = document.activeElement;
    setMenu(false);
     if (service) {
      var radio = $('input[name="service"][value="' + service + '"]');
      if (!radio && (service === 'Sofa Cleaning' || service === 'Upholstery Cleaning' || service === 'Upholstery')) {
        radio = $('input[name="service"][value="Upholstery"]') || $('input[name="service"][value="Upholstery Cleaning"]');
      }
      if (radio) radio.checked = true;
    }
    syncServiceDetails();
    state.isSameDay = false;
    setSameDayMode(false);
     modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setStep(1);
    $('.modal__close', modal).focus();
  }
   function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
   $$('[data-book]').forEach(function (b) {
    b.addEventListener('click', function () { openModal(b.getAttribute('data-service')); });
  });
  $$('[data-close]', modal).forEach(function (b) {
    b.addEventListener('click', closeModal);
  });
   document.addEventListener('keydown', function (e) {
    if (modal.hidden) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Tab') return;
     var focusables = $$('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])', panel)
      .filter(function (el) { return el.offsetParent !== null; });
    if (!focusables.length) return;
     var first = focusables[0];
    var last = focusables[focusables.length - 1];
     if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------------- Floating offer toggle ---------------- */
  var closeOfferBtn = $('#closeFloatingOffer');
  var openOfferBtn = $('#openFloatingOffer');
  var offerCard = $('#floatingOfferCard');

  if (closeOfferBtn && openOfferBtn && offerCard) {
    // On phones (and short landscape screens) the full card would cover the page, so start
    // with the small pill, and keep even that out of the way while the hero's Book and Call
    // buttons are on screen; it slides in once the visitor scrolls past them.
    var compactOffer = window.matchMedia('(max-width: 767px), (max-height: 500px)');
    if (compactOffer.matches) {
      offerCard.hidden = true;
      openOfferBtn.hidden = false;
    }
    var floatingOffer = $('#floatingOffer');
    var heroCta = $('.hero__cta');
    if (floatingOffer && heroCta && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        floatingOffer.classList.toggle('is-tucked', compactOffer.matches && entries[0].isIntersecting);
      }).observe(heroCta);
    }
    closeOfferBtn.addEventListener('click', function () {
      offerCard.hidden = true;
      openOfferBtn.hidden = false;
    });
    openOfferBtn.addEventListener('click', function () {
      offerCard.hidden = false;
      openOfferBtn.hidden = true;
    });
  }
}
