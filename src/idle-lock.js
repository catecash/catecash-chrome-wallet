export const DEFAULT_LOCK_MINUTES = 5;
export const LOCK_MINUTES = Object.freeze([5, 15, 30, 60, 120, 240, 480]);

export function lockMinutes(raw) {
  const minutes = Number(raw);
  return LOCK_MINUTES.includes(minutes) ? minutes : DEFAULT_LOCK_MINUTES;
}

export function createIdleLock(onLock, now = Date.now, schedule = setTimeout, cancel = clearTimeout) {
  let minutes = DEFAULT_LOCK_MINUTES;
  let lastActivity = 0;
  let timer;
  let active = false;

  function check() {
    if (!active) return;
    const remaining = lastActivity + minutes * 60_000 - now();
    if (remaining <= 0) {
      stop();
      onLock();
    } else {
      cancel(timer);
      timer = schedule(check, remaining);
    }
  }

  function stop() {
    active = false;
    cancel(timer);
    timer = undefined;
  }

  return {
    start() { active = true; lastActivity = now(); check(); },
    activity() { if (active) { lastActivity = now(); check(); } },
    configure(raw) { minutes = lockMinutes(raw); check(); },
    check,
    stop,
  };
}
