import type { Channel, Entry, NoteEntry, PresetLogEntry, PersistedState, Preset, PresetField } from './types';

const STORAGE_KEY = 'log-app-v1';

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export class Store {
  private state: PersistedState;

  constructor() {
    this.state = this.load();
  }

  private load(): PersistedState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as PersistedState;
    } catch {
      // ignore
    }
    return { channels: [], entries: [] };
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  getChannels(): Channel[] {
    return this.state.channels;
  }

  getChannel(id: string): Channel | undefined {
    return this.state.channels.find(c => c.id === id);
  }

  createChannel(name: string): Channel {
    const channel: Channel = {
      id: uid(),
      name: name.trim(),
      presets: [],
      createdAt: Date.now(),
    };
    this.state.channels.push(channel);
    this.save();
    return channel;
  }

  updateChannelName(id: string, name: string): void {
    const channel = this.state.channels.find(c => c.id === id);
    if (!channel) return;
    channel.name = name.trim();
    this.save();
  }

  deleteChannel(id: string): void {
    this.state.channels = this.state.channels.filter(c => c.id !== id);
    this.state.entries = this.state.entries.filter(e => e.channelId !== id);
    this.save();
  }

  addPreset(channelId: string, name: string, fields: Omit<PresetField, 'id'>[]): Preset {
    const channel = this.state.channels.find(c => c.id === channelId);
    if (!channel) throw new Error('Channel not found');
    const preset: Preset = {
      id: uid(),
      name: name.trim(),
      fields: fields.map(f => ({ ...f, id: uid() })),
    };
    channel.presets.push(preset);
    this.save();
    return preset;
  }

  updatePreset(channelId: string, presetId: string, name: string, fields: PresetField[]): void {
    const channel = this.state.channels.find(c => c.id === channelId);
    if (!channel) return;
    const preset = channel.presets.find(p => p.id === presetId);
    if (!preset) return;
    preset.name = name.trim();
    preset.fields = fields;
    this.save();
  }

  deletePreset(channelId: string, presetId: string): void {
    const channel = this.state.channels.find(c => c.id === channelId);
    if (!channel) return;
    channel.presets = channel.presets.filter(p => p.id !== presetId);
    this.save();
  }

  getEntries(channelId: string): Entry[] {
    return this.state.entries
      .filter(e => e.channelId === channelId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  addNoteEntry(channelId: string, text: string): Entry {
    const entry: NoteEntry = {
      id: uid(),
      channelId,
      type: 'note',
      text: text.trim(),
      createdAt: Date.now(),
    };
    this.state.entries.push(entry);
    this.save();
    return entry;
  }

  addPresetLogEntry(
    channelId: string,
    presetId: string,
    presetName: string,
    values: Array<{ fieldId: string; fieldName: string; value: string; unit: string }>
  ): Entry {
    const entry: PresetLogEntry = {
      id: uid(),
      channelId,
      type: 'preset-log',
      presetId,
      presetName,
      values,
      createdAt: Date.now(),
    };
    this.state.entries.push(entry);
    this.save();
    return entry;
  }

  deleteEntry(id: string): void {
    this.state.entries = this.state.entries.filter(e => e.id !== id);
    this.save();
  }
}
