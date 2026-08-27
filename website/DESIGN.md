# SendArc website design translation

The supplied `docs/design/SendArc-final-reference.png` remains the primary source of truth. Two fresh, section-specific references in `design-references/` clarify the hero and the new Business Beta area without changing the visual language.

## Extracted system

- **Direction:** pristine light mode, subtle technical linework, clean grotesk typography, open layouts, and restrained cobalt blue.
- **Hierarchy:** a two-line 64–72px desktop hero, 38–48px section statements, 18–20px supporting text, and 14–16px utility copy.
- **Palette:** ink `#071225`, secondary ink `#4f5f78`, cobalt `#075cf6`, pale blue `#eef5ff`, border `#d8e5f8`, white `#ffffff`.
- **Spacing:** 1180px maximum content width, 24–32px desktop gutters, 96–128px major section spacing, 24–32px card padding.
- **Components:** an open three-node workflow diagram, a flat four-benefit grid, a numbered three-step sequence, and an editorial split Business Beta form.
- **Shape:** 10–14px card radii, 8–10px buttons and controls, one-pixel blue-gray borders, restrained shadow only where a form or focal product node needs separation.
- **Motion:** subtle staggered reveal and native accordion expansion only; both are disabled by `prefers-reduced-motion`.

## Truthful departures

- Microsoft 365, customer counts, enterprise-readiness, social accounts, and demo claims were removed.
- Third-party product logos are not reproduced. Gmail and Google Workspace appear as text; the destination uses a generic envelope glyph.
- Download CTAs resolve through `/download/`, which discovers a real matching GitHub Release asset when one exists and otherwise shows an honest release-pending state.
- The Business Beta form is a real Pages Function/D1 workflow, with a prefilled support-email fallback if the D1 binding is unavailable.

## Responsive translation

The desktop composition remains open and horizontal. At tablet width, the hero and beta form become two balanced rows. At mobile width, navigation collapses into an accessible menu, the workflow becomes vertical, controls keep a minimum 44px target, and the page never relies on horizontal scrolling.
