# Account-Level Skills Inventory

The skills in this folder were imported from the built-in Claude skill library
(`/mnt/skills`) so they are available in every session of this project,
including cloud sessions.

The following skills are enabled at the **claude.ai account level** but their
full contents are stored in the claude.ai account and could not be exported
from a cloud session. They still work in claude.ai surfaces; to make them
project-local, export them from the machine where they were created
(`~/.claude/skills/<name>` → `.claude/skills/<name>` in this repo).

| Skill | What it does |
|---|---|
| `deep-work` | High-effort orchestration harness — triggers on "deep dive", "תתאמץ", "מחקר מעמיק" etc. |
| `el-al-flights` | Structured Hebrew interview + multi-source search for El Al flight deals |
| `ckmui-styling` | shadcn/ui + Tailwind UI building patterns |
| `ckmbanner-design` | Banner design for social/ads/web/print, 22 styles |
| `ckmslides` | Strategic HTML presentations with Chart.js and design tokens |
| `ckmbrand` | Brand voice, visual identity, messaging frameworks |
| `ckmdesign-system` | Three-layer design tokens, component specs |
| `ckmdesign` | Comprehensive design: logos, CIP, slides, banners, icons, social photos |
| `ui-ux-pro-max` | UI/UX design intelligence — 50+ styles, 161 palettes, 10 stacks |

## Missing: `graphify`

`graphify` was not found in the account skills, the built-in library, or this
container. It appears to exist only in the local `~/.claude/skills` folder on
the owner's machine. To import it, copy it into `.claude/skills/graphify/` in
this repo and push.
