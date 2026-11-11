# Discord mIRC 98 — Make Discord.com look like mIRC running on Windows 98 (via both a custom User Style and custom User Script)

Theme [`discord-mirc98.user.css`](https://github.com/BlohoJo/mIRC-Discord-98/raw/refs/heads/main/discord-mirc98.user.css) **1.1.1** · companion [`discord-mirc98-companion.user.js`](https://github.com/BlohoJo/mIRC-Discord-98/raw/refs/heads/main/discord-mirc98-companion.user.js) **1.1.1**

Makes browser Discord look like mIRC running on Windows 98 SE: black panes, the mIRC 16-colour palette, Fixedsys text, beveled grey chrome, navy title bars, `[hh:mm] <nick>` lines, and **green** normal chat text.

### Install the extensions/add-ons for your browser of choice:

- Stylus ([Chromium](https://chromewebstore.google.com/detail/stylus/clngdbkpkpeebahjckkjfobafhncgmne) / [Mozilla](https://addons.mozilla.org/en-US/firefox/addon/styl-us/))
- Tampermonkey ([Chromium](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) / [Mozilla](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/))

### Click the links to install:

- [User Style](https://github.com/BlohoJo/mIRC-Discord-98/raw/refs/heads/main/discord-mirc98.user.css)
- [User Script](https://github.com/BlohoJo/mIRC-Discord-98/raw/refs/heads/main/discord-mirc98-companion.user.js)

<img width="1024" height="695" alt="Main" src="https://github.com/user-attachments/assets/0d3bca7c-1fa7-4ca8-be8e-f475a71d10f9" />
<em>(Yes, the top menu bar does in fact function.)</em> ❖😎

### Why Stylus and not Tampermonkey

Stylus is the better fit, for three reasons. First, this mod only needs styling, and Stylus injects CSS before the page paints, so you don't get a flash of the stock Discord theme on load. Tampermonkey would add its CSS after the page starts, then need extra code to keep up with Discord's React re-renders. Second, a stylesheet can't read or send anything from your account, which is the safer kind of client mod for a logged-in site. Third, the UserCSS format gives you a settings panel (colours, fonts, size, nick brackets, fake window chrome) without editing any code.

A userscript is only needed for things CSS can't do, like rewriting `7:03 PM` as `19:03`. That one has a settings-based fix (see below).

### Install

1. Install **Stylus** for your browser. Use the official Stylus by openstyles (Chrome Web Store or Firefox Add-ons), not the old "Stylish".
2. Open Stylus → **Manage** → **Import** (or drag `discord-mirc98.user.css` onto the Manage page). You can also host the file anywhere that ends in `.user.css`, open that link, and Stylus offers to install it.
3. Reload discord.com.
4. To change colours or fonts: Stylus icon → the ⚙ next to "Discord mIRC 98".

### Recommended Discord settings (for the closest IRC look)

- **User Settings → Appearance → Message Display: Compact.** This gives you single-line `[time] <nick> text`, the most important setting.
- **Theme: Dark.** The style overrides both themes, but Dark has the fewest leftover light surfaces.
- **24-hour `[19:03]` timestamps.** Discord takes the clock format from your language/locale. Switching **Language** to *English, UK* usually gives 24-hour times (this can differ by Discord version).
- **Fixedsys font.** Install *Fixedsys Excelsior* (free) on your PC to get the real mIRC look. If it's missing, the style uses Lucida Console, then Consolas. Discord's security rules block web fonts, so the font has to be installed locally.

### What maps to what

| Discord part | mIRC / Win98 equivalent |
|---|---|
| Browser viewport | mIRC window: navy title bar, fake min/max/close buttons, menu bar |
| Server list | Grey switchbar, square beveled buttons (pressed = selected) |
| Channel list | Black treebar, Fixedsys, yellow folder icons, white-on-navy selection, red = unread, grey = muted |
| Channel header | Active MDI child title bar (`#channel: topic`) |
| Messages | `[hh:mm] <nick> text`, timestamps grey, normal text green |
| Mentions of you | mIRC highlight red, red left marker |
| Joins/system messages | `***` lines in mIRC join green |
| Day dividers | `*** Day changed: …` / new messages in red |
| Message box | Sunken editbox, green caret/text |
| Typing indicator | `* nick is typing...` in action purple |
| Member list | Nicklist, role colours kept, activity hidden |
| Context menus / tooltips / buttons / scrollbars | Win98 grey menus with navy highlight, yellow tooltips, raised buttons, checkered 16px scrollbars |
| Modal backdrop | Classic teal desktop |

### Colours (mIRC default palette)

| Use | Index | Hex |
|---|---:|---|
| Normal chat text (per your request) | 9 | `#00FC00` |
| Join / system | 3 | `#009300` |
| Highlight / unread | 4 | `#FF0000` |
| Action / typing | 6 | `#9C009C` |
| @mention pill | 7 | `#FC7F00` |
| Links | 11 | `#00FFFF` |
| Info / day change | 12 | `#0000FC` (lightened for black) |
| Timestamps | 14 | `#7F7F7F` |
| Tree / nick default | 15 | `#D2D2D2` |

### Notes and limits

- Discord's class names are hashed (e.g. `chat_a7d72e`) and change between builds. The style targets the stable parts (`id="message-content-…"`, `aria-label`s, `data-list-id`) and class-name *prefixes* (`[class*="chat_"]`) to keep breakage small. If an area turns stock-looking after a Discord update, that area's selector needs a refresh.
- Set **Fake mIRC title bar + menu bar → Hide** if you'd rather not lose 40 px at the top, or if any popout seems offset. The menu bar is decorative and can't be clicked (the companion script below makes it real).
- **Text size (1.1.0).** The `mirc-size` option (default 15 px) now applies to the whole left side as well: channel names, category headers, the DM list, the server list's text (acronym icons, folder names, and the companion's *Names* modes), and the nicklist group headers (2 px smaller). Before 1.1.0 it only sized the chat and the nicklist. Channel rows also shrink with the font instead of staying 32 px tall.
- **Channel column width.** Up to 1.1.0 the theme set `--custom-guild-sidebar-width: 220px !important` on `:root`. That line never worked: Discord writes the same variable as an inline style on `<body>` (the live export shows `--custom-guild-sidebar-width: 301px` there), and an inline declaration on a descendant beats anything on `:root`. 1.1.1 removes it; use the companion's drag-resizing, which overrides the variable on `<body>` itself.
- Chromium browsers get full Win98 scrollbars with arrow buttons. Firefox only allows colour changes, so you get grey scrollbars there.
- Desktop-app client mods (Vencord/BetterDiscord) aren't needed. This targets the browser version only.

### Changelog

#### 1.1.1 — fixes for the three failures reported on live discord.com (Firefox Developer Edition 159)

All three root causes were read out of the user's inspector exports and Discord's own CSS bundle; the mock in `preview/` was rebuilt from them so the 1.1.0 script fails the new tests and the 1.1.1 script passes.

1. **Dragging the left two splitters moved the splitter but not the column contents.** Confirmed from Discord's CSS: the left side is one grid item `.sidebar_ { width: var(--custom-guild-sidebar-width) }` (value set inline on `<body>`, 301 px in the export), containing `nav.guilds_` and every server row `.listItem_ { width: var(--custom-guild-list-width) }` and `.sidebarList_ { width: calc(sidebar − list − 1px) }`. 1.1.0 forced a width on the `nav` / `.sidebarList_` elements only, so the rows kept 72 px and (in Firefox) the outer `.sidebar_` stayed 301 px and clipped the widened channel list; the splitter followed the forced width and so "moved on its own". 1.1.1 overrides the two Discord variables on `<body>` instead (`--custom-guild-list-width`, `--custom-guild-sidebar-width`, `!important` beats the inline style), keeps the direct rules as fallback, and forces `box-sizing: border-box` on the channel column so the measured width equals the saved one. Regression checks: `#1 guild drag +60: server rows (.listItem_) follow` (1.1.0: 72→72), `#1 … outer .sidebar_ grows` (1.1.0 in Firefox: 301→301).
2. **Names mode unreadable.** Confirmed from the export: the tree item (`div[role=treeitem]`, no `aria-label`) sits inside a 40 × 40 masked `<foreignObject>` inside the icon's `<svg>`, nested twice; 1.1.0 drew the name as that element's `::after`, so it was clipped to the icon box, and the name lookup found nothing because live items carry the name only in an ancestor's `data-dnd-name`, a hidden label or the tooltip. 1.1.1 marks the `.listItem_` row, draws the row as the mIRC tree line (`--mirc-tree` on black, `--mirc-size`, unread `--mirc-unread`, selected white on navy, mention count after the name, 3 px red pill bar, 20 px icon in Icons + Names), reads names from `aria-label` → `data-dnd-name` → hidden label → tooltip, and forwards clicks on the row to the hidden tree item. Regression checks: `#2 names: rows marked on .listItem_ (9 rows)`, `#2 names: >= 60 px columns of light text actually painted in the row` (pixel check on a screenshot; 1.1.0: no row at all), `#2 names: click on the name reaches Discord's tree item`.
3. **Window blur reset everything.** Confirmed from the with-mods export: `<html … data-rh="lang,style,class">` — react-helmet owns the `<html>` class attribute and re-assigns the whole string on every update (Discord toggles `app-focused` on window focus/blur); the export's class list contains no `mirc98-*` class even though the script's `<style>` elements and `data-m98-*` attributes are present. Every 1.1.0 feature was gated on `html.mirc98-*` classes, so blur switched the server list back to Icons, dropped the column widths and un-floated the panel while the script's own bar stayed. 1.1.1 keeps the flags in `data-m98-state` on `<html>` (helmet never touches it), rewrites every injected selector to `html[data-m98-state~="flag"]`, mirrors the classes back through an attribute observer (idempotent, so no feedback loop; the test counts 0 attribute mutations while idle), and re-asserts state, layout CSS and the marks on Discord's nodes on `focus` / `blur` / `pageshow` / `visibilitychange` and after React re-mounts the server list. Regression checks: `#3 after blur: column widths kept (200/300/250)` (1.1.0: 72/229/180), `#3 after blur: panel still minimized`, `#3 after re-render: names re-applied to the new rows`.

Also: the theme's never-effective `:root { --custom-guild-sidebar-width: 220px }` line was removed (see *Notes and limits*), the navy selected pill rule now also matches the live `.overlay_ > .item_` pill, `--custom-app-panels-height` is zeroed while the panel floats (the channel list no longer leaves a gap for the docked panel), and the user panel is found by its current label `User status and settings`.

Still untested on live discord.com — every claim above was verified on the rebuilt mock only.

### Optional: Tampermonkey companion (`discord-mirc98-companion.user.js`)

The Stylus theme on its own handles all the visuals. The companion script adds the things CSS cannot do: 24-hour timestamps, a working menu bar, and (since 1.1.0) resizable columns, server-list text modes and a floating user panel. It is optional, and the theme works fine without it.

**Install:** In Tampermonkey, open the dashboard, click **+** (Create a new script), replace the template with the contents of the file, and save. Dragging the `.user.js` file onto a Tampermonkey-enabled Chrome or Firefox window also works. Keep the Stylus theme installed. The menu bar needs the theme's **Fake mIRC title bar + menu bar** option on: the script reads the theme's `--fake-chrome` variable and only mounts its menu bar while that option is on (re-checked every 1.5 s). The splitters and the floating user panel work either way; with the fake chrome off, the floating panel may go all the way to the top of the viewport, and the layout commands stay available from Tampermonkey's own menu.

**24-hour timestamps.** Every message `<time datetime=…>` is re-rendered as `[HH:mm]` (optionally `[HH:mm:ss]`) from its ISO datetime, in your local time zone. This happens whatever Discord's 12/24-hour setting is. The script does not edit React's text nodes. It stores the value in a `data-mirc-ts` attribute and draws it through CSS, so Discord re-renders never undo it and it never fights React.

**Working menu bar and title bar.** The fake menu bar from the theme is replaced with real Win98 drop-down menus (one level of submenus, radio and check marks):

| Menu | What it does |
|---|---|
| File | Home (Direct Messages), Discover Servers, Options… (Alt+O, User Settings), Reconnect (F5), Exit (Win98 confirm dialog) |
| View | Nicklist / Member List (Ctrl+U), Switchbar / server list on/off, **Server List ▸ Icons / Names / Icons + Names**, **Floating User Panel** on/off, Pinned Messages (Ctrl+P), Inbox / Mentions (Ctrl+I), Threads, Full Screen (F11) |
| Favorites | Add to Favorites, Organize Favorites… dialog (Join / Move Up / Move Down / Delete), your saved channels |
| Tools | Quick Switcher (Ctrl+K), Search (Ctrl+F), Upload File (Ctrl+Shift+U), Emoji (Ctrl+E), plus toggles: 24-hour timestamps, show seconds, window title shows channel, Alt+letter opens menus |
| Commands | Mark Channel / Server Read, Next / Previous Channel, Next / Previous Unread Channel, Next / Previous Server, Copy Channel Link |
| Window | Back / Forward, **Reset Column Widths**, **Reset User Panel**, **Minimize User Panel**, then the last 9 visited channels |
| Help | Keyboard Shortcuts (Ctrl+/), Discord Support Site, About mIRC 98… |

Keyboard use matches Windows: Alt plus the underlined letter, or F10, opens a menu. Inside a menu, arrows, Enter, Esc and the underlined letters work; Right/Enter opens a submenu, Left/Esc closes it. The title bar shows `mIRC - nick - [#channel (Server, nick)]`, built from Discord's page title. Its maximise box (or a double-click on the title bar) toggles browser full screen. The close box opens the Exit dialog. Minimise only removes focus, since a page cannot minimise the browser.

#### Layout features (1.1.0)

**Server list modes (View ▸ Server List).** *Icons* is the unchanged grey Win98 switchbar. *Names* turns the server column into a black mIRC-style treeview: one text row per server (and for Direct Messages, folders, Add a Server, Discover), dotted tree lines, Fixedsys in `--mirc-size` / `--mirc-tree`, the selected server white-on-navy, unread servers red, and mention counts as a red badge at the right end of the row. *Icons + Names* is the same list with a 20 px icon in front of each name. Names come from, in order, the item's `aria-label` (Home, Add a Server, Discover), the `data-dnd-name` of the server's drag wrapper, Discord's visually-hidden label ("Unread messages, Venice.ai" / "BikiniZero , 1 unread message", with the prefixes/suffixes stripped) or the hover tooltip text, and are drawn through CSS `attr()` from a `data-m98-name` attribute on the row (`.listItem_`), so nothing is written into React's DOM text. Unread state is Discord's pill (`.overlay_ > .item_.visible_`), selected state `aria-selected` / `.selected_`, the mention count the number badge; the column is re-marked whenever Discord changes it. Since 1.1.1 the row itself is the text line (the real tree item sits inside a 40 × 40 masked `<foreignObject>` and cannot show text), and a click anywhere on the name is forwarded to Discord's tree item. Each text mode has its own remembered width (160 px default), separate from the Icons width.

**Drag-resizable columns.** Invisible 6 px splitters sit on the right edge of the server list, the right edge of the channel list, and the *left* edge of the member list; the cursor turns into the column-resize arrows, and while dragging the splitter shows as a dithered Win98 bar. Widths are applied as `--m98-guild-w` / `--m98-chan-w` / `--m98-members-w` CSS variables through an injected `<style>` with `!important`, so they survive Discord's re-renders, and the chat column reflows (`min-width: 0`). For the two left columns (since 1.1.1) the script overrides Discord's own layout variables on `<body>`, `--custom-guild-list-width` and `--custom-guild-sidebar-width`, because the live layout is a CSS grid whose outer `.sidebar_` item, the server rows and the channel list all take their widths from those two variables. Limits: server list 48–400 px, channel list 100–600 px, member list 120–600 px. **Window ▸ Reset Column Widths** clears all three (the user panel is reset separately with **Window ▸ Reset User Panel**; Tampermonkey's menu has a *Reset whole layout* command that does both).

**Floating user panel (View ▸ Floating User Panel, on by default).** The lower-left account area (promo card + avatar / mute / deafen / settings) is lifted out of the channel column into a fixed-position Win98 window: grey frame, navy title bar reading `mIRC - nick`, two 16×14 caption buttons. The **minimize** button is the Win98 black down-arrow on a bevelled `#C0C0C0` face; when minimized only the framed title bar remains (26 px tall) and the button becomes an up-arrow to restore (double-clicking the title bar does the same). The **reset** button next to it (your `Defaults_button.png`, Lanczos-resized with PIL to a 12×10 glyph and embedded as a base64 `data:` PNG) puts the panel back to the default size/position: 260 px wide, docked bottom-left. Drag the title bar to move it; drag its right edge (column-resize cursor) to change the width, minimized or not. Limits: 150–800 px wide; it is always kept inside the viewport and below the fake menu bar, also after a browser resize. Discord's own panel element is only given a `data-m98-panel` attribute and positioned by CSS, so its buttons keep working. The user panel is only hidden when the panel is minimized; it is never removed from the DOM.

If Discord's CSP ever blocks `data:` images, the script detects the failed load and switches the reset button to a CSS-drawn circular-arrow glyph (`html.mirc98-noimg`). Discord's current CSP allows `data:` in `img-src`, so the real icon is expected; this is not verified on the live site.

**Persistence.** Everything is stored with `GM_setValue`: `guildMode`, `guildW` (Icons width), `guildWText` (Names / Icons + Names width), `chanW`, `membersW`, `floatPanel`, `panelX`, `panelY` (`null` = docked bottom-left), `panelW`, `panelMin`, plus the 1.0 settings (`timestamps24h`, `showSeconds`, `menubar`, `altKeys`, `dynamicTitle`, `hideSwitchbar`, `favorites`).

**Tampermonkey menu commands:** Toggle 24-hour timestamps · Toggle working menu bar · Toggle Alt+letter menu keys · Server list: cycle Icons / Names / Icons + Names · Toggle floating user panel · Reset column widths · Reset user panel size/position · Reset whole layout (columns + user panel).

**How the actions work, and their limits.** Where Discord has a real labelled button (User Settings, Member List, Pinned Messages, Inbox, Threads, Upload a File, emoji picker), the script clicks it. Otherwise it sends Discord's own keyboard shortcut as a synthetic key event. Synthetic key events are untrusted, and Discord may ignore some of them, so treat those menu items as best-effort. If an item does nothing, the matching real shortcut shown next to it in the menu still works. File > Exit's `window.close()` is usually blocked for tabs the script didn't open, so it falls back to `about:blank`. Discord changes its DOM often, and labels can break. The layout code finds the columns by stable hooks (`nav[aria-label="Servers sidebar"]`, `section[aria-label="User status and settings"]` (older builds: "User area") or `section[class*="panels_"]`, `[data-list-id^="members-"]`, `[data-list-item-id^="guildsnav___"]`) and class-name prefixes (`listItem_`, `sidebarList_`, `membersWrap_`, `overlay_`, `numberBadge_`, `hiddenVisually_`, `guildNameText_`); if Discord renames those, the splitters simply do not appear, the panel stays docked and Names mode shows icon-less rows without text. The text modes use `:has()`, so they need Firefox ≥ 121 or Chromium ≥ 105.
