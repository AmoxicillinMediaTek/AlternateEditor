"use client";

import { Icon } from "@/components/ui/Icon";
import { useStore, useStoreApi } from "@/lib/workspace/store";

function SwitchRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="setting-row">
      <div className="setting-copy">
        <label htmlFor={id}>{label}</label>
        <p>{description}</p>
      </div>
      <input
        id={id}
        type="checkbox"
        className="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}

export function SettingsView({ onClose }: { onClose: () => void }) {
  const store = useStoreApi();
  const settings = useStore((state) => state.settings);

  return (
    <div className="side-view">
      <div className="explorer-brand view-brand">
        <span className="brand-name">Settings</span>
        <button
          type="button"
          className="btn-icon btn-ghost explorer-close"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="side-view-body">
        <div className="settings-body">
          <fieldset className="settings-group">
            <legend>Editor</legend>

            <div className="setting-row">
              <div className="setting-copy">
                <span id="theme-label">Theme</span>
                <p>Applies to the editor and the shell.</p>
              </div>
              <div className="segmented" role="group" aria-labelledby="theme-label">
                <button
                  type="button"
                  className={settings.theme === "dark" ? "is-active" : ""}
                  aria-pressed={settings.theme === "dark"}
                  onClick={() => store.updateSettings({ theme: "dark" })}
                >
                  <Icon name="moon" size={14} />
                  Dark
                </button>
                <button
                  type="button"
                  className={settings.theme === "light" ? "is-active" : ""}
                  aria-pressed={settings.theme === "light"}
                  onClick={() => store.updateSettings({ theme: "light" })}
                >
                  <Icon name="sun" size={14} />
                  Light
                </button>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-copy">
                <span id="font-size-label">Font size</span>
                <p>Editor text, in pixels.</p>
              </div>
              <div className="stepper" role="group" aria-labelledby="font-size-label">
                <button
                  type="button"
                  className="stepper-btn"
                  aria-label="Decrease font size"
                  disabled={settings.fontSize <= 11}
                  onClick={() => store.updateSettings({ fontSize: settings.fontSize - 1 })}
                >
                  −
                </button>
                <output className="stepper-value mono">{settings.fontSize}</output>
                <button
                  type="button"
                  className="stepper-btn"
                  aria-label="Increase font size"
                  disabled={settings.fontSize >= 20}
                  onClick={() => store.updateSettings({ fontSize: settings.fontSize + 1 })}
                >
                  +
                </button>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-copy">
                <span id="tab-size-label">Tab size</span>
                <p>Spaces per indentation level.</p>
              </div>
              <div className="segmented" role="group" aria-labelledby="tab-size-label">
                {[2, 4, 8].map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={settings.tabSize === size ? "is-active" : ""}
                    aria-pressed={settings.tabSize === size}
                    onClick={() => store.updateSettings({ tabSize: size })}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <SwitchRow
              id="setting-wrap"
              label="Word wrap"
              description="Wrap long lines instead of scrolling."
              checked={settings.wordWrap}
              onChange={(value) => store.updateSettings({ wordWrap: value })}
            />
            <SwitchRow
              id="setting-active-line"
              label="Highlight active line"
              description="Tint the line the cursor sits on."
              checked={settings.highlightActiveLine}
              onChange={(value) => store.updateSettings({ highlightActiveLine: value })}
            />
          </fieldset>

          <fieldset className="settings-group">
            <legend>Files</legend>
            <SwitchRow
              id="setting-auto-save"
              label="Auto save"
              description="Checkpoint unsaved edits every 2 seconds."
              checked={settings.autoSave}
              onChange={(value) => store.updateSettings({ autoSave: value })}
            />
          </fieldset>

          <fieldset className="settings-group">
            <legend>Storage</legend>
            <p className="setting-note">
              Files, tabs and these preferences live in IndexedDB on this device. Saving in the
              editor is a checkpoint; edits are written as you type.
            </p>
            <dl className="about-list">
              <div>
                <dt>Editor</dt>
                <dd>CodeMirror 6</dd>
              </div>
              <div>
                <dt>Framework</dt>
                <dd>Next.js</dd>
              </div>
            </dl>
          </fieldset>
        </div>
      </div>
    </div>
  );
}
