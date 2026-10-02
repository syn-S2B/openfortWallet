# Site audit — 2 October 2026

Scope: local wallet demo, concepts/build guide, Openfort walkthrough and legacy
adapter redirect. Browser observations at default desktop viewport and 390×844;
source review against the Web Interface Guidelines and supplied Onli standard.
This was an audit: application code and user-authored concept copy were not changed.

## Findings, ordered by impact

1. **High — absolute safety claim exceeds the evidence.**
   `public/Docs/index.html:10` states that unintended actions cannot happen.
   The same site's implementation audit explicitly reports missing general backend
   behavior authorization for sends. Tested execution units do not establish correct
   intent interpretation or full end-to-end enforcement. Preserve the author's
   intended conceptual distinction, but qualify the guarantee before describing
   this implementation as production-ready. User-supplied wording was left intact.

2. **Medium — Openfort walkthrough overflows on mobile.**
   `public/Docs/docs.css:1`: `.eyebrow` source-path labels do not wrap long tokens.
   At 390px width the walkthrough document scrollWidth is 448px. Four labels were
   measured overflowing: confirmation Tool, execute Workflow, session Capability
   and reconcile Workflow paths. Add overflow-wrap:anywhere to source labels;
   verify document width rather than hiding overflow. Code/table overflow within
   their own containers is expected and distinct from this page-level bug.

3. **Medium — examples encourage a redundant Workflow wrapper.**
   `public/Docs/index.html:49`: workflow_quote_transfer only forwards its arguments
   to workflow_prepare_transfer, and is not an implemented unit. It adds no coherent
   responsibility and conflicts with the standard's complete-lifecycle/reuse guidance.
   Show the existing prepare/review implementation or a direct composition call.

4. **Medium — no skip-to-content link on either Docs page.**
   `public/Docs/index.html:1`, `public/Docs/openfort-walkthrough.html:1`:
   add a keyboard-visible skip link and matching main landmark target. Current
   repeated top navigation must be traversed on each page. Wallet main also lacks
   a target ID; a modal-specific focus path needs to remain valid in the demo.

5. **Medium — Docs smooth scrolling ignores reduced-motion preference.**
   `public/Docs/docs.css:1`: html uses scroll-behavior:smooth without a
   prefers-reduced-motion override. The wallet CSS already has a reduced-motion
   override, but the separate static Docs stylesheet does not inherit it.

6. **Low — horizontal scroll regions lack accessible labels/instructions.**
   Code/table wrappers on Docs have no region name or scrolling hint. Their
   tabIndex is -1 in the observed DOM; modern browser automatic scroll-container
   focus varies, so keyboard usability needs explicit cross-browser verification.
   Give intentional scrolling regions accessible names and a usable focus treatment.
   Do not turn every short code snippet into an unnecessary tab stop.

7. **Low — sign-in input has incomplete browser metadata.**
   `src/App.tsx:181`: the wrapped label works, but the mixed email/Onli ID input has
   no name and does not explicitly disable spelling/capitalization assistance.
   Add a meaningful name, spellCheck=false and autoCapitalize=none. It is correctly
   disabled in the credential-free demo; authenticated error-focus behavior could
   not be exercised without the backend.

## Checks that passed

- Both Docs pages have one h1 and consistent heading hierarchy.
- All in-page anchors resolve; no duplicate IDs found on the concept guide.
- Concept/build page has no document-level overflow at desktop or 390px.
- Mobile wallet renders without document-level horizontal overflow.
- Closing the wallet returns focus to Preview wallet UI.
- Docs, walkthrough and wallet links resolve in the local browser.
- Legacy wallet-adapter.html redirects to index.html#adapter successfully.
- Observed Docs/walkthrough console error and warning list was empty.
- Docs use local CSS, semantic links/tables, readable contrast and visible focus CSS.
- Walkthrough source snippets reflect the audited implementation and label their
  source paths; excerpts are explicitly described as non-standalone code.
- Recipe provider selection and current inclusion/production limits are explained.

## Limits and next steps

No real sign-in, permission request, provider effect or transaction was performed.
This does not certify WCAG conformance, screen-reader behavior, cross-browser
support, production network/security headers or Core Web Vitals. No performance
benchmark was run. Existing 137-test/build evidence belongs to the preceding code
change, not a newly run site audit suite.

Resolve mobile overflow and accessibility navigation/motion first; replace the
redundant Workflow example and review the absolute claim with the author. Preserve
truthful limitations for authorization, protected metadata, live provider evidence,
chain finality and dependency advisories.

Guideline source reviewed:
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
