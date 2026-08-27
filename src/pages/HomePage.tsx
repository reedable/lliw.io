import { useEffect, useState } from 'react';
import { Link, Page, useStore } from 'framework7-react';
import store from '../domain/store';
import type { Palette } from '../domain/types';
import { createPaletteId } from '../utils/ids';
import PaletteCard from './PaletteCard';
import styles from './HomePage.module.css';

const HomePage = () => {
  const palettes = useStore('palettes') as Palette[];
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const expanded = palettes.find((palette) => palette.id === expandedId) ?? null;

  const collapse = () => {
    setExpandedId(null);
    setEditing(false);
  };

  const addPalette = () => {
    const id = createPaletteId();
    store.dispatch('addPalette', { id });
    setExpandedId(id);
  };

  // The tab bar belongs to home and settings, not an expanded palette card.
  useEffect(() => {
    document.documentElement.classList.toggle('pcard-open', expanded !== null);
    return () => document.documentElement.classList.remove('pcard-open');
  }, [expanded]);

  return (
    <Page name="home" noNavbar className={styles.page}>
      <div slot="fixed" className={styles.controls}>
        <Link
          href={false}
          onClick={collapse}
          aria-label="Back"
          className={`${styles.control} ${styles.controlBack}`}
          iconIos="f7:chevron_left"
          iconMd="material:chevron_left"
        />
        <Link
          className={`${styles.control} ${styles.controlAdd}`}
          iconIos="f7:plus"
          iconMd="material:add"
          aria-label="Add palette"
          onClick={addPalette}
        />
        <Link
          className={`${styles.control} ${styles.controlEdit}`}
          href={false}
          onClick={() => setEditing((was) => !was)}
        >
          {editing ? 'Done' : 'Edit'}
        </Link>
      </div>

      <h1 className={styles.homeTitle}>lliw.io</h1>

      {palettes.map((palette) => (
        <PaletteCard
          key={palette.id}
          palette={palette}
          expanded={palette.id === expandedId}
          editing={editing && palette.id === expandedId}
          onExpand={() => setExpandedId(palette.id)}
          onCollapse={collapse}
        />
      ))}
    </Page>
  );
};

export default HomePage;
