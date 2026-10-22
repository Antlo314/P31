// The P31 Podcast with Melanie JC (The Proverbs 31 Podcast on Buzzsprout): what the podcast band on
// both home pages shows. Links come from the Buzzsprout page; a platform without a link shows as a
// badge only (Buzzsprout lists no iHeartRadio or Audible link, and its YouTube link does not open).
import apple from '../assets/podcast/icon-apple.webp';
import spotify from '../assets/podcast/icon-spotify.webp';
import iheart from '../assets/podcast/icon-iheart.webp';
import audible from '../assets/podcast/icon-audible.webp';
import youtube from '../assets/podcast/icon-youtube.webp';
import { getSiteInfo } from './siteInfo';

// The links are site info (Systems > Site info), read when the band renders; the band calls useSiteInfo()
// so it re-renders when saved links arrive. An empty link shows that platform as a badge only.
const link = (key) => getSiteInfo()[key] || '';

export const PODCAST = {
  title: 'The Proverbs 31 Podcast',
  get listen() { return link('podcastListen'); },
  host: 'Melanie JC',
  themes: ['Biblical wisdom.', 'Powerful testimonies.', 'Kingdom entrepreneurship.'],
  family: ['P31 Marketplace', 'P31 Collective', 'P31 Movement'],
  platforms: [
    { id: 'apple', label: 'Apple Podcasts', icon: apple, get url() { return link('podcastApple'); } },
    { id: 'spotify', label: 'Spotify', icon: spotify, get url() { return link('podcastSpotify'); } },
    { id: 'iheart', label: 'iHeartRadio', icon: iheart, get url() { return link('podcastIheart'); } },
    { id: 'audible', label: 'Audible', icon: audible, get url() { return link('podcastAudible'); } },
    { id: 'youtube', label: 'YouTube', icon: youtube, get url() { return link('podcastYoutube'); } },
  ],
  // The podcast's own accounts (from the Buzzsprout page).
  social: {
    instagram: { handle: '@the.p31podcast', get url() { return link('podcastInstagram'); } },
    facebook: { handle: 'Facebook', get url() { return link('podcastFacebook'); } },
  },
};
