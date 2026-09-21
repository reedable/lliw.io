import { useEffect, useRef, useState } from "react";
import Color from "colorjs.io";
import { colorChannels, formatChannels } from "../utils/colorEditing";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import {
  Page,
  Navbar,
  NavRight,
  Block,
  BlockTitle,
  Toolbar,
  ToolbarPane,
  Link,
  List,
  ListInput,
  ListItem,
  f7,
  useStore,
} from "framework7-react";
import type { Router } from "framework7/types";
import store, { allColors, findColor } from "../domain/store";
import type { Palette, Settings } from "../domain/types";
import { canonical, contrastRatio, flatten } from "../utils/contrast";
import { useSwipeDown } from "../hooks/useSwipeDown";
import styles from "./ColorPage.module.css";
import { RgbaSliders } from "./RgbaSliders";
import { HslaSliders } from "./HslaSliders";
import { OklchSliders } from "./OklchSliders";

type ColorField = "hex" | "rgb" | "hsl" | "oklch";

const COLOR_PLACEHOLDERS: Record<ColorField, string> = {
  hex: "#000000",
  rgb: "rgb(0, 0, 0)",
  hsl: "hsl(0, 0%, 0%)",
  oklch: "oklch(0% 0 0)",
};

const isValidColor = (value: string, field: ColorField): boolean => {
  const matchesFormat =
    field === "hex"
      ? value.startsWith("#")
      : (field === "rgb"
          ? /^rgba?\([^()]*\)$/i
          : field === "hsl"
            ? /^hsla?\([^()]*\)$/i
            : /^oklch\([^()]*\)$/i
        ).test(value);
  if (!matchesFormat || !CSS.supports("color", value)) return false;
  try {
    new Color(value);
    return true;
  } catch {
    return false;
  }
};

const formatColor = (value: string, field: ColorField): string => {
  try {
    return field === "hex"
      ? new Color(value).to("srgb").toString({ format: "hex" })
      : formatChannels(colorChannels(value, field), field);
  } catch {
    return value;
  }
};

interface ColorPageProps {
  f7route: Router.Route;
  f7router: Router.Router;
}

// Every palette is implicitly paired against these two as well.
const BASE_COLORS = ["#ffffff", "#000000"];

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
const FILTERS = ["AAA", "AA", "A", "All"] as const;
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
  <div
    className={styles.combo}
    style={{ "--tile-color": background, color: foreground } as React.CSSProperties}
  >
    <span className={styles.comboLarge}>Aa</span>
    <span className={styles.comboSmall}>Small text sample</span>
    <span className={styles.comboLabel}>
      {label && <b>{label}</b>}
      {hex}
    </span>
  </div>
);

const ColorPage = ({ f7route, f7router }: ColorPageProps) => {
  const { paletteId, colorId } = f7route.params;
  const palettes = useStore("palettes") as Palette[];
  const settings = useStore("settings") as Settings;

  // Seeds the initial tab only. Changing the setting later does not retroactively
  // move a tab the user has already switched on this page.
  const [filter, setFilter] = useState<Filter>(settings.defaultConformance);

  /*
   * The route param is only the entry point. Swiping the hero changes which
   * colour the whole page shows without navigating — F7 runs with
   * browserHistory: false, so there is no address bar to leave stale.
   */
  const [activeId, setActiveId] = useState(colorId ?? "");
  const [navbarTop, setNavbarTop] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    // The keyboard can pan the visual viewport without scrolling page-content.
    // Offset only the navbar so it stays at the visible top edge.
    const updateNavbarTop = () => {
      setNavbarTop(viewport.scale === 1 ? viewport.offsetTop : 0);
    };
    updateNavbarTop();
    viewport.addEventListener("resize", updateNavbarTop);
    viewport.addEventListener("scroll", updateNavbarTop);
    return () => {
      viewport.removeEventListener("resize", updateNavbarTop);
      viewport.removeEventListener("scroll", updateNavbarTop);
    };
  }, []);

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

  // Keep edits local until the checkmark is tapped.
  const [draft, setDraft] = useState<{
    id: string;
    name: string;
    value: string;
    inputs: Partial<Record<ColorField, string>>;
  } | null>(null);

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
    getScroller: () => heroRef.current?.closest<HTMLElement>(".page-content"),
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

  const editing = draft?.id === color.id ? draft : null;
  const beginEditing = () => {
    if (!editing) setDraft({ id: color.id, name: color.name, value: color.value, inputs: {} });
  };
  const editColor = (field: ColorField, text: string) => {
    const current = editing ?? { id: color.id, name: color.name, value: color.value, inputs: {} };
    const value = text.trim();
    if (isValidColor(value, field)) {
      setDraft({ ...current, value, inputs: { [field]: text } });
    } else {
      setDraft({ ...current, inputs: { ...current.inputs, [field]: text } });
    }
  };
  const hasInvalidInput =
    editing !== null &&
    Object.entries(editing.inputs).some(
      ([field, text]) => !isValidColor(text.trim(), field as ColorField),
    );
  const saveEdits = () => {
    if (!editing || hasInvalidInput) return;
    store.dispatch("renameColor", {
      paletteId: palette.id,
      colorId: color.id,
      name: editing.name,
    });
    store.dispatch("setColorValue", {
      paletteId: palette.id,
      colorId: color.id,
      value: editing.value,
    });
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setDraft(null);
  };

  /*
   * Counterparts to pair this colour with: the rest of the palette, plus black and
   * white when the setting allows. Deduped by canonical form so a palette that
   * already contains #FFFFFF does not produce a duplicate tile, and the colour
   * itself is dropped — pairing it with itself renders an unreadable solid block.
   */
  const self = canonical(color.value);
  const seen = new Set<string>([self]);
  const counterparts: Counterpart[] = [];

  // Palette colours first, so they keep their names; black and white have none.
  const flat = allColors(palette);

  flat.forEach((c) => {
    const key = canonical(c.value);
    if (seen.has(key)) return;
    seen.add(key);
    counterparts.push({ value: c.value, name: c.name });
  });
  if (settings.showBaseColors) {
    BASE_COLORS.forEach((value) => {
      const key = canonical(value);
      if (seen.has(key)) return;
      seen.add(key);
      counterparts.push({ value });
    });
  }

  /*
   * Filtered per direction, not once per counterpart.
   *
   * This used to be a single ratio reused by both grids, on the grounds that the
   * WCAG 2.x ratio is symmetric. That holds only while both colours are opaque.
   * Once either carries alpha the two directions are different composites — the
   * colour laid over the counterpart, versus the counterpart laid over it — and
   * they produce different numbers. So the two grids can legitimately show
   * different counterparts, and that is correct rather than a bug.
   */
  const bar = MIN_RATIO[filter];
  const visibleAsForeground = counterparts.filter(
    (c) => (contrastRatio(color.value, c.value) ?? 0) >= bar,
  );
  const visibleAsBackground = counterparts.filter(
    (c) => (contrastRatio(c.value, color.value) ?? 0) >= bar,
  );

  return (
    <Page name="color" noToolbar>
      <Navbar title={color.name} subtitle={palette.name} backLink="Back" style={{ top: navbarTop }}>
        {editing && (
          <NavRight>
            <button
              type="button"
              className={styles.saveButton}
              aria-label="Save changes"
              disabled={hasInvalidInput}
              onClick={saveEdits}
            >
              <span className="icon f7-icons" aria-hidden="true">
                checkmark
              </span>
            </button>
          </NavRight>
        )}
      </Navbar>

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
              className={f === filter ? "tab-link tab-link-active" : "tab-link"}
              onClick={(e: React.MouseEvent) => {
                toolbarElRef.current = (e.currentTarget as HTMLElement).closest<HTMLElement>(
                  ".toolbar",
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
        className={styles.colorHero}
        /*
         * The contrasting colour for the pagination bullets is derived in CSS
         * from this, so it has to be what is actually visible: a translucent
         * colour is flattened onto the base first. Handing contrast-color() the
         * raw value would have it pick a contrast against a colour nobody sees.
         */
        style={{ "--hero-color": flatten(color.value) } as React.CSSProperties}
        modules={[Pagination]}
        /*
         * dynamicBullets keeps only a few bullets on screen and slides the window
         * as you move, instead of rendering one per colour — a palette with twenty
         * colours would otherwise draw twenty dots across the hero.
         * dynamicMainBullets is how many stay full-size; the rest taper off.
         */
        pagination={{
          clickable: true,
          dynamicBullets: true,
          dynamicMainBullets: 3,
        }}
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
          if (next && next.id !== color.id) {
            setDraft(null);
            setActiveId(next.id);
          }
        }}
      >
        {flat.map((c) => (
          <SwiperSlide key={c.id} style={{ "--tile-color": c.value } as React.CSSProperties} />
        ))}
      </Swiper>

      <List strong inset>
        <ListInput
          type="text"
          label="Name"
          placeholder="Color name"
          value={editing?.name ?? color.name}
          onFocus={beginEditing}
          onInput={(e: any) =>
            setDraft({
              ...(editing ?? { id: color.id, name: color.name, value: color.value, inputs: {} }),
              name: e.target.value,
            })
          }
        />

        {(["hex", "rgb", "hsl", "oklch"] as const).map((field) =>
          field !== "hex" ? (
            <ListItem key={field}>
              <div slot="inner" style={{ width: "100%" }}>
                {field === "rgb" ? (
                  <RgbaSliders
                    key={color.id}
                    value={editing?.value ?? color.value}
                    onChange={(value) => editColor("rgb", value)}
                  />
                ) : field === "hsl" ? (
                  <HslaSliders
                    key={color.id}
                    value={editing?.value ?? color.value}
                    onChange={(value) => editColor("hsl", value)}
                  />
                ) : (
                  <OklchSliders
                    key={color.id}
                    value={editing?.value ?? color.value}
                    onChange={(value) => editColor("oklch", value)}
                  />
                )}
              </div>
            </ListItem>
          ) : (
            <ListInput
              key={field}
              type="text"
              label={field}
              placeholder={COLOR_PLACEHOLDERS[field]}
              value={editing?.inputs[field] ?? formatColor(editing?.value ?? color.value, field)}
              onFocus={beginEditing}
              onInput={(e: any) => editColor(field, e.target.value)}
              errorMessage={`Enter a complete ${field.toUpperCase()} color.`}
              errorMessageForce={
                editing?.inputs[field] !== undefined &&
                !isValidColor(editing.inputs[field]!.trim(), field)
              }
            />
          ),
        )}
      </List>

      {visibleAsForeground.length === 0 && visibleAsBackground.length === 0 ? (
        <Block strong inset className={styles.colorEmpty}>
          No pairing in this palette reaches {filter} ({MIN_RATIO[filter]}:1) against {color.value}.
        </Block>
      ) : (
        <>
          {/*
            The two sections are filtered independently, so one can be empty
            while the other is not — see the comment on the filters above.
          */}
          {visibleAsForeground.length > 0 && (
            <>
              <BlockTitle>{color.name} as foreground</BlockTitle>
              <Block>
                <div className={styles.comboGrid}>
                  {visibleAsForeground.map((c) => (
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
            </>
          )}

          {visibleAsBackground.length > 0 && (
            <>
              <BlockTitle>{color.name} as background</BlockTitle>
              <Block>
                <div className={styles.comboGrid}>
                  {visibleAsBackground.map((c) => (
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
        </>
      )}
    </Page>
  );
};

export default ColorPage;
