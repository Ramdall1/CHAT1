export function createSearchEngine() {
  function normalize(str) {
    return String(str || '').toLowerCase();
  }

  function fullTextSearch(items, keyword, fields = []) {
    const q = normalize(keyword);
    if (!q) return items;
    return items.filter(it => {
      const hay = fields.length
        ? fields.map(f => normalize(it[f])).join(' ')
        : normalize(JSON.stringify(it));
      return hay.includes(q);
    });
  }

  function filterBy(items, criteria = {}) {
    let out = items.slice();
    const { keyword, country, tag, dateFrom, dateTo } = criteria;

    if (keyword)
      out = fullTextSearch(out, keyword, ['name', 'phone', 'last_text']);

    if (country) {
      const cNorm = normalize(country).replace('+', '');
      out = out.filter(it => {
        const phone = String(it.phone || '');
        const m = phone.match(/^(\+?)(\d{1,3})/);
        const cc = m ? m[2] : '';
        return normalize(cc) === cNorm;
      });
    }

    if (tag) {
      out = out.filter(
        it =>
          Array.isArray(it.tags) &&
          it.tags.map(normalize).includes(normalize(tag))
      );
    }

    if (dateFrom || dateTo) {
      const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0;
      const toTs = dateTo
        ? new Date(dateTo).getTime()
        : Number.MAX_SAFE_INTEGER;
      out = out.filter(it => {
        const t = it.last_seen ? new Date(it.last_seen).getTime() : 0;
        return t >= fromTs && t <= toTs;
      });
    }

    return out;
  }

  return { fullTextSearch, filterBy };
}
