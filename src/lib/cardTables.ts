/**
 * Copia o texto do cabeçalho de cada coluna para o atributo data-label das células
 * de tabelas `.tbl-cards`. No celular, o CSS usa esse rótulo para exibir cada linha
 * como cartão ("Coluna ..... valor"). Funciona para qualquer tabela renderizada depois.
 */
export function startCardTableLabels(root: HTMLElement = document.body) {
  let queued = false;
  const apply = () => {
    queued = false;
    root.querySelectorAll<HTMLTableElement>('table.tbl-cards').forEach((table) => {
      const heads = Array.from(table.tHead?.rows[0]?.cells ?? []).map((th) => th.textContent?.trim() ?? '');
      if (!heads.length) return;
      Array.from(table.tBodies).forEach((tb) =>
        Array.from(tb.rows).forEach((tr) => {
          let col = 0;
          Array.from(tr.cells).forEach((td) => {
            const label = heads[col] ?? '';
            if (label && td.getAttribute('data-label') !== label) td.setAttribute('data-label', label);
            if (!label && td.hasAttribute('data-label')) td.removeAttribute('data-label');
            col += td.colSpan || 1;
          });
        }),
      );
    });
  };
  const obs = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  });
  obs.observe(root, { childList: true, subtree: true });
  apply();
  return () => obs.disconnect();
}
