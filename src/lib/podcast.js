// The P31 Podcast with Melanie JC (The Proverbs 31 Podcast on Buzzsprout): what the podcast band on
// both home pages shows. Links come from the Buzzsprout page; a platform without a link shows as a
// badge only (Buzzsprout lists no iHeartRadio or Audible link, and its YouTube link does not open).
import apple from '../assets/podcast/icon-apple.webp';
import spotify from '../assets/podcast/icon-spotify.webp';
import iheart from '../assets/podcast/icon-iheart.webp';
import audible from '../assets/podcast/icon-audible.webp';
import youtube from '../assets/podcast/icon-youtube.webp';

export const PODCAST = {
  title: 'The Proverbs 31 Podcast',
  listen: 'https://melaniejcpodcast.buzzsprout.com/',
  host: 'Melanie JC',
  themes: ['Biblical wisdom.', 'Powerful testimonies.', 'Kingdom entrepreneurship.'],
  family: ['P31 Marketplace', 'P31 Collective', 'P31 Movement'],
  platforms: [
    { id: 'apple', label: 'Apple Podcasts', icon: apple, url: 'https://podcasts.apple.com/us/podcast/neba-womens-ministrys-podcast/id1609875088' },
    { id: 'spotify', label: 'Spotify', icon: spotify, url: 'https://open.spotify.com/show/6NrJlx0dDts2cfUKP6ZIiE' },
    { id: 'iheart', label: 'iHeartRadio', icon: iheart, url: '' },
    { id: 'audible', label: 'Audible', icon: audible, url: '' },
    { id: 'youtube', label: 'YouTube', icon: youtube, url: '' },
  ],
  // The podcast's own accounts (from the Buzzsprout page).
  social: {
    instagram: { handle: '@the.p31podcast', url: 'https://www.instagram.com/the.p31podcast' },
    facebook: { handle: 'Facebook', url: 'https://www.facebook.com/share/1DaWb4crTC/' },
  },
};
