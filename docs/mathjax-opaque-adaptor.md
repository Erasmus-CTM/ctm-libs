# Opaque-frame MathJax worker adaptor (activation gated)

## Optional CORS transport for static hosts

A linked pre-loader can explicitly select
`data-ctm-mathjax-transport="cors"`. This mode is for opaque boards on static
hosts that provide `Access-Control-Allow-Origin: *` but cannot provide CORP.
It preserves the original asynchronous MathJax entry script and load event.
Without this attribute, the existing transport is unchanged.

The optional mode CORS-fetches the original speech worker with credentials
omitted and imports its unchanged source through a data URL. The original
absolute maps URL and SRE message protocol remain unchanged. An HTTP or network
failure rejects worker creation before a Worker is created. MathJax's own
startup failure reporting remains a separate upstream concern; consumers must
retain bounded loading/error UI rather than assume every failure rejects its
startup promise.

If no authored `loader.require` exists, this mode uses MathJax's supported
loader hook to insert anonymous-CORS scripts for dynamic extensions and fonts.
Existing custom loaders, authored startup functions/adaptors, and ordinary
origins retain ownership. The opt-in requires CORS access and a CSP permitting
the asset requests (`connect-src`), scripts, and `worker-src data:`. It is
validated against the pinned MathJax4.1.3 bundled SRE worker; experimental
`isLab` workers or relative imports are outside this contract.

The parent must fetch the shared board template and install an opaque `srcdoc`
with an explicit base and resolved resource URLs. This component does not alter
sandbox/isolation, service workers, vendor files, global Worker/fetch, or
resource URLs. The native-board build owns its pinned local bundle and
checks its full dependency closure separately.

`runtime/mathjax-opaque-adaptor.js` is a pre-loader configuration component for
MathJax 4.1.3. It uses MathJax's DOM-adaptor startup API to create the original
speech-rule-engine worker from a data URL in an opaque frame. Speech, braille,
worker commands and mathmaps retain their existing implementation. Ordinary
origins retain native startup. Authored startup ready functions and explicitly
selected adaptors retain their own configuration.

This component is not registered in the default filters. JSXGraph needs a
supported pre-loader script hook that executes it before its **unchanged**
original asynchronous MathJax script. Replacing `src_mjx` with a loader wrapper
changes the original script's load-event lifecycle and is not adopted here.
The hook must accept an embedded script for self-contained output and a resolved
script URL for linked output; no generated-frame patch or isolation change is
needed. AC/Claude retain ownership of the JSXGraph upstream change and repin.

The component has no vendor URL or version table. Local MathJax, worker and map
URLs continue to belong to the existing shared asset resolver and official
asset lock. Local board activation also remains gated on JSXGraph's relative
URL/base handling; a referrer-derived fallback is not used. A CSP that restricts
workers must allow the `data:` scheme for this transport.

The bounded transport experiment at assessment PR #48, commit
`7bb1e892cc4ff2330b3fb9d390908424f7f27f9f`, passed all ten cases in Chromium,
Firefox and WebKit in run
[39908348722](https://github.com/Erasmus-CTM/ctm-assessment/actions/runs/39908348722).
It retained an isolated parent and opaque sandbox, rendered actual SVG glyphs,
produced the same speech/braille as native MathJax, honored speech/braille
settings, and passed an explicit `worker-src data:` policy. The original
WebKit blob-worker controls still failed and stalled conversion. That experiment
used a diagnostic loader wrapper; this canonical pre-loader requires its own
actual-browser check before activation. It does not clear combined course/store
or offline-board acceptance.

## First-visit COI coordination

The assessment producer's default pre-loader embeds an explicit
`CTM_COI_FRAME_STARTUP` capability and emits the matching synchronous head
`coi-frame-startup.js` dependency in the same nil-only metadata branch. Custom,
blank and false pre-loader overrides retain their existing behavior; loading the
standalone adaptor without that capability never waits for a parent.

A flagged opaque child requests permission with a fresh nonce. The parent accepts
only a live direct iframe's WindowProxy and replies only to that source and nonce;
the child accepts only its parent with the matching protocol version and nonce.
The parent waits until DOMContentLoaded to read the deferred COI module's actual
`qpyodideCoiSettled` promise. A retired document never releases the worker; a
retained document or a page without the COI component does. Removed/replaced
frames do not receive an acknowledgement.

Only the adaptor's optional `createWorker` call waits. The coordinator imports no
Python or MathJax and registers no speech readiness in the parent's initial UI
barrier. Worker or speech failure remains separate from ordinary Check and Python.
The capability depends on the producer's synchronous-head ordering, not a timeout
probe or a global Worker replacement. Real first-visit browser lifecycle evidence
is still required for the combined package.
