/**
 * Data table. From `md` up it is a normal table. Below `md` each row becomes a stacked
 * card with the column name shown beside each value, so wide tables never need a
 * sideways swipe on a phone. Pass `stackOnMobile={false}` to keep a plain scrolling table.
 */
export default function Table({ columns, rows, stackOnMobile = true }) {
  const stack = stackOnMobile

  return (
    <div className="nm-table-wrap overflow-x-auto">
      <table
        className={[
          'w-full border-collapse border border-hairline rounded-sm overflow-hidden font-body',
          stack ? 'max-md:block max-md:border-0' : '',
        ].join(' ')}
      >
        <thead className={stack ? 'max-md:sr-only' : ''}>
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
        <tbody className={stack ? 'max-md:flex max-md:flex-col max-md:gap-3' : ''}>
          {rows.map((r, ri) => (
            <tr
              key={ri}
              className={[
                'hover:bg-surface-low transition-colors',
                stack ? 'max-md:block max-md:rounded-lg max-md:border max-md:border-hairline max-md:bg-surface' : '',
              ].join(' ')}
            >
              {r.map((cell, ci) => (
                <td
                  key={ci}
                  data-label={columns[ci] || undefined}
                  className={[
                    'px-4 py-3 text-sm text-ink',
                    ri < rows.length - 1 ? 'border-b border-hairline' : '',
                    stack
                      ? 'max-md:flex max-md:items-start max-md:justify-between max-md:gap-4 max-md:border-b max-md:border-hairline max-md:py-2.5 max-md:last:border-b-0 max-md:text-right max-md:before:shrink-0 max-md:before:text-left max-md:before:text-xs max-md:before:font-semibold max-md:before:uppercase max-md:before:tracking-[.05em] max-md:before:text-ink-muted max-md:before:content-[attr(data-label)] max-md:break-words'
                      : '',
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
