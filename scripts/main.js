/**
 * Simple Soundboard
 *
 * Adds a one-click button grid on top of Foundry's existing Playlist/Sound
 * system: tag sounds you've already imported, trigger them from a grid
 * instead of hunting through the Playlists sidebar, and save/recall named
 * scene presets (which tracks were playing, at what volume).
 *
 * Tags live as document flags on your existing PlaylistSound entries, so
 * importing audio still works exactly like vanilla Foundry — this module
 * only adds metadata and a trigger UI on top.
 *
 * If the "Open Soundboard" button doesn't appear in the Playlists sidebar
 * header, open devtools, inspect the header's button row, and add the
 * matching selector to HEADER_SELECTORS below.
 */

import { MODULE_ID, tagLibrarySound, savePreset, recallPreset } from "./soundboard-data.js";
import { SoundboardApp } from "./soundboard-app.js";

const HEADER_SELECTORS = [
  ".directory-header .header-actions",
  ".directory-header .action-buttons",
  ".directory-footer .action-buttons"
];

let soundboardApp = null;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "quickSounds", {
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  game.settings.register(MODULE_ID, "presets", {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MODULE_ID, "showUntagged", {
    scope: "client",
    config: false,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", () => {
  const module = game.modules.get(MODULE_ID);
  if (module) {
    module.api = {
      openSoundboard,
      tagLibrarySound,
      savePreset,
      recallPreset
    };
  }
});

function openSoundboard() {
  if (!soundboardApp) soundboardApp = new SoundboardApp();
  soundboardApp.render(true);
}

function findHeaderActions(root) {
  for (const selector of HEADER_SELECTORS) {
    const found = root.querySelector(selector);
    if (found) return found;
  }
  return null;
}

function onRenderPlaylistDirectory(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0] ?? html;
  if (!root) return;

  if (root.querySelector(".simple-soundboard-open")) return;

  const actions = findHeaderActions(root);
  if (!actions) {
    console.warn(`${MODULE_ID} | Could not find the Playlists header actions row. See the comment at the top of main.js.`);
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "simple-soundboard-open";
  button.innerHTML = `<i class="fa-solid fa-music"></i> Soundboard`;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    openSoundboard();
  });
  actions.appendChild(button);
}

function onPlaybackStateChanged() {
  if (soundboardApp?.rendered) soundboardApp.render();
}

Hooks.on("renderPlaylistDirectory", onRenderPlaylistDirectory);
Hooks.on("updatePlaylistSound", onPlaybackStateChanged);
Hooks.on("updatePlaylist", onPlaybackStateChanged);
Hooks.on("deletePlaylistSound", onPlaybackStateChanged);
