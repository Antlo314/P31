// The team photoshoot (olive-green studio, October 2026). Originals live in marketing/team;
// these are the web-sized crops from scripts/team-photos.mjs.
//
// Who is who: Melanie JC is confirmed. The other four portraits are waiting on names; until a
// name is filled in here, that person's card shows their role icon instead of a photo.
import melaniePortrait from '../assets/web/team/melanie-portrait.webp';
import melanieSquare from '../assets/web/team/melanie-square.webp';
import melanieWide from '../assets/web/team/melanie-wide.webp';
import teamA from '../assets/web/team/team-a.webp'; // locs, leopard-print dress
import teamB from '../assets/web/team/team-b.webp'; // white shirt, floral skirt, on the sofa
import teamC from '../assets/web/team/team-c.webp'; // cream vest and jeans, on the sofa
import teamD from '../assets/web/team/team-d.webp'; // black corset, on the stool
import teamGroup from '../assets/web/team/team-group.webp';
import teamGroupWide from '../assets/web/team/team-group-wide.webp';

export const MELANIE = { portrait: melaniePortrait, square: melanieSquare, wide: melanieWide };
export const GROUP = { tall: teamGroup, wide: teamGroupWide };

/** The portraits that are not yet matched to a name (shown in the team gallery, never with a wrong name). */
export const PORTRAITS = [teamA, teamB, teamC, teamD];

/** Photo per team member, by the name in src/lib/team.js. Add the four names here once confirmed. */
export const PHOTO_BY_NAME = {
  'Melanie JC': melanieSquare,
  // 'Savannah Campbell': teamA,
  // 'Yanni Bratcher': teamB,
  // 'Alexia Thomas': teamC,
  // 'Shanay Prince': teamD,
};
