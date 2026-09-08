# Preview Verification

## Supplied Original Artwork

September 8, 2026: the supplied JPEG from `Downloads/Patrick-VaultBoy-Terminal`
replaces the generated SVG on the homepage and in the boot screen. It is
1024x572 pixels and 118475 bytes, imported without conversion or modification.
SHA-256: `6c396868eef2492340d48f365ef60a97a4467af0830e39c42daaf8a32688a252`.

All 27 Node tests and 51 local Chromium browser checks passed. Verification
includes the served image's checksum and MIME type, natural dimensions, full
aspect ratio at 320/390/768/1440px, no added filters or scanlines, image loading
without JavaScript, animated boot diagnostics/progress, skip and replay,
reduced motion, preserved ASCII factory and pause behavior, and theme changes
that do not recolor the original art. Screenshots were visually inspected.
Independent source review reported no actionable findings.

After publication, 10 additional live-site browser checks passed, including
the splash/homepage image, scene controls, JPEG content type, and a SHA-256
match proving the hosted JPEG is byte-identical to the original Downloads file.

The artwork is intentionally static. Unsupported walking/typing/wink controls
and SVG pose code have been removed. No generated animation or paid media
service was used; only the existing boot text and factory effects animate.

## Filled Mascot Redraw

September 7, 2026: the mascot was redrawn against the supplied visual reference
with solid green shapes, consistent dark contours, simpler details, a large
thumbs-up, and a clear wink. The homepage defaults to the approval pose; the
boot progresses through walking, typing, and approval. Typing and walking
remain separately selectable, with correct eye and arm visibility.

All 27 Node tests and 58 Chromium browser checks passed. These include the
new gesture, wink replacing the open eye, restored open eyes while typing,
approval-specific accessible labels, the boot finale, pause, reduced motion,
and desktop/mobile sizing. Screenshots of the approval and typing poses were
visually inspected. Independent source review reported no actionable issues.

## Personalized Mascot Update

September 7, 2026: all 27 Node tests and 49 additional Chromium browser checks
passed. The customized engineer's walking and typing poses are visible in the
boot sequence and homepage. Browser evidence covers the timed boot transition,
moving limbs, scene selection, preserved ASCII factory, all three themes,
saved pause before module initialization, pause stability, reduced motion,
mobile sizing at 320/390/768px, desktop sizing at 1440px, non-home replay, and
stopping animation inside the closed boot dialog. No JavaScript page errors
occurred in the completed browser run.

Independent review found two issues, both corrected and independently
rechecked: restoring pause before the app module loads, and cascade-layer
precedence for the mobile mascot width. The repeatable browser checks are in
`tests/mascot.browser.js`. Screenshots were visually inspected for the beard,
bald forehead, backward cap, work suit, walking pose, and CRT typing pose.

## Boot And Connection Update

September 7, 2026: 24 Node tests and 29 additional Chromium browser checks passed.
The visible boot sequence was verified to progressively type diagnostics and
advance its progress bar, auto-dismiss after roughly three seconds, replay,
skip immediately, preserve focus, honor intro opt-out and reduced motion, and
honor paused animation even when browser storage is blocked. Printing does not
include the boot overlay. The boot and connection layouts fit 320, 390, 768,
and 1440px viewports. No JavaScript errors occurred in the final browser run.

An independent reviewer identified paused-state and print issues; both were
fixed and independently rechecked. Browser testing additionally caught an
initial animation-frame timestamp preceding the start timestamp; progress is
now clamped to the valid range, and incremental rendering was reverified.

Booking and email UI are configuration-ready, not activated: no real booking
URL, Buttondown username, or alternate newsletter signup URL was provided.
Unconfigured controls are disabled and collect nothing. Tests cover the
configured native Buttondown POST form and safe external destination links;
no real signup, email delivery, or appointment was submitted.

Verified on September 7, 2026 using Node.js v26.8.1 and Chromium via Playwright.

## Automated Tests

`node --test tests/*.test.mjs`: 20 tests passed, zero failures.

Coverage includes configuration and URL validation, content metadata, escaping,
RSS links and sample labels, GitHub activity and release parsing, malformed
API data, outbound URL validation, rate limits, network errors, and timeout signals.

## Browser Checks

43 checks passed against the local built site:

- Topic filtering, focused Vim navigation, and opening full article pages.
- Green, amber, and paper themes, including preference persistence.
- Animation pause and system reduced-motion handling.
- Search, keyboard help, theme commands, Escape, and restored dialog focus.
- Disabled single-key shortcuts with modifier-based search still available.
- Command focus preservation while a delayed search index arrives.
- Honest unconfigured profile, release, and activity states.
- Mocked GitHub activity and release responses, rate limits, retry recovery,
  malformed entries, and HTML injection prevention. These fixtures were never
  written to the site or published as real activity.
- All primary page types without horizontal overflow at 320, 390, 768, and 1440px.
- Archive and article navigation with JavaScript disabled.
- No unexpected JavaScript page errors in the primary 34-check run.

## Independent Review

An independent read-only reviewer checked the build, preview server, browser
code, GitHub integration, and styles. Findings were corrected and rechecked:
single-key shortcut disabling, async command focus races, safe same-origin
preview redirects, and root-directory redirect handling. Unit tests also
identified and drove fixes for malformed GitHub entries. The final targeted
review reported no remaining actionable findings.

## Live Publication

Permanent site: https://awake-iris-z6ww.here.now/

The authenticated here.now publish finalized successfully. A further 22 browser
checks passed against the live host: homepage, all five article URLs, Lab,
About, static assets, valid RSS and sitemap XML with absolute URLs, canonical
metadata, mobile overflow, search-to-article navigation, and no JavaScript
page errors. Published configuration was checked to exclude test GitHub data.

## Preview Scope

This is a public design preview with five clearly labeled sample articles.
Identity, social URLs, repositories, and paid memberships await configuration.
GitHub integration was verified with mocked API responses, not the owner's
unconfigured account. Payments, authentication, and gated content are not
implemented; membership links delegate to external providers.

## Personalization pass — September 8, 2026

Set Patrick Mannion as the author and added configurable short/long introductions. Replaced generic home, About, lab, and connection copy with concrete topics. Added shared author cards and bio navigation; configured LinkedIn, X, GitHub, and Substack profiles appear across author cards, About, Connect, and the footer. Unknown URLs remain blank, and sample articles retain their demonstration labels and neutral bylines. Career history and profile URLs still require Patrick’s input.

Validation: all 27 Node tests passed; the static build generated 10 pages. Playwright checked home, About, Connect, and an article at 1440px and 390px: no horizontal document overflow; bio links present on each. Inspected the mobile homepage screenshot. These changes have not been published.

## Approved animation integration

Added the approved first Kling render as a 563 KB H.264 MP4. Playback starts once after the intro closes and the artwork enters view, with pause/resume/replay and a held ending frame. Reduced motion, missing JavaScript, and video errors retain the original still. The key is used only by the local render script and is not included in the build. All 27 Node tests and 10 playback browser checks passed; the browser failure check deliberately aborts the video request. Changes remain local and are not published.

## Splash animation

The splash now plays the same approved MP4, syncs progress to playback, and closes after a brief hold on the ending. Skip pauses video; reduced motion uses the still; failed playback falls back to the timed text intro; stalled loads are bounded by an 8.5-second timeout. All 27 Node tests and nine splash browser checks passed, covering completion, replay, skip, reduced motion, mobile sizing, and failed download.

## Theme video variants

Created amber and paper MP4 variants locally from the approved green clip, plus matching final-frame JPEG fallbacks. No generation API calls or credits were used. Homepage media, splash media, and splash interface follow the selected theme. All 31 Node tests and 17 theme browser checks passed, including switching all three themes, reduced-motion stills, splash playback, persisted theme, and mobile layout sizing.
