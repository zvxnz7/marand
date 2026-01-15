// utils.js (merged)

export function clamp(v, a, b){
    return Math.max(a, Math.min(b, v));
  }
  
  export function esc(s){
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  
  export function escAttr(s){
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  
  export function formatDatePL(iso){
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("pl-PL");
  }
  
  /**
   * Kept for backwards compatibility (some code may still import it).
   * Even if you no longer use x/y logic, this is harmless and useful.
   */
  export function parseNumLoose(s){
    if (s == null) return null;
    const m = String(s).replace(",", ".").match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    const v = Number(m[0]);
    return Number.isFinite(v) ? v : null;
  }
  
  /**
   * ✅ Backwards-compatible signature:
   * - Old calls: wydanoBadgeHTML(ilosc, wydano)
   * - New calls: wydanoBadgeHTML(wydano)
   *
   * We IGNORE the numeric x/y comparison now (as requested) and just show what was typed.
   */
  export function wydanoBadgeHTML(a, b){
    // Detect which style was used:
    // new: (wydano) => a is wydano, b is undefined
    // old: (ilosc, wydano) => b is wydano
    const wydano = (b === undefined) ? a : b;
  
    const w = String(wydano ?? "").trim();
    if (!w) return `<span class="badge muted">Wydano: (puste)</span>`;
    return `<span class="badge">Wydano: ${esc(w)}</span>`;
  }
  
  /**
   * New nicer text, but still same export name so old imports work.
   */
  export function coveredBadgeHTML(covered){
    return covered
      ? `<span class="badge ok">Pozycja: zrobiona</span>`
      : `<span class="badge warn">Pozycja: w trakcie</span>`;
  }
  
  /**
   * Kept because some renderers may still import kv().
   */
  export function kv(k, v){
    return `
      <div class="kv">
        <div class="k">${k}</div>
        <div class="v">${v || "<span style='opacity:.6'>(puste)</span>"}</div>
      </div>
    `;
  }
  