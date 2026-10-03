/**
 * Minimal browser globals for the Node-side store tests.
 *
 * The store is written for the app, so it reaches for `window` (toasts, URL
 * params) and `localStorage` (project + licence persistence). None of that is
 * under test here, but it has to exist before the module is evaluated — hence a
 * side-effecting import that the tests pull in first.
 *
 * Toasts are deliberately inert: `setTimeout` is a no-op so a queued dismissal
 * can never keep the process alive after the assertions finish.
 */
const store = new Map<string, string>();

const g = globalThis as Record<string, unknown>;
g.window = {
  clearTimeout: () => undefined,
  // Returned id is never cancelled, and the callback is dropped: a toast must
  // not schedule work that outlives the test run.
  setTimeout: (() => 0) as unknown,
  location: { search: '', pathname: '/', href: '' },
  history: { replaceState: () => undefined },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};
g.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

export {};