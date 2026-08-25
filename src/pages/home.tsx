import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import store, { allColors, flattenPalette } from '../js/store';
import { TERTIARY } from '../js/colors';
import { createGroupId, createPaletteId } from '../js/ids';
import type { Palette, PaletteItem } from '../js/types';
import { useSwipeDown } from '../js/useSwipeDown';

/*
 * Placeholder until Add opens a real picker: the colour a new entry starts as.
 * The mid gray clears AA against both black and white, which are on by default,
 * so a first-run colour page has passing pairings to show rather than an empty
 * list.
 */
const DEFAULT_COLOR = TERTIARY.gray;

/** Must match the 300ms in `.pcard.is-lifted`'s transition in app.css. */
const LIFT_MS = 300;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const readRect = (el: Element): Rect => {
  // Viewport coordinates, which is what position:fixed resolves against.
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};

/*
 * Evaluates CSS's `ease` — cubic-bezier(0.25, 0.1, 0.25, 1), the default timing
 * function, and therefore the one .pcard.is-lifted's transition uses. The scroll
 * unwind below is driven from JS, so it has to reproduce the curve the geometry
 * is being carried along by; a linear tween against an eased box is visible as
 * the content sliding out of step with the edge that is chasing it.
 *
 * x(t) and y(t) are the standard cubic Béziers with p0 = 0 and p3 = 1. Bisection
 * rather than Newton-Raphson to invert x: the curve is monotonic in t, 20 halvings
 * pin it to under 1e-6, and it runs once per frame for 300ms.
 */
const ease = (fraction: number): number => {
  const cx = 3 * 0.25;
  const bx = 3 * (0.25 - 0.25) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * 0.1;
  const by = 3 * (1 - 0.1) - cy;
  const ay = 1 - cy - by;

  let lo = 0;
  let hi = 1;
  let t = fraction;
  for (let i = 0; i < 20; i += 1) {
    const x = ((ax * t + bx) * t + cx) * t;
    if (x < fraction) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return ((ay * t + by) * t + cy) * t;
};

/*
 * idle   — in the flow, no inline geometry.
 * pinned — position:fixed at an explicit pixel rect. Both ends of the animation
 *          are this shape, which is the whole point: a transition can only carry
 *          a property whose endpoints are interpolable values in the same
 *          positioning scheme. Going straight from the in-flow box to the
 *          viewport box straddles two schemes, so `position` jumped, `top`/`left`
 *          went auto→0 and `width` auto→100vw — none of which interpolate — and
 *          height was the only thing that actually animated.
 * open    — position:fixed filling the viewport.
 */
type Phase = 'idle' | 'pinned' | 'open';

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
   * Expansion is driven from HomePage, because the controls change with it — while
   * a palette is expanded the control layer carries its back chevron and Edit.
   * That is what removes the stacking problem entirely: the card never has to
   * cover the chrome, so nothing needs to escape its layer.
   */
  const cardElRef = useRef<HTMLDivElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  /** In-flight scroll unwind, cancelled by a re-open or by unmount — never by a
   *  phase change, which is the effect's own doing rather than an interruption. */
  const unwindRef = useRef(0);
  useEffect(() => () => cancelAnimationFrame(unwindRef.current), []);
  const [phase, setPhase] = useState<Phase>('idle');
  const [rect, setRect] = useState<Rect | null>(null);

  const lifted = phase !== 'idle';

  /*
   * Opening, step 1: pin. useLayoutEffect, not useEffect — it runs before the
   * browser paints, so React re-renders synchronously and the in-flow frame is
   * never shown. The first painted frame is already the pinned one, sitting at
   * exactly the pixels the row occupied, so there is nothing to see yet.
   */
  useLayoutEffect(() => {
    if (!expanded || phase !== 'idle') return;
    const el = cardElRef.current;
    if (!el) return;
    // Re-opened mid-collapse: the unwind no longer has anywhere to go.
    cancelAnimationFrame(unwindRef.current);
    setRect(readRect(el));
    setPhase('pinned');
  }, [expanded, phase]);

  /*
   * Opening, step 2: release. The pinned rect has to be the *painted* style
   * before the viewport rect replaces it, otherwise the browser coalesces the two
   * into one style change and there is no start value to animate from. Two frames
   * of rAF: the first lands after the pinned paint, the second is the frame the
   * new values are applied in.
   */
  useEffect(() => {
    if (!expanded || phase !== 'pinned') return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setPhase('open'));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [expanded, phase]);

  /*
   * Closing, step 1: aim. The holder is still reserving the row's space, so its
   * rect is precisely where the card has to land — no need to guess, and it is
   * correct even if the list scrolled or changed length while the card was open.
   */
  useLayoutEffect(() => {
    if (expanded || phase !== 'open') return;
    const holder = holderRef.current;
    if (!holder) {
      setPhase('idle');
      setRect(null);
      return;
    }
    setRect(readRect(holder));
    setPhase('pinned');

    /*
     * Unwind the scroll alongside the geometry. The collapsed card is a window
     * onto the top of the content — the swatch strip — so a card closed from
     * halfway down the colour list has to travel back to 0, not hold its offset.
     *
     * Driven here rather than left to the class change, because `.is-open` is
     * what grants `.pcard-inner` its `overflow: auto`; when that comes off, the
     * offset is dropped rather than animated and the content jumps to the top
     * before the box has started shrinking. scrollTop is read now, while the
     * scroller is still open, and written every frame from then on — which also
     * overrides the drop, whenever in the commit it happens.
     */
    const inner = innerRef.current;
    const from = inner?.scrollTop ?? 0;
    if (!inner || from === 0) return;

    /*
     * The handle lives in a ref, and this effect deliberately returns no cleanup.
     * setPhase above is in this effect's own dependencies, so React tears the
     * effect down on the very next commit — a cleanup here would cancel the tween
     * before its first frame, which is exactly what it used to do. Cancellation
     * is owned instead by whatever legitimately interrupts it: a re-open, or
     * unmount.
     */
    cancelAnimationFrame(unwindRef.current);
    const start = performance.now();
    unwindRef.current = requestAnimationFrame(function step(now) {
      const fraction = Math.min(1, (now - start) / LIFT_MS);
      inner.scrollTop = from * (1 - ease(fraction));
      if (fraction < 1) unwindRef.current = requestAnimationFrame(step);
    });
  }, [expanded, phase]);

  /*
   * Closing, step 2: rejoin the flow, but only once the transition has finished —
   * dropping the inline geometry any earlier would snap the card home instead of
   * animating it there.
   */
  useEffect(() => {
    if (expanded || phase !== 'pinned') return;
    const timer = setTimeout(() => {
      setPhase('idle');
      setRect(null);
    }, LIFT_MS);
    return () => clearTimeout(timer);
  }, [expanded, phase]);

  /*
   * Swipe down on the hero to collapse. Bound only while phase is 'open', so a
   * collapsed card is untouched — there, a vertical drag belongs to the page
   * scroller and a tap belongs to onExpand.
   */
  useSwipeDown(heroRef, onCollapse, {
    enabled: phase === 'open',
    getScroller: () => innerRef.current,
  });

  const deletePalette = () => {
    f7.dialog.confirm(`Delete “${palette.name}”? This cannot be undone.`, 'Delete palette', () => {
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

  /* The same colours without the group headers — the swatch strip and the empty
     check both want this, and neither cares which group a colour is in. */
  const colors = allColors(palette);

  /*
   * Fixed in both lifted phases, so the endpoints differ only in their values.
   * margin:0 because the measured rect is a border box — the row's margins are
   * already baked into rect.top/left, and leaving .pcard's margin on would offset
   * the card by them a second time.
   *
   * dvh, not vh: in a browser tab 100vh includes the strip behind Safari's
   * toolbar, which would run the card's bottom edge underneath it. Installed as a
   * PWA the two are identical.
   */
  const style: React.CSSProperties =
    phase === 'idle' || !rect
      ? {}
      : phase === 'open'
        ? {
            position: 'fixed',
            margin: 0,
            top: 0,
            left: 0,
            width: '100vw',
            height: '100dvh',
          }
        : {
            position: 'fixed',
            margin: 0,
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          };

  const card = (
    <div
      ref={cardElRef}
      className={`pcard${phase === 'open' ? ' is-open' : ''}${lifted ? ' is-lifted' : ''}`}
      style={style}
      onClick={lifted ? undefined : onExpand}
    >
      <div ref={innerRef} className="pcard-inner">
        {/*
          Full-height flex column so the footer can sit at the bottom of a short
          card via margin-top:auto, and stick to the viewport bottom on a long one.
        */}
        <div className="palette-body">
          <div ref={heroRef} className="palette-hero">
            <div className="palette-swatches">
              {colors.map((color) => (
                <div
                  key={color.id}
                  style={{ '--tile-color': color.value } as React.CSSProperties}
                />
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
                    style={{ '--tile-color': item.color.value } as React.CSSProperties}
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

          {colors.length === 0 && (
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
