# A Danish Boy In Theresienstadt: Drawn Testimony

Welcome! 

https://drawn-testimony.github.io/

## Augmented reality

Choose **AR** in the navigation, allow camera access, and point the camera at any complete scene drawing. The camera fills the view. When a scene is recognized, the timeline moves to it and the story becomes available in the drawer over the camera. Highlighted objects open their related story entries. Camera access requires HTTPS or localhost.

The single `public/ar-targets/scenes.mind` library is compiled from the scene SVGs at 1800 pixels wide, in the order listed in `src/data/paintings.json`. After changing a scene drawing, the target resolution, or the scene order, run `npm run build:ar-targets` and commit the updated file. This script needs Google Chrome or a Chromium executable supplied through `CHROME_PATH`. `npm run build` regenerates the browser AR runtime.

The repository disables dependency install scripts because MindAR's unused Node canvas package requires native build tools. The AR target compiler runs in Chrome, and the browser runtime is bundled with esbuild.
