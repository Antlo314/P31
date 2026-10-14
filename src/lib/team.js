// The P31 Marketplace & Collective team directory (October 2026): one source for names, roles
// and inboxes, used by both sites, structured data, the Team page in Systems and the DM assistant.
// Each mailbox is its own login; the @p31market.com ones belong to the marketplace side and the
// @thep31collective.org ones to the Collective side.

export const FOUNDER = 'Melanie JC';

export const OFFICE = {
  phone: '(470) 562-2852',
  tel: '+14705622852',
  // A mailbox, so it's shown as a mailing address only (the Google listing is a service-area business).
  mailing: ['1475 Buford Drive #403-777', 'Lawrenceville, GA 30043'],
  hours: 'Monday–Friday, 10am–6pm',
};

// Who to write to, by topic.
export const EMAIL = {
  founder: 'founder@thep31collective.org',
  ceo: 'ceo@p31market.com',
  assistant: 'secretary@thep31collective.org',
  assistantMarket: 'secretary@p31market.com',
  marketing: 'marketing@p31market.com',
  members: 'members@thep31collective.org',
  community: 'outreach@p31market.com',
  grantsCollective: 'grants@thep31collective.org',
  grants: 'grants@p31market.com',
  support: 'coordinator@p31market.com',
  vendors: 'vendor@p31market.com',
};

// photo: the key of her headshot in src/lib/teamPhotos.js (none for Anthony yet).
export const TEAM = [
  { name: 'Melanie JC', role: 'Founder & CEO', focus: ['Vision & leadership', 'Partnerships & decisions'], emails: [EMAIL.founder, EMAIL.ceo], icon: 'crown', photo: 'melanie' },
  { name: 'Savannah Campbell', role: 'Executive Assistant', focus: ['Administrative support', 'Outreach communications'], emails: [EMAIL.assistant, EMAIL.assistantMarket], icon: 'clipboard', photo: 'c' },
  { name: 'Yanni Bratcher', role: 'Marketing Strategist', focus: ['Marketing strategy', 'Organization awareness'], emails: [EMAIL.marketing], icon: 'megaphone', photo: 'd' },
  { name: 'Alexia Thomas', role: 'Member Liaison', focus: ['Community experience', 'Event planning'], emails: [EMAIL.members, EMAIL.community], icon: 'people', photo: 'a' },
  { name: 'Shanay Prince', role: 'Support Coordinator', focus: ['Grants & partnerships', 'Operations support'], emails: [EMAIL.grantsCollective, EMAIL.grants, EMAIL.support], icon: 'headset', photo: 'b' },
  { name: 'Anthony Carr', role: 'Marketplace Tech Support', focus: ['Virtual marketplace troubleshooting', 'Vendor support'], emails: [EMAIL.vendors], icon: 'laptop', photo: null },
];

/** The team member a mailbox belongs to. */
export const memberByEmail = (email = '') => TEAM.find((p) => p.emails.includes(email.toLowerCase()));
