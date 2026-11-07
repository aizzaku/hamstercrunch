# Sunny Bakery artwork

Generated with the built-in ImageGen tool. The selected Sunny Bakery panel from the three-direction concept board was used as the visual reference. Original generated files remain in the Codex generated-images directory; these project copies are the runtime assets.

- `bakery-background.png`: warm watercolor miniature bakery, buttercream parchment center kept quiet, pink gingham awning, jam, cookies, flour, whisk and strawberries confined to outer edges; no text or gameplay objects. Landscape background layer.
- `bakery-sprites.png`: transparent 4-column × 2-row atlas. Top row: round fluffy hamster, rolling pin, paw biscuit, perforated cracker. Bottom row: sugar biscuit, heart-jam biscuit, chocolate checkerboard biscuit, strawberry gift biscuit packet. Front-facing hand-painted storybook assets, separate cells, no text. Normalized source bounds are in `bakery-art.js`.
- `burrow-radio.png`: isolated transparent front-facing strawberry-pink vintage tabletop radio, cream blank title plate, brass handle and dial, speaker grilles, clear lower area for real HTML buttons, no printed lettering or playback buttons.

Shared prompt direction: warm hand-painted watercolor children's-book quality, honey/butter yellow, strawberry pink and cocoa, softly textured, cute and cozy, no neon, dark terminal UI, perspective mockups or distracting central decoration.

## Adding the ElevenLabs soundtrack

Create `assets/music/` and add the finished MP3, WAV, OGG or M4A files with simple filenames containing letters, digits, underscores or hyphens. Add entries to `RADIO_TRACKS` in `radio.js`, for example:

```js
const RADIO_TRACKS = [
  {title:'First Crumbs',src:'assets/music/first-crumbs.mp3'},
  {title:'Sunflower Shuffle',src:'assets/music/sunflower-shuffle.mp3'},
];
```

The radio starts only after the player clicks Play. It supports previous/next, automatic advancement and remembered volume. Game effects have their own separate sound toggle. Without configured tracks, playback controls are disabled and the player displays an honest empty state.


### Burrow Radio tracks

Ten user-provided ElevenLabs tracks are served from `assets/music`: Burrow Comfort, Pantry Adventure, Tiny Paws Kitchen Dance, Snack Heist Shuffle, Snack Cupboard Shuffle, Moonlit Hamster Garden, Hamster Tea Rush, Biscuits on the Little Line, Snack Bowl Groove and Homeward Burrow. Each original is approximately 120 seconds. Files were copied without transcoding; the source folder stays unchanged. Controls support selection, shuffle, listening history and saved volume. Playback requires a user action.
