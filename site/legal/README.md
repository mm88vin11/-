# Юридический слой

Section 9 of the brief, treated as a hard constraint rather than as advice: a
development studio that gets a takedown notice for its own site has a
reputational hole, not a legal problem.

**The rule: the mechanic is the reference, never the character.** A pipe, a
falling block, two pills, a road with milestone signs and a door in fog are all
ordinary ideas. A plumber in a red cap, the word Tetris, a frame of The Matrix
and a Smash Mouth track are not.

## What was referenced, what was kept, and what it cost

| Reference | Not used | What the site does instead | Recognition kept |
| --- | --- | --- | --- |
| Mario | The character, his sprites, the game's typeface, its music | A dark basement world with 8-bit mystery blocks you strike from below, a coin arc on real physics, and a pixel HUD. No figure at all. | ~100% — the *gesture* is the memory, not the plumber |
| Shrek | The ogre, the layers gag, the Smash Mouth track | Morning fog over water, a door standing on its own, an ordinary person with a mug coming out of it. The "layers" copy became "what you are left with after launch". | ~95% — and it is a better scene than the reference was |
| Tetris | The name, the brand colours, the official piece set | Falling blocks labelled with real client messages, in a well, priced by stack height. Never called Tetris anywhere in the copy or the code. | 100% |
| The Matrix | Frames, the typeface, the score | Two pills, our own symbol rain in a shader, and six seconds of a grey Times New Roman world if you choose the blue one. | 100% |
| Back to the Future | The DeLorean, "88 mph", the logo, the flux capacitor | A first-person road that climbs out of the dark, with milestone signs instead of a speedometer. The old build's "88 MPH" dial was removed in the rebuild. | ~90% — and the metaphor reads better without the dial |
| Star Wars | The crawl typeface, the opening text, the score | A scroll-driven crawl with our own opening line and our own credits. | 100% |
| Stranger Things | The characters, the names, the theme | Blue fog, drifting spores, tendril vignette, a bulb wall that spells a word we chose. No names anywhere. | ~90% |
| Marauder's Map | The exact incantation, the Potter typography | A parchment map where ink spreads as you type our own phrase, with boot prints between cities. | ~90% |

## Assets

* **No third-party imagery.** The only raster assets are the studio's own
  wordmarks and the two cuts of the hero reel, all of which came from the
  previous build of this site and belong to the client.
* **No third-party fonts beyond their own licences.** Manrope (OFL), JetBrains
  Mono (OFL), Press Start 2P (OFL) and Russo One (OFL) are all SIL Open Font
  License. Subsets in `public/assets/fonts/` were carried over from the
  previous build of the same site.
* **No audio files at all.** Every sound is synthesised at runtime by
  `src/core/audio-bus.ts` from oscillators and a generated noise buffer.
  Nothing was recorded, sampled, bought or borrowed, so there is no licence to
  file here. This is the main reason `legal/` has no receipts folder: there is
  nothing to receipt.

If a recorded ambient bed is ever licensed for the swamp or the road, the
licence PDF goes in `legal/audio/` and `voice()` in the audio bus is the single
function to replace.

## Footer wording

The footer no longer claims that other universes are "used as an hommage" —
that sentence implied borrowing. It now says the mechanics are original and any
resemblance is not a claim of association, which is both true and safer.
