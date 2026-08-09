import { useRef, useState } from 'react';
import {
  Page,
  Navbar,
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
  ListButton,
  Button,
  f7,
  Icon,
  Searchbar,
  SwipeoutActions,
  SwipeoutButton,
  useStore,
} from 'framework7-react';
import type { Searchbar as SearchbarNS } from 'framework7/types';
import store, { createPaletteId } from '../js/store';
import type { Palette } from '../js/store';

// Placeholder until Add opens a real picker: the colour a new entry starts as.
const DEFAULT_COLOR = '#3b82f6';

/**
 * A collapsed expandable card is a 300px window onto content that is always laid
 * out at full-screen size, so the swatch strip below is sized to fill exactly that
 * window. Everything after it is only reachable once the card is opened.
 */
const PaletteCard = ({
  palette,
  opened,
  onClosed,
}: {
  palette: Palette;
  opened: boolean;
  onClosed: () => void;
}) => {
  const [query, setQuery] = useState('');

  /*
   * Search mode, mirroring Notes: entered by focusing the field, and left only by
   * tapping the X — not by blurring. Keeping it out of `onBlur` matters. The X sits
   * on the button that would otherwise be Add, so if blur ended search mode the
   * state would flip back to Add before the tap resolved, and the tap would add a
   * colour instead of cancelling. F7's own searchbar enable/disable is no help here:
   * enable() only fires from a click on a .searchbar-enable element, never on focus.
   */
  const [searching, setSearching] = useState(false);

  /*
   * Edit mode reveals every colour and makes the list sortable. Suspending the
   * filter is not only the requested behaviour, it is what makes reordering safe:
   * onSortableSort reports from/to as positions in the *rendered* list, so a drag
   * while filtered would move the wrong colour.
   */
  const [editing, setEditing] = useState(false);

  const toggleEditing = () => {
    setEditing((was) => {
      if (!was) {
        setQuery('');
        setSearching(false);
      }
      return !was;
    });
  };

  /*
   * Deleting an open card can't just unmount it: F7's close() is what restores the
   * hidden navbar and removes the backdrop. Unmounting while open would strand
   * both. So close first, then delete once F7 reports the card closed.
   */
  // Shape dictated by CardProps['ref'] in framework7-react.
  const cardRef = useRef<{
    el: HTMLElement | null;
    open: () => void;
    close: () => void;
  }>(null!);
  const pendingDelete = useRef(false);

  const deletePalette = () => {
    f7.dialog.confirm(`Delete “${palette.name}”? This cannot be undone.`, 'Delete palette', () => {
      pendingDelete.current = true;
      cardRef.current?.close();
    });
  };

  const handleClosed = () => {
    if (pendingDelete.current) {
      pendingDelete.current = false;
      store.dispatch('deletePalette', { id: palette.id });
      return;
    }
    onClosed();
  };
  // Shape dictated by SearchbarProps['ref'] in framework7-react.
  const searchbarRef = useRef<{
    el: HTMLElement | null;
    f7Searchbar: () => SearchbarNS.Searchbar;
  }>(null!);

  const exitSearch = () => {
    setQuery('');
    setSearching(false);
    searchbarRef.current?.el?.querySelector('input')?.blur();
  };

  // Matches name or hex, so filtering still works before a colour is named.
  const needle = editing ? '' : query.trim().toLowerCase();
  const colors = palette.colors.filter(
    (c) =>
      !needle ||
      c.name.toLowerCase().includes(needle) ||
      c.value.toLowerCase().includes(needle),
  );

  return (
    <Card ref={cardRef} expandable expandableOpened={opened} onCardClosed={handleClosed}>
      <CardContent padding={false}>
        {/*
          Full-height flex column so the footer can sit at the bottom of a short
          card via margin-top:auto, and stick to the viewport bottom on a long one.
        */}
        <div className="palette-body">
          <div className="palette-hero">
            <div className="palette-swatches">
              {palette.colors.map((color) => (
                <div
                  key={color.id}
                  className="palette-swatch"
                  style={{ backgroundColor: color.value }}
                />
              ))}
            </div>
            <div className="palette-hero-bar">{palette.name}</div>
            <div className="palette-hero-actions">
              <Link href={false} className="palette-edit" onClick={toggleEditing}>
                {editing ? 'Done' : 'Edit'}
              </Link>
              <Link cardClose className="palette-close" iconIos="f7:xmark" iconMd="material:close" />
            </div>
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
          {/*
            sortableMoveElements={false} keeps F7 from reordering the DOM itself —
            React stays the only thing that moves rows, so there is no ownership
            fight like the one swipeout `delete` causes.
          */}
          <List
            strong
            inset
            dividersIos
            sortable={editing}
            sortableEnabled={editing}
            sortableMoveElements={false}
            onSortableSort={(sortData: { from: number; to: number }) =>
              store.dispatch('reorderColors', {
                paletteId: palette.id,
                from: sortData.from,
                to: sortData.to,
              })
            }
          >
            {colors.map((color) => (
              <ListItem
                key={color.id}
                swipeout={!editing}
                title={color.name}
                after={color.value}
                link={editing ? undefined : `/palette/${palette.id}/color/${color.id}/`}
              >
                <div
                  slot="media"
                  className="palette-chip"
                  style={{ backgroundColor: color.value }}
                />
                {/*
                  `close`, not `delete`. F7's delete removes the <li> from the DOM
                  itself, which fights React for ownership of a node it still has in
                  its tree. close just retracts the swipeout and lets the store
                  update drive the removal through React.
                */}
                <SwipeoutActions right>
                  <SwipeoutButton
                    close
                    color="red"
                    onClick={() =>
                      store.dispatch('removeColor', {
                        paletteId: palette.id,
                        colorId: color.id,
                      })
                    }
                  >
                    Delete
                  </SwipeoutButton>
                </SwipeoutActions>
              </ListItem>
            ))}
          </List>

          {colors.length === 0 && (
            <Block className="palette-empty">
              {palette.colors.length === 0
                ? 'No colors yet.'
                : `No colors match “${query.trim()}”.`}
            </Block>
          )}

          {/* Destructive action last, so it takes a deliberate scroll to reach. */}
          <List strong inset>
            <ListButton title="Delete palette" color="red" onClick={deletePalette} />
          </List>

          <div className="palette-footer">
            {/*
              customSearch keeps F7 from doing its own DOM filtering — React owns
              the list. inline drops the searchbar's own bar chrome so it sits
              inside this one, and disableButton removes the "Cancel" affordance.
            */}
            <Searchbar
              ref={searchbarRef}
              className="palette-search"
              inline
              customSearch
              clearButton
              disableButton={false}
              placeholder="Filter colors"
              value={query}
              onFocus={() => setSearching(true)}
              onInput={(e: any) => setQuery(e.target.value)}
              onClickClear={() => setQuery('')}
            />
            {/* Circular glass button beside the pill, as in Notes. Styling comes
                from F7's own --f7-glass-* tokens, not hand-picked values. It is
                Add normally, and becomes the cancel X while searching. */}
            <Button
              className="palette-add"
              aria-label={searching ? 'Cancel filter' : 'Add color'}
              onClick={() =>
                searching
                  ? exitSearch()
                  : store.dispatch('addColor', { paletteId: palette.id, value: DEFAULT_COLOR })
              }
            >
              <Icon
                ios={searching ? 'f7:xmark' : 'f7:plus'}
                md={searching ? 'material:close' : 'material:add'}
              />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const HomePage = () => {
  const palettes = useStore('palettes') as Palette[];

  // Id of the card to auto-expand. Set only when a palette is created here, so a
  // freshly added card mounts already open; cleared once that card is closed.
  const [autoOpenId, setAutoOpenId] = useState<string | null>(null);

  const addPalette = () => {
    const id = createPaletteId();
    store.dispatch('addPalette', { id });
    setAutoOpenId(id);
  };

  return (
    <Page name="home">
      <Navbar large>
        <NavTitle>lliw.io</NavTitle>
        <NavRight>
          <Link
            iconIos="f7:plus"
            iconMd="material:add"
            tooltip="Add palette"
            onClick={addPalette}
          />
        </NavRight>
        <NavTitleLarge>lliw.io</NavTitleLarge>
      </Navbar>

      {palettes.map((palette) => (
        <PaletteCard
          key={palette.id}
          palette={palette}
          opened={palette.id === autoOpenId}
          onClosed={() => setAutoOpenId((cur) => (cur === palette.id ? null : cur))}
        />
      ))}
    </Page>
  );
};

export default HomePage;
