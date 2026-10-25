import React from 'react'
import { C } from '../theme'
import { Chip, Hero, SITE, SiteHeader } from './SiteChrome'

export const FormsScreen: React.FC = () => (
  <div style={{ position: 'absolute', inset: 0 }}>
    <SiteHeader active="Support" />
    <div style={{ position: 'absolute', left: 0, right: 0, top: 126 }}>
      <Hero title="Open forms" subtitle="Event registrations, surveys, and applications currently accepting responses." />
    </div>

    <div
      style={{
        position: 'absolute',
        left: 64,
        top: 470,
        width: 1792,
        height: 150,
        borderRadius: 14,
        backgroundColor: SITE.soft,
        display: 'flex',
        alignItems: 'center',
        padding: '0 40px',
      }}
    >
      {[
        ['Open now', '1', SITE.ink],
        ['Responses so far', '128', SITE.ink],
        ['Next deadline', '12 Nov', SITE.orange],
      ].map(([label, value, color], index) => (
        <div key={label} style={{ flex: 1, borderLeft: index ? `1.5px solid ${SITE.line}` : 'none', paddingLeft: index ? 40 : 0 }}>
          <div style={{ fontSize: 25, color: SITE.muted }}>{label}</div>
          <div style={{ fontSize: 48, fontWeight: 700, color }}>{value}</div>
        </div>
      ))}
    </div>

    <div
      style={{
        position: 'absolute',
        left: 64,
        top: 664,
        width: 1792,
        borderRadius: 14,
        border: `1.5px solid ${SITE.line}`,
        backgroundColor: SITE.card,
        padding: '30px 36px',
        display: 'flex',
        alignItems: 'center',
        gap: 32,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <Chip tone="line">SURVEY</Chip>
          <Chip tone="sage">OPEN</Chip>
        </div>
        <div style={{ fontSize: 42, fontWeight: 700, marginTop: 14 }}>Materials Horizon 3.0 attendance</div>
        <div style={{ fontSize: 28, color: SITE.muted, marginTop: 6, maxWidth: 1180 }}>
          Confirm your attendance and pick your preferred session for the department's annual conference.
        </div>
      </div>
      <div
        style={{
          backgroundColor: SITE.green,
          color: C.white,
          fontSize: 30,
          fontWeight: 700,
          padding: '20px 44px',
          borderRadius: 12,
        }}
      >
        Fill form
      </div>
    </div>
  </div>
)
