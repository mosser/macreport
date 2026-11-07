# ADR 0002: The McMaster colour palette and the McSCert logo

- **Status:** Accepted
- **Date:** 2026-11-07
- **Deciders:** Sébastien Mosser

## Context

The system and the report document it writes are McSCert material: the report
goes to McSCert's administration in place of the McSCert Expense Report
Template. Picking colours screen by screen would drift from McMaster's
identity and leave contrast decisions to be made again each time. McMaster's
other applications by the same team use the university palette with the
token names below, so styles can be carried between them.

McMaster publishes its palette and usage rules at
<https://brand.mcmaster.ca/guidelines_introduction/visual-identity-guidelines/colour-palette/>.
The official Heritage Grey is `#495965`; older third-party sources list
`#5E6A71`.

## Decision

### Palette

The interface and the report document use **only** the McMaster palette. It
is declared as CSS custom properties in `src/style.css`, the only file holding
colour literals; everything else refers to a `var(--mac-…)` or a semantic
`--color-*` role derived from one. The report document takes its colours from
the same tokens, read from the page when the document is written, so it holds
no colour literal of its own.

**Heritage colours**

| Token | Name | HEX | Role |
|---|---|---|---|
| `--mac-maroon` | Heritage Maroon | `#7A003C` | Primary: headers, primary actions, titles. |
| `--mac-gold` | Heritage Gold | `#FDBF57` | Secondary: highlights, active states, callouts. |
| `--mac-grey` | Heritage Grey | `#495965` | Neutral: body text on light backgrounds, secondary text, borders. |
| `--mac-white` | White | `#FFFFFF` | Page and surface background (light theme). |
| `--mac-black` | Black | `#000000` | Page and surface background (dark theme), text on gold. |

**Brighter World accent colours** (icons, status, signalling only)

| Token | Name | HEX |
|---|---|---|
| `--mac-accent-pink` | Royal Botanical Pink | `#FF9980` |
| `--mac-accent-lime` | Cootes Paradise Green | `#E4EA6C` |
| `--mac-accent-green` | King's Forest Green | `#0E5B3D` |
| `--mac-accent-blue` | Bayfront Blue | `#0D5D78` |
| `--mac-accent-sky` | Albion Falls Blue | `#AAD5E1` |
| `--mac-accent-purple` | Pier 4 Purple | `#CC99CC` |
| `--mac-accent-light-grey` | Dundurn Grey | `#DBDBDD` |

### Usage rules

1. **Maroon dominates.** Gold is the first additional colour and always less
   prominent. Accents never dominate a screen or a page.
2. **Accents are for signalling**: status, icons, findings. Never chrome.
3. **Tints and shades are not invented.** An intermediate tone is derived from
   a token with `color-mix()` or opacity, never added as a literal. Dundurn
   Grey is the light neutral for dividers and subtle backgrounds.
4. **Text contrast** meets WCAG AA (4.5:1). Approved pairings:

   | Text | Background | Ratio |
   |---|---|---|
   | White | Maroon | 11.1 |
   | Gold | Maroon | 6.7 |
   | Maroon | White | 11.1 |
   | Grey | White | 7.2 |
   | Black | Gold | 12.8 |
   | Maroon | Dundurn Grey | 8.0 |
   | White | Grey | 7.2 |
   | White | Green / Blue accents | 8.1 / 7.4 |
   | Black | Pink / Lime / Sky / Purple accents | ≥ 9.0 |
   | Maroon | 12% maroon tint on white | 8.7 |
   | Amber (50% gold, 50% black) | White | 5.8 |

   **Forbidden for text:** gold on white (1.6:1) and white on gold.
5. **Dark theme** for the interface: same palette, white and black swap roles,
   maroon stays primary. The report document is always light.

### Logo

The McSCert logo is used as supplied by McMaster, never redrawn or recoloured:

| File | Use |
|---|---|
| `src/assets/mcscert-left-col.png` | Colour, horizontal: the generated pages of the report document (cover, section pages, missing receipt authorizations), and the interface on a light background. |
| `src/assets/mcscert-left-rev.png` | Reversed, horizontal: the interface's maroon header bar. |
| `src/assets/mcscert-stack-col.png` | Colour, stacked: the favicon. |

They are imported from `src/` so the build inlines them (ADR 0001). As
supplied images, they are exempt from the colour-literal rule. The McSCert
logo carries McMaster's wordmark and crest, so it also heads the missing
receipt authorizations the system writes in place of McMaster's form.

## Consequences

**Positive**

- The interface and the report document look like McSCert material without
  any per-screen design discussion, and like the team's other applications.
- Contrast has been checked once; pairings are picked from rule 4.

**Negative / accepted trade-offs**

- Gold is unusable for text on light surfaces.
- The logos are raster images inlined in the single file; they are kept at the
  resolution supplied, which is enough for print at the size used.

## Compliance

A change is compliant with this ADR when:

- every colour literal lives in the palette block of `src/style.css`, and the
  report document's colours come from those tokens;
- any text/background pairing is one listed in rule 4, or has a measured
  contrast ratio of at least 4.5:1 noted in the change;
- no gold text appears on white or on Dundurn Grey;
- the logo files are those of the table, unmodified.
