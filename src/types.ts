export interface Channel {
  id: string;
  name: string;
  presets: Preset[];
  createdAt: number;
}

export interface Preset {
  id: string;
  name: string;
  fields: PresetField[];
}

export interface PresetField {
  id: string;
  name: string;
  type: 'text' | 'number';
  unit: string;
}

export interface NoteEntry {
  id: string;
  channelId: string;
  type: 'note';
  text: string;
  createdAt: number;
}

export interface PresetLogEntry {
  id: string;
  channelId: string;
  type: 'preset-log';
  presetId: string;
  presetName: string;
  values: Array<{ fieldId: string; fieldName: string; value: string; unit: string }>;
  createdAt: number;
}

export type Entry = NoteEntry | PresetLogEntry;

export interface PersistedState {
  channels: Channel[];
  entries: Entry[];
}

export type Modal =
  | null
  | { type: 'create-channel' }
  | { type: 'preset-log'; preset: Preset }
  | { type: 'channel-settings' }
  | { type: 'edit-preset'; preset: Preset | null };
