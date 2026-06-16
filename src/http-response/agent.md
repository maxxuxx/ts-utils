# HTTP response module notes

## Purpose

This module provides small Web `Response` helpers for projects that need repeated JSON and message based route responses

It does not depend on Next.js, Express, or API fetch internals

## Public shape

Expose HTTP response utilities through `src/http-response/index.ts`

Consumers import this module through `@maxxuxx/ts-utils/http-response`

```ts
import { badRequest, jsonResponse, unauthorized } from "@maxxuxx/ts-utils/http-response";
```

Primary response vocabulary should stay small and direct

`jsonResponse`, `messageResponse`, `badRequest`, `unauthorized`, and `badGateway`

## Design decisions

The module uses the platform `Response` API directly

Status helpers accept caller-provided messages and only use English default messages when the caller omits one

Keep product copy, localization, auth policy, and app-specific error mapping in the consuming app

Do not import from `api-fetch` here unless the module intentionally grows a separate adapter for `ApiHttpError` style errors

Keep module docs updated whenever helper names, default messages, exports, or response body shapes change
## Public documentation

Every exported function, class, constant, interface, and type alias must have concise JSDoc before the declaration so editor hover explains purpose, important behavior, and expected usage
