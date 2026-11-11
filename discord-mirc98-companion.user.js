// ==UserScript==
// @name         Discord mIRC 98 – Companion (24h timestamps + working menu bar + layout)
// @namespace    github.com/BlohoJo/discord-mirc98
// @version      1.1.1
// @description  Companion to the "Discord mIRC 98" Stylus theme. Forces [HH:mm] 24-hour timestamps, turns the fake mIRC menu bar / title bar into working Win98 menus, adds server-list text modes, drag-resizable columns and a floating Win98 user panel.
// @author       BlohoJo
// @license      MIT
// @match        https://discord.com/*
// @match        https://*.discord.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const VERSION = '1.1.1';

  /* ======================================================================
     Settings (persisted with GM_setValue; also toggleable from the menus)
     ====================================================================== */
  const DEFAULTS = {
    timestamps24h: true,   // rewrite message timestamps as [HH:mm]
    showSeconds: false,    // [HH:mm:ss]
    menubar: true,         // replace the Stylus theme's decorative menu bar with a working one
    altKeys: true,         // Alt+F / Alt+V ... and F10 open the menus (like Windows)
    dynamicTitle: true,    // title bar shows "mIRC - [#channel (Server, nick)]"
    hideSwitchbar: false,  // View > Switchbar
    favorites: [],         // [{ title, path }]
    // --- layout (v1.1) ---
    guildMode: 'icons',    // server list: 'icons' | 'names' | 'both'
    guildW: null,          // column widths in px; null = Discord's default (guildW = Icons mode,
    guildWText: null,      //   guildWText = Names / Icons + Names modes)
    chanW: null,
    membersW: null,
    floatPanel: true,      // lower-left user panel becomes a floating Win98 window
    panelX: null,          // null = docked bottom-left
    panelY: null,
    panelW: 260,
    panelMin: false,       // minimized to its title bar
  };
  // min / max for the resizable things
  const LIMITS = {
    guildW: [48, 400], guildWText: [48, 400], chanW: [100, 600], membersW: [120, 600], panelW: [150, 800],
  };
  const TEXT_MODE_GUILD_W = 160; // default server-list width while names are shown
  const PANEL_TITLE_H = 18;      // height of the floating panel's Win98 title bar
  const WIN_TOP = PANEL_TITLE_H + 4; // title bar + 4px window frame above it
  const WIN_MIN_H = WIN_TOP + 4;     // minimized: title bar with frame all round

  const cfg = {};
  for (const k of Object.keys(DEFAULTS)) {
    let v;
    try { v = GM_getValue(k, DEFAULTS[k]); } catch (e) { v = DEFAULTS[k]; }
    cfg[k] = v;
  }
  const save = (k, v) => { cfg[k] = v; try { GM_setValue(k, v); } catch (e) { /* ignore */ } };
  const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, Math.round(v)));

  /* ======================================================================
     <html> state flags  (v1.1.1)
     Discord manages the <html> class attribute with react-helmet (data-rh="lang,style,class")
     and re-assigns the WHOLE attribute whenever it re-renders (e.g. on window focus/blur), which
     wiped every mirc98-* class in 1.1.0. The flags therefore live in our own attribute
     data-m98-state="ts menubar gl-text ..." (helmet never touches it) and all injected CSS keys off
     html[data-m98-state~="flag"]. The html.mirc98-<flag> classes are still mirrored for user CSS and
     re-added by an attribute observer whenever Discord strips them.
     ====================================================================== */
  const state = Object.create(null);     // flag -> true/false
  function syncState() {   // idempotent: only touches what is missing/stale, so observers can't loop
    const root = document.documentElement;
    if (!root) return;
    const on = Object.keys(state).filter((k) => state[k]);
    const attr = on.join(' ');
    if (root.getAttribute('data-m98-state') !== attr) root.setAttribute('data-m98-state', attr);
    const cl = root.classList;
    for (const k of Object.keys(state)) {
      const name = 'mirc98-' + k;
      if (state[k]) { if (!cl.contains(name)) cl.add(name); }
      else if (cl.contains(name)) cl.remove(name);
    }
  }
  function setState(flag, on) {
    on = !!on;
    if (state[flag] === on) return;
    state[flag] = on;
    syncState();
  }
  function hasState(flag) { return !!state[flag]; }
  // html.mirc98-x  ->  html[data-m98-state~="x"]  (applied to every stylesheet we inject)
  const stateSelectors = (css) => css.replace(/html\.mirc98-([a-z0-9-]+)/g, 'html[data-m98-state~="$1"]');

  /* ======================================================================
     Tiny DOM helper (no innerHTML -> safe under Discord's CSP)
     ====================================================================== */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (k === 'class') el.className = v;
        else if (k === 'style') el.style.cssText = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  // "&File" -> F underlined; returns [nodes], accelerator letter
  function accelLabel(text) {
    const i = text.indexOf('&');
    if (i < 0 || i === text.length - 1) return { nodes: [text.replace(/&&/g, '&')], key: null };
    const key = text[i + 1];
    return {
      nodes: [text.slice(0, i), h('u', null, key), text.slice(i + 2)],
      key: key.toLowerCase(),
    };
  }

  /* ======================================================================
     Embedded images (data: URIs – Discord's CSP allows data: images; if it
     ever stops, html.mirc98-noimg switches to CSS-drawn fallbacks)
     ====================================================================== */
  // The user's "Defaults" icon (Uploads/Defaults_button.png), glyph only, Lanczos-resized with
  // PIL to 12x10 (the face of a 16x14 Win98 caption button), black on transparent.
  const IMG_DEFAULTS_GLYPH = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAKCAYAAACALL/6AAAAfElEQVR42oWRwQmAQAwERz19iF9B/zYgWMM1YXfaguDPAixD7mEX+omgZ04XQshusiwEnnDSG6DjBwtwALv0qzJtebsttMKVNy72DwwwiOjjAMZQLKNwVjOKgDpgEmsHfSAOwKxpiZAuwFvNKRVxAgqgknn9+kXu/eAV5QQvZB+f1rPebwAAAABJRU5ErkJggg==';

  /* ======================================================================
     Styles injected by this script
     ====================================================================== */
  const BASE_CSS = `
  /* ---- 24h timestamps: hide Discord's text, draw our own via ::before (React-safe) ---- */
  html.mirc98-ts time[data-mirc-ts] { font-size: 0 !important; letter-spacing: 0 !important; }
  html.mirc98-ts time[data-mirc-ts] > * { font-size: 0 !important; }
  html.mirc98-ts time[data-mirc-ts]::before {
    content: "[" attr(data-mirc-ts) "]" !important;
    font-size: var(--mirc-size, 0.75rem) !important;
    font-family: var(--mirc-font, inherit);
    color: inherit;
  }
  html.mirc98-ts time[data-mirc-ts]::after { content: none !important; }
  html.mirc98-ts [class*="messageContent_"] [class*="timestamp_"] time[data-mirc-ts]::before,
  html.mirc98-ts [class*="cozy_"] h3 time[data-mirc-ts]::before { font-size: 12px !important; }

  /* ---- hide the theme's painted (unclickable) menu bar when ours is mounted ---- */
  html.mirc98-menubar body::after { visibility: hidden !important; }

  /* ---- View > Switchbar ---- */
  html.mirc98-no-switchbar nav[aria-label="Servers sidebar"],
  html.mirc98-no-switchbar nav[class*="guilds_"] { display: none !important; }

  /* ---- Working menu bar ---- */
  #mirc98-menubar {
    position: fixed; z-index: 2147483001; left: 0; right: 0; top: 20px; height: 20px;
    box-sizing: border-box; padding: 1px 2px 0;
    display: flex; align-items: stretch; gap: 0;
    background: var(--win-face, #c0c0c0);
    border-bottom: 1px solid #808080; box-shadow: 0 1px 0 #fff;
    font: 11px var(--win-font, 'MS Sans Serif', Tahoma, sans-serif); color: #000;
    user-select: none; -webkit-user-select: none; cursor: default;
  }
  #mirc98-menubar .m98-top {
    padding: 2px 7px 0; line-height: 14px; border: 1px solid transparent; white-space: pre;
  }
  #mirc98-menubar .m98-top:hover { border-color: #fff #808080 #808080 #fff; }
  #mirc98-menubar .m98-top.open { border-color: #808080 #fff #fff #808080; padding: 3px 6px 0 8px; }
  #mirc98-menubar u, .m98-menu u, .m98-dialog u { text-decoration: underline; }

  #mirc98-titlehit {
    position: fixed; z-index: 2147483001; top: 0; left: 0; right: 0; height: 20px;
    background: transparent;
  }
  #mirc98-titlehit .m98-tb { position: absolute; top: 3px; width: 16px; height: 14px; }

  .m98-menu {
    position: fixed; z-index: 2147483002; min-width: 160px; padding: 2px;
    background: var(--win-face, #c0c0c0);
    box-shadow: inset -1px -1px #0a0a0a, inset 1px 1px #dfdfdf, inset -2px -2px #808080, inset 2px 2px #fff,
                2px 2px 0 rgba(0,0,0,.35);
    font: 11px var(--win-font, 'MS Sans Serif', Tahoma, sans-serif); color: #000;
    user-select: none; -webkit-user-select: none; cursor: default;
  }
  .m98-item {
    display: grid; grid-template-columns: 18px 1fr auto 14px; align-items: center;
    padding: 3px 2px; line-height: 13px; white-space: nowrap;
  }
  .m98-item .m98-sc { padding-left: 24px; }
  .m98-item .m98-arrow { text-align: right; font-size: 8px; padding-right: 2px; }
  .m98-item.hot { background: #000080; color: #fff; }
  .m98-item.disabled { color: #808080; text-shadow: 1px 1px 0 #fff; }
  .m98-item.disabled.hot { background: #000080; color: #808080; text-shadow: none; }
  .m98-sep { height: 2px; margin: 3px 1px; box-shadow: inset 0 1px #808080, inset 0 -1px #fff; }
  .m98-check { text-align: center; font-size: 10px; }
  .m98-check.radio { font-size: 7px; }

  .m98-modal { position: fixed; inset: 0; z-index: 2147483003; background: transparent; }
  .m98-dialog {
    position: fixed; min-width: 300px; max-width: 460px; padding: 3px;
    background: var(--win-face, #c0c0c0);
    box-shadow: inset -1px -1px #0a0a0a, inset 1px 1px #dfdfdf, inset -2px -2px #808080, inset 2px 2px #fff,
                3px 3px 0 rgba(0,0,0,.35);
    font: 11px var(--win-font, 'MS Sans Serif', Tahoma, sans-serif); color: #000;
  }
  .m98-dialog .m98-dtitle {
    display: flex; align-items: center; justify-content: space-between; height: 18px; padding: 0 2px 0 4px;
    background: linear-gradient(90deg, var(--win-title-a, #000080), var(--win-title-b, #1084d0));
    color: #fff; font-weight: bold; cursor: default; user-select: none;
  }
  .m98-dialog .m98-x, .m98-dialog .m98-btn, .m98-cbtn {
    background: var(--win-face, #c0c0c0); color: #000; border: 0; padding: 0;
    box-shadow: inset -1px -1px #0a0a0a, inset 1px 1px #fff, inset -2px -2px #808080, inset 2px 2px #dfdfdf;
    font: 11px var(--win-font, 'MS Sans Serif', Tahoma, sans-serif);
  }
  .m98-dialog .m98-x { width: 16px; height: 14px; font-weight: bold; line-height: 10px; font-size: 11px; }
  .m98-dialog .m98-btn { min-width: 75px; height: 23px; padding: 0 10px; margin-left: 6px; }
  .m98-dialog .m98-btn:active, .m98-dialog .m98-x:active, .m98-cbtn:active {
    box-shadow: inset -1px -1px #fff, inset 1px 1px #0a0a0a, inset -2px -2px #dfdfdf, inset 2px 2px #808080;
  }
  .m98-dialog .m98-btn:focus { outline: 1px dotted #000; outline-offset: -4px; }
  .m98-dialog .m98-dbody { display: flex; gap: 12px; padding: 14px 12px 10px; line-height: 1.45; }
  .m98-dialog .m98-dbtns { display: flex; justify-content: flex-end; padding: 2px 8px 8px; }
  .m98-dialog .m98-list {
    background: #fff; height: 150px; overflow-y: auto; min-width: 260px; flex: 1;
    box-shadow: inset -1px -1px #fff, inset 1px 1px #808080, inset -2px -2px #dfdfdf, inset 2px 2px #0a0a0a;
    padding: 3px;
  }
  .m98-dialog .m98-list div { padding: 1px 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .m98-dialog .m98-list div.sel { background: #000080; color: #fff; }
  .m98-dialog .m98-side { display: flex; flex-direction: column; gap: 6px; }
  .m98-dialog .m98-side .m98-btn { margin-left: 0; }

  /* =====================================================================
     Column widths (set from the splitters; values live in --m98-*-w)
     Live Discord (visual-refresh, verified against the site's CSS 2026-11): the left side is one
     grid item  .sidebar_  { width: var(--custom-guild-sidebar-width) }  whose body inline style
     carries the user's width; inside it  .guilds_/.listItem_ { width: var(--custom-guild-list-width) }
     and  .sidebarList_ { width: calc(sidebar-width - list-width - 1px) }.  So the only thing that
     really moves all the contents is overriding those two variables on <body> (!important beats
     Discord's inline style there). The direct width rules below stay as a fallback for other layouts.
     ===================================================================== */
  html.mirc98-w-guild body { --custom-guild-list-width: var(--m98-guild-w) !important; }
  /* guild column resized but channel column untouched: keep the channel list at Discord's own width
     (--m98-dc-* = Discord's values, copied by the script before they are overridden) */
  html.mirc98-w-guild:not(.mirc98-w-chan) body {
    --custom-guild-sidebar-width: calc(var(--m98-dc-sidebar-w, 268px) - var(--m98-dc-list-w, 72px) + var(--m98-guild-w)) !important;
  }
  /* .sidebarList_ is content-box with a 1px inline-start border on live Discord; we force border-box below so
     the measured width == the saved width, hence no "+ 1px" here */
  html.mirc98-w-chan body { --custom-guild-sidebar-width: calc(var(--custom-guild-list-width) + var(--m98-chan-w)) !important; }
  html.mirc98-w-guild nav[aria-label="Servers sidebar"],
  html.mirc98-w-guild nav[class*="guilds_"] {
    width: var(--m98-guild-w) !important; min-width: var(--m98-guild-w) !important;
    max-width: var(--m98-guild-w) !important; flex: 0 0 var(--m98-guild-w) !important;
  }
  html.mirc98-w-guild nav[aria-label="Servers sidebar"] > *,
  html.mirc98-w-guild nav[aria-label="Servers sidebar"] [data-list-id="guildsnav"],
  html.mirc98-w-guild nav[aria-label="Servers sidebar"] [class*="itemsContainer_"],
  html.mirc98-w-guild nav[aria-label="Servers sidebar"] [class*="unreadMentionsIndicator"],
  html.mirc98-w-guild nav[aria-label="Servers sidebar"] [data-list-id="guildsnav"] > [class*="stack_"],
  html.mirc98-w-guild nav[aria-label="Servers sidebar"] [class*="listItem_"],
  html.mirc98-w-guild nav[aria-label="Servers sidebar"] [class*="folderGroup_"] {
    width: 100% !important; max-width: none !important; min-width: 0 !important;
  }
  html.mirc98-w-chan [data-m98-col="channels"] {
    width: var(--m98-chan-w) !important; min-width: var(--m98-chan-w) !important;
    max-width: var(--m98-chan-w) !important; flex: 0 0 var(--m98-chan-w) !important;
    box-sizing: border-box !important;
  }
  html.mirc98-w-chan [data-m98-col="channels"] > *,
  html.mirc98-w-chan [data-m98-col="channels"] > * > nav,
  html.mirc98-w-chan [data-m98-col="channels"] > * > [class*="sidebar_"] {
    width: 100% !important; max-width: none !important; min-width: 0 !important;
  }
  html.mirc98-w-members [data-m98-col="members"] {
    width: var(--m98-members-w) !important; min-width: var(--m98-members-w) !important;
    max-width: var(--m98-members-w) !important; flex: 0 0 var(--m98-members-w) !important;
  }
  html.mirc98-w-members [data-m98-col="members"] > *,
  html.mirc98-w-members [data-m98-col="members"] [class*="members_"],
  html.mirc98-w-members [data-m98-col="members"] [data-list-id^="members-"] {
    width: 100% !important; max-width: none !important; min-width: 0 !important;
  }
  /* the chat column must be allowed to shrink/grow when the others change */
  [class*="page_"], [class*="chat_"], main[class*="chatContent_"] { min-width: 0 !important; }

  /* splitters: invisible 6px strips (Win98 splitters show only the cursor; dithered bar while dragging) */
  #mirc98-splitters .m98-split {
    position: fixed; width: 6px; z-index: 2147482998; cursor: col-resize; background: transparent;
    display: none;
  }
  #mirc98-splitters .m98-split.show { display: block; }
  html.mirc98-dragging #mirc98-splitters .m98-split.active,
  html.mirc98-dragging #mirc98-userwin .m98-grip {
    background: repeating-conic-gradient(#000 0 25%, transparent 0 50%) 0 0 / 2px 2px !important;
  }
  #mirc98-dragshield { position: fixed; inset: 0; z-index: 2147483004; cursor: col-resize; background: transparent; }
  #mirc98-dragshield.move { cursor: move; }
  html.mirc98-dragging, html.mirc98-dragging * { user-select: none !important; -webkit-user-select: none !important; }

  /* =====================================================================
     Server list modes: Names / Icons + Names  (html.mirc98-gl-text + -names/-both)
     Rendered like the Win98 treeview in mIRC's switchbar/treebar.
     Live structure (inspector export, 2026-11):
       .listItem_ > .wrapper_(overlay pill: > span.item_.visible_.selected_)
                  + span > [.blobContainer_] > .wrapper_(40x40) > svg(48x48, masked) > foreignObject(40x40)
                        > ... > div[data-dnd-name] > div[role=treeitem][data-list-item-id=guildsnav___id]
                  + span.hiddenVisually (tooltip with the name) + dnd drop targets
     i.e. the tree item sits INSIDE a masked 40px <foreignObject>; anything drawn on it is clipped to
     the icon box (why 1.1.0's names were unreadable). The script therefore copies the name to the
     .listItem_ row (data-m98-name) and the row is drawn here, outside the svg.
     ===================================================================== */
  html.mirc98-gl-text nav[aria-label="Servers sidebar"],
  html.mirc98-gl-text nav[class*="guilds_"] {
    background: var(--mirc-bg, #000) !important;
    box-shadow: var(--w98-sunken, inset -1px -1px #fff, inset 1px 1px #808080, inset -2px -2px #dfdfdf, inset 2px 2px #0a0a0a) !important;
    font-family: var(--mirc-font, 'Fixedsys', monospace) !important;
    mask: none !important; -webkit-mask: none !important;
  }
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [data-list-id="guildsnav"] [class*="stack_"],
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [data-list-id="guildsnav"] [class*="scroller_"] {
    gap: 0 !important; padding-left: 0 !important; padding-right: 0 !important;
  }
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="scroller_"],
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [data-list-id="guildsnav"] { padding-top: 4px !important; }
  /* Discord wraps DM rows in a div with an inline height:40px */
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [role="group"] > div:has(> [class*="listItem_"][data-m98-name]),
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="folderGroup_"],
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="tutorialContainer_"] {
    height: auto !important; width: 100% !important; transform: none !important; max-width: none !important;
  }
  /* ---- the row ---- */
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name] {
    position: relative !important; display: flex !important; align-items: center !important;
    justify-content: flex-start !important; width: 100% !important; max-width: none !important;
    height: auto !important; min-height: 0 !important; box-sizing: border-box !important;
    margin: 0 !important; padding: 1px 4px 1px 10px !important;
    font-size: var(--mirc-size, 15px) !important; line-height: 1.25 !important;
    font-family: var(--mirc-font, 'Fixedsys', monospace) !important; font-weight: normal !important;
    color: var(--mirc-tree, #d2d2d2) !important; cursor: pointer; overflow: visible !important;
    /* dotted treeview guide line */
    background: repeating-linear-gradient(to bottom, #808080 0 1px, transparent 1px 2px) 9px 0 / 1px 100% no-repeat !important;
  }
  /* horizontal dotted connector */
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name]::before {
    content: ""; flex: none; width: 8px; height: 1px; margin-right: 3px;
    background: repeating-linear-gradient(to right, #808080 0 1px, transparent 1px 2px);
  }
  /* the name itself (copied by the script from data-dnd-name / aria-label / the hidden label) */
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name]::after {
    content: attr(data-m98-name); flex: 1 1 auto; min-width: 0; display: block;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    font: inherit; color: inherit; margin-left: 3px; pointer-events: none;
  }
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name][data-m98-mention]::after {
    content: attr(data-m98-name) " (" attr(data-m98-mention) ")";
  }
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name]:hover {
    background-color: rgba(0, 0, 128, .55) !important;
  }
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name][data-m98-unread] {
    color: var(--mirc-unread, #ff0000) !important;
  }
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name][data-m98-mention] {
    color: var(--mirc-highlight, #ff0000) !important;
  }
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name][data-m98-selected] {
    background-color: #000080 !important; color: #fff !important; outline: 1px dotted #ffff00; outline-offset: -1px;
  }
  /* folders: children are indented one level */
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="folderGroup_"] [class*="listItem_"][data-m98-name]:not(:has([class*="folderButton_"])) {
    padding-left: 24px !important;
  }
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="folderHeader_"],
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="folderButton_"],
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="expandedFolderBackground_"] {
    width: auto !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important;
    background: transparent !important; border: 0 !important; box-shadow: none !important; flex: none;
  }
  /* non-icon children of the row stay out of the flex flow (tooltip text, drag-and-drop targets) */
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name] > [class*="hiddenVisually_"],
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name] > :has(> [data-dnd-name^="Above"]) {
    position: absolute !important; width: 1px !important; height: 1px !important; overflow: hidden !important;
    clip: rect(0 0 0 0) !important; left: 0 !important; top: 0 !important; margin: 0 !important; padding: 0 !important;
  }
  /* ---- the icon box: .wrapper_(40x40) that directly holds the masked <svg> ---- */
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name] > span:has(svg),
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name] [class*="listItemWrapper_"],
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name] [class*="blobContainer_"] {
    display: flex !important; flex: none !important; align-items: center !important;
    position: static !important; width: auto !important; height: auto !important; min-width: 0 !important;
    margin: 0 !important; padding: 0 !important; transform: none !important;
  }
  html.mirc98-gl-names nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name] [class*="wrapper_"]:has(> svg),
  html.mirc98-gl-names nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name] [class*="folderIconWrapper_"] {
    display: none !important;
  }
  html.mirc98-gl-both nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name] [class*="wrapper_"]:has(> svg) {
    position: relative !important; display: block !important; flex: none !important;
    width: 20px !important; height: 20px !important; min-width: 20px !important; min-height: 20px !important;
    margin: 0 4px 0 0 !important; padding: 0 !important; overflow: visible !important;
  }
  /* the svg scales its 48-unit viewBox (icon + 4px badge margin) down to 24px -> a 20px icon */
  html.mirc98-gl-both nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name] [class*="wrapper_"] > svg {
    width: 24px !important; height: 24px !important; left: -2px !important; top: -2px !important;
    position: absolute !important; overflow: visible !important;
  }
  html.mirc98-gl-both nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name] [class*="folderButton_"] > [class*="wrapper_"] > svg {
    width: 20px !important; height: 20px !important; left: 0 !important; top: 0 !important;
  }
  /* badges live inside the icon box; in text modes the mention count is written after the name instead */
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name] [class*="lowerBadge_"],
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name] [class*="upperBadge_"] {
    display: none !important;
  }
  /* unread pill (Discord: 8px white blob left of the icon) -> 3px red bar on the far left of the row */
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name] > [class*="overlay_"] {
    position: absolute !important; left: 0 !important; top: 0 !important; height: 100% !important; width: 4px !important;
    contain: none !important; overflow: visible !important; margin: 0 !important;
  }
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name] > [class*="overlay_"] > * {
    position: absolute !important; left: 0 !important; top: 0 !important; height: 100% !important; width: 3px !important;
    margin: 0 !important; transform: none !important; border-radius: 0 !important; transition: none !important;
    opacity: 0 !important; background: var(--mirc-unread, #ff0000) !important;
  }
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name][data-m98-unread]:not([data-m98-selected]) > [class*="overlay_"] > * {
    opacity: 1 !important;
  }
  /* old (pre-2025) pill structure, kept for safety */
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="pill_"] { height: 100% !important; left: 0 !important; top: 0 !important; }
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="pill_"] span { width: 3px !important; max-height: 100% !important; background: transparent !important; }
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [data-m98-unread] [class*="pill_"] span { background: var(--mirc-unread, #ff0000) !important; }
  /* separators between the groups */
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="listItem_"]:has(> [class*="guildSeparator_"]) {
    width: 100% !important; height: auto !important; margin: 0 !important; padding: 3px 6px !important; box-sizing: border-box !important;
  }
  html.mirc98-gl-text nav[aria-label="Servers sidebar"] [class*="guildSeparator_"] { width: 100% !important; margin: 0 !important; }

  /* =====================================================================
     Floating user panel (html.mirc98-float; the panel is marked data-m98-panel)
     ===================================================================== */
  html.mirc98-float [data-m98-panel] {
    position: fixed !important; z-index: 300 !important;
    left: var(--m98-panel-x, 2px) !important; top: var(--m98-panel-y, auto) !important;
    bottom: var(--m98-panel-bottom, auto) !important; right: auto !important;
    width: var(--m98-panel-w, 260px) !important; max-width: none !important; min-width: 0 !important;
    height: auto !important; max-height: 60vh !important; overflow: auto !important;
    margin: 0 !important; box-sizing: border-box !important;
    background: var(--win-face, #c0c0c0) !important;
    box-shadow: inset 1px 0 #dfdfdf, inset -1px 0 #0a0a0a, inset 0 -1px #0a0a0a, inset 2px 0 #fff, inset -2px 0 #808080, inset 0 -2px #808080 !important;
    padding: 2px 6px 6px !important;
  }
  html.mirc98-float.mirc98-panel-min [data-m98-panel] { display: none !important; }
  /* Discord reserves the docked panel's height (body --custom-app-panels-height) under the columns; not needed while floating */
  html.mirc98-float body { --custom-app-panels-height: 0px !important; }
  #mirc98-userwin {
    position: fixed; z-index: 2147482997; display: none; box-sizing: border-box; height: ${WIN_TOP}px;
    padding: 4px 4px 0; background: var(--win-face, #c0c0c0);
    box-shadow: inset 1px 0 #dfdfdf, inset 0 1px #dfdfdf, inset -1px 0 #0a0a0a, inset 2px 0 #fff, inset 0 2px #fff, inset -2px 0 #808080;
    user-select: none; -webkit-user-select: none; cursor: default;
  }
  #mirc98-userwin.show { display: block; }
  html.mirc98-panel-min #mirc98-userwin {
    height: ${WIN_MIN_H}px; padding-bottom: 4px;
    box-shadow: inset 1px 0 #dfdfdf, inset 0 1px #dfdfdf, inset -1px 0 #0a0a0a, inset 0 -1px #0a0a0a,
                inset 2px 0 #fff, inset 0 2px #fff, inset -2px 0 #808080, inset 0 -2px #808080;
  }
  #mirc98-userwin .m98-wbar {
    height: ${PANEL_TITLE_H}px; display: flex; align-items: center; padding: 0 2px 0 4px; gap: 2px;
    background: linear-gradient(90deg, var(--win-title-a, #000080), var(--win-title-b, #1084d0));
    color: #fff; font: bold 11px var(--win-font, 'MS Sans Serif', Tahoma, sans-serif);
  }
  #mirc98-userwin .m98-wtitle { flex: 1 1 auto; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; pointer-events: none; }
  #mirc98-userwin .m98-cbtn { width: 16px; height: 14px; flex: none; cursor: default; position: relative; }
  /* minimize = black down-arrow; restore = up-arrow (CSS-drawn, so no image needed) */
  #mirc98-userwin .m98-cbtn.min::before {
    content: ""; position: absolute; left: 4px; top: 5px; width: 0; height: 0;
    border-left: 3.5px solid transparent; border-right: 3.5px solid transparent; border-top: 4px solid #000;
  }
  html.mirc98-panel-min #mirc98-userwin .m98-cbtn.min::before {
    border-top: 0; border-bottom: 4px solid #000;
  }
  #mirc98-userwin .m98-cbtn:active::before { transform: translate(1px, 1px); }
  /* reset = the user's Defaults icon (embedded PNG) with a CSS-drawn circular-arrow fallback */
  #mirc98-userwin .m98-cbtn.rst::before {
    content: ""; position: absolute; left: 2px; top: 2px; width: 12px; height: 10px;
    background: url("${IMG_DEFAULTS_GLYPH}") center / 12px 10px no-repeat;
  }
  html.mirc98-noimg #mirc98-userwin .m98-cbtn.rst::before {
    left: 3px; top: 2px; width: 6px; height: 6px; background: none;
    border: 2px solid #000; border-radius: 50%; border-top-color: transparent;
  }
  html.mirc98-noimg #mirc98-userwin .m98-cbtn.rst::after {
    content: ""; position: absolute; left: 3px; top: 1px; width: 0; height: 0;
    border-top: 2px solid transparent; border-bottom: 2px solid transparent; border-right: 3px solid #000;
  }
  #mirc98-userwin .m98-grip { position: absolute; top: 0; right: -3px; width: 6px; cursor: col-resize; background: transparent; }
  `;

  function injectStyle(id, css) {
    let st = document.getElementById(id);
    if (!st) {
      st = document.createElement('style');
      st.id = id;
      (document.head || document.documentElement).appendChild(st);
    }
    css = stateSelectors(css);
    if (st.textContent !== css) st.textContent = css;
    return st;
  }

  /* ======================================================================
     1. 24-hour timestamps
     ====================================================================== */
  const pad = (n) => String(n).padStart(2, '0');
  function fmt(d) {
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + (cfg.showSeconds ? ':' + pad(d.getSeconds()) : '');
  }
  const TS_SEL = 'time[datetime][id^="message-timestamp-"], li[id^="chat-messages-"] time[datetime], ' +
                 '[id^="search-result"] time[datetime], [class*="searchResult"] time[datetime]';

  function stampAll(root) {
    if (!cfg.timestamps24h) return;
    const scope = root && root.querySelectorAll ? root : document;
    const list = scope.querySelectorAll(TS_SEL);
    for (const t of list) stamp(t);
    if (root && root.matches && root.matches(TS_SEL)) stamp(root);
  }
  function stamp(t) {
    const iso = t.getAttribute('datetime');
    if (!iso) return;
    const d = new Date(iso);
    if (isNaN(d)) return;
    const v = fmt(d);
    if (t.getAttribute('data-mirc-ts') !== v) t.setAttribute('data-mirc-ts', v);
  }
  function restampEverything() {
    document.querySelectorAll('time[data-mirc-ts]').forEach((t) => t.removeAttribute('data-mirc-ts'));
    applyTsClass();
    stampAll(document);
  }
  function applyTsClass() {
    setState('ts', !!cfg.timestamps24h);
  }

  let pending = new Set(), scheduled = false;
  const mo = new MutationObserver((muts) => {
    let structural = false;
    for (const m of muts) {
      if (m.type === 'attributes') { pending.add(m.target); continue; }
      structural = true;
      for (const n of m.addedNodes) if (n.nodeType === 1) pending.add(n);
    }
    if (structural) scheduleLayout();
    if (!cfg.timestamps24h) { pending.clear(); return; }
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        const nodes = pending; pending = new Set();
        for (const n of nodes) if (n.isConnected) stampAll(n);
      });
    }
  });

  /* ======================================================================
     Discord helpers (best-effort: click a real button, else send Discord's shortcut)
     ====================================================================== */
  function navigate(path) {
    if (location.pathname === path) return;
    history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }
  function q(selectors) {
    for (const s of [].concat(selectors)) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  }
  const KEYCODES = { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Escape: 27, Enter: 13, '/': 191 };
  function sendKey(key, mods = {}) {
    const keyCode = KEYCODES[key] || key.toUpperCase().charCodeAt(0);
    const code = key.length === 1 ? (key === '/' ? 'Slash' : 'Key' + key.toUpperCase()) : key;
    const target = (document.activeElement && document.activeElement !== document.body &&
                    !document.activeElement.closest('#mirc98-menubar, .m98-menu'))
      ? document.activeElement : document.body;
    for (const type of ['keydown', 'keyup']) {
      const ev = new KeyboardEvent(type, {
        key, code, bubbles: true, cancelable: true, composed: true,
        ctrlKey: !!mods.ctrl, shiftKey: !!mods.shift, altKey: !!mods.alt, metaKey: !!mods.meta,
      });
      Object.defineProperty(ev, 'keyCode', { get: () => keyCode });
      Object.defineProperty(ev, 'which', { get: () => keyCode });
      target.dispatchEvent(ev);
    }
  }
  function clickOrKey(selectors, key, mods) {
    const el = q(selectors);
    if (el) { el.click(); return; }
    if (key) sendKey(key, mods);
  }

  const actions = {
    home: () => navigate('/channels/@me'),
    discover: () => navigate('/discovery'),
    settings: () => clickOrKey(['button[aria-label="User Settings"]', '[aria-label="User Settings"]']),
    reload: () => location.reload(),
    exit: () => dialog({
      title: 'mIRC', icon: 'question',
      text: 'Are you sure you want to exit mIRC?\n(This closes the Discord tab.)',
      buttons: [
        { label: '&Yes', act: () => { window.close(); setTimeout(() => { location.href = 'about:blank'; }, 150); } },
        { label: '&No', def: true },
      ],
    }),
    members: () => clickOrKey(['[aria-label="Hide Member List"]', '[aria-label="Show Member List"]',
                               '[aria-label*="Member List"]'], 'u', { ctrl: true }),
    switchbar: () => { save('hideSwitchbar', !cfg.hideSwitchbar); applySwitchbar(); },
    pins: () => clickOrKey(['[aria-label="Pinned Messages"]', '[aria-label*="Pinned"]'], 'p', { ctrl: true }),
    inbox: () => clickOrKey(['[aria-label="Inbox"]', '[aria-label*="Inbox"]'], 'i', { ctrl: true }),
    threads: () => clickOrKey(['[aria-label="Threads"]']),
    fullscreen: () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    },
    quickSwitcher: () => sendKey('k', { ctrl: true }),
    search: () => {
      const box = q(['section[aria-label="Channel header"] [role="combobox"]',
                     '[class*="search_"] [role="combobox"]', '[aria-label="Search"]']);
      if (box) { box.focus(); box.click(); } else sendKey('f', { ctrl: true });
    },
    upload: () => clickOrKey(['form [aria-label="Upload a File"]', 'form [class*="attachButton_"]'],
                             'u', { ctrl: true, shift: true }),
    emoji: () => clickOrKey(['form [aria-label="Select emoji"]'], 'e', { ctrl: true }),
    markChannelRead: () => sendKey('Escape'),
    markServerRead: () => sendKey('Escape', { shift: true }),
    nextChannel: () => sendKey('ArrowDown', { alt: true }),
    prevChannel: () => sendKey('ArrowUp', { alt: true }),
    nextUnread: () => sendKey('ArrowDown', { alt: true, shift: true }),
    prevUnread: () => sendKey('ArrowUp', { alt: true, shift: true }),
    nextServer: () => sendKey('ArrowDown', { ctrl: true, alt: true }),
    prevServer: () => sendKey('ArrowUp', { ctrl: true, alt: true }),
    copyLink: () => { navigator.clipboard && navigator.clipboard.writeText(location.href); },
    back: () => history.back(),
    forward: () => history.forward(),
    shortcuts: () => sendKey('/', { ctrl: true }),
    support: () => window.open('https://support.discord.com/', '_blank', 'noopener'),
    about: () => dialog({
      title: 'About mIRC 98', icon: 'info',
      text: 'Discord mIRC 98\nStylus theme + Tampermonkey companion v' + VERSION + '\n\n' +
            'Makes discord.com look like mIRC on Windows 98 SE.\n' +
            'Not affiliated with mIRC Co. Ltd. or Discord Inc.',
      buttons: [{ label: 'OK', def: true }],
    }),
    addFavorite: () => {
      const path = location.pathname;
      if (!path.startsWith('/channels/')) return;
      const favs = cfg.favorites.slice();
      if (favs.some((f) => f.path === path)) {
        return dialog({ title: 'Favorites', icon: 'info', text: 'This window is already in your Favorites.',
                        buttons: [{ label: 'OK', def: true }] });
      }
      favs.push({ title: currentWindowTitle() || path, path });
      save('favorites', favs);
    },
    organizeFavorites: () => organizeFavoritesDialog(),
    // --- layout (v1.1) ---
    guildMode: (mode) => { save('guildMode', mode); applyLayout(); markGuilds(); },
    resetColumns: () => { save('guildW', null); save('guildWText', null); save('chanW', null); save('membersW', null); applyLayout(); },
    resetPanel: () => { save('panelX', null); save('panelY', null); save('panelW', DEFAULTS.panelW); save('panelMin', false); applyLayout(); },
    resetLayout: () => { actions.resetColumns(); actions.resetPanel(); },
    toggleFloatPanel: () => { save('floatPanel', !cfg.floatPanel); if (!cfg.floatPanel) save('panelMin', false); applyLayout(); },
    togglePanelMin: () => { save('panelMin', !cfg.panelMin); applyLayout(); },
  };

  /* ======================================================================
     Window title ("mIRC - [#channel (Server, nick)]") + recent windows
     ====================================================================== */
  function parseTitle() {
    let t = document.title || '';
    t = t.replace(/^\(\d+\)\s*/, '').replace(/\s*-\s*Discord\s*$/i, '');
    const parts = t.split(/\s+\|\s+/).map((s) => s.trim()).filter((s) => s && !/^Discord$/i.test(s));
    const unread = (/^\((\d+)\)/.exec(document.title) || [])[1];
    return { chan: parts[0] || '', server: parts.slice(1).join(' | '), unread };
  }
  function currentNick() {
    const el = q(['section[aria-label="User area"] [class*="nameTag_"] [class*="title_"]',
                  'section[aria-label="User area"] [class*="panelTitleContainer_"]',
                  'section[aria-label="User area"] [class*="title_"]',
                  '[data-m98-panel] [class*="title_"]']);
    return el ? el.textContent.trim() : '';
  }
  function currentWindowTitle() {
    const { chan, server } = parseTitle();
    if (!chan) return '';
    return server ? `${chan} (${server})` : chan;
  }
  const recent = []; // [{title, path}]
  let lastPath = '', lastTitleCss = '';
  function updateTitle() {
    const path = location.pathname;
    const wt = currentWindowTitle();
    if (wt && path.startsWith('/channels/')) {
      const i = recent.findIndex((r) => r.path === path);
      if (i >= 0) recent.splice(i, 1);
      recent.unshift({ title: wt, path });
      if (recent.length > 9) recent.length = 9;
    }
    lastPath = path;
    if (!cfg.dynamicTitle) { injectStyle('mirc98-title', ''); return; }
    const { chan, server, unread } = parseTitle();
    const nick = currentNick();
    const inner = [server, nick].filter(Boolean).join(', ');
    let title = 'mIRC';
    if (nick) title += ' - ' + nick;
    if (chan) title += ' - [' + chan + (inner ? ' (' + inner + ')' : '') + ']';
    if (unread) title += ' - Pager[' + unread + ']';
    const esc = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
    const css = `html.mirc98-title body::before { content: "${esc}" !important; }`;
    if (css !== lastTitleCss) { lastTitleCss = css; injectStyle('mirc98-title', css); }
    setState('title', true);
  }

  /* ======================================================================
     Menu model  (items: {label, sc, act, check, radio, disabled, items})
     ====================================================================== */
  const SEP = '-';
  function buildMenus() {
    const favItems = cfg.favorites.length
      ? cfg.favorites.map((f, i) => ({
          label: (i < 9 ? `&${i + 1} ` : '') + f.title.replace(/&/g, '&&'),
          act: () => navigate(f.path),
          check: () => location.pathname === f.path,
        }))
      : [{ label: '(empty)', disabled: true }];
    const winItems = recent.length
      ? recent.map((r, i) => ({
          label: `&${i + 1} ` + r.title.replace(/&/g, '&&'),
          act: () => navigate(r.path),
          check: () => location.pathname === r.path,
        }))
      : [{ label: '(no windows yet)', disabled: true }];
    const guildModeItem = (label, mode) => ({
      label, radio: true, check: () => cfg.guildMode === mode, act: () => actions.guildMode(mode),
    });

    return [
      { label: '&File', items: [
        { label: '&Home (Direct Messages)', act: actions.home },
        { label: '&Discover Servers', act: actions.discover },
        SEP,
        { label: '&Options...', sc: 'Alt+O', act: actions.settings },
        SEP,
        { label: '&Reconnect', sc: 'F5', act: actions.reload },
        { label: 'E&xit', act: actions.exit },
      ] },
      { label: '&View', items: [
        { label: '&Nicklist (Member List)', sc: 'Ctrl+U', act: actions.members },
        { label: '&Switchbar (Server List)', check: () => !cfg.hideSwitchbar, act: actions.switchbar },
        { label: 'Server &List', items: [
          guildModeItem('&Icons', 'icons'),
          guildModeItem('&Names', 'names'),
          guildModeItem('Icons + N&ames', 'both'),
        ] },
        { label: 'Floating &User Panel', check: () => cfg.floatPanel, act: actions.toggleFloatPanel },
        SEP,
        { label: '&Pinned Messages', sc: 'Ctrl+P', act: actions.pins },
        { label: '&Inbox / Mentions', sc: 'Ctrl+I', act: actions.inbox },
        { label: '&Threads', act: actions.threads },
        SEP,
        { label: '&Full Screen', sc: 'F11', check: () => !!document.fullscreenElement, act: actions.fullscreen },
      ] },
      { label: 'F&avorites', items: [
        { label: '&Add to Favorites', disabled: !location.pathname.startsWith('/channels/'), act: actions.addFavorite },
        { label: '&Organize Favorites...', act: actions.organizeFavorites },
        SEP,
        ...favItems,
      ] },
      { label: '&Tools', items: [
        { label: '&Quick Switcher...', sc: 'Ctrl+K', act: actions.quickSwitcher },
        { label: '&Search...', sc: 'Ctrl+F', act: actions.search },
        { label: '&Upload File...', sc: 'Ctrl+Shift+U', act: actions.upload },
        { label: '&Emoji...', sc: 'Ctrl+E', act: actions.emoji },
        SEP,
        { label: '24-hour &Timestamps', check: () => cfg.timestamps24h,
          act: () => { save('timestamps24h', !cfg.timestamps24h); restampEverything(); } },
        { label: 'Show Se&conds', check: () => cfg.showSeconds, disabled: !cfg.timestamps24h,
          act: () => { save('showSeconds', !cfg.showSeconds); restampEverything(); } },
        { label: '&Window Title Shows Channel', check: () => cfg.dynamicTitle,
          act: () => { save('dynamicTitle', !cfg.dynamicTitle); if (!cfg.dynamicTitle) {
            setState('title', false); } updateTitle(); } },
        { label: 'Alt+&Letter Opens Menus', check: () => cfg.altKeys,
          act: () => save('altKeys', !cfg.altKeys) },
      ] },
      { label: '&Commands', items: [
        { label: 'Mark Channel &Read', sc: 'Esc', act: actions.markChannelRead },
        { label: 'Mark &Server Read', sc: 'Shift+Esc', act: actions.markServerRead },
        SEP,
        { label: '&Next Channel', sc: 'Alt+Down', act: actions.nextChannel },
        { label: '&Previous Channel', sc: 'Alt+Up', act: actions.prevChannel },
        { label: 'Next &Unread Channel', sc: 'Alt+Shift+Down', act: actions.nextUnread },
        { label: 'Previous Unrea&d Channel', sc: 'Alt+Shift+Up', act: actions.prevUnread },
        { label: 'Next Ser&ver', sc: 'Ctrl+Alt+Down', act: actions.nextServer },
        { label: 'Previous Serv&er', sc: 'Ctrl+Alt+Up', act: actions.prevServer },
        SEP,
        { label: '&Copy Channel Link', act: actions.copyLink },
      ] },
      { label: '&Window', items: [
        { label: '&Back', sc: 'Alt+Left', act: actions.back },
        { label: '&Forward', sc: 'Alt+Right', act: actions.forward },
        SEP,
        { label: '&Reset Column Widths', act: actions.resetColumns },
        { label: 'Reset &User Panel', disabled: () => !cfg.floatPanel, act: actions.resetPanel },
        { label: '&Minimize User Panel', check: () => cfg.panelMin, disabled: () => !cfg.floatPanel, act: actions.togglePanelMin },
        SEP,
        ...winItems,
      ] },
      { label: '&Help', items: [
        { label: '&Keyboard Shortcuts', sc: 'Ctrl+/', act: actions.shortcuts },
        { label: 'Discord &Support Site', act: actions.support },
        SEP,
        { label: '&About mIRC 98...', act: actions.about },
      ] },
    ];
  }

  /* ======================================================================
     Menu bar UI (with one level of submenus)
     ====================================================================== */
  let bar = null, titleHit = null, menus = [], openIdx = -1, dropdown = null, hotIdx = -1, keyboardMode = false;
  let sub = null; // { el, items, hotIdx, parentIdx }

  function mountMenubar() {
    if (bar || !document.body) return;
    bar = h('div', { id: 'mirc98-menubar', role: 'menubar' });
    renderBar();
    titleHit = h('div', { id: 'mirc98-titlehit',
      ondblclick: (e) => { if (!e.target.classList.contains('m98-tb')) actions.fullscreen(); } },
      h('div', { class: 'm98-tb', title: 'Minimize', style: 'right:39px',
                 onclick: () => document.activeElement && document.activeElement.blur() }),
      h('div', { class: 'm98-tb', title: 'Maximize (full screen)', style: 'right:23px', onclick: actions.fullscreen }),
      h('div', { class: 'm98-tb', title: 'Close', style: 'right:3px', onclick: actions.exit }));
    document.body.append(titleHit, bar);
    setState('menubar', true);
  }
  function unmountMenubar() {
    closeMenu();
    if (bar) { bar.remove(); bar = null; }
    if (titleHit) { titleHit.remove(); titleHit = null; }
    setState('menubar', false);
  }
  function renderBar() {
    menus = buildMenus();
    bar.replaceChildren(...menus.map((m, i) => {
      const { nodes } = accelLabel(m.label);
      return h('div', {
        class: 'm98-top' + (i === openIdx ? ' open' : ''), role: 'menuitem',
        onmousedown: (e) => { e.preventDefault(); e.stopPropagation(); openIdx === i ? closeMenu() : openMenu(i, false); },
        onmouseenter: () => { if (openIdx >= 0 && openIdx !== i) openMenu(i, false); },
      }, nodes);
    }));
  }
  const isDisabled = (it) => (typeof it.disabled === 'function' ? it.disabled() : !!it.disabled);

  function buildItems(container, items, onHot, hot, isSub) {
    items.forEach((it, idx) => {
      if (it === SEP) { container.append(h('div', { class: 'm98-sep' })); return; }
      const dis = isDisabled(it);
      const checked = it.check ? !!it.check() : false;
      const { nodes } = accelLabel(it.label);
      const row = h('div', {
        class: 'm98-item' + (dis ? ' disabled' : '') + (idx === hot ? ' hot' : ''), role: 'menuitem',
        'data-idx': idx,
        onmouseenter: () => onHot(idx),
        onmouseup: (e) => { e.stopPropagation(); if (!dis && !it.items) activate(it); },
      },
        h('span', { class: 'm98-check' + (it.radio ? ' radio' : '') }, checked ? (it.radio ? '\u25CF' : '\u2714') : ''),
        h('span', null, nodes),
        h('span', { class: 'm98-sc' }, it.sc || ''),
        h('span', { class: 'm98-arrow' }, it.items ? '\u25B6' : ''));
      container.append(row);
    });
  }
  function keepInView(el) {
    const r = el.getBoundingClientRect();
    if (r.right > innerWidth) el.style.left = Math.max(0, innerWidth - r.width - 2) + 'px';
    if (r.bottom > innerHeight) el.style.top = Math.max(0, innerHeight - r.height - 2) + 'px';
  }

  function openMenu(i, viaKeyboard) {
    closeDropdownOnly();
    keyboardMode = viaKeyboard;
    openIdx = (i + menus.length) % menus.length;
    renderBar(); // refresh dynamic items (favorites, windows, checks)
    const top = bar.children[openIdx];
    const r = top.getBoundingClientRect();
    const m = menus[openIdx];
    hotIdx = viaKeyboard ? nextEnabled(m.items, -1, 1) : -1;
    dropdown = h('div', { class: 'm98-menu', role: 'menu', style: `left:${Math.round(r.left)}px;top:${Math.round(r.bottom)}px`,
                          onmousedown: (e) => { e.preventDefault(); e.stopPropagation(); } });
    buildItems(dropdown, m.items, (idx) => { setHot(idx); const it = m.items[idx]; if (it.items && !isDisabled(it)) openSub(idx, false); else closeSub(); }, hotIdx, false);
    document.body.append(dropdown);
    keepInView(dropdown);
  }
  function openSub(idx, viaKeyboard) {
    if (sub && sub.parentIdx === idx) return;
    closeSub();
    const it = menus[openIdx].items[idx];
    const row = dropdown.querySelector(`.m98-item[data-idx="${idx}"]`);
    if (!it || !row) return;
    const r = row.getBoundingClientRect();
    const el = h('div', { class: 'm98-menu', role: 'menu', style: `left:${Math.round(r.right - 3)}px;top:${Math.round(r.top - 3)}px`,
                          onmousedown: (e) => { e.preventDefault(); e.stopPropagation(); } });
    sub = { el, items: it.items, hotIdx: viaKeyboard ? nextEnabled(it.items, -1, 1) : -1, parentIdx: idx };
    buildItems(el, it.items, (j) => setSubHot(j), sub.hotIdx, true);
    el.addEventListener('mouseleave', () => { if (sub && !keyboardMode) setSubHot(-1); });
    document.body.append(el);
    keepInView(el);
  }
  function closeSub() { if (sub) { sub.el.remove(); sub = null; } }
  function setSubHot(j) {
    if (!sub) return;
    sub.hotIdx = j;
    for (const row of sub.el.querySelectorAll('.m98-item')) row.classList.toggle('hot', Number(row.dataset.idx) === j);
  }
  function setHot(idx) {
    hotIdx = idx;
    if (!dropdown) return;
    for (const row of dropdown.querySelectorAll('.m98-item')) {
      row.classList.toggle('hot', Number(row.dataset.idx) === idx);
    }
  }
  function nextEnabled(items, from, dir) {
    const n = items.length;
    for (let s = 1; s <= n; s++) {
      const i = ((from + dir * s) % n + n) % n;
      const it = items[i];
      if (it !== SEP) return i;
    }
    return -1;
  }
  function activate(it) {
    closeMenu();
    // let the menu disappear and focus return before acting (keyboard shortcuts need it)
    setTimeout(() => { try { it.act && it.act(); } catch (e) { console.error('[mIRC98]', e); } }, 0);
  }
  function closeDropdownOnly() { closeSub(); if (dropdown) { dropdown.remove(); dropdown = null; } }
  function closeMenu() {
    closeDropdownOnly();
    if (openIdx !== -1) { openIdx = -1; hotIdx = -1; if (bar) renderBar(); }
  }

  // close on outside click
  window.addEventListener('mousedown', (e) => {
    if (openIdx < 0) return;
    if (e.target.closest && (e.target.closest('#mirc98-menubar') || e.target.closest('.m98-menu'))) return;
    closeMenu();
  }, true);
  window.addEventListener('blur', closeMenu);
  window.addEventListener('resize', () => { closeMenu(); scheduleLayout(); });

  // Keyboard: Alt+letter / F10 open menus; arrows/Enter/Esc/letters inside menus
  window.addEventListener('keydown', (e) => {
    if (document.querySelector('.m98-modal')) return; // dialogs handle their own keys
    if (!bar) return;
    if (openIdx >= 0) {
      const m = menus[openIdx];
      let handled = true;
      const activeItems = sub ? sub.items : m.items;
      const activeHot = sub ? sub.hotIdx : hotIdx;
      const setActiveHot = sub ? setSubHot : setHot;
      switch (e.key) {
        case 'Escape': if (sub) closeSub(); else closeMenu(); break;
        case 'ArrowLeft': if (sub) closeSub(); else openMenu(openIdx - 1, true); break;
        case 'ArrowRight': {
          const it = m.items[hotIdx];
          if (!sub && it && it.items && !isDisabled(it)) { keyboardMode = true; openSub(hotIdx, true); }
          else openMenu(openIdx + 1, true);
          break;
        }
        case 'ArrowDown': setActiveHot(nextEnabled(activeItems, activeHot, 1)); break;
        case 'ArrowUp': setActiveHot(nextEnabled(activeItems, activeHot < 0 ? 0 : activeHot, -1)); break;
        case 'Enter': {
          const it = activeItems[activeHot];
          if (it && it !== SEP && !isDisabled(it)) {
            if (it.items) { keyboardMode = true; openSub(activeHot, true); } else activate(it);
          }
          break;
        }
        case 'Alt': closeMenu(); break;
        default: {
          const k = (e.key || '').toLowerCase();
          if (k.length === 1) {
            if (e.altKey) {
              const ti = menus.findIndex((mm) => accelLabel(mm.label).key === k);
              if (ti >= 0) { openMenu(ti, true); break; }
            }
            const ii = activeItems.findIndex((it) => it !== SEP && accelLabel(it.label).key === k && !isDisabled(it));
            if (ii >= 0) {
              const it = activeItems[ii];
              if (it.items) { setHot(ii); keyboardMode = true; openSub(ii, true); } else activate(it);
            }
          } else handled = false;
        }
      }
      if (handled) { e.preventDefault(); e.stopImmediatePropagation(); }
      return;
    }
    if (e.key === 'F10' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault(); e.stopImmediatePropagation(); openMenu(0, true); return;
    }
    if (cfg.altKeys && e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && e.key && e.key.length === 1) {
      const k = e.key.toLowerCase();
      if (k === 'o') { e.preventDefault(); e.stopImmediatePropagation(); actions.settings(); return; }
      const ti = menus.findIndex((mm) => accelLabel(mm.label).key === k);
      if (ti >= 0) { e.preventDefault(); e.stopImmediatePropagation(); openMenu(ti, true); }
    }
  }, true);

  /* ======================================================================
     Win98 dialogs
     ====================================================================== */
  const ICONS = {
    info: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%23fff' stroke='%23000080' stroke-width='2'/%3E%3Crect x='14' y='13' width='4' height='11' fill='%23000080'/%3E%3Crect x='14' y='7' width='4' height='4' fill='%23000080'/%3E%3C/svg%3E",
    question: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%23fff' stroke='%23000080' stroke-width='2'/%3E%3Cpath d='M11 12a5 5 0 1 1 7 4.5c-1.5.8-2 1.6-2 3.5' fill='none' stroke='%23000080' stroke-width='3'/%3E%3Crect x='14.5' y='22' width='3' height='3' fill='%23000080'/%3E%3C/svg%3E",
  };
  function dialogShell(title, onClose) {
    closeMenu();
    const modal = h('div', { class: 'm98-modal' });
    const close = () => { modal.remove(); document.removeEventListener('keydown', onKey, true); onClose && onClose(); };
    const titleBar = h('div', { class: 'm98-dtitle' }, h('span', null, title),
      h('button', { class: 'm98-x', title: 'Close', onclick: close }, '\u2715'));
    const box = h('div', { class: 'm98-dialog', role: 'dialog' }, titleBar);
    modal.append(box);
    // drag by title bar
    titleBar.addEventListener('mousedown', (e) => {
      if (e.target.closest('.m98-x')) return;
      const r = box.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
      const mv = (ev) => { box.style.left = (ev.clientX - ox) + 'px'; box.style.top = (ev.clientY - oy) + 'px'; };
      const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
      addEventListener('mousemove', mv); addEventListener('mouseup', up);
    });
    const keyHandlers = [];
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
      for (const fn of keyHandlers) if (fn(e)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
      e.stopImmediatePropagation(); // keep Discord from reacting while a dialog is up
    }
    document.addEventListener('keydown', onKey, true);
    const show = () => {
      document.body.append(modal);
      const r = box.getBoundingClientRect();
      box.style.left = Math.round((innerWidth - r.width) / 2) + 'px';
      box.style.top = Math.round((innerHeight - r.height) / 3) + 'px';
    };
    return { modal, box, close, show, keyHandlers };
  }
  function dialog({ title, text, icon, buttons }) {
    const d = dialogShell(title);
    const body = h('div', { class: 'm98-dbody' },
      icon ? h('img', { src: ICONS[icon], width: 32, height: 32, alt: '' }) : null,
      h('div', { style: 'white-space:pre-line;padding-top:2px' }, text));
    let defBtn = null;
    const btns = h('div', { class: 'm98-dbtns' }, buttons.map((b) => {
      const { nodes, key } = accelLabel(b.label);
      const el = h('button', { class: 'm98-btn', onclick: () => { d.close(); b.act && b.act(); } }, nodes);
      if (b.def) defBtn = el;
      if (key) d.keyHandlers.push((e) => { if (e.key.toLowerCase() === key && !e.ctrlKey) { el.click(); return true; } return false; });
      return el;
    }));
    d.keyHandlers.push((e) => { if (e.key === 'Enter' && document.activeElement && document.activeElement.classList.contains('m98-btn')) { document.activeElement.click(); return true; } return false; });
    d.box.append(body, btns);
    d.show();
    (defBtn || btns.firstChild).focus();
  }
  function organizeFavoritesDialog() {
    const d = dialogShell('Organize Favorites');
    let sel = -1;
    const list = h('div', { class: 'm98-list' });
    const render = () => {
      list.replaceChildren(...(cfg.favorites.length ? cfg.favorites.map((f, i) =>
        h('div', { class: i === sel ? 'sel' : '', title: f.path,
                   onclick: () => { sel = i; render(); },
                   ondblclick: () => { d.close(); navigate(f.path); } }, f.title))
        : [h('div', { style: 'color:#808080' }, '(no favorites — use Favorites > Add to Favorites)')]));
    };
    const move = (dir) => {
      if (sel < 0) return;
      const j = sel + dir, favs = cfg.favorites.slice();
      if (j < 0 || j >= favs.length) return;
      [favs[sel], favs[j]] = [favs[j], favs[sel]];
      save('favorites', favs); sel = j; render();
    };
    const side = h('div', { class: 'm98-side' },
      h('button', { class: 'm98-btn', onclick: () => { if (sel >= 0) { const f = cfg.favorites[sel]; d.close(); navigate(f.path); } } }, accelLabel('&Join').nodes),
      h('button', { class: 'm98-btn', onclick: () => move(-1) }, accelLabel('Move &Up').nodes),
      h('button', { class: 'm98-btn', onclick: () => move(1) }, accelLabel('Move &Down').nodes),
      h('button', { class: 'm98-btn', onclick: () => {
        if (sel < 0) return;
        const favs = cfg.favorites.slice(); favs.splice(sel, 1); save('favorites', favs);
        sel = Math.min(sel, favs.length - 1); render();
      } }, accelLabel('&Delete').nodes),
      h('button', { class: 'm98-btn', onclick: d.close }, 'Close'));
    render();
    d.box.append(h('div', { class: 'm98-dbody' }, list, side));
    d.show();
  }

  /* ======================================================================
     Layout: columns, server-list modes, floating user panel
     ====================================================================== */
  const GUILD_NAV = ['nav[aria-label="Servers sidebar"]', 'nav[class*="guilds_"]', '[class*="guilds_"]'];
  const GUILD_ITEM = '[data-list-item-id^="guildsnav___"]';

  function guildNav() { return q(GUILD_NAV); }

  // The channel column is the sibling of the guild nav that contains the channel list / user area.
  function findChanCol() {
    const nav = guildNav();
    if (!nav || !nav.parentElement) return null;
    const inner = q(['section[aria-label="User area"]', 'nav[aria-label*="(server)"]', 'ul[aria-label="Channels"]',
                     '[class*="privateChannels_"]', '[class*="sidebarList_"]', 'div[class^="sidebar_"]', 'div[class*=" sidebar_"]']);
    let el = inner;
    while (el && el.parentElement !== nav.parentElement) el = el.parentElement;
    if (el && el !== nav && el.tagName !== 'HTML') return el;
    const sib = nav.nextElementSibling;
    return (sib && sib.matches && !sib.matches('[class*="page_"]')) ? sib : null;
  }
  function findMembersCol() {
    const list = q(['[data-list-id^="members-"]', '[class*="members_"][role="list"]', 'div[aria-label="Members"]']);
    if (list) {
      const wrap = list.closest('[class*="membersWrap_"], aside');
      if (wrap) return wrap;
    }
    return q(['[class*="membersWrap_"]', 'aside[class*="members"]']);
  }
  function findPanel() {
    // live 2026-11: section.panels_[aria-label="User status and settings"]; older builds: "User area"
    return q(['section[aria-label="User status and settings"]', 'section[aria-label="User area"]',
              'section[class*="panels_"]', '[class*="panels_"]']);
  }
  function mark(el, attr, value) {
    for (const old of document.querySelectorAll(`[${attr}="${value}"]`)) if (old !== el) old.removeAttribute(attr);
    if (el && el.getAttribute(attr) !== value) el.setAttribute(attr, value);
  }

  // ---- server list names (data-m98-name / -unread / -selected / -mention on the .listItem_ row) ----
  // Live DOM (2026-11): server rows carry the name only in data-dnd-name (on an ancestor of the tree
  // item) and in a visually-hidden label ("Unread messages, Venice.ai"); DM rows only in the hidden
  // label ("BikiniZero , 1 unread message") and a tooltip (.guildNameText_); the Home / Add a Server /
  // Discover buttons in aria-label.
  const NAME_SUFFIX = /\s*,\s*(\d+\s+(unread|mention|notification|server|message)s?.*|unread.*|selected.*|folder.*|\d+\s+.*)$/i;
  const NAME_PREFIX = /^\s*(unread messages?|mentions?|selected)\s*,\s*/i;
  function cleanName(s) { return (s || '').replace(NAME_PREFIX, '').replace(NAME_SUFFIX, '').trim(); }
  function hiddenLabel(item) {
    for (const el of item.querySelectorAll('[class*="hiddenVisually_"], [class*="visuallyHidden_"], [class*="srOnly"]')) {
      const t = (el.textContent || '').trim();
      if (t) return t;
    }
    return '';
  }
  function guildName(item, row) {
    const own = cleanName(item.getAttribute('aria-label'));
    if (own) return own;
    const dndEl = item.closest('[data-dnd-name]') || item.querySelector('[data-dnd-name]');
    const dnd = dndEl && dndEl.getAttribute('data-dnd-name');
    if (dnd && dnd.trim()) return dnd.trim();
    const hidden = cleanName(hiddenLabel(item));
    if (hidden) return hidden;
    const tip = row && row.querySelector('[class*="guildNameText_"]');
    if (tip && tip.textContent.trim()) return tip.textContent.trim();
    const inner = item.querySelector('[aria-label], img[alt]');
    if (inner) return cleanName(inner.getAttribute('aria-label') || inner.getAttribute('alt'));
    return '';
  }
  const ROW_ATTRS = ['data-m98-name', 'data-m98-unread', 'data-m98-selected', 'data-m98-mention'];
  function clearRowAttrs(el) { for (const a of ROW_ATTRS) if (el.hasAttribute(a)) el.removeAttribute(a); }
  function setAttrIf(el, attr, value) {   // value === false/null -> remove; idempotent (no React churn)
    if (value === false || value == null) { if (el.hasAttribute(attr)) el.removeAttribute(attr); return; }
    const v = value === true ? '' : String(value);
    if (el.getAttribute(attr) !== v) el.setAttribute(attr, v);
  }
  function markGuilds() {
    const nav = guildNav();
    if (!nav) return;
    const textMode = cfg.guildMode !== 'icons';
    if (!textMode) {
      for (const el of nav.querySelectorAll('[data-m98-name]')) clearRowAttrs(el);
      return;
    }
    for (const item of nav.querySelectorAll(GUILD_ITEM)) {
      const row = item.closest('[class*="listItem_"]') || item.parentElement || item;
      const name = guildName(item, row);
      if (!name) { clearRowAttrs(row); continue; }
      const label = (item.getAttribute('aria-label') || '') + ' ' + hiddenLabel(item);
      const selected = item.getAttribute('aria-selected') === 'true' ||
        /(^|\s)selected_/.test(item.className || '') || !!item.querySelector('[class*="selected_"]') ||
        !!row.querySelector('[class*="blobContainer_"][class*="selected_"], [class*="overlay_"] > [class*="selected_"]');
      // Discord's unread "pill": span.item_.visible_ inside .wrapper_.overlay_ (old DOM: [class*="pill_"] span)
      const pillNew = row.querySelector('[class*="overlay_"] > [class*="visible_"]');
      const pillOld = row.querySelector('[class*="pill_"] span, [class*="pill_"] [class*="item_"]');
      const ph = pillOld ? pillOld.offsetHeight : 0;
      const unread = !selected && (!!pillNew || (ph > 0 && ph < 20) || /\b(unread|mention)/i.test(label));
      const badge = row.querySelector('[class*="numberBadge_"], [class*="lowerBadge_"] [class*="badge_"]');
      const mention = badge && /^\s*\d+\+?\s*$/.test(badge.textContent || '') ? badge.textContent.trim() : null;
      setAttrIf(row, 'data-m98-name', name);
      setAttrIf(row, 'data-m98-selected', selected);
      setAttrIf(row, 'data-m98-unread', unread);
      setAttrIf(row, 'data-m98-mention', mention);
      if (row !== item) clearRowAttrs(item);   // 1.1.0 put them on the tree item (clipped inside the svg)
    }
  }
  // In Names mode the real click target (the tree item inside the hidden icon) is not visible; clicks
  // on the rest of the row are forwarded to it. React listens at the root, so a synthetic click on a
  // display:none element still reaches Discord's handler.
  function forwardRowEvent(e) {
    if (cfg.guildMode === 'icons') return;
    if (e.type === 'click' && e.button !== 0) return;
    if (e.target.closest('[role="treeitem"], [data-list-item-id]')) return;
    const row = e.target.closest('nav[aria-label="Servers sidebar"] [class*="listItem_"][data-m98-name]');
    if (!row) return;
    const item = row.querySelector(GUILD_ITEM);
    if (!item) return;
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'click') { item.click(); return; }
    item.dispatchEvent(new MouseEvent(e.type, { bubbles: true, cancelable: true, composed: true,
      clientX: e.clientX, clientY: e.clientY, button: e.button, buttons: e.buttons }));
  }

  // ---- CSS variables + html classes derived from cfg ----
  let lastLayoutCss = '';
  function applyLayout() {
    const text = cfg.guildMode !== 'icons';
    setState('gl-text', text);
    setState('gl-names', cfg.guildMode === 'names');
    setState('gl-both', cfg.guildMode === 'both');
    const gw = text ? cfg.guildWText : cfg.guildW;
    const guildW = gw != null ? clamp(gw, LIMITS.guildW) : (text ? TEXT_MODE_GUILD_W : null);
    setState('w-guild', guildW != null);
    setState('w-chan', cfg.chanW != null);
    setState('w-members', cfg.membersW != null);
    setState('float', !!cfg.floatPanel);
    setState('panel-min', !!cfg.floatPanel && !!cfg.panelMin);
    const vars = [];
    // Discord's own sidebar/list widths (body inline style / :root), needed to keep the channel list
    // width when only the guild column is resized
    const dcSidebar = document.body && document.body.style.getPropertyValue('--custom-guild-sidebar-width').trim();
    const dcList = getComputedStyle(document.documentElement).getPropertyValue('--custom-guild-list-width').trim();
    if (dcSidebar) vars.push(`--m98-dc-sidebar-w:${dcSidebar}`);
    if (dcList) vars.push(`--m98-dc-list-w:${dcList}`);
    if (guildW != null) vars.push(`--m98-guild-w:${guildW}px`);
    if (cfg.chanW != null) vars.push(`--m98-chan-w:${clamp(cfg.chanW, LIMITS.chanW)}px`);
    if (cfg.membersW != null) vars.push(`--m98-members-w:${clamp(cfg.membersW, LIMITS.membersW)}px`);
    vars.push(`--m98-panel-w:${clamp(cfg.panelW, LIMITS.panelW)}px`);
    if (cfg.panelX != null && cfg.panelY != null) {
      vars.push(`--m98-panel-x:${Math.round(cfg.panelX)}px`, `--m98-panel-y:${Math.round(cfg.panelY)}px`, '--m98-panel-bottom:auto');
    } else {
      vars.push('--m98-panel-x:2px', '--m98-panel-y:auto', '--m98-panel-bottom:2px');
    }
    const css = `html{${vars.join(';')}}`;
    if (css !== lastLayoutCss) { lastLayoutCss = css; injectStyle('mirc98-layout', css); }
    scheduleLayout();
  }

  // ---- overlays: splitters + floating panel title bar ----
  let splitters = null, userwin = null, panelRO = null, roTarget = null;
  const splitEls = {};
  function mountOverlays() {
    if (splitters || !document.body) return;
    splitters = h('div', { id: 'mirc98-splitters' });
    for (const col of ['guild', 'channels', 'members']) {
      splitEls[col] = h('div', { class: 'm98-split', 'data-col': col, title: 'Drag to resize',
                                  onmousedown: (e) => startColumnDrag(e, col) });
      splitters.append(splitEls[col]);
    }
    userwin = h('div', { id: 'mirc98-userwin', onmousedown: startPanelMove },
      h('div', { class: 'm98-wbar', ondblclick: (e) => { if (!e.target.closest('.m98-cbtn')) actions.togglePanelMin(); } },
        h('span', { class: 'm98-wtitle' }, 'User'),
        h('button', { class: 'm98-cbtn rst', title: 'Reset size and position',
                      onmousedown: (e) => e.stopPropagation(), onclick: actions.resetPanel }),
        h('button', { class: 'm98-cbtn min', title: 'Minimize / Restore',
                      onmousedown: (e) => e.stopPropagation(), onclick: actions.togglePanelMin })),
      h('div', { class: 'm98-grip', onmousedown: startPanelResize }));
    document.body.append(splitters, userwin);
    // does the browser accept data: images? (Discord's CSP) – otherwise switch to CSS-drawn glyphs
    const probe = new Image();
    probe.onerror = () => setState('noimg', true);
    probe.src = IMG_DEFAULTS_GLYPH;
  }

  // Is the main app view actually visible (not covered by User Settings / a modal backdrop)?
  function appVisible(nav) {
    const r = nav.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const x = r.left + Math.min(20, r.width / 2), y = r.top + Math.min(60, r.height / 2);
    const el = document.elementFromPoint(x, y);
    if (!el) return false;
    if (nav.contains(el) || el === nav) return true;
    return !!el.closest('#mirc98-userwin, #mirc98-splitters, #mirc98-dragshield, [data-m98-panel], #mirc98-menubar, .m98-menu, .m98-modal');
  }

  let layoutQueued = false;
  function scheduleLayout() {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => { layoutQueued = false; layoutOverlays(); });
  }
  function placeSplit(el, x, top, bottom) {
    if (x == null || bottom - top < 10) { el.classList.remove('show'); return; }
    el.style.left = Math.round(x - 3) + 'px';
    el.style.top = Math.round(top) + 'px';
    el.style.height = Math.round(bottom - top) + 'px';
    el.classList.add('show');
  }
  function layoutOverlays() {
    if (!splitters) return;
    const nav = guildNav();
    if (nav && nav !== guildMOTarget) watchGuilds();   // React re-mounted the server list -> re-mark it
    const visible = nav && appVisible(nav) && !document.querySelector('.m98-modal');
    const chan = findChanCol(), members = findMembersCol(), panel = cfg.floatPanel ? findPanel() : null;
    mark(chan, 'data-m98-col', 'channels');
    mark(members, 'data-m98-col', 'members');
    mark(panel, 'data-m98-panel', '');

    if (!visible) {
      for (const el of Object.values(splitEls)) el.classList.remove('show');
      userwin.classList.remove('show');
      return;
    }
    const rects = {
      guild: nav && !cfg.hideSwitchbar ? nav.getBoundingClientRect() : null,
      channels: chan ? chan.getBoundingClientRect() : null,
      members: members ? members.getBoundingClientRect() : null,
    };
    placeSplit(splitEls.guild, rects.guild && rects.guild.width > 0 ? rects.guild.right : null, rects.guild ? rects.guild.top : 0, rects.guild ? rects.guild.bottom : 0);
    placeSplit(splitEls.channels, rects.channels && rects.channels.width > 0 ? rects.channels.right : null, rects.channels ? rects.channels.top : 0, rects.channels ? rects.channels.bottom : 0);
    placeSplit(splitEls.members, rects.members && rects.members.width > 0 ? rects.members.left : null, rects.members ? rects.members.top : 0, rects.members ? rects.members.bottom : 0);

    // floating panel title bar follows the (fixed-positioned) panel
    if (!panel) { userwin.classList.remove('show'); return; }
    if (roTarget !== panel) {
      if (panelRO) panelRO.disconnect();
      panelRO = new ResizeObserver(scheduleLayout);
      panelRO.observe(panel);
      roTarget = panel;
    }
    let x, y, w, ph;
    if (cfg.panelMin) {
      w = clamp(cfg.panelW, LIMITS.panelW);
      ph = 0;
      if (cfg.panelX != null && cfg.panelY != null) { x = cfg.panelX; y = cfg.panelY; }
      else { x = 2; y = innerHeight - 2; }
    } else {
      const pr = panel.getBoundingClientRect();
      if (pr.width < 1 && pr.height < 1) { userwin.classList.remove('show'); return; }
      x = pr.left; y = pr.top; w = pr.width; ph = pr.height;
      // keep inside the viewport (window resized / panel grew)
      const minTop = chromeTop() + WIN_TOP;
      const nx = Math.min(Math.max(0, x), Math.max(0, innerWidth - w));
      const ny = Math.min(Math.max(minTop, y), Math.max(minTop, innerHeight - ph));
      if (Math.abs(nx - x) > 0.5 || Math.abs(ny - y) > 0.5) {
        save('panelX', nx); save('panelY', ny); applyLayout(); // re-runs layout next frame
        return;
      }
    }
    userwin.style.left = Math.round(x) + 'px';
    userwin.style.top = Math.round(y - WIN_TOP) + 'px';
    userwin.style.width = Math.round(w) + 'px';
    userwin.querySelector('.m98-grip').style.height = Math.round(cfg.panelMin ? WIN_MIN_H : ph + WIN_TOP) + 'px';
    const nick = currentNick();
    const t = userwin.querySelector('.m98-wtitle');
    const title = nick ? 'mIRC - ' + nick : 'User';
    if (t.textContent !== title) t.textContent = title;
    userwin.classList.add('show');
  }
  function chromeTop() { return themeChromeOn() ? 40 : 0; }

  // ---- dragging ----
  function dragSession(e, { move, cursor, onMove, onUp }) {
    e.preventDefault(); e.stopPropagation();
    const shield = h('div', { id: 'mirc98-dragshield', class: move ? 'move' : '' });
    document.body.append(shield);
    setState('dragging', true);
    const x0 = e.clientX, y0 = e.clientY;
    const mv = (ev) => onMove(ev.clientX - x0, ev.clientY - y0, ev);
    const up = (ev) => {
      removeEventListener('mousemove', mv, true); removeEventListener('mouseup', up, true);
      shield.remove();
      setState('dragging', false);
      onUp && onUp(ev.clientX - x0, ev.clientY - y0);
      scheduleLayout();
    };
    addEventListener('mousemove', mv, true); addEventListener('mouseup', up, true);
  }
  function startColumnDrag(e, col) {
    if (e.button !== 0) return;
    const key = col === 'guild' ? (cfg.guildMode !== 'icons' ? 'guildWText' : 'guildW') : col === 'channels' ? 'chanW' : 'membersW';
    const target = col === 'guild' ? guildNav() : col === 'channels' ? findChanCol() : findMembersCol();
    if (!target) return;
    const startW = target.getBoundingClientRect().width;
    const sign = col === 'members' ? -1 : 1; // member list is resized from its left edge
    splitEls[col].classList.add('active');
    let w = startW;
    dragSession(e, {
      onMove: (dx) => { w = clamp(startW + sign * dx, LIMITS[key]); cfg[key] = w; applyLayout(); layoutOverlays(); },
      onUp: () => { splitEls[col].classList.remove('active'); save(key, w); applyLayout(); },
    });
  }
  function startPanelMove(e) {
    if (e.button !== 0 || e.target.closest('.m98-cbtn, .m98-grip')) return;
    const r = userwin.getBoundingClientRect();
    const sx = r.left, sy = r.top + WIN_TOP, w = r.width;
    const panel = findPanel();
    const ph = (!cfg.panelMin && panel) ? panel.getBoundingClientRect().height : 0;
    let x = sx, y = sy;
    dragSession(e, {
      move: true,
      onMove: (dx, dy) => {
        const minTop = chromeTop() + WIN_TOP;
        x = Math.min(Math.max(0, sx + dx), Math.max(0, innerWidth - w));
        y = Math.min(Math.max(minTop, sy + dy), Math.max(minTop, innerHeight - ph));
        cfg.panelX = x; cfg.panelY = y; applyLayout(); layoutOverlays();
      },
      onUp: () => { save('panelX', x); save('panelY', y); applyLayout(); },
    });
  }
  function startPanelResize(e) {
    if (e.button !== 0) return;
    const startW = userwin.getBoundingClientRect().width;
    let w = startW;
    dragSession(e, {
      onMove: (dx) => { w = clamp(startW + dx, LIMITS.panelW); cfg.panelW = w; applyLayout(); layoutOverlays(); },
      onUp: () => { save('panelW', w); applyLayout(); },
    });
  }

  // guild list: names/unread state change through attributes & styles -> re-mark (throttled)
  let guildMO = null, guildMOTarget = null, guildMark = 0;
  function watchGuilds() {
    const nav = guildNav();
    if (!nav || nav === guildMOTarget) return;
    if (guildMO) guildMO.disconnect();
    guildMOTarget = nav;
    guildMO = new MutationObserver(() => {
      if (cfg.guildMode === 'icons' || guildMark) return;
      guildMark = setTimeout(() => { guildMark = 0; markGuilds(); }, 150);
    });
    // (our own data-m98-* writes are not in the filter, so marking never re-triggers itself)
    guildMO.observe(nav, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'aria-label', 'aria-selected', 'data-dnd-name'] });
    markGuilds();
  }

  /* ======================================================================
     Wiring
     ====================================================================== */
  function themeChromeOn() {
    // The Stylus theme exposes its "Fake mIRC title bar + menu bar" option as --fake-chrome (1/0).
    return getComputedStyle(document.documentElement).getPropertyValue('--fake-chrome').trim() === '1';
  }
  function applySwitchbar() {
    setState('no-switchbar', !!cfg.hideSwitchbar);
  }
  function syncMenubar() {
    if (cfg.menubar && themeChromeOn()) mountMenubar(); else unmountMenubar();
  }

  // At document-start the <html> element may not exist yet; wait for it before touching the DOM.
  // Re-assert everything Discord may have undone: html classes (react-helmet rewrites the class
  // attribute on focus/blur), the state attribute, the layout variables, the marks on Discord's nodes.
  function reassert() {
    syncState();
    if (lastLayoutCss) injectStyle('mirc98-layout', lastLayoutCss);
    if (cfg.guildMode !== 'icons') markGuilds();
    scheduleLayout();
  }
  function earlySetup() {
    injectStyle('mirc98-companion', BASE_CSS);
    applyTsClass();
    applySwitchbar();
    applyLayout();
    mo.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['datetime'],
    });
    // html class / state attribute watcher: re-adds our flags whenever they are stripped (idempotent,
    // so our own re-add does not trigger more work than one empty callback)
    new MutationObserver(syncState).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-m98-state'] });
    for (const ev of ['focus', 'blur', 'pageshow']) addEventListener(ev, reassert, true);
    document.addEventListener('visibilitychange', reassert, true);
  }
  if (document.documentElement) earlySetup();
  else {
    const rootWatch = new MutationObserver(() => {
      if (document.documentElement) { rootWatch.disconnect(); earlySetup(); }
    });
    rootWatch.observe(document, { childList: true });
  }

  function onReady() {
    injectStyle('mirc98-companion', BASE_CSS); // re-append in case <head> was replaced
    stampAll(document);
    syncMenubar();
    mountOverlays();
    watchGuilds();
    applyLayout();
    updateTitle();
    // title changes on every channel switch
    const titleEl = document.querySelector('title');
    if (titleEl) new MutationObserver(updateTitle).observe(titleEl, { childList: true, characterData: true, subtree: true });
    // follow the Stylus option being toggled, Stylus being disabled, SPA <title> replacement, etc.
    setInterval(() => {
      syncMenubar();
      watchGuilds();
      injectStyle('mirc98-companion', BASE_CSS);
      if (lastLayoutCss) injectStyle('mirc98-layout', lastLayoutCss);
      if (location.pathname !== lastPath) updateTitle();
    }, 1500);
    // overlays track Discord's layout (columns move when panels open/close, member list toggles, etc.)
    setInterval(layoutOverlays, 300);
    document.addEventListener('scroll', scheduleLayout, true);
    for (const ev of ['click', 'contextmenu', 'auxclick']) document.addEventListener(ev, forwardRowEvent, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady, { once: true });
  else onReady();

  try {
    GM_registerMenuCommand('Toggle 24-hour timestamps', () => { save('timestamps24h', !cfg.timestamps24h); restampEverything(); });
    GM_registerMenuCommand('Toggle working menu bar', () => { save('menubar', !cfg.menubar); syncMenubar(); });
    GM_registerMenuCommand('Toggle Alt+letter menu keys', () => save('altKeys', !cfg.altKeys));
    GM_registerMenuCommand('Server list: cycle Icons / Names / Icons + Names', () => {
      const order = ['icons', 'names', 'both'];
      actions.guildMode(order[(order.indexOf(cfg.guildMode) + 1) % order.length]);
    });
    GM_registerMenuCommand('Toggle floating user panel', actions.toggleFloatPanel);
    GM_registerMenuCommand('Reset column widths', actions.resetColumns);
    GM_registerMenuCommand('Reset user panel size/position', actions.resetPanel);
    GM_registerMenuCommand('Reset whole layout (columns + user panel)', actions.resetLayout);
  } catch (e) { /* not in Tampermonkey */ }
})();
