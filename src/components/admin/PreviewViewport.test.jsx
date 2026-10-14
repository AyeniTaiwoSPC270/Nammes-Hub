import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import PreviewViewport from './PreviewViewport'

describe('admin preview viewport', () => {
  it('labels a keyboard-scrollable region constrained to the viewport', () => {
    const html = renderToStaticMarkup(
      <PreviewViewport label="Calendar preview">
        <p>Preview content</p>
      </PreviewViewport>,
    )

    expect(html).toContain('role="region"')
    expect(html).toContain('aria-label="Calendar preview"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('max-h-[calc(100dvh-12rem)]')
    expect(html).toContain('overflow-y-auto')
    expect(html).toContain('overscroll-contain')
  })
})
