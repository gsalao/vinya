# Content from a spreadsheet

**Date:** 2026-08-18
**Status:** superseded by `2026-08-19-sheets-cms-design.md`, which extends this to
all site copy, a debounced auto-publish, editable mail settings, and bookings
written back to the sheet. Its reasoning on rebuilds, payment links and
validation is carried forward unchanged.

## Problem

Every piece of copy on the site lives in `src/lib/data.js`. That was deliberate —
one file, one place to edit — but it still means the owner cannot change a class
time, add an event, or fix a typo without opening a code editor, editing
JavaScript, and pushing a commit. The studio needs someone non-technical to
maintain the site's content directly.

The proposal is a spreadsheet as the editing surface: one tab per kind of
content, a photo dropped in a Drive folder, and a change that reaches the live
site without anyone touching the repo.

## Constraints

- The editor is non-technical. Anything that fails silently, or that requires
  reading an error to recover from, has failed.
- `data.js` is an ES module compiled into the bundle. Content changes therefore
  require a rebuild — there is no path where editing a file at rest updates a
  running site.
- Deploys already run through `.github/workflows/deploy.yml` on push to `main`,
  which builds with the Vercel CLI. Whatever triggers a content update should
  reuse that, not stand up a second deploy path.
- The site renders Tikkie payment links and QR codes. The existing CSP in
  `svelte.config.js` exists specifically to keep those from being swapped.

## Why a rebuild, not a runtime fetch

The obvious alternative is for the server to fetch the sheet on each request and
cache the result, skipping builds entirely. It updates faster and needs no
commit. It is the wrong trade here.

A runtime fetch makes Google Sheets a hard dependency of page rendering. When the
sheet is unavailable, slow, or has been left mid-edit with a half-typed row, that
state is what visitors see. There is no review step and no way back except
editing the sheet again correctly.

Going through a commit inverts all of that. Content is versioned, a bad edit is
`git revert`, the built site has no runtime dependency on Google at all, and —
most important — there is a place to run validation *before* anything ships. The
cost is roughly ninety seconds of build time between clicking Publish and seeing
the change. For a studio timetable that is not a real cost.

## Design

### Trigger

```
Sheet ──Apps Script──▶ repository_dispatch ──▶ GitHub Action
                                                  ├─ read sheet
                                                  ├─ validate
                                                  ├─ write src/lib/data.generated.json
                                                  └─ commit + deploy
```

Apps Script fires a `repository_dispatch` event and nothing more. It does not
write files, and it does not know the shape of the data. The Action does the
work, using its own `GITHUB_TOKEN`.

That split matters for the secret. A script that commits directly needs a token
with `contents:write` on the repo; a script that only fires an event needs a
fine-grained token scoped to dispatch alone. Anyone with edit access to the Apps
Script project can read whichever token is stored there, so it should be the
weakest one that works.

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  repository_dispatch:
    types: [content-update]
```

**The existing workflow needs a fix for this to work.** `VERCEL_ENV` and
`PROD_FLAG` are both derived from `github.event_name == 'push'`. A
`repository_dispatch` run takes the `else` branch of each, so a content update
would deploy to a throwaway preview and never reach production. Both ternaries
need to treat `repository_dispatch` as production too.

### Publish is a button, not an edit hook

The instinct is to sync on every edit. Two reasons not to.

A simple `onEdit(e)` trigger runs unauthorized and cannot call `UrlFetchApp` at
all, so an edit-driven sync needs an *installable* trigger regardless. And
`onEdit` fires per cell: rewriting one paragraph would queue dozens of deploys.

A **Publish** item in a custom sheet menu solves both and is better to use. The
owner edits freely, reviews the tab, and ships when the change is finished —
which is also the only point at which the content is guaranteed coherent.

```js
function publish() {
  UrlFetchApp.fetch('https://api.github.com/repos/gsalao/vinya/dispatches', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + PropertiesService.getScriptProperties().getProperty('GH_TOKEN'),
      Accept: 'application/vnd.github+json'
    },
    payload: JSON.stringify({ event_type: 'content-update' })
  });
}
```

### One tab per export, not per page

The first instinct is one sheet per route. It does not survive contact with the
data: `classes` renders on both `/` and `/classes`, and `bookOptions` is derived
across classes, offerings and events at once. Splitting by route would mean the
same class typed in two places, which is exactly the drift `data.js` was
organised to prevent.

One tab per export instead — `classes`, `timetable`, `events`, `faqs`,
`offerings`, `teachers`, `partners`. That is already the shape of the file, so
the mapping is close to mechanical, and every derived value keeps its single
source.

### Validation is the load-bearing part

`data.js` has invariants that are enforced by nobody. Today that is fine, because
the only editor is someone reading the comments. Once a spreadsheet is upstream,
each one becomes a way for the site to break quietly:

- **`bookOptions` matches labels exactly** (`data.js:143-145`). `openBooking()`
  preselects on an exact string match, so a trailing space in a sheet cell opens
  an empty picker with the submit button disabled. Spreadsheet cells accumulate
  trailing spaces as a matter of course.
- **`eventLabel()` slices the month string** — `group.month.slice(0, 3)`
  (`data.js:137`). It assumes the format `August 2026`. A sheet date cell
  serialises to an ISO timestamp or a locale string, and the booking label
  becomes nonsense.
- **`locationOf()` returns an empty string** for a provider key that does not
  exist (`data.js:47`). A mistyped provider does not raise anything; the venue
  simply disappears from the page.

So the Action validates rows against a schema and **fails the build** on a bad
one, rather than deploying whatever the sheet contained. Trimming whitespace,
pinning date formats, and checking that every `provider` resolves are most of the
work. The failure needs to reach the owner in a form they can act on — a mail
from the Action naming the tab, the row, and what was wrong.

Without this step the system is not a CMS, it is a way to break the site from a
spreadsheet.

### Images

Text is the easy half. The `photo` object carries `src`, a `srcset` at 1400w and
2200w, WebP variants of both, alt text, and a focal point.

Drive links are not a shortcut around that. `drive.google.com/uc?id=` is not
CDN-backed, is rate-limited, and breaks when sharing settings change — it is not
something to point a production `<img>` at.

Doing it properly means the Action reads the Drive folder, downloads the
original, resizes and converts with `sharp`, and commits the derivatives into
`static/images/` alongside the data. Alt text and focal point stay as sheet
columns, since both are editorial judgements rather than derived values.

This is the part that turns a one-day job into a three-day one, and it is
separable: the text pipeline works fine while images stay a manual task.

## Payment links stay in code

`prices` and everything under `pay` are excluded from the sheet.

The reasoning is already written down at `data.js:50-53`: a QR code cannot be
checked by eye, so anything able to change the link behind one can redirect real
money and nobody would see it. The CSP in `svelte.config.js` is the control that
makes injecting such a change hard. Moving those URLs into a spreadsheet routes
around that control entirely — it grants the ability to redirect payments to
anyone with edit access to the sheet, and to anyone who phishes the owner's
Google account. The QR PNGs are generated from those same URLs, so a sheet-side
edit would also leave image and link disagreeing, which is the one failure the
current design rules out by construction.

The validator enforces this rather than leaving it to convention: any
sheet-sourced field under `prices`, and any field named `pay` or `url` there, is
rejected outright. A boundary that depends on everyone remembering it is not a
boundary.

The dispatch token is fine-grained, single-repo, dispatch-only, and lives in
Script Properties.

## Accepted limitations

- **Roughly ninety seconds from Publish to live**, bounded by build time. Worth
  it for the review step and the revert path; revisit only if the studio starts
  making time-critical changes.
- **Anyone with edit access to the sheet can change site copy.** That is the
  entire point, but it means sheet sharing is now a production permission and
  should be treated like one.
- **Validation catches malformed content, not wrong content.** A correctly
  formatted class at the wrong time will deploy. `git revert` is the recovery.

## Effort

| Slice | Estimate |
| ----- | -------- |
| Sheet tabs, reader, `data.generated.json` | ~1 day |
| Schema validation and failure reporting | ~half a day |
| Drive image pipeline (`sharp`, derivatives, commit) | ~1.5 days |

The first two ship independently and are worth doing first.

## Out of scope

- `prices`, `pay.url`, and the QR images. Deliberate, see above.
- Booking data. Requests are emailed and not stored (`supabase/schema.sql`);
  nothing about this touches that path.
- The `subscribers` table keeps its existing Supabase path.
