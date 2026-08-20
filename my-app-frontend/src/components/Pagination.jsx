import { useState, useEffect, useMemo } from "react";

/*
  Reusable client-side pagination.

  Usage:
    const { pageItems, pagination } = usePagination(filteredArray, 25);
    ...render pageItems...
    {pagination}
*/
export function usePagination(items, perPage = 25) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / perPage));

  // If filtering shrinks the list, don't strand the user on an empty page.
  useEffect(() => { if (page > pages) setPage(1); }, [pages, page]);

  const pageItems = useMemo(
    () => items.slice((page - 1) * perPage, page * perPage),
    [items, page, perPage]
  );

  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const pagination = total > perPage
    ? <Pagination page={page} pages={pages} from={from} to={to} total={total} onChange={setPage} />
    : null;

  return { pageItems, pagination, page, setPage };
}

export default function Pagination({ page, pages, from, to, total, onChange }) {
  // Windowed page numbers: 1 … 4 5 [6] 7 8 … 20
  const nums = [];
  const push = (n) => nums.push(n);
  const span = 1;
  push(1);
  if (page - span > 2) nums.push("…");
  for (let n = Math.max(2, page - span); n <= Math.min(pages - 1, page + span); n++) push(n);
  if (page + span < pages - 1) nums.push("…");
  if (pages > 1) push(pages);

  return (
    <div style={wrap}>
      <div style={count}>
        Showing <b style={{ color: "#334155" }}>{from}–{to}</b> of <b style={{ color: "#334155" }}>{total}</b>
      </div>

      <div style={controls}>
        <button
          style={{ ...navBtn, ...(page === 1 ? disabled : {}) }}
          className="tc-btn"
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
        >
          ‹ Prev
        </button>

        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`gap-${i}`} style={gap}>…</span>
          ) : (
            <button
              key={n}
              style={{ ...numBtn, ...(n === page ? numActive : {}) }}
              className="tc-btn"
              onClick={() => onChange(n)}
              aria-current={n === page ? "page" : undefined}
            >
              {n}
            </button>
          )
        )}

        <button
          style={{ ...navBtn, ...(page === pages ? disabled : {}) }}
          className="tc-btn"
          onClick={() => onChange(page + 1)}
          disabled={page === pages}
          aria-label="Next page"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */
const wrap = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  gap: 14, flexWrap: "wrap", marginTop: 16, paddingTop: 14, borderTop: "1px solid #EEF2F8",
};
const count = { fontSize: 13, color: "#94A3B8" };
const controls = { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" };
/* Longhand border properties only — mixing `border` shorthand with `borderColor`
   in a state-dependent style causes React style-patching bugs. */
const base = {
  borderWidth: 1, borderStyle: "solid", borderColor: "#E6ECF5",
  background: "#fff", color: "#334155",
  borderRadius: 9, cursor: "pointer", fontSize: 13.5, fontWeight: 600,
};
const navBtn = { ...base, padding: "8px 13px" };
const numBtn = { ...base, padding: "8px 0", minWidth: 36, textAlign: "center" };
const numActive = {
  background: "linear-gradient(135deg,#1D4ED8,#123471)", color: "#fff",
  borderColor: "transparent", boxShadow: "0 4px 12px rgba(29,78,216,.28)",
};
const disabled = { opacity: 0.45, cursor: "not-allowed" };
const gap = { color: "#CBD5E1", padding: "0 2px", fontSize: 13 };
