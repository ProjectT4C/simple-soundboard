/**
 * Simple Soundboard — data layer.
 *
 * No UI in this file. Everything here reads/writes real Foundry documents
 * (Playlist/PlaylistSound flags, world settings) so the soundboard app is
 * just a view onto native state, never a shadow copy of it.
 */

export const MODULE_ID = "simple-soundboard";

export function getQuickSounds() {
  return game.settings.get(MODULE_ID, "quickSounds");
}

async function setQuickSounds(list) {
  await game.settings.set(MODULE_ID, "quickSounds", list);
}

export function getPresets() {
  return game.settings.get(MODULE_ID, "presets");
}

async function setPresets(presets) {
  await game.settings.set(MODULE_ID, "presets", presets);
}

/** All PlaylistSound documents across every Playlist that carry our tag flag. */
export function getAllTaggedSounds() {
  const showUntagged = game.settings.get(MODULE_ID, "showUntagged");
  const records = [];

  for (const playlist of game.playlists.contents) {
    for (const sound of playlist.sounds.contents) {
      const tags = sound.getFlag(MODULE_ID, "tags") ?? [];
      if (!tags.length && !showUntagged) continue;

      records.push({
        kind: "library",
        playlistId: playlist.id,
        playlistName: playlist.name,
        soundId: sound.id,
        name: sound.name,
        tags,
        loop: !!sound.repeat,
        playing: !!sound.playing,
        volume: sound.volume
      });
    }
  }

  return records;
}

export function getAllQuickSounds() {
  return getQuickSounds().map((entry) => ({
    kind: "quick",
    id: entry.id,
    label: entry.label,
    path: entry.path,
    tags: entry.tags ?? [],
    volume: entry.volume ?? 0.8
  }));
}

export function getAllTags() {
  const tags = new Set();
  for (const record of getAllTaggedSounds()) record.tags.forEach((t) => tags.add(t));
  for (const record of getAllQuickSounds()) record.tags.forEach((t) => tags.add(t));
  return Array.from(tags).sort();
}

export function findPlaylistSound(playlistId, soundId) {
  const playlist = game.playlists.get(playlistId);
  const sound = playlist?.sounds.get(soundId);
  return { playlist, sound };
}

/** Play/stop a real Playlist track — native state stays authoritative. */
export async function triggerLibrarySound(playlistId, soundId) {
  const { playlist, sound } = findPlaylistSound(playlistId, soundId);
  if (!playlist || !sound) return;

  if (sound.playing) await playlist.stopSound(sound);
  else await playlist.playSound(sound);
}

/** Fire a one-off SFX that isn't backed by any Playlist document. */
export async function triggerQuickSound(quickSoundDef) {
  await foundry.audio.AudioHelper.play(
    { src: quickSoundDef.path, volume: quickSoundDef.volume ?? 0.8, loop: false, autoplay: true },
    true
  );
}

/** GM-only: set the tag list on an existing PlaylistSound. */
export async function tagLibrarySound(playlistId, soundId, tags) {
  if (!game.user.isGM) return;
  const { sound } = findPlaylistSound(playlistId, soundId);
  if (!sound) return;
  await sound.setFlag(MODULE_ID, "tags", tags);
}

/** GM-only: add/update a quick sound definition. */
export async function upsertQuickSound(def) {
  if (!game.user.isGM) return;
  const list = foundry.utils.deepClone(getQuickSounds());
  const index = list.findIndex((entry) => entry.id === def.id);
  if (index >= 0) list[index] = def;
  else list.push(def);
  await setQuickSounds(list);
}

export async function tagQuickSound(id, tags) {
  if (!game.user.isGM) return;
  const list = foundry.utils.deepClone(getQuickSounds());
  const entry = list.find((e) => e.id === id);
  if (!entry) return;
  entry.tags = tags;
  await setQuickSounds(list);
}

export async function deleteQuickSound(id) {
  if (!game.user.isGM) return;
  const list = getQuickSounds().filter((entry) => entry.id !== id);
  await setQuickSounds(list);
}

/** Snapshot every currently-playing library sound as a named preset. */
export async function savePreset(name) {
  if (!game.user.isGM) return;
  const snapshot = [];
  for (const playlist of game.playlists.contents) {
    for (const sound of playlist.sounds.contents) {
      if (sound.playing) {
        snapshot.push({ playlistId: playlist.id, soundId: sound.id, volume: sound.volume });
      }
    }
  }

  const presets = foundry.utils.deepClone(getPresets());
  presets[name] = snapshot;
  await setPresets(presets);
}

export async function deletePreset(name) {
  if (!game.user.isGM) return;
  const presets = foundry.utils.deepClone(getPresets());
  delete presets[name];
  await setPresets(presets);
}

/** Recall a preset: stop anything not in it, start/adjust anything that is. */
export async function recallPreset(name) {
  if (!game.user.isGM) return;
  const presets = getPresets();
  const target = presets[name];
  if (!target) return;

  const targetKeys = new Set(target.map((e) => `${e.playlistId}.${e.soundId}`));

  for (const playlist of game.playlists.contents) {
    for (const sound of playlist.sounds.contents) {
      const key = `${playlist.id}.${sound.id}`;
      if (sound.playing && !targetKeys.has(key)) {
        await playlist.stopSound(sound);
      }
    }
  }

  for (const entry of target) {
    const { playlist, sound } = findPlaylistSound(entry.playlistId, entry.soundId);
    if (!playlist || !sound) continue;

    if (sound.volume !== entry.volume) {
      await sound.update({ volume: entry.volume });
    }
    if (!sound.playing) {
      await playlist.playSound(sound);
    }
  }
}
