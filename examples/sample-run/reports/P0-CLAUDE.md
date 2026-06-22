Task ID: P0-CLAUDE
Status: done
Needs-decision: none
Changed: none accepted into this repo
Evidence:
- Computer Use opened `/Applications/Claude.app` and started a `yunfan-star` Code session.
- Claude was prompted not to modify files and to provide reference interpretation, minimal change advice, acceptance checklist, and risks.
- Local `git status --short` after Claude response showed only `.conductor/` and a pre-existing untracked `md/research-outreach-tiktok-shop-api.md`; no Claude edits were accepted into this repo.

Findings:
- Reference direction: light, calm, Ant-Design-flavored SaaS; white sidebar around 182px; white topbar around 54px; blue `#2f7cff` primary; neutral `#f5f7fb` background; compact cards/tables and soft shadows.
- Current app gap: dark navy gradient sidebar, lime/purple accents, wider 276px sidebar, radial background glows, and more marketing-polished dashboard chrome.
- Minimal change advice: first retarget `web/app/globals.css` tokens, then convert the hardcoded dark desktop sidebar block in `web/components/layout/workbench-shell.tsx` to light compact styling.
- Optional density work: dashboard/cards/tables can be tightened after shell tokens, but avoid broad shared component changes unless needed.
- Capability preservation: hiding nav entries is reversible, but hiding actual capabilities is a product decision. Safer default is to keep route entries available and visually compact them.
- Acceptance checklist: no dark gradient/lime in workbench chrome; white compact sidebar; blue active pill; light app background; soft cards; direct routes still resolve; API/auth/model files untouched; graphify update after `web/` edits.

Risks:
- Renaming the product to "TK Star" or changing role/navigation structure is a product decision and should not be guessed in auto.
- Hidden entries should be flag-gated if implemented; deleting route objects or route files would violate the goal.

