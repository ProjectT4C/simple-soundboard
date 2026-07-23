/**
 * Simple Soundboard — the button-grid window.
 *
 * Built on ApplicationV2 + HandlebarsApplicationMixin, the standard v12+
 * pattern for new windows: DEFAULT_OPTIONS.actions maps data-action
 * attributes in the template straight to handler methods below.
 */

import {
  MODULE_ID,
  getAllTaggedSounds,
  getAllQuickSounds,
  getAllTags,
  getAllPlayingSounds,
  getPresets,
  getQuickSounds,
  findPlaylistSound,
  triggerLibrarySound,
  triggerQuickSound,
  stopLibrarySound,
  stopAllSounds,
  tagLibrarySound,
  tagQuickSound,
  upsertQuickSound,
  deleteQuickSound,
  savePreset,
  recallPreset,
  deletePreset
} from "./soundboard-data.js";

export class SoundboardApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: "simple-soundboard-app",
    tag: "div",
    window: { title: "Soundboard", icon: "fa-solid fa-music", resizable: true },
    position: { width: 640, height: 520 },
    actions: {
      triggerSound: SoundboardApp.prototype._onTriggerSound,
      triggerQuick: SoundboardApp.prototype._onTriggerQuick,
      filterTag: SoundboardApp.prototype._onFilterTag,
      editTags: SoundboardApp.prototype._onEditTags,
      addQuickSound: SoundboardApp.prototype._onAddQuickSound,
      deleteQuickSound: SoundboardApp.prototype._onDeleteQuickSound,
      stopPlaying: SoundboardApp.prototype._onStopPlaying,
      stopAllPlaying: SoundboardApp.prototype._onStopAllPlaying,
      savePreset: SoundboardApp.prototype._onSavePreset,
      recallPreset: SoundboardApp.prototype._onRecallPreset,
      deletePreset: SoundboardApp.prototype._onDeletePreset
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/soundboard.hbs` }
  };

  constructor(options = {}) {
    super(options);
    this._filter = null;
  }

  async _prepareContext() {
    const filter = this._filter;
    const matchesFilter = (tags) => !filter || tags.includes(filter);

    const sounds = getAllTaggedSounds().filter((s) => matchesFilter(s.tags));
    const quickSounds = getAllQuickSounds().filter((s) => matchesFilter(s.tags));
    const presets = Object.keys(getPresets()).sort();

    return {
      tags: getAllTags(),
      activeFilter: filter,
      sounds,
      quickSounds,
      presets,
      playing: getAllPlayingSounds(),
      isGM: game.user.isGM
    };
  }

  async _onTriggerSound(event, target) {
    const { playlistId, soundId } = target.dataset;
    await triggerLibrarySound(playlistId, soundId);
    this.render();
  }

  async _onTriggerQuick(event, target) {
    const { quickId } = target.dataset;
    const def = getQuickSounds().find((q) => q.id === quickId);
    if (def) await triggerQuickSound(def);
  }

  _onFilterTag(event, target) {
    const { tag } = target.dataset;
    this._filter = this._filter === tag ? null : tag;
    this.render();
  }

  async _onEditTags(event, target) {
    if (!game.user.isGM) return;
    const { playlistId, soundId, quickId } = target.dataset;

    const current = quickId
      ? (getQuickSounds().find((q) => q.id === quickId)?.tags ?? [])
      : (findPlaylistSound(playlistId, soundId).sound?.getFlag(MODULE_ID, "tags") ?? []);

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: "Edit Tags" },
      content: `
        <div class="form-group">
          <label>Tags (comma-separated)</label>
          <input type="text" name="tags" value="${foundry.utils.escapeHTML(current.join(", "))}" autofocus>
        </div>`,
      buttons: [
        {
          action: "save",
          label: "Save",
          default: true,
          callback: (evt, button) => button.form.elements.tags.value
        },
        { action: "cancel", label: "Cancel", callback: () => null }
      ],
      rejectClose: false
    });

    if (!result || result === "cancel") return;
    const tags = result.split(",").map((t) => t.trim()).filter(Boolean);

    if (quickId) await tagQuickSound(quickId, tags);
    else await tagLibrarySound(playlistId, soundId, tags);

    this.render();
  }

  async _onAddQuickSound() {
    if (!game.user.isGM) return;

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: "Add Quick Sound" },
      content: `
        <div class="form-group">
          <label>Label</label>
          <input type="text" name="label" autofocus>
        </div>
        <div class="form-group">
          <label>Audio file</label>
          <file-picker name="path" type="audio"></file-picker>
        </div>`,
      buttons: [
        {
          action: "save",
          label: "Add",
          default: true,
          callback: (evt, button) => ({
            label: button.form.elements.label.value,
            path: button.form.elements.path.value
          })
        },
        { action: "cancel", label: "Cancel", callback: () => null }
      ],
      rejectClose: false
    });

    if (!result || result === "cancel" || !result.label || !result.path) return;

    await upsertQuickSound({
      id: foundry.utils.randomID(),
      label: result.label,
      path: result.path,
      tags: [],
      volume: 0.8
    });

    this.render();
  }

  async _onDeleteQuickSound(event, target) {
    if (!game.user.isGM) return;
    await deleteQuickSound(target.dataset.quickId);
    this.render();
  }

  async _onStopPlaying(event, target) {
    if (!game.user.isGM) return;
    const { playlistId, soundId } = target.dataset;
    await stopLibrarySound(playlistId, soundId);
    this.render();
  }

  async _onStopAllPlaying() {
    if (!game.user.isGM) return;
    await stopAllSounds();
    this.render();
  }

  async _onSavePreset() {
    if (!game.user.isGM) return;

    const name = await foundry.applications.api.DialogV2.wait({
      window: { title: "Save Preset" },
      content: `
        <div class="form-group">
          <label>Preset name</label>
          <input type="text" name="name" autofocus>
        </div>`,
      buttons: [
        {
          action: "save",
          label: "Save",
          default: true,
          callback: (evt, button) => button.form.elements.name.value
        },
        { action: "cancel", label: "Cancel", callback: () => null }
      ],
      rejectClose: false
    });

    if (!name || name === "cancel") return;
    await savePreset(name);
    this.render();
  }

  _getSelectedPresetName() {
    return this.element.querySelector("#soundboard-preset-select")?.value ?? null;
  }

  async _onRecallPreset() {
    if (!game.user.isGM) return;
    const name = this._getSelectedPresetName();
    if (!name) return;
    await recallPreset(name);
    this.render();
  }

  async _onDeletePreset() {
    if (!game.user.isGM) return;
    const name = this._getSelectedPresetName();
    if (!name) return;
    await deletePreset(name);
    this.render();
  }
}
