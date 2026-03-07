import { Store, uid } from './store';
import type { Channel, Entry, Modal, PresetField } from './types';

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function sameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export class App {
  private store: Store;
  private root: HTMLElement;
  private activeChannelId: string | null = null;
  private modal: Modal = null;

  private editingPresetFields: PresetField[] = [];
  private editingPresetName: string = '';
  private sidebarOpen: boolean = false;

  constructor(root: HTMLElement) {
    this.store = new Store();
    this.root = root;

    const channels = this.store.getChannels();
    if (channels.length > 0) {
      this.activeChannelId = channels[0].id;
    }

    this.render();
    this.attachListeners();
  }

  private render(): void {
    const channels = this.store.getChannels();
    const activeChannel = this.activeChannelId
      ? this.store.getChannel(this.activeChannelId) ?? null
      : null;

    this.root.innerHTML = `
      <div class="layout ${this.sidebarOpen ? 'sidebar-open' : ''}">
        ${this.renderSidebar(channels, activeChannel)}
        <div class="main">
          ${activeChannel ? this.renderChannelView(activeChannel) : this.renderEmptyState()}
        </div>
        ${this.modal ? this.renderModal(activeChannel) : ''}
        ${this.sidebarOpen ? '<div class="sidebar-backdrop" data-action="close-sidebar"></div>' : ''}
      </div>
    `;

    if (activeChannel && !this.modal) {
      this.scrollFeedToBottom();
    }

    if (this.modal?.type === 'create-channel') {
      const input = this.root.querySelector<HTMLInputElement>('#modal-channel-name');
      input?.focus();
    }
    if (this.modal?.type === 'preset-log') {
      const first = this.root.querySelector<HTMLInputElement>('.preset-log-field');
      first?.focus();
    }
    if (this.modal?.type === 'edit-preset') {
      const input = this.root.querySelector<HTMLInputElement>('#edit-preset-name');
      input?.focus();
    }
  }

  private renderSidebar(channels: Channel[], active: Channel | null): string {
    return `
      <aside class="sidebar">
        <div class="sidebar-header">
          <span class="app-logo">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="16" height="16" rx="3" fill="currentColor" opacity="0.15"/>
              <path d="M5 7h10M5 10h10M5 13h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="app-name">Log</span>
        </div>
        <nav class="channel-list">
          ${channels.map(c => `
            <button
              class="channel-item ${active?.id === c.id ? 'active' : ''}"
              data-action="select-channel"
              data-channel-id="${c.id}"
            >
              <span class="channel-dot"></span>
              <span class="channel-name">${esc(c.name)}</span>
            </button>
          `).join('')}
        </nav>
        <button class="new-channel-btn" data-action="open-create-channel">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          New channel
        </button>
      </aside>
    `;
  }

  private renderEmptyState(): string {
    return `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect x="4" y="4" width="32" height="32" rx="8" fill="#E0E7FF"/>
            <path d="M12 16h16M12 20h16M12 24h10" stroke="#6366F1" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <h2>No channel selected</h2>
        <p>Create a channel to start logging</p>
        <button class="btn btn-primary" data-action="open-create-channel">Create a channel</button>
      </div>
    `;
  }

  private renderChannelView(channel: Channel): string {
    const entries = this.store.getEntries(channel.id);
    return `
      <div class="channel-view">
        <header class="channel-header">
          <button class="menu-btn" data-action="toggle-sidebar" aria-label="Menu">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
          <h1 class="channel-title">${esc(channel.name)}</h1>
          <button class="settings-btn" data-action="open-settings" aria-label="Settings">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="2.5" stroke="currentColor" stroke-width="1.5"/>
              <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.697 3.697l1.414 1.414M12.889 12.889l1.414 1.414M3.697 14.303l1.414-1.414M12.889 5.111l1.414-1.414" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </header>

        <div class="feed" id="entry-feed">
          ${entries.length === 0 ? this.renderFeedEmpty() : this.renderEntries(entries)}
        </div>

        <div class="input-area">
          ${channel.presets.length > 0 ? `
            <div class="preset-strip">
              ${channel.presets.map(p => `
                <button class="preset-pill" data-action="open-preset-log" data-preset-id="${p.id}">
                  ${esc(p.name)}
                </button>
              `).join('')}
            </div>
          ` : ''}
          <form class="note-form" data-action="submit-note">
            <textarea
              class="note-input"
              placeholder="Add a note…"
              rows="1"
              id="note-input"
            ></textarea>
            <button type="submit" class="send-btn" aria-label="Add note">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 13V3M3 8l5-5 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </form>
        </div>
      </div>
    `;
  }

  private renderFeedEmpty(): string {
    return `
      <div class="feed-empty">
        <p>Nothing logged yet. Add a note or use a preset below.</p>
      </div>
    `;
  }

  private renderEntries(entries: Entry[]): string {
    let html = '';
    let lastDay: number | null = null;

    for (const entry of entries) {
      if (lastDay === null || !sameDay(lastDay, entry.createdAt)) {
        html += `<div class="day-divider"><span>${formatDate(entry.createdAt)}</span></div>`;
        lastDay = entry.createdAt;
      }
      html += this.renderEntry(entry);
    }

    return html;
  }

  private renderEntry(entry: Entry): string {
    const time = formatTime(entry.createdAt);
    if (entry.type === 'note') {
      return `
        <div class="entry entry-note" data-entry-id="${entry.id}">
          <div class="entry-body">
            <p class="entry-text">${esc(entry.text).replace(/\n/g, '<br>')}</p>
          </div>
          <div class="entry-meta">
            <span class="entry-time">${time}</span>
            <button class="entry-delete" data-action="delete-entry" data-entry-id="${entry.id}" aria-label="Delete">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    } else {
      const valueStr = entry.values
        .map(v => `<span class="preset-value"><span class="preset-field-name">${esc(v.fieldName)}</span> <strong>${esc(v.value)}${v.unit ? `<span class="preset-unit"> ${esc(v.unit)}</span>` : ''}</strong></span>`)
        .join('');
      return `
        <div class="entry entry-preset" data-entry-id="${entry.id}">
          <div class="entry-body">
            <span class="entry-preset-name">${esc(entry.presetName)}</span>
            <div class="preset-values">${valueStr}</div>
          </div>
          <div class="entry-meta">
            <span class="entry-time">${time}</span>
            <button class="entry-delete" data-action="delete-entry" data-entry-id="${entry.id}" aria-label="Delete">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    }
  }

  private renderModal(channel: Channel | null): string {
    if (!this.modal) return '';

    if (this.modal.type === 'create-channel') {
      return `
        <div class="overlay" data-action="close-modal">
          <div class="modal" data-stop-propagation>
            <h2 class="modal-title">New channel</h2>
            <form data-action="submit-create-channel">
              <label class="field-label" for="modal-channel-name">Channel name</label>
              <input
                id="modal-channel-name"
                class="field-input"
                type="text"
                placeholder="e.g. Liam sickness"
                autocomplete="off"
              />
              <div class="modal-actions">
                <button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    if (this.modal.type === 'preset-log') {
      const preset = this.modal.preset;
      return `
        <div class="overlay" data-action="close-modal">
          <div class="modal" data-stop-propagation>
            <h2 class="modal-title">${esc(preset.name)}</h2>
            <form data-action="submit-preset-log" data-preset-id="${preset.id}">
              ${preset.fields.length === 0 ? `
                <p class="modal-hint">No fields defined. Add fields in channel settings.</p>
              ` : preset.fields.map((f, i) => `
                <div class="field-row">
                  <label class="field-label" for="preset-field-${f.id}">${esc(f.name)}${f.unit ? ` <span class="field-unit-hint">(${esc(f.unit)})</span>` : ''}</label>
                  <input
                    id="preset-field-${f.id}"
                    class="field-input preset-log-field"
                    type="${f.type === 'number' ? 'number' : 'text'}"
                    placeholder="${f.type === 'number' ? '0' : '…'}"
                    data-field-id="${f.id}"
                    data-field-name="${esc(f.name)}"
                    data-field-unit="${esc(f.unit)}"
                    ${i === 0 ? 'autofocus' : ''}
                    autocomplete="off"
                    inputmode="${f.type === 'number' ? 'decimal' : 'text'}"
                  />
                </div>
              `).join('')}
              <div class="modal-actions">
                <button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button>
                <button type="submit" class="btn btn-primary" ${preset.fields.length === 0 ? 'disabled' : ''}>Log</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    if (this.modal.type === 'channel-settings' && channel) {
      return `
        <div class="overlay" data-action="close-modal">
          <div class="settings-panel" data-stop-propagation>
            <div class="settings-header">
              <h2 class="settings-title">Settings</h2>
              <button class="icon-btn" data-action="close-modal" aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M1 1l14 14M15 1L1 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </button>
            </div>

            <div class="settings-section">
              <label class="field-label" for="settings-channel-name">Channel name</label>
              <div class="inline-edit-row">
                <input
                  id="settings-channel-name"
                  class="field-input"
                  type="text"
                  value="${esc(channel.name)}"
                  autocomplete="off"
                />
                <button class="btn btn-sm btn-primary" data-action="save-channel-name">Save</button>
              </div>
            </div>

            <div class="settings-section">
              <div class="settings-section-header">
                <h3 class="settings-section-title">Presets</h3>
                <button class="btn btn-sm btn-ghost" data-action="open-edit-preset" data-preset-id="">
                  + Add preset
                </button>
              </div>
              ${channel.presets.length === 0 ? `
                <p class="settings-empty">No presets yet. Add one to enable quick logging.</p>
              ` : channel.presets.map(p => `
                <div class="preset-row">
                  <div class="preset-row-info">
                    <span class="preset-row-name">${esc(p.name)}</span>
                    <span class="preset-row-fields">${p.fields.length === 0 ? 'No fields' : p.fields.map(f => f.name + (f.unit ? ` (${f.unit})` : '')).join(', ')}</span>
                  </div>
                  <div class="preset-row-actions">
                    <button class="icon-btn" data-action="open-edit-preset" data-preset-id="${p.id}" aria-label="Edit preset">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M9.5 1.5l3 3L4 13H1v-3L9.5 1.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                      </svg>
                    </button>
                    <button class="icon-btn icon-btn-danger" data-action="delete-preset" data-preset-id="${p.id}" aria-label="Delete preset">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M1 3.5h12M5 3.5V2h4v1.5M2.5 3.5l.9 8.5h5.2l.9-8.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>

            <div class="settings-section settings-danger">
              <button class="btn btn-danger-outline" data-action="delete-channel">Delete channel</button>
            </div>
          </div>
        </div>
      `;
    }

    if (this.modal.type === 'edit-preset' && channel) {
      const isNew = !this.modal.preset;
      return `
        <div class="overlay" data-action="close-modal">
          <div class="modal modal-wide" data-stop-propagation>
            <h2 class="modal-title">${isNew ? 'New preset' : 'Edit preset'}</h2>
            <form data-action="submit-edit-preset">
              <label class="field-label" for="edit-preset-name">Preset name</label>
              <input
                id="edit-preset-name"
                class="field-input"
                type="text"
                placeholder="e.g. Calpol"
                value="${esc(this.editingPresetName)}"
                autocomplete="off"
              />

              <div class="preset-fields-section">
                <div class="preset-fields-header">
                  <span class="field-label" style="margin:0">Fields</span>
                  <button type="button" class="btn btn-sm btn-ghost" data-action="add-preset-field">+ Add field</button>
                </div>
                ${this.editingPresetFields.length === 0 ? `
                  <p class="settings-empty" style="margin-top:8px">No fields — preset will log as a simple marker.</p>
                ` : this.editingPresetFields.map((f, i) => `
                  <div class="field-editor-row" data-field-index="${i}">
                    <input
                      class="field-input field-editor-name"
                      type="text"
                      placeholder="Field name"
                      value="${esc(f.name)}"
                      data-action="update-field-name"
                      data-field-index="${i}"
                      autocomplete="off"
                    />
                    <select
                      class="field-select"
                      data-action="update-field-type"
                      data-field-index="${i}"
                    >
                      <option value="text" ${f.type === 'text' ? 'selected' : ''}>Text</option>
                      <option value="number" ${f.type === 'number' ? 'selected' : ''}>Number</option>
                    </select>
                    <input
                      class="field-input field-editor-unit"
                      type="text"
                      placeholder="Unit"
                      value="${esc(f.unit)}"
                      data-action="update-field-unit"
                      data-field-index="${i}"
                      autocomplete="off"
                    />
                    <button type="button" class="icon-btn icon-btn-danger" data-action="remove-preset-field" data-field-index="${i}" aria-label="Remove field">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      </svg>
                    </button>
                  </div>
                `).join('')}
              </div>

              <div class="modal-actions">
                <button type="button" class="btn btn-ghost" data-action="close-to-settings">Cancel</button>
                <button type="submit" class="btn btn-primary">Save preset</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    return '';
  }

  private scrollFeedToBottom(): void {
    requestAnimationFrame(() => {
      const feed = this.root.querySelector('#entry-feed');
      if (feed) feed.scrollTop = feed.scrollHeight;
    });
  }

  private attachListeners(): void {
    this.root.addEventListener('click', e => this.handleClick(e));
    this.root.addEventListener('submit', e => this.handleSubmit(e));
    this.root.addEventListener('input', e => this.handleInput(e));
    this.root.addEventListener('keydown', e => this.handleKeydown(e));
    this.root.addEventListener('change', e => this.handleChange(e));
  }

  private getTarget(e: Event): HTMLElement | null {
    let el = e.target as HTMLElement | null;
    while (el && el !== this.root) {
      if (el.dataset.action) return el;
      el = el.parentElement;
    }
    return null;
  }

  private handleClick(e: MouseEvent): void {
    if ((e.target as HTMLElement)?.dataset.stopPropagation !== undefined) return;

    const target = this.getTarget(e);
    if (!target) return;

    const action = target.dataset.action;

    if (action === 'close-modal') {
      this.modal = null;
      this.render();
      return;
    }

    if (action === 'close-sidebar') {
      this.sidebarOpen = false;
      this.render();
      return;
    }

    if (action === 'toggle-sidebar') {
      this.sidebarOpen = !this.sidebarOpen;
      this.render();
      return;
    }

    if (action === 'select-channel') {
      const id = target.dataset.channelId;
      if (id) {
        this.activeChannelId = id;
        this.sidebarOpen = false;
        this.render();
      }
      return;
    }

    if (action === 'open-create-channel') {
      this.modal = { type: 'create-channel' };
      this.render();
      return;
    }

    if (action === 'open-settings') {
      this.modal = { type: 'channel-settings' };
      this.render();
      return;
    }

    if (action === 'open-preset-log') {
      const presetId = target.dataset.presetId;
      if (!presetId || !this.activeChannelId) return;
      const channel = this.store.getChannel(this.activeChannelId);
      const preset = channel?.presets.find(p => p.id === presetId);
      if (preset) {
        this.modal = { type: 'preset-log', preset };
        this.render();
      }
      return;
    }

    if (action === 'open-edit-preset') {
      const presetId = target.dataset.presetId;
      if (!this.activeChannelId) return;
      const channel = this.store.getChannel(this.activeChannelId);
      if (!channel) return;
      const existing = presetId ? channel.presets.find(p => p.id === presetId) ?? null : null;
      this.editingPresetName = existing?.name ?? '';
      this.editingPresetFields = existing ? existing.fields.map(f => ({ ...f })) : [];
      this.modal = { type: 'edit-preset', preset: existing };
      this.render();
      return;
    }

    if (action === 'close-to-settings') {
      this.modal = { type: 'channel-settings' };
      this.render();
      return;
    }

    if (action === 'save-channel-name') {
      const input = this.root.querySelector<HTMLInputElement>('#settings-channel-name');
      if (input && this.activeChannelId) {
        this.store.updateChannelName(this.activeChannelId, input.value);
        this.render();
      }
      return;
    }

    if (action === 'delete-channel') {
      if (!this.activeChannelId) return;
      const channel = this.store.getChannel(this.activeChannelId);
      if (!channel) return;
      if (!confirm(`Delete channel "${channel.name}"? This cannot be undone.`)) return;
      this.store.deleteChannel(this.activeChannelId);
      const channels = this.store.getChannels();
      this.activeChannelId = channels[0]?.id ?? null;
      this.modal = null;
      this.render();
      return;
    }

    if (action === 'delete-preset') {
      const presetId = target.dataset.presetId;
      if (!presetId || !this.activeChannelId) return;
      this.store.deletePreset(this.activeChannelId, presetId);
      this.modal = { type: 'channel-settings' };
      this.render();
      return;
    }

    if (action === 'delete-entry') {
      const entryId = target.dataset.entryId;
      if (entryId) {
        this.store.deleteEntry(entryId);
        this.render();
      }
      return;
    }

    if (action === 'add-preset-field') {
      this.syncEditingFields();
      this.editingPresetFields.push({ id: uid(), name: '', type: 'text', unit: '' });
      this.render();
      const lastInput = this.root.querySelectorAll<HTMLInputElement>('.field-editor-name');
      lastInput[lastInput.length - 1]?.focus();
      return;
    }

    if (action === 'remove-preset-field') {
      this.syncEditingFields();
      const idx = parseInt(target.dataset.fieldIndex ?? '', 10);
      if (!isNaN(idx)) {
        this.editingPresetFields.splice(idx, 1);
        this.render();
      }
      return;
    }
  }

  private handleSubmit(e: SubmitEvent): void {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const action = form.dataset.action;

    if (action === 'submit-note') {
      const textarea = this.root.querySelector<HTMLTextAreaElement>('#note-input');
      const text = textarea?.value.trim();
      if (text && this.activeChannelId) {
        this.store.addNoteEntry(this.activeChannelId, text);
        if (textarea) textarea.value = '';
        this.render();
        this.scrollFeedToBottom();
      }
      return;
    }

    if (action === 'submit-create-channel') {
      const input = this.root.querySelector<HTMLInputElement>('#modal-channel-name');
      const name = input?.value.trim();
      if (!name) return;
      const channel = this.store.createChannel(name);
      this.activeChannelId = channel.id;
      this.modal = null;
      this.render();
      return;
    }

    if (action === 'submit-preset-log') {
      if (!this.activeChannelId || this.modal?.type !== 'preset-log') return;
      const preset = this.modal.preset;
      const fieldInputs = this.root.querySelectorAll<HTMLInputElement>('.preset-log-field');
      const values = Array.from(fieldInputs).map(input => ({
        fieldId: input.dataset.fieldId ?? '',
        fieldName: input.dataset.fieldName ?? '',
        value: input.value.trim(),
        unit: input.dataset.fieldUnit ?? '',
      }));
      this.store.addPresetLogEntry(this.activeChannelId, preset.id, preset.name, values);
      this.modal = null;
      this.render();
      this.scrollFeedToBottom();
      return;
    }

    if (action === 'submit-edit-preset') {
      if (!this.activeChannelId) return;
      this.syncEditingFields();
      const nameInput = this.root.querySelector<HTMLInputElement>('#edit-preset-name');
      const name = nameInput?.value.trim() ?? this.editingPresetName;
      if (!name) {
        nameInput?.focus();
        return;
      }
      if (this.modal?.type === 'edit-preset') {
        const existing = this.modal.preset;
        if (existing) {
          this.store.updatePreset(this.activeChannelId, existing.id, name, this.editingPresetFields);
        } else {
          this.store.addPreset(this.activeChannelId, name, this.editingPresetFields);
        }
      }
      this.modal = { type: 'channel-settings' };
      this.render();
      return;
    }
  }

  private handleInput(e: Event): void {
    const target = e.target as HTMLElement;

    if (target instanceof HTMLTextAreaElement && target.id === 'note-input') {
      target.style.height = 'auto';
      target.style.height = Math.min(target.scrollHeight, 120) + 'px';
      return;
    }

    const action = target.dataset.action;
    const idx = parseInt(target.dataset.fieldIndex ?? '', 10);

    if (action === 'update-field-name' && !isNaN(idx)) {
      this.editingPresetFields[idx].name = (target as HTMLInputElement).value;
      return;
    }
    if (action === 'update-field-unit' && !isNaN(idx)) {
      this.editingPresetFields[idx].unit = (target as HTMLInputElement).value;
      return;
    }
  }

  private handleChange(e: Event): void {
    const target = e.target as HTMLElement;
    const action = target.dataset.action;
    const idx = parseInt(target.dataset.fieldIndex ?? '', 10);

    if (action === 'update-field-type' && !isNaN(idx)) {
      this.editingPresetFields[idx].type = (target as HTMLSelectElement).value as 'text' | 'number';
    }
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.modal) {
      if (this.modal.type === 'edit-preset') {
        this.modal = { type: 'channel-settings' };
      } else {
        this.modal = null;
      }
      this.render();
      return;
    }

    const target = e.target as HTMLElement;
    if (target instanceof HTMLTextAreaElement && target.id === 'note-input') {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const form = target.closest('form') as HTMLFormElement | null;
        if (form) form.requestSubmit();
      }
    }

    if (target instanceof HTMLInputElement && target.id === 'modal-channel-name') {
      if (e.key === 'Enter') {
        const form = target.closest('form') as HTMLFormElement | null;
        if (form) form.requestSubmit();
      }
    }
  }

  private syncEditingFields(): void {
    const rows = this.root.querySelectorAll<HTMLElement>('.field-editor-row');
    rows.forEach((row, i) => {
      const nameInput = row.querySelector<HTMLInputElement>('.field-editor-name');
      const unitInput = row.querySelector<HTMLInputElement>('.field-editor-unit');
      const typeSelect = row.querySelector<HTMLSelectElement>('.field-select');
      if (nameInput && this.editingPresetFields[i]) {
        this.editingPresetFields[i].name = nameInput.value;
      }
      if (unitInput && this.editingPresetFields[i]) {
        this.editingPresetFields[i].unit = unitInput.value;
      }
      if (typeSelect && this.editingPresetFields[i]) {
        this.editingPresetFields[i].type = typeSelect.value as 'text' | 'number';
      }
    });
  }
}
