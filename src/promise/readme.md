# Promise module

Dependency free helpers for promise timing, retries, and concurrent task execution

## Public API

```ts
import {
  all,
  allObject,
  promise,
  retry,
  run,
  settleObject,
  withTimeout
} from "@maxxuxx/ts-utils/promise";
```

## Defaults

The default behavior is intentionally conservative

```ts
{
  timeoutMs: undefined, // no timeout unless provided
  retries: 0,
  delayMs: 300
}
```

`retry` and `run` receive a task function, not an already created promise, so the task can be executed again when retrying

```ts
await promise.run(fetchUser, {
  timeoutMs: 5000,
  retries: 2,
  delayMs: 300
});
```

## Multiple API requests

Use `allObject` when named results are easier to read than tuple positions

```ts
const { user, orders, notifications } = await promise.allObject(
  {
    user: fetchUser,
    orders: {
      task: fetchOrders,
      retries: 3,
      delayMs: 500
    },
    notifications: {
      task: fetchNotifications,
      timeoutMs: 2000,
      retries: 0
    }
  },
  {
    timeoutMs: 5000,
    retries: 2,
    delayMs: 300
  }
);
```

Common options are applied first. Per-task options override only the fields they define.

Use `all` when tuple ordering is preferred

```ts
const [user, orders] = await all([
  fetchUser,
  {
    task: fetchOrders,
    timeoutMs: 3000
  }
], {
  retries: 2,
  delayMs: 300
});
```

## Partial failure

Use `settleObject` when some requests can fail without rejecting the whole operation

```ts
const result = await settleObject({
  user: fetchUser,
  orders: fetchOrders,
  notifications: fetchNotifications
}, {
  timeoutMs: 5000
});

if (result.user.ok) {
  result.user.data;
} else {
  result.user.error;
}
```

## Single helpers

```ts
await promise.sleep(300);

const user = await withTimeout(fetchUser, {
  timeoutMs: 5000
});

const orders = await retry(fetchOrders, {
  retries: 2,
  delayMs: 300
});
```

`PromiseTimeoutError` is thrown when a timeout is reached.
