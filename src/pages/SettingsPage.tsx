import { useRef } from 'react';
import {
  Page,
  Navbar,
  BlockTitle,
  List,
  ListItem,
  ListInput,
  ListButton,
  Toggle,
  f7,
  useStore,
} from 'framework7-react';
import store, { buildExport, parseImport } from '../domain/store';
import type { ConformanceSetting, Palette, Settings, ThemeSetting } from '../domain/types';

const CONFORMANCE_OPTIONS: ConformanceSetting[] = ['AAA', 'AA', 'A'];

const THEME_OPTIONS: { value: ThemeSetting; label: string }[] = [
  { value: 'auto', label: 'Automatic' },
  { value: 'ios', label: 'iOS' },
  { value: 'md', label: 'Material' },
];

const SettingsPage = () => {
  const settings = useStore('settings') as Settings;
  const palettes = useStore('palettes') as Palette[];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportPalettes = () => {
    const json = JSON.stringify(buildExport(palettes), null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `lliw-palettes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    // Revoking immediately can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importFile = async (file: File) => {
    const result = parseImport(await file.text());
    if (!result.ok) {
      f7.dialog.alert(result.reason, 'Import failed');
      return;
    }
    const existing = new Set(palettes.map((p) => p.id));
    const replaced = result.palettes.filter((p) => existing.has(p.id)).length;
    const added = result.palettes.length - replaced;
    store.dispatch('importPalettes', { palettes: result.palettes });
    f7.dialog.alert(`${added} added, ${replaced} replaced.`, 'Imported');
  };

  /*
   * What F7 actually resolved to, read off the class it stamps on <html> at init.
   * Shown because 'Automatic' is a guess — on iPadOS, F7 matches window.screen
   * against a hardcoded resolution list — and without this the user has no way to
   * see which way the guess went.
   */
  const activeTheme = document.documentElement.classList.contains('md') ? 'Material' : 'iOS';

  const changeTheme = (theme: ThemeSetting) => {
    store.dispatch('setSettings', { theme });
    // F7 reads the theme once, in its constructor, and stamps it on <html>. There
    // is no supported way to restyle a running app, so this needs a fresh boot.
    f7.dialog.confirm('Reload now to apply it?', 'Theme changed', () => location.reload());
  };

  return (
    <Page name="settings">
      <Navbar title="Settings" />

      <List strong inset dividersIos>
        <ListInput
          type="select"
          label="Theme"
          value={settings.theme}
          info={`Currently rendering: ${activeTheme}`}
          onChange={(e: any) => changeTheme(e.target.value as ThemeSetting)}
        >
          {THEME_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </ListInput>

        <ListInput
          type="select"
          label="Default WCAG conformance"
          value={settings.defaultConformance}
          onChange={(e: any) =>
            store.dispatch('setSettings', { defaultConformance: e.target.value })
          }
        >
          {CONFORMANCE_OPTIONS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </ListInput>

        <ListItem title="Show black/white on color page">
          {/*
            defaultChecked, not checked. F7's Toggle writes $inputEl[0].checked
            directly in its own setter; a React-controlled checkbox forces the DOM
            back to the prop after the event, so the switch springs back and cannot
            be turned off. Uncontrolled lets F7 own the DOM while the store stays
            the source of truth via onToggleChange.
          */}
          <Toggle
            slot="after"
            defaultChecked={settings.showBaseColors}
            onToggleChange={(checked: boolean) =>
              store.dispatch('setSettings', { showBaseColors: checked })
            }
          />
        </ListItem>
      </List>

      <BlockTitle>Palettes</BlockTitle>
      <List strong inset dividersIos>
        <ListButton title={`Export ${palettes.length} palettes`} onClick={exportPalettes} />
        <ListButton title="Import palettes" onClick={() => fileInputRef.current?.click()} />
      </List>

      {/*
        Hidden input rather than a visible file field: iOS renders the native
        control inconsistently, and this keeps both actions as matching list rows.
        Value is cleared after each pick so choosing the same file twice re-fires
        change.
      */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) importFile(file);
        }}
      />
    </Page>
  );
};

export default SettingsPage;
