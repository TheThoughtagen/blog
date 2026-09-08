# FIELDNOTES

A static engineering notebook with sample articles, RSS, local search, keyboard navigation, three color themes, and optional public GitHub activity/releases. Requires Node.js 22 or newer; no dependencies or install step.

Live preview: https://awake-iris-z6ww.here.now/

Published permanently to the existing here.now account. Patrick’s introduction is configured; social URLs and additional career details are awaiting confirmation. Update this existing site rather than creating a new one:

```sh
node scripts/build.mjs
bash "$HOME/.agents/skills/here-now/scripts/publish.sh" dist --client opencode --slug awake-iris-z6ww
```

**Local Commands**
Run from this directory:

```sh
node scripts/build.mjs
node scripts/serve.mjs
node --test tests/*.test.mjs
```

The build validates configuration/content, replaces `dist/`, copies `public/`, and generates pages, the search index, and RSS. Edit source files, not `dist/`.

The server builds once at startup and serves `http://127.0.0.1:4173`. Override the port with `PORT=4174 node scripts/serve.mjs`. There is no file watcher: rebuild and refresh after edits, or restart the server. Tests use Node's built-in runner and injected fetch fixtures; they do not call GitHub, start a server, or rebuild `dist/`.

**Configuration**
Edit `site.config.mjs`:

- `name`, `author`, and `description`: notebook branding, article byline, and metadata. The author is Patrick Mannion. `bio.short` appears in the author card and About header; `bio.paragraphs` holds the longer bio.
- `siteUrl`: public origin, such as `https://notes.example.com/`, with no subpath. The build-time `SITE_URL` environment variable overrides it. Set it for canonical/OG URLs, absolute RSS links, and the sitemap. Without it, previews omit canonical URLs and the sitemap and use relative RSS identifiers.
- `github.username`: GitHub username only, not a profile URL. Activity uses public events; no token is needed or shipped.
- `github.repositories`: up to six `owner/repo` strings, for example `['example-owner/project']`, not repository URLs. These drive releases independently of the username. With only a username, releases come from its available public event window. Empty settings show an unconfigured state.
- `links.linkedin`, `links.x`, `links.substack`, and `links.patreon`: actual profile/publication/support URLs. Leave unknown links blank. Configured URLs must use HTTP(S) without embedded credentials.
- `membership.enabled` and `membership.url`: set `enabled: true` only with a real external membership destination. Patreon and membership are outbound links; the provider handles payments and access. This site does not implement authentication or a client-side paywall. Anything included in `dist/` is public when hosted publicly, so do not put paid/private content there.

**Booking And Email**
The homepage, article pages, footer, and `/connect/` provide booking and email subscription entry points. These remain explicitly unavailable until configured; the preview does not collect email addresses or appointment requests.

- `links.booking`: your booking page URL. Cal.com is recommended, but an existing Calendly or Microsoft Bookings link also works. Calendar availability, confirmations, and cancellation are handled by that provider.
- `newsletter.buttondownUsername`: your real Buttondown newsletter username. Enables a styled, native HTML POST form using Buttondown's documented `embed-subscribe` endpoint. Visitors continue to Buttondown in a new tab for CAPTCHA, errors, and confirmation; there is no fake local success message. No API key is needed or sent to browsers.
- `links.subscribe`: an alternative provider-hosted signup URL, such as your Substack subscription page. Used when the Buttondown username is blank. Do not configure two separate mailing lists unless that is intentional.

Recommended setup: [Cal.com](https://cal.com) for booking and [Buttondown](https://buttondown.com) for email. Create the accounts, configure your availability and newsletter confirmation settings, then provide the real booking URL and newsletter username. Account creation, purchases, calendar connection, and actual newsletter delivery have not been performed. Buttondown form reference: https://docs.buttondown.com/building-your-subscriber-base

**Terminal Boot**
The homepage has a full-screen, roughly five-second terminal boot simulation with typed diagnostics, the approved walk-to-terminal animation, and a progress bar synced to the clip. The splash holds the thumbs-up briefly before closing; video errors use the still artwork and a stalled load times out. It appears on fresh homepage navigation and reload, but not article pages, anchor links, or back/forward history navigation. Skip with Enter, Escape, or the skip button; the checkbox remembers an opt-out.

Replay from the footer's **Replay terminal boot** button or the `:reboot` command on any page. Reduced-motion and paused-animation preferences skip the automatic sequence; manual replay shows a static, immediately dismissible terminal. No JavaScript means no splash and directly readable content. Commands `:book` and `:subscribe` open the connection page.

**The Operator**
The homepage and splash use the supplied `Patrick-VaultBoy-Terminal` artwork directly. `public/assets/patrick-terminal.jpg` is a byte-for-byte copy of the original 1024x572 JPEG, not an SVG reconstruction. Its green color, framing, glow, and scanlines are preserved without added filters, overlays, or cropping.

The homepage plays the approved Kling animation once, after the opening intro closes and the artwork enters view. A small button pauses, resumes, or replays it. The final thumbs-up frame remains visible. Reduced-motion visitors and browsers without JavaScript see the original still; the video is only requested when playback starts. A failed download also restores the still. The illustration remains green in every theme.

`scripts/mascot.mjs` renders the image and `public/assets/mascot.css` provides responsive sizing. The boot reuses the same asset through its generated template. The approved clip is `public/assets/patrick-welcome.mp4` (about 563 KB), encoded from the first fal.ai Kling 2.1 Pro render. `public/assets/welcome.js` manages playback. The full render, keyframes, and generation record remain under `output/animation/`, outside the published assets. `scripts/import-artwork.mjs` imports an original JPEG without converting it or overwriting an existing asset.

Optional browser regression checks, with the local server running and Playwright CLI available:

```sh
playwright-cli -s=fieldnotes-mascot open http://127.0.0.1:4173/ --browser=chrome
playwright-cli -s=fieldnotes-mascot run-code --filename=tests/mascot.browser.js
playwright-cli -s=fieldnotes-mascot close
```

**Content**
Edit `content/articles.mjs`. Replace the demonstration writing with actual reviewed articles and set `sample: false` on each real article. Leave remaining demonstrations labeled as samples. Keep exactly one article `featured: true`.

Each article needs a unique lowercase hyphenated `slug`, `title`, `description`, real `YYYY-MM-DD` date, `category`, `tags` array, positive integer `readingMinutes`, and nonempty `sections`. Categories are `Industrial software`, `Development`, `Leadership`, or `AI & ML`. Sections appear in array order and require a unique lowercase hyphenated `id`, `title`, and `paragraphs` array. Optional fields are `code: { language, text }`, `list`, and `quote`. Text is escaped, not interpreted as HTML or Markdown. Keep published slugs and section IDs stable for existing links. Sample labels and the home preview notice follow the `sample` flags automatically. Update the bio in `site.config.mjs`; sample labels remain until each demonstration is replaced.

Add crossposts to the `externalPosts` array in `content/links.mjs`; these are curated links, not scraping or automatic imports:

```js
{
  title: 'Your published post',
  description: 'A short summary.',
  url: 'https://example.substack.com/p/your-post',
  source: 'Substack', // Or 'LinkedIn'.
  date: '2026-09-07',
  category: 'Development',
  tags: ['Testing'],
}
```

Use the actual post URL and publication date. Crossposts appear on the home page and in search; RSS contains local articles only. Rebuild after configuration or content changes.

**Publishing**
When ready to publish, run tests and build first, then publish only `dist/` using the installed here.now helper:

```sh
node --test tests/*.test.mjs
node scripts/build.mjs
"$HOME/.agents/skills/here-now/scripts/publish.sh" dist --client opencode
```

The first publish returns a URL and slug. Replace `YOUR-SLUG` below with that slug, rebuild with the actual public origin, and update the same site so canonical and feed URLs are correct:

```sh
SITE_URL="https://YOUR-SLUG.here.now/" node scripts/build.mjs
"$HOME/.agents/skills/here-now/scripts/publish.sh" dist --client opencode --slug YOUR-SLUG
```

For later updates, use those same build/update commands, or persist the origin in `site.config.mjs`. Use your actual custom-domain origin instead if applicable. Omitting `--slug` creates another site. This is a multipage site; do not enable SPA routing.

The helper needs `curl`, `file`, and bundled or installed `jq`. It uses `HERENOW_API_KEY` or `~/.herenow/credentials` if available; anonymous sites expire after 24 hours. Keep API keys and local `.herenow/` state private and out of published files. See [here.now docs](https://here.now/docs) for current hosting details.

Animation browser checks: `playwright-cli -s=welcome run-code --filename=tests/welcome.browser.js` with the preview server running.
