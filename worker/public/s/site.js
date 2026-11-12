/* WJR — interações do site (sem dependências). Tudo funciona sem JS; aqui é só refinamento. */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ───────── Header: sólido ao rolar, esconde ao descer ───────── */
  const hdr = $('[data-header]');
  const over = hdr && hdr.classList.contains('hdr--over');
  const mbar = $('[data-mbar]');
  const waf = $('[data-wa-float]');
  let lastY = 0;
  const onScroll = () => {
    const y = scrollY;
    if (hdr) {
      if (over) hdr.classList.toggle('is-solid', y > 40);
      hdr.classList.toggle('is-hidden', y > 400 && y > lastY + 4 && !document.body.classList.contains('menu-open'));
      if (y < lastY - 4) hdr.classList.remove('is-hidden');
    }
    const show = y > innerHeight * 0.6;
    mbar && mbar.classList.toggle('is-on', show);
    waf && waf.classList.toggle('is-on', show);
    lastY = y;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ───────── Menu móvel ───────── */
  const toggle = $('[data-menu-toggle]');
  const menu = $('[data-menu]');
  if (toggle && menu) {
    const label = $('.hdr__burger-label', toggle);
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('menu-open', open);
      if (label) label.textContent = open ? 'Fechar' : 'Menu';
      if (open) {
        menu.hidden = false;
        requestAnimationFrame(() => menu.classList.add('is-open'));
        const first = $('a', menu);
        first && first.focus({ preventScroll: true });
      } else {
        menu.classList.remove('is-open');
        setTimeout(() => (menu.hidden = true), reduced ? 0 : 300);
      }
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    addEventListener('keydown', (e) => e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true' && (setOpen(false), toggle.focus()));
    matchMedia('(min-width: 981px)').addEventListener('change', (e) => e.matches && setOpen(false));
  }

  /* ───────── Revelação ao rolar ───────── */
  const reveal = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    reveal.forEach((el) => io.observe(el));
  } else reveal.forEach((el) => el.classList.add('is-in'));

  /* ───────── Vídeo do hero: só carrega em telas grandes e sem economia de dados ───────── */
  const vid = $('[data-hero-video]');
  if (vid) {
    const save = navigator.connection && navigator.connection.saveData;
    if (!reduced && !save && matchMedia('(min-width: 768px)').matches) {
      vid.preload = 'auto';
      vid.play().catch(() => {});
    } else vid.remove();
  }

  /* ───────── Serviços (home): quadro de imagem acompanha a linha ativa ───────── */
  const svcs = $('[data-svcs]');
  if (svcs) {
    const rows = $$('[data-svc]', svcs);
    const frames = $$('[data-svc-frame]', svcs);
    const activate = (i) => {
      rows.forEach((r, k) => r.classList.toggle('is-on', k === i));
      frames.forEach((f, k) => f.classList.toggle('is-on', k === i));
    };
    rows.forEach((r, i) => {
      r.addEventListener('mouseenter', () => activate(i));
      r.addEventListener('focusin', () => activate(i));
    });
  }

  /* ───────── Portfólio: filtro com transição (links continuam funcionando sem JS) ───────── */
  const filters = $('[data-filters]');
  const grid = $('[data-pgrid]');
  if (filters && grid) {
    const SIZES = ['xl', 's', 'm', 'm', 'm', 'l', 's'];
    const cards = $$('.pcard', grid);
    const empty = $('[data-empty]');
    const apply = (cat) => {
      let n = 0;
      grid.classList.add('is-filtering');
      for (const c of cards) {
        const show = !cat || c.dataset.cat === cat;
        c.hidden = !show;
        if (show) {
          c.className = c.className.replace(/pcard--\w+/, `pcard--${SIZES[n % SIZES.length]}`);
          const num = $('.pcard__n', c);
          if (num) num.textContent = String(n + 1).padStart(2, '0');
          c.classList.add('is-in');
          if (!reduced) {
            c.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], {
              duration: 500,
              delay: Math.min(n, 6) * 50,
              easing: 'cubic-bezier(.2,.7,.1,1)',
              fill: 'backwards',
            });
          }
          n++;
        }
      }
      if (empty) empty.hidden = n > 0;
      $$('a', filters).forEach((a) => (a.dataset.filter === cat ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    };
    filters.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-filter]');
      if (!a || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      apply(a.dataset.filter);
      history.replaceState(null, '', a.href);
      const title = $('.phead__title');
      if (title) title.textContent = a.dataset.filter ? a.firstChild.textContent.trim() : 'Projetos executados';
    });
  }

  /* ───────── Lightbox da galeria do projeto ───────── */
  const lb = $('[data-lightbox]');
  const dataEl = $('[data-lb-data]');
  if (lb && dataEl) {
    let items = [];
    try {
      items = JSON.parse(dataEl.textContent || '[]').filter((i) => i.src);
    } catch {
      items = [];
    }
    const imgEl = $('[data-lb-img]', lb);
    const cap = $('[data-lb-cap]', lb);
    const count = $('[data-lb-count]', lb);
    let idx = 0;
    let opener = null;
    const big = (src) => (src.includes('images.unsplash.com') ? src.replace(/([?&])w=\d+/, '$1w=2400') : src);
    const show = (i) => {
      idx = (i + items.length) % items.length;
      const it = items[idx];
      imgEl.src = big(it.src);
      imgEl.alt = it.alt || '';
      cap.textContent = [it.alt, it.demo ? 'Imagem ilustrativa' : ''].filter(Boolean).join(' · ');
      count.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
    };
    const open = (i, from) => {
      opener = from;
      show(i);
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => lb.classList.add('is-open'));
      $('[data-lb-close]', lb).focus();
    };
    const close = () => {
      lb.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(() => (lb.hidden = true), reduced ? 0 : 250);
      opener && opener.focus();
    };
    $$('[data-lb-item]').forEach((b) => b.addEventListener('click', () => open(Number(b.dataset.lbItem), b)));
    $('[data-lb-close]', lb).addEventListener('click', close);
    $('[data-lb-prev]', lb).addEventListener('click', () => show(idx - 1));
    $('[data-lb-next]', lb).addEventListener('click', () => show(idx + 1));
    lb.addEventListener('click', (e) => e.target === lb && close());
    addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
      if (e.key === 'Tab') {
        const f = $$('button', lb);
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
        else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
      }
    });
    let x0 = null;
    lb.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
    lb.addEventListener('touchend', (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
      x0 = null;
    });
    if (items.length < 2) $$('.lb__nav', lb).forEach((b) => (b.hidden = true));
  }

  /* ───────── Formulário de orçamento ───────── */
  const form = $('[data-qform]');
  if (!form) return;
  const MAX_FILES = 5;
  const MAX_BYTES = 8 * 1024 * 1024;
  const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
  const started = $('[data-started]', form);
  if (started) started.value = String(Date.now());
  const summary = $('[data-summary]', form);
  const done = $('[data-done]');
  const fileInput = $('[data-files]', form);
  const list = $('[data-file-list]', form);
  const drop = $('[data-drop]', form);
  let files = [];
  let mode = 'site';

  const rules = {
    name: (v) => (v.trim().length < 2 ? 'Informe seu nome.' : ''),
    phone: (v) => (v.replace(/\D/g, '').length < 10 ? 'Informe um telefone com DDD.' : ''),
    city: (v) => (v.trim().length < 2 ? 'Informe a cidade.' : ''),
    description: (v) => (v.trim().length < 10 ? 'Descreva o projeto em poucas palavras (mín. 10 caracteres).' : ''),
  };
  const setErr = (name, msg) => {
    const box = $(`[data-field="${name}"]`, form);
    const el = $(`#e-${name}`, form);
    const input = form.elements[name];
    if (el) el.textContent = msg || '';
    if (box) {
      box.classList.toggle('is-invalid', !!msg);
      box.classList.toggle('is-valid', !msg && !!(input && input.value && input.value.trim()));
    }
    if (input && input.setAttribute) {
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      const desc = [msg ? `e-${name}` : '', $(`#h-${name}`, form) ? `h-${name}` : ''].filter(Boolean).join(' ');
      desc ? input.setAttribute('aria-describedby', desc) : input.removeAttribute('aria-describedby');
    }
  };
  for (const name of Object.keys(rules)) {
    const input = form.elements[name];
    if (!input) continue;
    input.addEventListener('blur', () => input.value && setErr(name, rules[name](input.value)));
    input.addEventListener('input', () => {
      if ($(`[data-field="${name}"]`, form).classList.contains('is-invalid')) setErr(name, rules[name](input.value));
    });
  }

  // Máscara simples de telefone: (00) 00000-0000
  const phone = $('[data-phone]', form);
  phone &&
    phone.addEventListener('input', () => {
      const d = phone.value.replace(/\D/g, '').slice(0, 11);
      phone.value =
        d.length > 10
          ? d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
          : d.length > 6
            ? d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
            : d.length > 2
              ? d.replace(/(\d{2})(\d+)/, '($1) $2')
              : d;
    });

  // Arquivos: pré-visualização, remoção e redução de fotos grandes antes do envio.
  const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
  const renderFiles = () => {
    list.innerHTML = '';
    files.forEach((f, i) => {
      const li = document.createElement('li');
      li.className = 'drop__file';
      if (f.type.startsWith('image/') && !/hei[cf]/.test(f.type)) {
        const im = document.createElement('img');
        im.alt = '';
        im.src = URL.createObjectURL(f);
        im.onload = () => URL.revokeObjectURL(im.src);
        li.append(im);
      } else {
        const d = document.createElement('div');
        d.className = 'drop__pdf';
        d.textContent = f.type === 'application/pdf' ? 'PDF' : 'IMG';
        li.append(d);
      }
      const p = document.createElement('p');
      p.textContent = `${f.name} · ${fmtSize(f.size)}`;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'drop__rm';
      rm.setAttribute('aria-label', `Remover ${f.name}`);
      rm.textContent = '×';
      rm.addEventListener('click', () => {
        files.splice(i, 1);
        renderFiles();
      });
      li.append(p, rm);
      list.append(li);
    });
  };
  const shrink = (file) =>
    new Promise((resolve) => {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 900 * 1024) return resolve(file);
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        URL.revokeObjectURL(url);
        const max = 2200;
        const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
        const cv = document.createElement('canvas');
        cv.width = Math.round(im.naturalWidth * k);
        cv.height = Math.round(im.naturalHeight * k);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        cv.toBlob(
          (b) => resolve(b && b.size < file.size ? new File([b], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file),
          'image/jpeg',
          0.84,
        );
      };
      im.onerror = () => (URL.revokeObjectURL(url), resolve(file));
      im.src = url;
    });
  const addFiles = async (incoming) => {
    const errs = [];
    for (const f of incoming) {
      if (files.length >= MAX_FILES) {
        errs.push(`Máximo de ${MAX_FILES} arquivos.`);
        break;
      }
      if (!OK_TYPES.includes(f.type)) {
        errs.push(`${f.name}: formato não aceito.`);
        continue;
      }
      const s = await shrink(f);
      if (s.size > MAX_BYTES) {
        errs.push(`${f.name}: acima de 8 MB.`);
        continue;
      }
      files.push(s);
    }
    $('#e-files', form).textContent = errs.join(' ');
    renderFiles();
  };
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      addFiles(Array.from(fileInput.files || []));
      fileInput.value = '';
    });
    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => (e.preventDefault(), drop.classList.add('is-over'))));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      addFiles(Array.from(e.dataTransfer.files || []));
    });
  }

  $$('[data-submit]', form).forEach((b) => b.addEventListener('click', () => (mode = b.dataset.submit)));

  const waMessage = (fd, protocol) => {
    const g = (k) => String(fd.get(k) || '').trim();
    const lines = [
      'Olá! Gostaria de solicitar um orçamento.',
      '',
      `*Nome:* ${g('name')}`,
      `*Telefone:* ${g('phone')}`,
      `*Cidade:* ${g('city')}`,
      g('service') && `*Serviço:* ${g('service')}`,
      g('material') && `*Material:* ${g('material')}`,
      g('measures') && `*Medidas:* ${g('measures')}`,
      g('reference') && `*Referência:* ${g('reference')}`,
      '',
      `*Descrição:* ${g('description')}`,
      files.length ? `\nEnviei ${files.length} arquivo(s) pelo formulário do site.` : '',
      protocol ? `Protocolo: ${protocol}` : '',
    ];
    return lines.filter((l) => l !== false && l !== null).join('\n');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    summary.hidden = true;
    const errs = [];
    for (const [name, fn] of Object.entries(rules)) {
      const msg = fn(form.elements[name].value);
      setErr(name, msg);
      if (msg) errs.push(name);
    }
    if (errs.length) {
      summary.textContent = errs.length === 1 ? 'Confira o campo destacado.' : `Confira os ${errs.length} campos destacados.`;
      summary.hidden = false;
      form.elements[errs[0]].focus();
      return;
    }
    const fd = new FormData(form);
    fd.delete('files');
    files.forEach((f) => fd.append('files', f, f.name));
    const btns = $$('[data-submit]', form);
    const active = btns.find((b) => b.dataset.submit === mode) || btns[0];
    const original = active.innerHTML;
    btns.forEach((b) => (b.disabled = true));
    active.textContent = files.length ? 'Enviando arquivos…' : 'Enviando…';
    form.classList.add('is-sending');
    try {
      const res = await fetch(form.action, { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const fields = (data.details && data.details.fields) || {};
        Object.entries(fields).forEach(([k, v]) => setErr(k, v));
        throw new Error(data.error || 'Não foi possível enviar agora.');
      }
      const protocol = (data.id || '').slice(0, 8).toUpperCase();
      $('[data-protocol]', done).textContent = protocol || '—';
      const wa = form.dataset.wa;
      form.hidden = true;
      done.hidden = false;
      done.focus();
      scrollTo({ top: done.getBoundingClientRect().top + scrollY - 120, behavior: reduced ? 'auto' : 'smooth' });
      if (mode === 'wa' && wa) location.href = `${wa}?text=${encodeURIComponent(waMessage(fd, protocol))}`;
    } catch (err) {
      summary.textContent = `${err.message} Se preferir, fale conosco pelo WhatsApp ou telefone.`;
      summary.hidden = false;
      summary.focus();
    } finally {
      btns.forEach((b) => (b.disabled = false));
      active.innerHTML = original;
      form.classList.remove('is-sending');
    }
  });

  const again = $('[data-again]');
  again &&
    again.addEventListener('click', () => {
      form.reset();
      files = [];
      renderFiles();
      $$('.f', form).forEach((f) => f.classList.remove('is-valid', 'is-invalid'));
      if (started) started.value = String(Date.now());
      done.hidden = true;
      form.hidden = false;
      form.elements.name.focus();
    });
})();
