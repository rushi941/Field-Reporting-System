type SavedStyles = {
  htmlOverflow: string;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
  bodyPaddingRight: string;
};

let lockCount = 0;
let scrollY = 0;
let saved: SavedStyles | null = null;

/** Prevent page scroll while modals/dialogs are open (supports nested locks). */
export function lockPageScroll(): () => void {
  if (lockCount === 0) {
    scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    saved = {
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyWidth: document.body.style.width,
      bodyPaddingRight: document.body.style.paddingRight,
    };

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  lockCount += 1;

  return () => {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount !== 0 || !saved) return;

    document.documentElement.style.overflow = saved.htmlOverflow;
    document.body.style.overflow = saved.bodyOverflow;
    document.body.style.position = saved.bodyPosition;
    document.body.style.top = saved.bodyTop;
    document.body.style.width = saved.bodyWidth;
    document.body.style.paddingRight = saved.bodyPaddingRight;
    window.scrollTo(0, scrollY);
    saved = null;
  };
}
