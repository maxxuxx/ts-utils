# README positioning redesign

## Goal

Make the root README explain why `@maxxuxx/ts-utils` is useful before presenting its complete module inventory.

The README should position the package as a safety-first TypeScript toolkit for application boundaries: API requests and responses, untrusted JSON, runtime configuration, JWT claims, token sessions, and asynchronous control flow.

## Audience

- TypeScript developers building browser or Node.js applications
- Teams that want runtime validation at external data boundaries
- React or SvelteKit applications that need reusable API and session primitives
- Developers who prefer explicit, tree-shakable subpath imports over one large root namespace

## Reference patterns

The redesign adapts recurring patterns from established library READMEs:

- Lodash and date-fns state the category and practical value before listing APIs.
- Zod demonstrates its core promise with a small executable example near the top.
- Ky explains benefits over the platform primitive and then shows a concise usage example.
- Radash uses a compact kitchen-sink example to make the breadth of the library tangible.
- ts-pattern leads with the problem solved, a representative example, and a short feature list.

These references inform the information hierarchy only. The wording and examples will describe this repository's actual API and behavior.

## Positioning

Primary message:

> Safety-first TypeScript utilities for the boundaries where application data can fail.

Supporting message:

The package combines focused subpath modules for validated API clients, runtime parsing, sessions, JSON, JWT, promises, URLs, objects, and other common application work. Consumers import only the modules they need.

## README structure

1. Title and badges
2. One-sentence value proposition
3. Short supporting paragraph naming the main problem areas
4. `Why ts-utils?` with four concrete benefits
5. `Quick start` installation and one representative integrated example
6. `Built for application boundaries` with three focused examples:
   - validated API endpoint
   - safe JSON or runtime parsing
   - timeout/retry or token-session control flow
7. `Featured modules` highlighting `api-fetch`, `session`, `parser`, `promise`, `json`, and `jwt`
8. Existing full `Module map`, kept as the comprehensive reference
9. Runtime and compatibility notes
10. Development commands

The Korean README should remain linked from the top. This change is scoped to the root English README; translating the new narrative into `docs/readme.kr.md` can be done as a separate follow-up so the root improvement is not blocked.

## Core claims

The README may make the following claims because they are backed by the current source and package manifest:

- TypeScript-first and ESM-only
- explicit subpath imports with an intentionally empty package root
- Zod-backed validation where runtime schemas are useful
- browser and Node.js support, with runtime-specific device entry points
- optional React and iron-session peer integrations
- API validation, retry, timeout, auth refresh, hooks, and typed endpoints
- memory-first React sessions with opt-in persistence
- Result-based safe operations in JSON, JWT, promise, and error-boundary modules

The README must not claim zero dependencies, universal runtime support, signature verification for JWTs, or a measured bundle size.

## Representative example

The first example should use `api-fetch` because it is the package's strongest differentiator. It will show:

- `createApiFetcher`
- `endpoint.get`
- colocated `z` schemas
- path parameter validation
- response validation and inferred output
- timeout and retry configuration

The example should be short enough to scan without hiding the result behind placeholder helper functions.

Secondary examples should be independent snippets so readers can adopt a small module without committing to the API/session stack.

## Content constraints

- Preserve all public module links in the existing module map.
- Keep installation instructions for npm and GitHub.
- Explain the empty root import before showing subpath imports.
- Prefer concrete benefits over adjectives such as "powerful" or "best".
- Keep the root README as an overview; detailed behavior remains in each module README.
- Use only APIs verified against the current source.
- Avoid adding decorative images or unverified badges.

## Verification

- Run README and source-document tests.
- Run the complete test suite and typecheck when dependencies are available.
- Confirm every `package.json.exports` entry remains represented in the module map.
- Check all relative links in the root README.
- Verify code snippets use existing exports and valid option names.

## Success criteria

- A new reader can explain the package's purpose after the first screen.
- A new reader can copy a representative example before reaching the module map.
- The strongest modules are discoverable without scanning 24 rows.
- Existing consumers retain the complete module reference and migration link.
- README claims remain accurate to version `0.8.0` and do not overstate verification or compatibility.
