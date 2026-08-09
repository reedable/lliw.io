import { useState } from 'react';
import {
  Page,
  Navbar,
  NavLeft,
  NavTitle,
  NavTitleLarge,
  NavRight,
  Link,
  Block,
  BlockTitle,
  Card,
  CardContent,
  List,
  ListInput,
  ListItem,
  Button,
  useStore,
} from 'framework7-react';
import store from '../js/store';
import type { Palette } from '../js/store';

/**
 * A collapsed expandable card is a 300px window onto content that is always laid
 * out at full-screen size, so the swatch strip below is sized to fill exactly that
 * window. Everything after it is only reachable once the card is opened.
 */
const PaletteCard = ({ palette }: { palette: Palette }) => {
  const [draftColor, setDraftColor] = useState('#3b82f6');

  return (
    <Card expandable>
      <CardContent padding={false}>
        <div className="palette-hero">
          <div className="palette-swatches">
            {palette.colors.map((color, index) => (
              <div key={index} className="palette-swatch" style={{ backgroundColor: color }} />
            ))}
          </div>
          <div className="palette-hero-bar">{palette.name}</div>
          <Link cardClose className="palette-close" iconIos="f7:xmark" iconMd="material:close" />
        </div>

        {/* Below the fold: only visible once the card is open. */}
        <BlockTitle>Name</BlockTitle>
        <List strong inset>
          <ListInput
            type="text"
            placeholder="Palette name"
            value={palette.name}
            onInput={(e: any) =>
              store.dispatch('renamePalette', { id: palette.id, name: e.target.value })
            }
          />
        </List>

        <BlockTitle>Colors</BlockTitle>
        <List strong inset dividersIos>
          {palette.colors.map((color, index) => (
            <ListItem key={index} title={color}>
              <div slot="media" className="palette-chip" style={{ backgroundColor: color }} />
              <Link
                slot="after"
                iconIos="f7:trash"
                iconMd="material:delete"
                onClick={() => store.dispatch('removeColor', { id: palette.id, index })}
              />
            </ListItem>
          ))}
        </List>

        <Block className="palette-add">
          <input
            type="color"
            value={draftColor}
            onChange={(e) => setDraftColor(e.target.value)}
            aria-label="Pick a color"
          />
          <Button
            fill
            onClick={() => store.dispatch('addColor', { id: palette.id, color: draftColor })}
          >
            Add color
          </Button>
        </Block>
      </CardContent>
    </Card>
  );
};

const HomePage = () => {
  const palettes = useStore('palettes') as Palette[];

  return (
    <Page name="home">
      <Navbar large>
        <NavLeft>
          <Link iconIos="f7:menu" iconMd="material:menu" panelOpen="left" />
        </NavLeft>
        <NavTitle>Palette Studio</NavTitle>
        <NavRight>
          <Link iconIos="f7:menu" iconMd="material:menu" panelOpen="right" />
        </NavRight>
        <NavTitleLarge>Palette Studio</NavTitleLarge>
      </Navbar>

      {palettes.map((palette) => (
        <PaletteCard key={palette.id} palette={palette} />
      ))}
    </Page>
  );
};

export default HomePage;
