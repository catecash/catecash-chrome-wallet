import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdleLock, lockMinutes } from '../src/idle-lock.js';

function clock() {
  let time = 0;
  let next = 0;
  const timers = new Map();
  return {
    now: () => time,
    schedule: (fn, delay) => { const id = ++next; timers.set(id, { fn, at: time + delay }); return id; },
    cancel: id => timers.delete(id),
    advance(ms) {
      time += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= time) { timers.delete(id); timer.fn(); }
      }
    },
  };
}

test('auto-lock fires after five minutes without activity and activity restarts the deadline', () => {
  const time = clock();
  let locks = 0;
  const idle = createIdleLock(() => locks++, time.now, time.schedule, time.cancel);
  idle.start();
  time.advance(4 * 60_000);
  idle.activity();
  time.advance(4 * 60_000);
  assert.equal(locks, 0);
  time.advance(60_000);
  assert.equal(locks, 1);
  time.advance(60_000);
  assert.equal(locks, 1);
});

test('auto-lock accepts configured periods through eight hours and rejects invalid values', () => {
  const time = clock();
  let locks = 0;
  const idle = createIdleLock(() => locks++, time.now, time.schedule, time.cancel);
  assert.equal(lockMinutes(480), 480);
  assert.equal(lockMinutes(481), 5);
  idle.configure(480);
  idle.start();
  time.advance(479 * 60_000);
  assert.equal(locks, 0);
  time.advance(60_000);
  assert.equal(locks, 1);
  idle.start();
  idle.stop();
  time.advance(8 * 60 * 60_000);
  assert.equal(locks, 1);
});
