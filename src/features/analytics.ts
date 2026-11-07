import { inject, pageview, track } from "@vercel/analytics";

/**
 * Vercel Web Analytics, cookieless. Only on the deployed site.
 *
 * Page views work on every plan. Custom events (track) only show up on Vercel
 * Pro, so each milestone is also sent as a virtual page view under /_m/…: on
 * the Hobby plan the Pages panel then shows how many visitors hit each one.
 * Never sends values, stack contents or anything else from your results.
 */

const live = () => {
  const h = location.hostname;
  return /^https?:/.test(location.protocol) && h !== "localhost" && h !== "127.0.0.1" && !/claude|usercontent/.test(h);
};

let started = false;
function start() {
  if (started || !live()) return started;
  // we send our own page views so tab changes and milestones are counted the same way
  inject({ mode: "production", disableAutoTrack: true });
  started = true;
  return true;
}

export function trackPage(path: string) {
  if (!start()) return;
  pageview({ route: path, path });
}

/** Count a milestone once per browser session. Props must be plain numbers. */
export function milestone(name: string, props: Record<string, number> = {}) {
  const key = "spotter-m-" + name;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
  if (!start()) return;
  track(name, props);
  pageview({ route: "/_m/" + name, path: "/_m/" + name });
}
