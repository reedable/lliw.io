import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/*
 * Swipe-down-to-dismiss, measured on whatever element is passed in. Either a
 * deliberate drag of SWIPE_DISTANCE, or a shorter flick of at least SWIPE_MIN
 * travelling faster than SWIPE_VELOCITY — the second is what makes a quick flick
 * work without demanding the full distance, which is how iOS dismissals read.
 */
const SWIPE_DISTANCE = 64;
const SWIPE_MIN = 16;
const SWIPE_VELOCITY = 0.5; // px per ms

interface SwipeDownOptions {
  /*
   * Bind only while this is true. A collapsed card, or a page that is not the
   * current one, wants its vertical drags left to the scroller underneath.
   */
  enabled?: boolean;
  /*
   * The scroller the gesture sits inside, resolved at touchstart rather than
   * held as a ref: one caller has the element in a ref already, the other has to
   * walk up to Framework7's `.page-content`. Anywhere but the very top and the
   * gesture is a scroll, not a dismissal — `scrollTop <= 0` rather than `=== 0`
   * because iOS rubber-band drives it negative. Omit for no guard.
   */
  getScroller?: () => HTMLElement | null | undefined;
}

/**
 * Native listeners rather than React props because touchmove has to be
 * non-passive: at the top of a scroller a downward drag is otherwise claimed by
 * it and rubber-bands the content, and only preventDefault stops that.
 */
export const useSwipeDown = (
  targetRef: RefObject<HTMLElement | null>,
  onSwipeDown: () => void,
  { enabled = true, getScroller }: SwipeDownOptions = {},
) => {
  /*
   * Both callbacks live in refs so the listeners below bind once per enable, not
   * once per render — callers build fresh closures every time they render.
   */
  const onSwipeDownRef = useRef(onSwipeDown);
  onSwipeDownRef.current = onSwipeDown;
  const getScrollerRef = useRef(getScroller);
  getScrollerRef.current = getScroller;

  useEffect(() => {
    if (!enabled) return;
    const target = targetRef.current;
    if (!target) return;

    let startX = 0;
    let startY = 0;
    let startAt = 0;
    let tracking = false;

    const onStart = (e: TouchEvent) => {
      const scroller = getScrollerRef.current?.();
      if (scroller && scroller.scrollTop > 0) return;
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startAt = e.timeStamp;
      tracking = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      // Mostly sideways: let it go, so a swipeout on a row — or a horizontal
      // Swiper under the same element — still starts here.
      if (Math.abs(dx) > Math.abs(dy)) {
        tracking = false;
        return;
      }
      if (dy > 0) e.preventDefault();
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches[0];
      const dy = touch.clientY - startY;
      const elapsed = e.timeStamp - startAt || 1;
      if (dy >= SWIPE_DISTANCE || (dy >= SWIPE_MIN && dy / elapsed >= SWIPE_VELOCITY)) {
        onSwipeDownRef.current();
      }
    };

    target.addEventListener('touchstart', onStart, { passive: true });
    target.addEventListener('touchmove', onMove, { passive: false });
    target.addEventListener('touchend', onEnd, { passive: true });
    target.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      target.removeEventListener('touchstart', onStart);
      target.removeEventListener('touchmove', onMove);
      target.removeEventListener('touchend', onEnd);
      target.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled, targetRef]);
};
