export default function Table({ columns, rows }) {
  return (
    <div className="nm-table-wrap overflow-x-auto">
      <table className="w-full border-collapse border border-hairline rounded-sm overflow-hidden font-body">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={i}
                className="border-b border-hairline bg-surface-low px-4 py-2.5 text-left font-body text-xs font-semibold uppercase tracking-[.05em] text-ink"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="hover:bg-surface-low transition-colors">
              {r.map((cell, ci) => (
                <td
                  key={ci}
                  className={[
                    'px-4 py-3 text-sm text-ink',
                    ri < rows.length - 1 ? 'border-b border-hairline' : '',
                  ].join(' ')}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
