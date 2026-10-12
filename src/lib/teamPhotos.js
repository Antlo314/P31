// The team photoshoot (olive-green studio, October 2026). Originals live in marketing/team;
// these are the web-sized crops from scripts/team-photos.mjs.
//
// Who is who comes from the original file names (alexa.jpg, savannah.png, shnay.png, yanni.jpg):
// a = Alexia Thomas, b = Savannah Campbell, c = Shanay Prince, d = Yanni Bratcher, plus Melanie JC
// (marble dress). Each person's `photo` key lives in src/lib/team.js; every page follows it.
import melaniePortrait from '../assets/web/team/melanie-portrait.webp';
import melanieSquare from '../assets/web/team/melanie-square.webp';
import melanieWide from '../assets/web/team/melanie-wide.webp';
import melanieHead from '../assets/web/team/melanie-head.webp';
import teamA from '../assets/web/team/team-a.webp'; // Alexia Thomas: locs, leopard-print dress
import teamB from '../assets/web/team/team-b.webp'; // Savannah Campbell: white shirt, floral skirt, on the sofa
import teamC from '../assets/web/team/team-c.webp'; // Shanay Prince: cream vest and jeans, on the sofa
import teamD from '../assets/web/team/team-d.webp'; // Yanni Bratcher: black corset, on the stool
import teamAHead from '../assets/web/team/team-a-head.webp';
import teamBHead from '../assets/web/team/team-b-head.webp';
import teamCHead from '../assets/web/team/team-c-head.webp';
import teamDHead from '../assets/web/team/team-d-head.webp';
import teamGroup from '../assets/web/team/team-group.webp';
import teamGroupWide from '../assets/web/team/team-group-wide.webp';
import { TEAM } from './team';

export const MELANIE = { portrait: melaniePortrait, square: melanieSquare, wide: melanieWide, head: melanieHead };
/** The "Meet the team" event photo. It is not the team: it belongs only in the marketplace pop-up. */
export const GROUP = { tall: teamGroup, wide: teamGroupWide };

/** Round headshots and full portraits by photo key (src/lib/team.js → photo). */
export const HEADSHOTS = { melanie: melanieHead, a: teamAHead, b: teamBHead, c: teamCHead, d: teamDHead };
export const PORTRAIT_BY_KEY = { melanie: melaniePortrait, a: teamA, b: teamB, c: teamC, d: teamD };

/** Headshot per team member, by the name in src/lib/team.js. */
export const PHOTO_BY_NAME = Object.fromEntries(TEAM.filter((p) => p.photo && HEADSHOTS[p.photo]).map((p) => [p.name, HEADSHOTS[p.photo]]));
