import { useRef, useState } from 'react';
import {
  Page,
  Navbar,
  NavTitle,
  NavTitleLarge,
  NavRight,
  Link,
  Block,
  Card,
  CardContent,
  List,
  ListItem,
  ListButton,
  Fab,
  FabButtons,
  FabButton,
  f7,
  Icon,
  Searchbar,
  SwipeoutActions,
  SwipeoutButton,
  useStore,
} from 'framework7-react';
import type { Searchbar as SearchbarNS } from 'framework7/types';
import store, {
  allColors,
  createGroupId,
  createPaletteId,
  flattenPalette,
} from '../js/store';
import type { Palette, PaletteItem } from '../js/store';

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

  /* Appends to the last group, which is the one nearest the Fab on screen. */
  const addColor = () => {
    const groupId = palette.groups[palette.groups.length - 1]?.id;
    if (!groupId) return;
    store.dispatch('addColor', { paletteId: palette.id, groupId, value: DEFAULT_COLOR });
  };

  const addGroup = () => {
    store.dispatch('addGroup', {
      paletteId: palette.id,
      id: createGroupId(),
      name: `Group ${palette.groups.length + 1}`,
    });
  };

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


  /*
   * Rendered rows. Unfiltered, this is the flat sequence the store folds to and
   * from, so a drag index means the same thing on both sides. While filtering it
   * is just the matching colours — headers would be misleading when their group
   * is partly hidden, and sorting is off in that state anyway, so no index from
   * this shape ever reaches the store.
   */
  const needle = editing ? '' : query.trim().toLowerCase();
  const matches = (c: { name: string; value: string }) =>
    !needle || c.name.toLowerCase().includes(needle) || c.value.toLowerCase().includes(needle);

  const items: PaletteItem[] = needle
    ? allColors(palette)
        .filter(matches)
        .map((color) => ({ kind: 'color', color }))
    : flattenPalette(palette);

  const totalCount = allColors(palette).length;
  const visibleCount = items.filter((i) => i.kind === 'color').length;

  return (
    <Card ref={cardRef} expandable expandableOpened={opened} onCardClosed={handleClosed}>
      <CardContent padding={false}>
        {/*
          Full-height flex column so the footer can sit at the bottom of a short
          card via margin-top:auto, and stick to the viewport bottom on a long one.
        */}
        <div className="palette-body">
          {/*
            Inside CardContent, because F7 leaves an open card scaled and only
            counter-scales .card-content — anything outside it renders stretched.
            Sticky with zero height so it pins to the top of the scroller without
            occupying a row in the flex column.
          */}
          <div className="palette-actions">
            <Link
              cardClose
              className="palette-close"
              aria-label="Close palette"
              iconIos="f7:chevron_left"
              iconMd="material:chevron_left"
            />
            <Link href={false} className="palette-edit" onClick={toggleEditing}>
              {editing ? 'Done' : 'Edit'}
            </Link>
          </div>

          <div className="palette-hero">
            <div className="palette-swatches">
              {allColors(palette).map((color) => (
                <div key={color.id} style={{ backgroundColor: color.value }} />
              ))}
            </div>
            {/*
              The palette name is edited here directly. pointer-events is off
              until the card opens (see app.css) so that tapping a collapsed card
              still opens it rather than focusing the field.
            */}
            <input
              type="text"
              placeholder="Palette name"
              aria-label="Palette name"
              value={palette.name}
              onChange={(e) =>
                store.dispatch('renamePalette', { id: palette.id, name: e.target.value })
              }
            />
          </div>

          {/* Below the fold: only visible once the card is open. */}
          {/*
            One list, headers and colours as sibling rows. That is what makes F7's
            sibling-scoped sort indices meaningful across groups: `from`/`to` are
            positions in this sequence, which is exactly what the store folds.
          */}
          <List
            strong
            inset
            dividersIos
            sortable={editing}
            sortableEnabled={editing}
            sortableMoveElements={false}
            onSortableSort={(sortData: { from: number; to: number }) =>
              store.dispatch('moveItem', {
                paletteId: palette.id,
                from: sortData.from,
                to: sortData.to,
              })
            }
          >
            {items.map((item) =>
              item.kind === 'group' ? (
                <ListItem key={item.group.id} className="palette-group">
                  {/*
                    In the title slot, so F7 still renders its own row structure —
                    including the .sortable-handler that drags start from. Drags
                    are delegated on that handler alone, so focusing this input
                    does not compete with dragging the row.
                  */}
                  <input
                    slot="title"
                    type="text"
                    placeholder="Group name"
                    aria-label="Group name"
                    value={item.group.name}
                    onChange={(e) =>
                      store.dispatch('renameGroup', {
                        paletteId: palette.id,
                        groupId: item.group.id,
                        name: e.target.value,
                      })
                    }
                  />
                </ListItem>
              ) : (
                <ListItem
                  key={item.color.id}
                  swipeout={!editing}
                  title={item.color.name}
                  after={item.color.value}
                  link={editing ? undefined : `/palette/${palette.id}/color/${item.color.id}/`}
                >
                  <div
                    slot="media"
                    className="palette-chip"
                    style={{ backgroundColor: item.color.value }}
                  />
                  {/*
                    `close`, not `delete`. F7's delete removes the <li> from the DOM
                    itself, which fights React for ownership of a node it still has
                    in its tree. close just retracts the swipeout and lets the store
                    update drive the removal through React.
                  */}
                  <SwipeoutActions right>
                    <SwipeoutButton
                      close
                      color="red"
                      onClick={() =>
                        store.dispatch('removeColor', {
                          paletteId: palette.id,
                          colorId: item.color.id,
                        })
                      }
                    >
                      Delete
                    </SwipeoutButton>
                  </SwipeoutActions>
                </ListItem>
              ),
            )}
          </List>

          {visibleCount === 0 && (
            <Block className="palette-empty">
              {totalCount === 0 ? 'No colors yet.' : `No colors match “${query.trim()}”.`}
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
              onInput={(e: any) => setQuery(e.target.value)}
              onClickClear={() => setQuery('')}
            />
            {/*
              Two outcomes, so a Fab speed-dial rather than a plain button. It
              lives inside .palette-footer, which is already sticky and inside
              .card-content — an opened card carries a scale that only
              .card-content counter-scales, so anything outside renders stretched.
              CSS makes it a flex item; FabButtons still anchor to it.
            */}
            <Fab className="palette-add" aria-label="Add">
              <Icon ios="f7:plus" md="material:add" />
              <Icon ios="f7:xmark" md="material:close" />
              <FabButtons position="top">
                <FabButton fabClose label="Color" onClick={addColor}>
                  <Icon ios="f7:drop" md="material:water_drop" />
                </FabButton>
                <FabButton fabClose label="Group" onClick={addGroup}>
                  <Icon ios="f7:folder" md="material:folder" />
                </FabButton>
              </FabButtons>
            </Fab>
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
