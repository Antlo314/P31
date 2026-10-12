// The P31 Podcast with Melanie JC: what the podcast band on both home pages shows.
// Paste each show link into `url` once it is live; a platform without a link shows as a badge only.
import apple from '../assets/podcast/icon-apple.webp';
import spotify from '../assets/podcast/icon-spotify.webp';
import iheart from '../assets/podcast/icon-iheart.webp';
import audible from '../assets/podcast/icon-audible.webp';
import youtube from '../assets/podcast/icon-youtube.webp';

export const PODCAST = {
  title: 'P31 Podcast',
  host: 'Melanie JC',
  themes: ['Biblical wisdom.', 'Powerful testimonies.', 'Kingdom entrepreneurship.'],
  family: ['P31 Marketplace', 'P31 Collective', 'P31 Movement'],
  platforms: [
    { id: 'apple', label: 'Apple Podcasts', icon: apple, url: '' },
    { id: 'spotify', label: 'Spotify', icon: spotify, url: '' },
    { id: 'iheart', label: 'iHeartRadio', icon: iheart, url: '' },
    { id: 'audible', label: 'Audible', icon: audible, url: '' },
    { id: 'youtube', label: 'YouTube', icon: youtube, url: '' },
  ],
  // Where to follow along: each site's own Instagram, and the P31 Facebook page.
  social: {
    instagram: {
      market: { handle: '@proverbs31market', url: 'https://www.instagram.com/proverbs31market' },
      collective: { handle: '@the.p31collective', url: 'https://www.instagram.com/the.p31collective' },
    },
    facebook: { handle: 'Proverbs 31 Marketplace', url: 'https://www.facebook.com/share/1LEtAu9AJD/?mibextid=wwXIfr' },
  },
};
