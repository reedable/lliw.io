import { Page, Navbar, Block, BlockTitle, useStore } from 'framework7-react';
import type { Router } from 'framework7/types';
import type { Palette } from '../js/store';

interface ColorPageProps {
  f7route: Router.Route;
}

// Every palette is implicitly paired against these two as well.
const BASE_COLORS = ['#ffffff', '#000000'];

interface ComboProps {
  background: string;
  foreground: string;
  label: string;
}

const Combo = ({ background, foreground, label }: ComboProps) => (
  <div className="color-combo" style={{ backgroundColor: background, color: foreground }}>
    <span className="color-combo-sample">Aa</span>
    <span className="color-combo-label">{label}</span>
  </div>
);

const ColorPage = ({ f7route }: ColorPageProps) => {
  const { paletteId, colorIndex } = f7route.params;
  const palettes = useStore('palettes') as Palette[];

  const palette = palettes.find((p) => p.id === paletteId);
  const color = palette?.colors[Number(colorIndex)];

  // The colour can vanish while this page is open — deleted via swipe on the card
  // underneath, or the palette itself removed.
  if (!color || !palette) {
    return (
      <Page name="color">
        <Navbar title="Not found" backLink="Back" />
        <Block>That color is no longer in this palette.</Block>
      </Page>
    );
  }

  /*
   * Counterparts to pair this colour with: the rest of the palette plus black and
   * white. Compared lowercased so a palette that already contains #FFFFFF does not
   * produce a duplicate tile, and the colour itself is dropped — pairing it with
   * itself renders an unreadable solid block.
   */
  const self = color.toLowerCase();
  const counterparts = Array.from(
    new Set([...palette.colors, ...BASE_COLORS].map((c) => c.toLowerCase())),
  ).filter((c) => c !== self);

  return (
    <Page name="color">
      <Navbar title={color} subtitle={palette.name} backLink="Back" />

      <div className="color-hero" style={{ backgroundColor: color }} />

      <BlockTitle>{color} as foreground</BlockTitle>
      <Block>
        <div className="color-combo-grid">
          {counterparts.map((bg) => (
            <Combo key={`fg-${bg}`} background={bg} foreground={color} label={`on ${bg}`} />
          ))}
        </div>
      </Block>

      <BlockTitle>{color} as background</BlockTitle>
      <Block>
        <div className="color-combo-grid">
          {counterparts.map((fg) => (
            <Combo key={`bg-${fg}`} background={color} foreground={fg} label={`${fg} on it`} />
          ))}
        </div>
      </Block>
    </Page>
  );
};

export default ColorPage;
