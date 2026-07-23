export default function Table({ columns, rows }) {
  return (
    <div className="nm-table-wrap overflow-x-auto">
      <table className="w-full border-collapse border border-hairline rounded-md overflow-hidden font-body">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={i}
                className="border-b border-hairline bg-green-100 px-4 py-2.5 text-left font-mono text-xs uppercase tracking-[.04em] text-green-900"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
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
