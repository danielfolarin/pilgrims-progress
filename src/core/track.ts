// Anonymous counting of how far pilgrims get (Umami, loaded in index.html).
// Off the live site, or with a blocker on, there is no `umami` and this does nothing.
export function track(event: string, detail?: Record<string, string | number | boolean>) {
  try {
    (window as any).umami?.track(event, detail);
  } catch {
    // Counting must never get in the way of playing.
  }
}
