import { Page, Navbar, List, ListItem, ListInput, Toggle, useStore } from 'framework7-react';
import store from '../js/store';
import type { ConformanceSetting, Settings } from '../js/store';

const CONFORMANCE_OPTIONS: ConformanceSetting[] = ['AAA', 'AA', 'A'];

const SettingsPage = () => {
  const settings = useStore('settings') as Settings;

  return (
    <Page name="settings">
      <Navbar title="Settings" />

      <List strong inset dividersIos>
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
    </Page>
  );
};

export default SettingsPage;
