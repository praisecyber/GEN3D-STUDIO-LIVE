# Projection feature coverage — 0.8

The benchmark is Holyrics' current public feature description, inspected on 2026-10-22:

- https://holyrics.com.br/software.html
- https://holyrics.com.br/app.html
- https://holyrics.com.br/download.html

Initial proxy denial was resolved during implementation. These pages do not provide a complete versioned compatibility specification; full Holyrics parity is **not** asserted.

| Workflow | GEN3D capability | Material boundary |
| --- | --- | --- |
| Song library/editing/paragraphs | Search, add, edit, duplicate, remove, reflow, groups | Read-only API/GetSongs JSON migration preserves basic text/order/credits and offers reviewed group filters for new songs; native binary backups are unsupported |
| Imports | JSON libraries, text songs, OpenLyrics XML | OpenLyrics subset preserves title, verse order, line breaks; chords and translated verse variants are not migrated |
| Bible reading | Complete bundled KJV, 66 books / 31,102 verses | NKJV and other restricted translations require an appropriate user-supplied module |
| Bible modules | GEN3D JSON, Zefania XML, OpenSong XML | Rejects DTD/entity declarations, duplicates and malformed verses; not a Holyrics-native Bible importer |
| Bible navigation | Book/chapter/verse selectors, range/chapter/text search, favorites | Text results are capped at 50 matches; book names follow the installed module |
| Bible comparison | Side-by-side review and prepared comparison slides | Corresponding book/chapter/verse records must exist in both modules |
| Themes | Saved appearance/size and local image/video references; text styling and dimming | Local files must still exist; not a media-packaging format |
| Stage | Current/next, clock, count, uppercase/colors, stage messages, countdown | Up to eight independently configured stage windows with custom widget geometry; physical monitor acceptance remains outstanding |
| Service orders | Songs, Bible and local media; load/reorder/previous/next | Loading does not take an item live |
| Services/events/team | Dated plans, 1–52 weekly occurrences, member/role assignments | Local data; no email/calendar invitations or external calendar synchronization |
| History/reports | Song activation history, played/scheduled counts, team scheduling counts, CSV | Counts song activations, not every slide take |
| Announcements | Editable text slide items and automatic slide shows | No separate announcement database/editor |
| Automatic presentation | Delay, repeat, stop; explicit Start is required | Selected-item change stops playback; no automatic unattended scheduling daemon |
| Export presentation | Offline HTML, PNG ZIP and timed WebM, 720p/1080p; HTML can print to PDF | WebM supports moving backgrounds, optional 3D avatar and chosen recorded vocals; system speech synthesis is not captured; not pixel-identical to every projector configuration |
| Phone | PIN remote, slides, production cuts/transitions, schedules/reports, Program preview | Live functions need the desktop and a suitable LAN/WebRTC route |
| Android offline | Packaged UI, saved read-only desktop snapshot, bundled KJV | Physical APK/WebView/device acceptance remains outstanding |
| Project backups | Songs, media references, prepared Bible passages, themes, stage settings, service order and ministry planning | Media and separately installed Bible modules are not embedded; favorites/voice/provider configuration are local |
| Cloud backup | Authenticated HTTPS/WebDAV PUT/GET; download for review before restore | Requires a configured compatible endpoint; does not use Holyrics accounts, cloud API or access keys |
| Presenter | Three.js robot, GLB import, system speech, recorded vocals with mouth amplitude | No generated singing voice or phoneme alignment; unsupported model rigs retain their own animation |
| Translation | LibreTranslate-compatible endpoint, review/apply selected song slide | Provider access/language support must be configured; no silent rewrite of official Bible text |
| PowerPoint | Editable text import and static rendered visual decks | Windows requires PowerPoint; Linux requires LibreOffice/Poppler. Animations and native Windows acceptance are outstanding |

## Song interchange

**Content library → Import & back up songs** accepts one file up to 5 MB. Review counts, then add. Matching titles are skipped without overwriting existing songs.

Text: first line is the title; blank lines separate slides.

```text
Example song
Verse one
Second line

Chorus text
```

JSON:

```json
{"format":"gen3d-song-library","version":1,"songs":[{"title":"Example","slides":["Verse","Chorus"]}]}
```

OpenLyrics XML uses namespace `http://openlyrics.info/namespace/2009/song`, `properties/titles/title`, `lyrics/verse/lines`, `<br/>` and `verseOrder`. Repeated verse-order entries are retained.

## Offline Bible format

Use **Offline Bible library**. Review and install a JSON/XML module up to 20 MB. The bundled KJV installs locally without a network request. Installed modules use IndexedDB; prepared passages use localStorage and project backups. Export additional modules separately with **Back up module**.

```json
{"translation":"Example","verses":[{"book":"Example","chapter":1,"verse":1,"text":"Sample verse"}]}
```

Zefania uses `XMLBIBLE/BIBLEBOOK/CHAPTER/VERS` with `biblename`, `bname`, `cnumber`, `vnumber`. OpenSong uses `bible/b/c/v` with `n` names/numbers. Other XML layouts are rejected, not guessed.

## Remaining compatibility prerequisites

Direct NDI discovery and video/stereo-audio reception are implemented with an installed NDI 6 runtime; multi-machine/Windows acceptance remains outstanding. Holyrics binary migration needs representative exported files and a verified schema. Licensed translations need appropriately licensed source modules. Real provider accounts, OBS Virtual Camera, Windows devices and Android hardware must be configured/tested on their target systems. These are not established by passing browser tests.
