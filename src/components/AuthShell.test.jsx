import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import AuthShell, { AuthHeading } from './AuthShell'

// This suite renders to a string, so there is no DOM for a theme to be read from. Only the toggle needs
// one, and what is under test is the shell's shape, so the hook is fixed and the provider never mounts.
vi.mock('../lib/ThemeContext.jsx', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useTheme: () => ({ theme: 'light', toggleTheme: () => {} }) }
})

const render = (children) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <AuthShell>{children}</AuthShell>
    </MemoryRouter>,
  )

describe('AuthShell', () => {
  it('puts the brand panel and the form in one frame', () => {
    const html = render(<p>the form</p>)
    expect(html).toContain('Everything for the semester, in one place.')
    expect(html).toContain('the form')
  })

  it('links the crest and wordmark back to the site, the only way home on these routes', () => {
    const html = render(null)
    expect(html).toContain('href="/"')
    expect(html).toContain('NAMMES Hub home')
  })

  it('keeps the same three capabilities on every screen', () => {
    const onLogin = render(null)
    const onReset = render(<AuthHeading eyebrow="Final step" title="Choose a new password" />)
    for (const line of ['Outlines and course materials by level', 'Timetable, academic calendar and events', 'Past questions, practice and live quizzes']) {
      expect(onLogin).toContain(line)
      expect(onReset).toContain(line)
    }
  })

  it('carries a theme toggle, because the navbar that normally has one is hidden here', () => {
    expect(render(null)).toContain('Switch to dark mode')
  })
})

// The four screens used to look different from each other because login and forgot-password hand-rolled
// their own fields. A page that quietly kept the old card would bring that back one screen at a time.
describe('the auth pages', () => {
  const PAGES = [
    'src/pages/Login.jsx',
    'src/pages/Signup.jsx',
    'src/pages/ForgotPassword.jsx',
    'src/pages/ResetPassword.jsx',
  ]

  for (const page of PAGES) {
    const source = readFileSync(page, 'utf8')

    it(`${page} renders inside AuthShell`, () => {
      expect(source).toContain("from '../components/AuthShell'")
      expect(source).toContain('<AuthShell>')
    })

    it(`${page} no longer builds its own card`, () => {
      expect(source).not.toContain('AuthCard')
    })
  }
})
