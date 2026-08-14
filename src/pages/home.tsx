import { useEffect, useRef, useState } from 'react';
import {
  Page,
  Link,
  Block,
  List,
  ListItem,
  ListButton,
  Fab,
  FabButtons,
  FabButton,
  f7,
  Icon,
  SwipeoutActions,
  SwipeoutButton,
  useStore,
} from 'framework7-react';
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
  expanded,
  editing,
  onExpand,
  onCollapse,
}: {
  palette: Palette;
  expanded: boolean;
  editing: boolean;
  onExpand: () => void;
  onCollapse: () => void;
}) => {
  /*
   * Expansion is driven from HomePage, because the navbar changes with it — while
   * a palette is expanded the navbar carries its back chevron and Edit. That is
   * what removes the stacking problem entirely: the card never has to cover the
   * chrome, so nothing needs to escape its layer.
   *
   * Geometry is absolute within .page, not fixed. `fixed` resolves against the
   * nearest transformed ancestor rather than the viewport, and Framework7 puts
   * transforms on pages and views — which is what left the card 42px down. .page
   * is position:absolute, so it is a deterministic containing block.
   */
  const cardElRef = useRef<HTMLDivElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const pendingDelete = useRef(false);

  const lifted = rect !== null || expanded;

  // Measure before the card leaves the flow, then let CSS carry it to full size.
  useEffect(() => {
    if (!expanded) return;
    const el = cardElRef.current;
    const page = el?.closest('.page') as HTMLElement | null;
    if (!el || !page) return;
    const r = el.getBoundingClientRect();
    const p = page.getBoundingClientRect();
    setRect({ top: r.top - p.top, left: r.left - p.left, width: r.width, height: r.height });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  useEffect(() => {
    if (!expanded) setRect(null);
  }, [expanded]);

  const deletePalette = () => {
    f7.dialog.confirm(`Delete “${palette.name}”? This cannot be undone.`, 'Delete palette', () => {
      pendingDelete.current = true;
      onCollapse();
      store.dispatch('deletePalette', { id: palette.id });
    });
  };

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

  /* The flat sequence the store folds to and from, so a drag index matches. */
  const items: PaletteItem[] = flattenPalette(palette);

  /*
   * Absolute within .page. Collapsed it is in the flow; expanded it fills the area
   * below the navbar, using F7's own navbar tokens so it lines up with the chrome
   * rather than covering it.
   */
  const style: React.CSSProperties = !rect
    ? {}
    : expanded
      ? {
          position: 'absolute',
          margin: 0,
          top: 'calc(var(--f7-navbar-height) + var(--f7-safe-area-top))',
          left: 0,
          right: 0,
          bottom: 0,
          width: 'auto',
          height: 'auto',
        }
      : {
          position: 'absolute',
          margin: 0,
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };

  const card = (
    <div
      ref={cardElRef}
      className={`pcard${expanded ? ' is-open' : ''}${lifted ? ' is-lifted' : ''}`}
      style={style}
      onClick={expanded ? undefined : onExpand}
    >
      <div className="pcard-inner">
        {/*
          Full-height flex column so the footer can sit at the bottom of a short
          card via margin-top:auto, and stick to the viewport bottom on a long one.
        */}
        <div className="palette-body">
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

          {allColors(palette).length === 0 && (
            <Block className="palette-empty">No colors yet.</Block>
          )}

          {/* Destructive action last, so it takes a deliberate scroll to reach. */}
          <List strong inset>
            <ListButton title="Delete palette" color="red" onClick={deletePalette} />
          </List>

          <div className="palette-footer">
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
      </div>
    </div>
  );

  return (
    <>
      {/* Holds the row's space in the list while the card is lifted out of it. */}
      <div ref={holderRef} className={`pcard-holder${lifted ? ' is-holding' : ''}`} />
      {card}
    </>
  );
};

const HomePage = () => {
  const palettes = useStore('palettes') as Palette[];

  /*
   * Which palette is expanded, held here rather than inside the card, because the
   * navbar changes with it. That is what removes the stacking problem: the card
   * never has to cover the chrome, the chrome becomes the palette's own.
   */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const expanded = palettes.find((p) => p.id === expandedId) ?? null;

  const collapse = () => {
    setExpandedId(null);
    setEditing(false);
  };

  const addPalette = () => {
    const id = createPaletteId();
    store.dispatch('addPalette', { id });
    setExpandedId(id);
  };

  /* Tab bar belongs to home and settings only. */
  useEffect(() => {
    document.documentElement.classList.toggle('pcard-open', expanded !== null);
    return () => document.documentElement.classList.remove('pcard-open');
  }, [expanded]);

  return (
    <Page name="home" noNavbar>
      {/*
        Controls live in their own layer, not in a navbar. One steady z-index, each
        control absolutely positioned, parked above the viewport when it does not
        apply and translated down when it does. Nothing mounts or unmounts, and
        nothing has to out-stack anything else.
      */}
      <div slot="fixed" className="controls">
        <Link
          href={false}
          onClick={collapse}
          aria-label="Back"
          className="control control-back"
          iconIos="f7:chevron_left"
          iconMd="material:chevron_left"
        />
        <Link
          className="control control-add"
          iconIos="f7:plus"
          iconMd="material:add"
          aria-label="Add palette"
          onClick={addPalette}
        />
        <Link
          className="control control-edit"
          href={false}
          onClick={() => setEditing((was) => !was)}
        >
          {editing ? 'Done' : 'Edit'}
        </Link>
      </div>

      <h1 className="home-title">lliw.io</h1>

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
