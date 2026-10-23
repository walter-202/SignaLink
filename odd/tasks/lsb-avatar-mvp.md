# LSB Avatar MVP

## Objective

Ship a self-owned, CC0-compatible 3D avatar that can demonstrate the LSB greeting `HOLA` in the existing web viewer without changing authentication, exposing private routes, or claiming linguistic validation that has not happened.

## Problem

The catalog is honest about missing LSB animation, but the viewer has no bundled animated avatar. The IVILSB assets cannot be redistributed because the repository has no license, and MMS-Player is GPL/NC-SA with no confirmed LSB vocabulary. A self-authored clip gives the MVP a demonstrable path while keeping the validation gate visible.

## Scope

- Bundle the MakeHuman/MPFB avatar and a `HOLA` clip under `apps/web/public/avatars/`.
- Load the bundled avatar by default in `AvatarPreview`, with the existing environment override still taking precedence.
- Keep the catalog honest: `HOLA` is a provisional own clip, not an IVILSB asset, and remains pending linguistic review.
- Do not change auth, Supabase configuration, camera capture, or private-route behavior.
- Do not copy IVILSB models, textures, clips, or images into the repository.

## Constraints

- Avatar source and output are CC0; the MPFB addon is GPL and MakeHuman is AGPL; neither codebase is redistributed.
- The sign is based on the official LSB Module 1 reference (page 56) and is not expert-validated.
- The viewer must never fall back to a different clip when the requested one is missing.
- Use the existing `resolveAnimationClip` behavior and the current playback controls.
- Keep the existing local GLB upload path working.

## Tasks

- [x] T1. Create a MakeHuman/MPFB avatar with GameEngine rig and finger bones.
- [x] T2. Add a provisional `HOLA` animation with idle, raise, wave, and return poses.
- [x] T3. Export `signalink_avatar.glb` with the `HOLA` clip and keep the `.blend` source.
- [x] T4. Load the bundled avatar by default in the viewer while preserving the env override.
- [x] T5. Update catalog source/status notes for the own `HOLA` clip.
- [x] T6. Update viewer tests for the bundled default and the exact-clip rule.
- [x] T7. Run tests, typecheck, lint, build, and visually verify the animated avatar.

## Acceptance Criteria

- The viewer loads `/avatars/signalink_avatar.glb` when `NEXT_PUBLIC_LSB_AVATAR_MODEL_URL` is unset.
- Selecting `HOLA` resolves the exact `HOLA` clip and shows a non-zero duration.
- Selecting another greeting does not play `HOLA` or the first available clip.
- The catalog marks `HOLA` as a provisional own clip and still shows that linguistic review is pending.
- Existing auth and private-route behavior are unchanged.
- Tests, typecheck, lint, and build pass with the repository's documented commands.

## Verification

- `cd apps/web; .\node_modules\.bin\vitest.cmd run`
- `cd apps/web; .\node_modules\.bin\tsc.cmd --noEmit`
- `cd apps/web; .\node_modules\.bin\eslint.cmd .`
- `cd apps/web; node scripts/copy-mediapipe-wasm.mjs; .\node_modules\.bin\next.cmd build`
- Visual check of the avatar at idle, raised hand, wave, and return frames.

## Progress

- Avatar generated with MPFB 2.0.18 in Blender 5.0.1.
- `HOLA` action exported with 159 animation channels; GLB is about 20.5 MB with all body, clothing, hair, eye, teeth, and tongue meshes.
- Pose reference: right upper arm local Y `-45°` for idle, Z `-50°` to raise, forearm Z `-90°`, hand Z `±30°` for the wave.
- The `.blend` source now contains the `HOLA` action.
- The viewer loads `/avatars/signalink_avatar.glb` by default; `off` keeps the provisional figure.
- Catalog marks `HOLA` as `SIGNALINK`/`provisional`; linguistic review remains pending.
- Verification: 67/67 tests, `tsc --noEmit` clean, `eslint .` clean, `next build` clean.
- Browser smoke check with Chromium: clip `HOLA`, duration `2s`, avatar renders with clothing/hair and raised hand.
- Actual Next.js viewer check with Playwright: status text, `0:00 / 0:02`, pause/resume, repeat, stop, canvas present, no console errors.
- The `.blend` source references local MPFB texture paths; the exported GLB embeds all textures, so runtime loading is self-contained.
- Engram mirror pending: this runtime does not expose an Engram write tool.

## Next Step

Obtain review from a person competent in LSB before changing the catalog to an available/validated state; then add clips for the remaining greetings.
