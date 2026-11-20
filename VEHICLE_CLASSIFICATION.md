# Vehicle photo classification

How Agnora decides that an uploaded image actually shows a car, and what
happens when it cannot decide.

## Why this document exists

A 1024×768 gaussian-noise JPEG was accepted by `/api/upload` with
`status 200, review=false`. Three independent faults combined:

1. `VEHICLE_CLASSIFIER` / `VEHICLE_CLASSIFIER_URL` were unset, so the `none`
   provider was selected and every image came back `unchecked`.
2. `decidePhoto()` mapped `unchecked` → **accept**. The gate was open by
   default rather than closed.
3. Even had the ONNX provider been selected in production it could not have
   run: `onnxruntime-web` was installed but **not declared** in
   `package.json` (so `npm ci` would not produce it), and `.models/` is
   gitignored (so the model is not deployed).

Faults 1 and 2 are fixed in code. **Fault 3 is a deployment decision and is
not resolved** — see *Deploying the ONNX provider*.

## Decision table

`lib/vehicle-classifier.ts` → `decidePhoto()`

| Classification | Action | HTTP | Effect |
|---|---|---|---|
| `vehicle`, score ≥ `ACCEPT` (0.75) | `accept` | 200 | Uploaded, counts toward the 10-photo requirement |
| `not_vehicle`, score ≥ `REJECT` (0.85) | `reject` | **422** | Refused before Cloudinary |
| `uncertain` | `review` | 200 | Uploaded but flagged; held `pending`, kept out of public view |
| `unchecked` (no provider) | `unavailable` | **503** | Refused before Cloudinary |
| `unavailable` (error/timeout/garbage) | `unavailable` | **503** | Refused before Cloudinary |

Both refusals return **before** `cloudinary.uploader.upload()`, so a refused
image never becomes an asset and never gets a classification row. No orphans.

`unchecked` and `unavailable` are deliberately distinct from `uncertain`: a
timeout is the *absence* of an opinion, not a weak one, and collapsing the two
is what let failures through.

## Required environment variables

Pick **one** provider. Nothing switches itself on implicitly — turning
classification on changes what gets published, so it is an explicit operator
decision.

### Option A — local ONNX (nothing leaves the server)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `VEHICLE_CLASSIFIER` | yes | — | Set to `onnx` (or `local`) |
| `VEHICLE_MODEL_PATH` | no | `.models/mobilenetv2-12.onnx` | Must exist at runtime |
| `VEHICLE_CLASSIFIER_ACCEPT` | no | `0.75` | Score at or above which `vehicle` is accepted |
| `VEHICLE_CLASSIFIER_REJECT` | no | `0.85` | Score at or above which `not_vehicle` is rejected |

Also requires the `onnxruntime-web` package (now declared under
`optionalDependencies`).

### Option B — HTTP classifier endpoint

| Variable | Required | Default | Notes |
|---|---|---|---|
| `VEHICLE_CLASSIFIER_URL` | yes | — | Endpoint receiving the raw image bytes |
| `VEHICLE_CLASSIFIER_TOKEN` | no | — | Sent as `Authorization: Bearer …` |
| `VEHICLE_CLASSIFIER_ACCEPT` / `_REJECT` | no | as above | |

**No endpoint is provided or assumed.** There is no default URL and none is
hardcoded. Supplying one is an infrastructure decision.

#### Endpoint contract

Request: `POST` with the image bytes as the body and the image's
`Content-Type`.

Response: JSON containing a `labels` array:

```json
{ "labels": [ { "name": "car", "confidence": 0.93 } ] }
```

A label whose `name` contains a vehicle term contributes its `confidence`.
Highest wins. Anything the server cannot parse into a known label is treated
as **`unavailable`** (503), not as a pass.

### Neither configured

Provider `none` → every image is `unchecked` → **every upload returns 503**.
That is intentional: with no classifier, Agnora cannot honour the claim that
listing photos show the vehicle, so it declines rather than pretending.

> Consequence: leaving both unset **blocks all photo uploads**, and therefore
> all new listings. Choose a provider before enabling this in an environment
> that must accept listings.

## Deploying the ONNX provider

Measured locally (Windows, Node 24):

| | |
|---|---|
| Model | MobileNetV2-12, **13.3 MB** (`.models/mobilenetv2-12.onnx`) |
| Cold first call | ~600 ms (includes session creation) |
| Warm call | ~55–65 ms |
| Process RSS after load | ~205 MB |
| Threads | pinned to 1 (`ort.env.wasm.numThreads = 1`) |

**Unresolved for serverless deployment:** `.models/` is in `.gitignore`, so
the model is not part of the deployment bundle. Running the ONNX provider on
Vercel requires one of:

- committing the model (adds ~13 MB to the repository), or
- fetching it at build time into the bundle, or
- running the detector as a sidecar and using **Option B** instead.

The ~205 MB resident set should also be checked against the function's memory
limit before enabling.

## Verifying real inference

Mocked tests prove the plumbing. They prove nothing about whether the model
can tell a car from a sofa. For that:

```sh
VEHICLE_CLASSIFIER=onnx node --import ./tests/helpers/register.mjs \
  scripts/verify-classifier.mjs ./photos/car1.jpg ./photos/sofa.jpg
```

It prints the label, score, decision and latency per image. **Accuracy has not
been measured against real photographs** — the thresholds above are
inherited defaults and should be calibrated once a real sample exists.

Guards on the live endpoint (auth, folder, size, magic bytes, resolution,
fail-closed 503) can be exercised with:

```sh
node scripts/staging/verify-upload-guards.mjs <creds.json> [baseUrl]
```

Every case in that script is refused *before* Cloudinary, so it creates no
assets.
