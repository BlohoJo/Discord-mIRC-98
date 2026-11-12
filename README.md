# Discord mIRC 98 - Make Discord.com look like mIRC running on Windows 98

Theme `discord-mirc98.user.css` **v1.1.1** · Companion `discord-mirc98-companion.user.js` **v1.1.1**

Makes browser Discord look and behave like [mIRC](https://en.wikipedia.org/wiki/MIRC) running on Windows 98 SE: black panes, the mIRC 16-colour palette, Fixedsys text, beveled grey chrome, navy title bars, `[hh:mm] <nick>` lines, **green** normal chat text, and a menu bar that actually works.

<img width="1024" height="695" alt="Main" src="https://github.com/user-attachments/assets/0d3bca7c-1fa7-4ca8-be8e-f475a71d10f9" />
<em>(Yes, the top menu bar does in fact function.)</em> ❖😎
<br>

## Two parts, one mod

The mod comes in two pieces that are designed to work together. Each one does the job its tool is best at.

| Part | Runs in | What it does |
|---|---|---|
| **User Style** `discord-mirc98.user.css` | Stylus | All the visuals: colours, fonts, Win98 chrome, the mIRC title bar and menu bar, line layout, scrollbars. |
| **User Script** `discord-mirc98-companion.user.js` | Tampermonkey | The behaviour CSS can't provide: 24-hour timestamps, working drop-down menus, server-list name modes, drag-resizable columns and a floating user panel. |

**Why two parts?** Stylus injects CSS before the page paints, so Discord never flashes its stock theme on load. A stylesheet also can't read or send anything from your account, and the UserCSS format gives you a settings panel (colours, fonts, size, nick brackets, fake window chrome) without touching code. Some things simply can't be done in CSS, like turning `7:03 PM` into `19:03` or making a menu open when you click it. The companion script handles those and leaves all the styling to the theme.

You can run the theme by itself if you only want the look. Install both for the full experience shown above.

## Requirements

- A Chromium-based browser (105 or newer), or **Firefox 121 or newer**. The server-list text modes use CSS `:has()`.
- **Stylus** ([Chromium](https://chromewebstore.google.com/detail/stylus/clngdbkpkpeebahjckkjfobafhncgmne) / [Mozilla](https://addons.mozilla.org/en-US/firefox/addon/styl-us/)). Use the official Stylus by openstyles, not the old "Stylish".
- **Tampermonkey** ([Chromium](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) / [Mozilla](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)), for the companion script.
- [**Fixedsys Excelsior**](https://font.download/font/fixedsys-excelsior-301) (free) installed on your PC. Discord's security policy blocks web fonts, so the font has to be installed locally. Without it, the theme falls back to Lucida Console, then Consolas.

## Install

1. Install the Stylus and Tampermonkey extensions (links above).
2. Click **[User Style](https://github.com/BlohoJo/mIRC-Discord-98/raw/refs/heads/main/discord-mirc98.user.css)**. Stylus opens an install page; click **Install style**.
3. Click **[User Script](https://github.com/BlohoJo/mIRC-Discord-98/raw/refs/heads/main/discord-mirc98-companion.user.js)**. Tampermonkey opens an install page; click **Install**.
4. Reload discord.com.

To change colours, fonts or text size, click the Stylus icon, then the ⚙ next to "Discord mIRC 98". Leave **Fake mIRC title bar + menu bar** set to *Show* if you use the companion, because its working menu bar is mounted in that space.

Manual install also works. In Stylus, open **Manage → Import**, or drag the `.user.css` file onto the Manage page. In Tampermonkey, open the dashboard, click **+**, paste the contents of the `.user.js` file and save.

## Recommended Discord settings

- **User Settings → Appearance → Message Display: Compact.** This is the most important setting. It gives you single-line `[time] <nick> text` messages.
- **Theme: Dark.** The style overrides both themes, but Dark leaves the fewest light surfaces behind.
- **24-hour timestamps.** The companion always shows `[19:03]`, whatever Discord's own setting is. With the theme alone, Discord takes the clock format from your language: switching **Language** to *English, UK* usually gives 24-hour times (this can differ by Discord version).

## The theme

### What maps to what

| Discord part | mIRC / Win98 equivalent |
|---|---|
| Browser viewport | mIRC window: navy title bar, min/max/close buttons, menu bar |
| Server list | Grey switchbar with square beveled buttons (pressed = selected), or a mIRC treeview in the companion's Names modes |
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
| Normal chat text | 9 | `#00FC00` |
| Join / system | 3 | `#009300` |
| Highlight / unread | 4 | `#FF0000` |
| Action / typing | 6 | `#9C009C` |
| @mention pill | 7 | `#FC7F00` |
| Links | 11 | `#00FFFF` |
| Info / day change | 12 | `#0000FC` (lightened for black) |
| Timestamps | 14 | `#7F7F7F` |
| Tree / nick default | 15 | `#D2D2D2` |

### Text size

The `mirc-size` option (default 15 px) sizes the chat, the nicklist and the whole left side: channel names, category headers, the DM list, the server list's text (acronym icons, folder names and the companion's Names modes) and the nicklist group headers (2 px smaller). Channel rows shrink with the font instead of staying 32 px tall.

## The companion script

With the companion installed, the title bar and menu bar stop being decoration and start working, timestamps switch to 24-hour, and the layout can be rearranged by dragging.

### 24-hour timestamps

Every message timestamp is redrawn as `[HH:mm]` (optionally `[HH:mm:ss]`) from its ISO datetime, in your local time zone, whatever Discord's 12/24-hour setting is. The script never edits React's text. It stores the value in a `data-mirc-ts` attribute and draws it through CSS, so Discord's re-renders never undo it.

### Working menu bar and title bar

The theme's menu bar becomes real Win98 drop-down menus (one level of submenus, radio and check marks):

| Menu | What it does |
|---|---|
| File | Home (Direct Messages), Discover Servers, Options… (Alt+O, User Settings), Reconnect (F5), Exit (Win98 confirm dialog) |
| View | Nicklist / Member List (Ctrl+U), Switchbar on/off, **Server List ▸ Icons / Names / Icons + Names**, **Floating User Panel** on/off, Pinned Messages (Ctrl+P), Inbox / Mentions (Ctrl+I), Threads, Full Screen (F11) |
| Favorites | Add to Favorites, Organize Favorites… dialog (Join / Move Up / Move Down / Delete), your saved channels |
| Tools | Quick Switcher (Ctrl+K), Search (Ctrl+F), Upload File (Ctrl+Shift+U), Emoji (Ctrl+E), plus toggles: 24-hour timestamps, show seconds, window title shows channel, Alt+letter opens menus |
| Commands | Mark Channel / Server Read, Next / Previous Channel, Next / Previous Unread Channel, Next / Previous Server, Copy Channel Link |
| Window | Back / Forward, **Reset Column Widths**, **Reset User Panel**, **Minimize User Panel**, then the last 9 visited channels |
| Help | Keyboard Shortcuts (Ctrl+/), Discord Support Site, About mIRC 98… |

Keyboard use matches Windows. Alt plus the underlined letter, or F10, opens a menu. Inside a menu, the arrow keys, Enter, Esc and the underlined letters work; Right or Enter opens a submenu, and Left or Esc closes it.

The title bar reads `mIRC - nick - [#channel (Server, nick)]`, built from Discord's page title. The maximise box (or a double-click on the title bar) toggles browser full screen, and the close box opens the Exit dialog. Minimise only removes focus, since a web page can't minimise the browser.

The menu bar only appears while the theme's **Fake mIRC title bar + menu bar** option is on (the script checks every 1.5 s). The column splitters and the floating panel work either way, and the layout commands are always available from Tampermonkey's own menu.

### Server list modes (View ▸ Server List)

*Icons* is the grey Win98 switchbar. *Names* turns the server column into a black mIRC-style treeview: one text row per server (plus Direct Messages, folders, Add a Server and Discover), dotted tree lines, the selected server white-on-navy, unread servers red, and mention counts as a red badge at the end of the row. *Icons + Names* is the same list with a 20 px icon in front of each name. Click anywhere on a name to open that server. Each text mode remembers its own column width (160 px by default), separate from the Icons width.

### Drag-resizable columns

Invisible 6 px splitters sit on the right edge of the server list, the right edge of the channel list and the left edge of the member list. The cursor changes to the column-resize arrows, and while you drag, the splitter shows as a dithered Win98 bar. The chat column reflows to fit. Limits are 48–400 px for the server list, 100–600 px for the channel list and 120–600 px for the member list. **Window ▸ Reset Column Widths** puts all three back.

### Floating user panel (View ▸ Floating User Panel, on by default)

The account area at the lower left (avatar, mute, deafen, settings) moves out of the channel column into its own Win98 window, with a grey frame, a navy title bar reading `mIRC - nick` and two caption buttons. **Minimize** shrinks it to just the title bar; click it again, or double-click the title bar, to restore. **Reset** puts it back to the default: 260 px wide, docked bottom-left. Drag the title bar to move the window, and drag its right edge to resize it (150–800 px). It always stays inside the viewport and below the menu bar, even after you resize the browser. Discord's own buttons inside it keep working, since the script only repositions the panel.

### Settings and Tampermonkey commands

All settings, column widths and the panel position are saved in Tampermonkey's storage and survive reloads. Tampermonkey's extension menu offers the same controls: Toggle 24-hour timestamps · Toggle working menu bar · Toggle Alt+letter menu keys · Server list: cycle Icons / Names / Icons + Names · Toggle floating user panel · Reset column widths · Reset user panel size/position · Reset whole layout (columns + user panel).

## Notes and limits

- **Discord updates.** Discord's class names are hashed (e.g. `chat_a7d72e`) and change between builds. Both files target stable hooks (`aria-label`s, `data-list-id`, `id="message-content-..."`) and class-name prefixes (`[class*="chat_"]`) to keep breakage small. If an area turns stock-looking after a Discord update, that area's selector needs a refresh. If the companion loses its hooks, it fails quietly: the splitters don't appear, the panel stays docked, and Names mode shows empty rows.
- **Menu actions.** Where Discord has a real labelled button (User Settings, Member List, Pinned Messages, Inbox, Threads, Upload a File, emoji picker), the script clicks it. Otherwise it sends Discord's own keyboard shortcut. Browsers mark these synthetic key presses as untrusted and Discord may ignore some of them, so treat those items as best-effort. If one does nothing, the real shortcut shown next to it in the menu still works.
- **File ▸ Exit.** Browsers usually block `window.close()` for tabs a script didn't open, so Exit falls back to `about:blank`.
- **Screen space.** Set **Fake mIRC title bar + menu bar → Hide** if you'd rather not lose 40 px at the top, or if a popout looks offset. Without the companion this bar is decorative; with the companion it's the working menu bar.
- **Scrollbars.** Chromium browsers get full Win98 scrollbars with arrow buttons. Firefox only allows colour changes, so scrollbars there are plain grey.
- **Browser only.** This targets Discord in a web browser. Desktop client mods (Vencord, BetterDiscord) aren't needed.

## Changelog

### 1.1.1

Fixes for three problems found on live discord.com (Firefox Developer Edition 159):

1. **Dragging the server or channel splitter didn't resize the column contents.** Discord sizes the whole left side from two CSS variables set inline on `<body>`. The companion now overrides `--custom-guild-list-width` and `--custom-guild-sidebar-width` directly, so the server rows and channel list follow the splitters.
2. **Names mode was unreadable.** Server names were drawn inside a clipped 40 × 40 icon box and often found no name at all. Names are now drawn on the full list row, read from `aria-label`, `data-dnd-name`, Discord's hidden label or the tooltip, and a click on the name opens the server.
3. **Switching windows reset the layout.** Discord rewrites the `class` attribute on `<html>` whenever the window gains or loses focus, which wiped the companion's state. State now lives in a `data-m98-state` attribute that Discord doesn't touch, and it's re-applied on focus, blur and re-render.

Also: the theme's ineffective `--custom-guild-sidebar-width: 220px` line was removed (column width is now handled by the companion), the selected-server pill matches Discord's current markup, the channel list no longer leaves a gap when the user panel floats, and the panel is found by its current label, *User status and settings*.

### 1.1.0

The companion gained the server-list Names / Icons + Names modes, drag-resizable columns, the floating user panel, and Window ▸ Reset Column Widths / Reset User Panel. The theme's text-size option now covers the whole left side, not only the chat and nicklist.

### 1.0

First release: the UserCSS theme, plus the companion with 24-hour timestamps and the working menu bar.

## Testing

v1.1.1 was tested live on discord.com in Firefox Developer Edition 159. Each fix also has regression tests against a mock Discord page, run in Chromium and Firefox with Playwright.
