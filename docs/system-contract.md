# Ama Monster OS system bridge v1

> Status: implemented by the hosted plugin; reserved for the future built-in app.
> Contract ID: `ama.system.bridge` · Version: `1.0.0` · API level: `1`

This document is the handoff contract between the Ama Monster OS shell and its
host. The hosted N.E.K.O plugin is the first provider. A future standalone
build must be able to supply the same contract without importing the N.E.K.O
plugin facade.

## 1. Boundary

```text
ui/panel.tsx                  presentation only; Hosted UI props
__init__.py                   N.E.K.O SDK facade
app.py                        host-free runtime; JSON in / JSON out
system_contract.py            protocol + manifest + validation
system_port.py                N.E.K.O adapter
DesktopSystemPort             future built-in adapter (not in this repo)
```

`AmaOsRuntime` and `system_contract.py` use only the Python standard library.
`app.py` must stay free of N.E.K.O imports. If a change needs a host API, add it
to `SystemPort` rather than importing the host into the runtime.

## 2. SystemPort protocol

```python
class SystemPort(Protocol):
    provider_id: str
    mode: str
    capabilities: Sequence[str]

    def manifest(self) -> Mapping[str, Any]: ...
    async def environment(self) -> Mapping[str, Any]: ...
    async def activity(self) -> Mapping[str, Any] | None: ...
    def record_event(self, name: str, detail: str = "") -> None: ...
    async def close(self) -> None: ...
```

### `environment()`

Return non-sensitive facts only. The shipped adapter returns:

```json
{
  "host": "N.E.K.O",
  "host_surface": "plugin-manager",
  "plugin_id": "ama_monster_os",
  "platform": "Windows",
  "os_release": "11",
  "python": "3.11.17",
  "sdk": "0.1.0"
}
```

Do not include usernames, hostnames, absolute paths, environment variables, or
raw window titles.

### `activity()`

Return privacy-filtered activity, or `None` on failure:

```json
{
  "available": true,
  "privacy": "visible",
  "category": "game",
  "idle_seconds": 4.2
}
```

Allowed `privacy` values: `visible`, `private`, `unavailable`. When the state is
`private`, `category` and `idle_seconds` MUST be omitted or `null`. A future host
must preserve this rule; the shell itself also drops them defensively.

### `record_event()`

Best-effort host journal. It must never raise. A failing journal must not break
the window.

### `close()`

Release provider resources. Must be idempotent.

## 3. Manifest shape

`build_manifest()` produces the serialized contract:

```json
{
  "contract_id": "ama.system.bridge",
  "contract_version": "1.0.0",
  "schema_version": "1.0",
  "api_level": 1,
  "provider": "neko-plugin-host",
  "mode": "hosted-plugin",
  "capabilities": [
    "telemetry.environment",
    "activity.privacy",
    "actions.invoke",
    "events.record"
  ],
  "reserved": [
    {
      "id": "window.native",
      "state": "reserved",
      "summary": "Native always-on-top shell window managed by the built-in app."
    }
  ],
  "entrypoints": {
    "context": "os_shell",
    "pulse": "ama_pulse",
    "contract": "ama_system_contract"
  }
}
```

The JSON Schema is at
[`system-contract.v1.schema.json`](system-contract.v1.schema.json).

Modes:

- `hosted-plugin` — the current N.E.K.O panel.
- `desktop-builtin` — reserved for the future application.

## 4. Reserved seams

| id | State | Meaning |
|----|-------|---------|
| `window.native` | reserved | Native always-on-top shell window. |
| `process.supervision` | reserved | Start/stop/health-check companion processes with consent. |
| `vault.storage` | reserved | User-scoped settings and secrets from the desktop vault. |
| `voice.pipeline` | reserved | Speech input/output handoff. |
| `module.registry` | reserved | Additional OS modules beyond the preview. |

A reserved seam is declared, not implemented. A provider must not advertise a
capability it cannot serve.

## 5. Future desktop integration sequence

1. Implement `DesktopSystemPort` in the desktop app.
2. Construct `AmaOsRuntime(DesktopSystemPort(...))`.
3. Call `await runtime.start()` when the app shell opens.
4. Render `runtime.snapshot()` in an equivalent shell view. The current TSX is
   written against the Hosted UI bridge; a desktop build can reuse the visual
   design, but must provide its own renderer or bundle.
5. Call `runtime.pulse()` for the pulse button and `runtime.contract()` for the
   bridge page.
6. Call `await runtime.stop()` before exiting.
7. Keep `contract_version` at `1.0.0` for additions that do not break v1. Bump
   the major version and update the schema for breaking changes.

The hosted plugin's UI action and entries stay N.E.K.O-specific; the desktop
build does not need to expose them.

## 6. Compatibility rules

- Adding an optional snapshot key is non-breaking; removing or renaming one is
  breaking.
- New capabilities may be added to `capabilities`; consumers must ignore
  unknown capability strings.
- `reserved` entries may move from `reserved` to `implemented` by adding a new
  `state` value; do not reuse a reserved id for a different meaning.
- `mode` must be one of the declared modes.
- The shell must degrade safely when any port call raises or times out.

## 7. Verification

The shipped tests cover:

- manifest validation and reserved ids;
- `SystemPort` protocol conformance of the N.E.K.O adapter shape;
- private activity not leaking category/idle time;
- runtime boot, pulse, shutdown, and degraded-host behaviour;
- serializability of the complete snapshot.
