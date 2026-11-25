// GuyFran fork: UI persistence (global UI rule). The fork's own surfaces reopen as they were left:
// scroll positions of their lists and the restore debug window's position, size and maximized state.
// Stored in browser.storage.local, one key per value (`forkUi:<name>`); nothing in the extension
// listens to these keys. Inventory: docs/UI_PERSISTENCE.md.
import browser from "webextension-polyfill";

const PREFIX = "forkUi:";
const DEBOUNCE_MS = 250;
const RESTORE_WAIT_MS = 5000;

const pending = {};
let timer = null;

export const flushForkUi = () => {
  clearTimeout(timer);
  timer = null;
  const items = { ...pending };
  for (const key of Object.keys(pending)) delete pending[key];
  if (Object.keys(items).length) browser.storage.local.set(items).catch(() => {});
};

// A popup closes without warning: write what is pending as soon as the page goes away.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushForkUi);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushForkUi();
  });
}

export const getForkUi = async (name, fallback) => {
  const key = PREFIX + name;
  const stored = await browser.storage.local.get(key).catch(() => ({}));
  return key in stored ? stored[key] : fallback;
};

export const setForkUi = (name, value) => {
  pending[PREFIX + name] = value;
  clearTimeout(timer);
  timer = setTimeout(flushForkUi, DEBOUNCE_MS);
};

// React ref callback that restores and follows an element's scroll position. Content that renders
// after the element (async lists, a log refreshed every second) is waited for, unless the user
// scrolls first; the browser clamps an offset past the end itself.
export const persistScrollRef = name => {
  let attached = null;
  return el => {
    if (!el || el === attached) return;
    attached = el;
    let userScrolled = false;
    let restoring = false;
    el.addEventListener(
      "scroll",
      () => {
        if (restoring) return;
        userScrolled = true;
        setForkUi(name, Math.round(el.scrollTop));
      },
      { passive: true }
    );
    getForkUi(name, 0).then(saved => {
      const target = Number(saved) || 0;
      if (target <= 0) return;
      const apply = () => {
        if (userScrolled) return true;
        restoring = true;
        el.scrollTop = target;
        requestAnimationFrame(() => (restoring = false));
        return el.scrollTop >= target - 1;
      };
      if (apply()) return;
      const observer = new MutationObserver(() => apply() && observer.disconnect());
      observer.observe(el, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), RESTORE_WAIT_MS);
    });
  };
};

const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;
const MAX_SIZE = 20000;

// Saved bounds for windows.create(): normal-state bounds only, sane sizes, or {} for the default.
export const savedWindowBounds = async (name, defaults) => {
  const saved = await getForkUi(name, null);
  const b = saved?.bounds;
  const ok =
    b &&
    [b.left, b.top, b.width, b.height].every(Number.isFinite) &&
    b.width >= MIN_WIDTH &&
    b.height >= MIN_HEIGHT &&
    b.width <= MAX_SIZE &&
    b.height <= MAX_SIZE;
  return {
    bounds: ok ? { left: b.left, top: b.top, width: b.width, height: b.height } : defaults,
    maximized: saved?.state === "maximized"
  };
};

// Inside a window the extension opened (the restore debug page): pull it back onto the visible work
// area if it opened off-screen (monitor removed, resolution changed), then save its bounds whenever it
// is resized or moved and when it closes. A minimized window keeps the last normal bounds.
export const trackWindowBounds = async name => {
  let current = await browser.windows.getCurrent().catch(() => null);
  if (!current) return;
  const area = {
    left: screen.availLeft ?? 0,
    top: screen.availTop ?? 0,
    width: screen.availWidth,
    height: screen.availHeight
  };
  if (current.state === "normal") {
    const width = Math.min(current.width, area.width);
    const height = Math.min(current.height, area.height);
    const left = Math.min(Math.max(current.left, area.left), area.left + area.width - width);
    const top = Math.min(Math.max(current.top, area.top), area.top + area.height - height);
    if (left !== current.left || top !== current.top || width !== current.width || height !== current.height) {
      current = (await browser.windows.update(current.id, { left, top, width, height }).catch(() => null)) || current;
    }
  }

  let lastNormal = current.state === "normal" ? current : null;
  let lastState = current.state;
  const save = () => {
    if (lastState === "minimized") return;
    const bounds = lastNormal && {
      left: lastNormal.left,
      top: lastNormal.top,
      width: lastNormal.width,
      height: lastNormal.height
    };
    setForkUi(name, { state: lastState === "maximized" ? "maximized" : "normal", bounds });
  };
  const poll = async () => {
    const w = await browser.windows.getCurrent().catch(() => null);
    if (!w) return;
    const changed =
      w.state !== lastState ||
      (w.state === "normal" &&
        (!lastNormal || w.left !== lastNormal.left || w.top !== lastNormal.top || w.width !== lastNormal.width || w.height !== lastNormal.height));
    lastState = w.state;
    if (w.state === "normal") lastNormal = w;
    if (changed) save();
  };
  save();
  // Moving a window fires no page event: poll lightly, and on resize.
  window.addEventListener("resize", poll);
  setInterval(poll, 1500);
  window.addEventListener("pagehide", () => {
    if (lastState === "normal") {
      lastNormal = { left: window.screenX, top: window.screenY, width: window.outerWidth, height: window.outerHeight };
    }
    save();
    flushForkUi();
  });
};
