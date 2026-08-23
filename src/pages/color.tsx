import { useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import {
  Page,
  Navbar,
  Block,
  BlockTitle,
  Toolbar,
  ToolbarPane,
  Link,
  List,
  ListInput,
  f7,
  useStore,
} from 'framework7-react';
import type { Router } from 'framework7/types';
import store, { allColors, findColor } from '../js/store';
import type { Palette, Settings } from '../js/types';
import { contrastRatio } from '../js/contrast';
import { useSwipeDown } from '../js/useSwipeDown';

/** #rgb or #rrggbb. Anything else is treated as still being typed. */
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

interface ColorPageProps {
  f7route: Router.Route;
  f7router: Router.Router;
}

// Every palette is implicitly paired against these two as well.
const BASE_COLORS = ['#ffffff', '#000000'];

/*
 * Filter tabs. Each shows pairings meeting *at least* its bar, keyed to normal
 * (small) text — so AAA is 7:1, AA is 4.5:1.
 *
 * "A" is not a WCAG level: the spec has no Level A contrast requirement, only
 * SC 1.4.3 (AA) and SC 1.4.6 (AAA). It is included here because it was asked for,
 * and mapped to 3:1 — the one other threshold WCAG actually defines, used by
 * SC 1.4.11 for non-text contrast and by SC 1.4.3 for large text. So the tabs form
 * a real ladder of WCAG numbers, but the "A" label is ours, not the spec's.
 */
const FILTERS = ['AAA', 'AA', 'A', 'All'] as const;
type Filter = (typeof FILTERS)[number];

const MIN_RATIO: Record<Filter, number> = {
  AAA: 7,
  AA: 4.5,
  A: 3,
  All: 0,
};

/*
 * The app tabbar lives at `.views > .tabbar` (z-index 5001), above this page's
 * stacking context, so a page-level bottom toolbar is drawn behind it.
 *
 * `noToolbar` is the only reliable way to suppress it. F7's own pageBeforeIn
 * handler resolves the parent toolbar and then branches on this exact class:
 *   if (page.$el.hasClass('no-toolbar')) app.toolbar.hide($toolbarEl);
 *   else                                 app.toolbar.show($toolbarEl);
 * Calling app.toolbar.hide() ourselves loses that race every time the handler
 * runs. Setting the class makes F7 do the hiding, and restores it automatically
 * when the next page without the class comes in.
 *
 * It resolves to the *views* tabbar, not our toolbar: the lookup tries
 * `.view > .toolbar` first (empty here), then `.views > .tabbar`, and only falls
 * back to `page.find('.toolbar')` if both miss. `.no-toolbar` has no CSS rules
 * attached, so nothing else changes.
 */

/** A colour to pair against. `name` is absent for black and white. */
interface Counterpart {
  value: string;
  name?: string;
}

interface ComboProps {
  background: string;
  foreground: string;
  /** Absent for black and white, which are not palette members. */
  label?: string;
  hex: string;
}

const Combo = ({ background, foreground, label, hex }: ComboProps) => (
  <div className="color-combo" style={{ backgroundColor: background, color: foreground }}>
    <span className="color-combo-large">Aa</span>
    <span className="color-combo-small">Small text sample</span>
    <span className="color-combo-label">
      {label && <b>{label}</b>}
      {hex}
    </span>
  </div>
);

const ColorPage = ({ f7route, f7router }: ColorPageProps) => {
  const { paletteId, colorId } = f7route.params;
  const palettes = useStore('palettes') as Palette[];
  const settings = useStore('settings') as Settings;

  // Seeds the initial tab only. Changing the setting later does not retroactively
  // move a tab the user has already switched on this page.
  const [filter, setFilter] = useState<Filter>(settings.defaultConformance);

  /*
   * The route param is only the entry point. Swiping the hero changes which
   * colour the whole page shows without navigating — F7 runs with
   * browserHistory: false, so there is no address bar to leave stale.
   */
  const [activeId, setActiveId] = useState(colorId ?? '');

  /*
   * Framework7 owns the selected-tab pill: it appends a `.tab-link-highlight`
   * span into the `.toolbar-pane` and positions it from whichever `.tab-link`
   * carries `tab-link-active` (components/toolbar/toolbar.js). It is imperative
   * — nothing watches the class — so switching filters has to ask it to move.
   *
   * The element is taken from the click rather than a ref because F7's Toolbar
   * component does not forward one.
   */
  const toolbarElRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (toolbarElRef.current) f7.toolbar.setHighlight(toolbarElRef.current);
  }, [filter]);

  const palette = palettes.find((p) => p.id === paletteId);
  const color =
    (palette && findColor(palette, activeId)) ??
    (palette && colorId ? findColor(palette, colorId) : undefined);

  /*
   * Half-typed hex lives here rather than in the store. Tagged with the colour it
   * belongs to, so swiping to another colour shows that colour's value instead of
   * carrying the previous field's text across.
   */
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null);

  /*
   * Swipe down on the hero to go back to the palette, the same gesture that
   * collapses an expanded card on the home page.
   *
   * The element is the Swiper's own root, taken from onSwiper rather than a ref
   * prop: swiper/react types `ref` as SwiperRef, not the element. That is safe
   * to bind to — Swiper resolves the drag angle once past 5px and, for a
   * horizontal swiper, hands back any gesture steeper than its 45° touchAngle
   * (shared/swiper-core.mjs), so a downward drag never competes with a slide.
   *
   * The scroller is Framework7's `.page-content`, which is not exposed as a ref,
   * so it is walked up to from the hero at touchstart.
   */
  const heroRef = useRef<HTMLElement | null>(null);
  useSwipeDown(heroRef, () => f7router.back(), {
    getScroller: () => heroRef.current?.closest<HTMLElement>('.page-content'),
  });

  // The colour can vanish while this page is open — deleted via swipe on the card
  // underneath, or the palette itself removed.
  if (!color || !palette) {
    return (
      <Page name="color" noToolbar>
        <Navbar title="Not found" backLink="Back" />
        <Block>That color is no longer in this palette.</Block>
      </Page>
    );
  }

  /*
   * Counterparts to pair this colour with: the rest of the palette, plus black and
   * white when the setting allows. Compared lowercased so a palette that already
   * contains #FFFFFF does not produce a duplicate tile, and the colour itself is
   * dropped — pairing it with itself renders an unreadable solid block.
   */
  const self = color.value.toLowerCase();
  const seen = new Set<string>([self]);
  const counterparts: Counterpart[] = [];

  // Palette colours first, so they keep their names; black and white have none.
  const flat = allColors(palette);

  flat.forEach((c) => {
    const value = c.value.toLowerCase();
    if (seen.has(value)) return;
    seen.add(value);
    counterparts.push({ value, name: c.name });
  });
  if (settings.showBaseColors) {
    BASE_COLORS.forEach((value) => {
      if (seen.has(value)) return;
      seen.add(value);
      counterparts.push({ value });
    });
  }

  /*
   * One ratio per counterpart, not per tile: the WCAG 2.x ratio is symmetric —
   * colorjs.io's own WCAG21 source notes it "does not matter which is foreground
   * and which is background" — so both sections below filter identically.
   */
  const visible = counterparts.filter(
    (c) => (contrastRatio(color.value, c.value) ?? 0) >= MIN_RATIO[filter],
  );

  return (
    <Page name="color" noToolbar>
      <Navbar title={color.name} subtitle={palette.name} backLink="Back" />

      <Toolbar tabbar bottom>
        {/*
          Real `.tab-link`s, so F7 draws and animates its own selection pill
          instead of us painting a background on the link. href={false} is what
          makes that safe: F7's delegated handler only calls app.tab.show() when
          the link has an href starting with "#" or a data-tab attribute
          (components/tabs/tabs.js), and Link defaults href to "#". With the
          default, every filter tap drove the app's real tab system and re-showed
          the app tabbar. Without an href, the handler is a no-op and these stay
          plain buttons whose state is React's.
        */}
        <ToolbarPane>
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={false}
              className={f === filter ? 'tab-link tab-link-active' : 'tab-link'}
              onClick={(e: React.MouseEvent) => {
                toolbarElRef.current = (e.currentTarget as HTMLElement).closest<HTMLElement>(
                  '.toolbar',
                );
                setFilter(f);
              }}
            >
              {f}
            </Link>
          ))}
        </ToolbarPane>
      </Toolbar>

      {/*
        swiper/react gives real components, so React owns the DOM here — no
        imperative init and no ownership fight. realIndex is used rather than
        activeIndex because loop mode inserts duplicate slides at both ends.
      */}
      <Swiper
        className="color-hero"
        /* Only the value; the contrasting colour is derived in CSS from this. */
        style={{ '--hero-color': color.value } as React.CSSProperties}
        modules={[Pagination]}
        /*
         * dynamicBullets keeps only a few bullets on screen and slides the window
         * as you move, instead of rendering one per colour — a palette with twenty
         * colours would otherwise draw twenty dots across the hero.
         * dynamicMainBullets is how many stay full-size; the rest taper off.
         */
        pagination={{ clickable: true, dynamicBullets: true, dynamicMainBullets: 3 }}
        onSwiper={(swiper) => {
          heroRef.current = swiper.el;
        }}
        initialSlide={Math.max(
          0,
          flat.findIndex((c) => c.id === color.id),
        )}
        loop={flat.length > 1}
        onSlideChange={(swiper) => {
          const next = flat[swiper.realIndex];
          if (next) setActiveId(next.id);
        }}
      >
        {flat.map((c) => (
          <SwiperSlide key={c.id} style={{ backgroundColor: c.value }} />
        ))}
      </Swiper>

      <List strong inset>
        <ListInput
          type="text"
          label="Name"
          placeholder="Color name"
          value={color.name}
          onInput={(e: any) =>
            store.dispatch('renameColor', {
              paletteId: palette.id,
              colorId: color.id,
              name: e.target.value,
            })
          }
        />
        <ListInput
          type="text"
          label="Hex"
          placeholder="#000000"
          value={draft && draft.id === color.id ? draft.text : color.value}
          onInput={(e: any) => {
            const next = e.target.value;
            setDraft({ id: color.id, text: next });
            // Only commit parseable values, so half-typed input like "#2a" never
            // reaches the store and blanks the hero and the tiles.
            if (HEX.test(next)) {
              store.dispatch('setColorValue', {
                paletteId: palette.id,
                colorId: color.id,
                value: next,
              });
            }
          }}
        />
      </List>

      {visible.length === 0 ? (
        <Block strong inset className="color-empty">
          No pairing in this palette reaches {filter} ({MIN_RATIO[filter]}:1) against{' '}
          {color.value}.
        </Block>
      ) : (
        <>
          <BlockTitle>{color.name} as foreground</BlockTitle>
          <Block>
            <div className="color-combo-grid">
              {visible.map((c) => (
                <Combo
                  key={`fg-${c.value}`}
                  background={c.value}
                  foreground={color.value}
                  label={c.name}
                  hex={c.value}
                />
              ))}
            </div>
          </Block>

          <BlockTitle>{color.name} as background</BlockTitle>
          <Block>
            <div className="color-combo-grid">
              {visible.map((c) => (
                <Combo
                  key={`bg-${c.value}`}
                  background={color.value}
                  foreground={c.value}
                  label={c.name}
                  hex={c.value}
                />
              ))}
            </div>
          </Block>
        </>
      )}
    </Page>
  );
};

export default ColorPage;
