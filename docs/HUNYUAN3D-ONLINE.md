# Online 3D Studio with a Kaggle GPU

GEN3D 0.11 adds a desktop client and a personal hosted inference service using official Tencent Hunyuan3D-2mini source. It does not bundle model weights or claim ownership of Tencent's model. The notebook clones upstream revision `f8db63096c8282cb27354314d896feba5ba6ff8a` without modifying it. Model weights download from their publishers on first use.

## Supported workflows

- Image → Hunyuan3D-2mini → self-contained GLB.
- Text → SDXL-Turbo reference image → background removal → Hunyuan3D-2mini → GLB. This is a composed text workflow, not a native text-conditioned Hunyuan mesh model.
- Preview the returned model in GEN3D, explicitly use it on projection, or export a GLB copy. Downloaded models remain in the local generated-model library across app restarts, even when Kaggle disconnects.

This free-GPU profile produces untextured geometry. It does not generate textures, rigs, mouth morphs, animations or singing. The preview fixture is a triangle solely in tests; production never substitutes a fake model when inference fails.

## Start on Kaggle

1. Download `cloud/hunyuan3d/GEN3D-Kaggle.ipynb` from this repository or the 0.11 release. Upload it as a new Kaggle notebook.
2. Select a CUDA GPU accelerator and enable Internet. Account verification, current GPU availability, quotas, network policy and notebook time limits are controlled by Kaggle. A free GPU session is not permanent online hosting. A T4/P100 class GPU is the intended profile, not yet hardware-validated. GPU memory is not combined across two cards.
3. Open Kaggle's Secrets interface (Add-ons → Secrets), add `GEN3D_GPU_TOKEN` and enable it for this notebook. Use a unique random 32–512 character password, keep the same value securely for GEN3D, and never put it into a public notebook cell or Git. No Kaggle API key is required by the desktop app.
4. Read the included Tencent agreement and the SDXL-Turbo license. Run the two code cells. The second stays running intentionally. Dependencies install, the official source is checked out, CUDA/import checks run and a checksum-verified Cloudflare tunnel binary is prepared. Model weights download during generation. Downloads require several GB and time.
5. Copy the printed HTTPS connection URL into GEN3D's **Projection Studio → Online 3D Studio · Hunyuan3D**, enter the same GPU token and choose **Connect GPU**. The token field clears immediately; the main process retains it for the current app session only.
6. Enter a description of one object, or choose a PNG/JPEG up to 10 MB and 16 megapixels. Choose 10–50 shape steps, a seed and **Generate 3D model**. Text and images go only to the configured backend via the Cloudflare HTTPS tunnel; local image selection alone does not upload anything.
7. Review the model, save a GLB copy or deliberately select **Use reviewed model on projection**. Generation and preview do not change live projection. Generated geometry does not gain mouth animation automatically.

Leave the server cell running. Interrupting it stops the tunnel and backend. On notebook restart the URL changes; reconnect in the desktop app. Kaggle may terminate sessions independently. The desktop reports disconnects and never reports a missing GPU result as success.

## Resource and service behavior

Inference is serialized; at most three queued/running jobs are accepted. Text and shape pipelines load sequentially and release GPU memory between stages. Default shape resolution is 256 with smaller decode chunks. Actual VRAM/latency depends on the assigned accelerator and current Kaggle image. A running GPU operation cannot necessarily be interrupted immediately; cancellation discards its result at the next safe stage boundary. Desktop generation has a 20-minute deadline.

Requests require a bearer token, including health and downloads. The notebook token is read through Kaggle Secrets, is not printed, and is not placed on a process command line. Redirects are rejected by the desktop client. Requests, images and downloaded models are bounded; GLB validation rejects external linked files before local storage. Prompts and tokens are not saved in project backups. Backend terminal jobs expire after an hour; input images are deleted after processing. Session files may disappear when Kaggle ends. Keep local GLB copies.

The service binds loopback; only the authenticated tunnel exposes it. This is a personal single-session service, not a multi-tenant hosted product. Use it only where the notebook/network provider permits this workload. Do not share the token or publicize a notebook containing secrets.

## License and provenance

- Source: https://github.com/Tencent-Hunyuan/Hunyuan3D-2 at the revision above.
- Shape model: `tencent/Hunyuan3D-2mini`, subfolder `hunyuan3d-dit-v2-mini`.
- Text reference model: `stabilityai/sdxl-turbo`, under its separate publisher license.
- Tencent's agreement includes territorial restrictions (EU, UK and South Korea are excluded by its Territory definition) and an acceptable-use policy. See `HUNYUAN3D-LICENSE.txt` and `HUNYUAN3D-NOTICE.txt`; copies are included as desktop installer resources. No claim of unrestricted licensing is made.
- Cloudflare tunnel 2026.10.5 Linux AMD64 is checksum-verified in `bootstrap.py`. It is fetched in Kaggle, not bundled in the app.

## Executed validation and limits

Local checks cover authenticated requests, text/image validation, bounded queue, failure/expiry, cancellation, actual GLB download/storage/export, native Three.js review, persistence and operator-only IPC. They use synthetic inference fixtures. `npm test`, `DISPLAY=:99 npm run test:hunyuan` (from desktop) and `python3 -m unittest discover -s cloud/hunyuan3d/tests -v` exercise those checks.

No CUDA device or authenticated Kaggle session is available in this cloud workspace. The pinned GPU dependencies, actual model downloads, SDXL/Hunyuan inference, free-GPU memory fit, tunnel reachability from Kaggle and long-session behavior are not validated on Kaggle. The first real acceptance is running the supplied notebook with your accelerator. Errors require diagnosis; they are not silently bypassed. The notebook's CUDA/import check precedes opening the tunnel. Inspect `/kaggle/working/gen3d-gpu.log` for the failing stage/error class. Existing Windows/Android physical acceptance limitations continue to apply.
