// The P31 Marketplace & Collective team directory: one source for names, roles and inboxes,
// used by both sites, structured data and the DM assistant's routing.

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
  support: 'coordinator@thep31collective.org',
  grants: 'grants@p31market.com',
  vendors: 'vendor@p31market.com',
};

export const TEAM = [
  { name: 'Melanie JC', role: 'Founder & CEO', focus: ['Vision & leadership', 'Partnerships & decisions'], emails: [EMAIL.founder, EMAIL.ceo], icon: 'crown' },
  { name: 'Savannah Campbell', role: 'Executive Assistant', focus: ['Administrative support', 'Outreach communications'], emails: [EMAIL.assistant, EMAIL.assistantMarket], icon: 'clipboard' },
  { name: 'Yanni Bratcher', role: 'Marketing Strategist', focus: ['Marketing strategy', 'Organization awareness'], emails: [EMAIL.marketing], icon: 'megaphone' },
  { name: 'Alexia Thomas', role: 'Member Liaison', focus: ['Community experience', 'Event planning'], emails: [EMAIL.members, EMAIL.community], icon: 'people' },
  { name: 'Shanay Prince', role: 'Support Coordinator', focus: ['Grants & partnerships', 'Operations support'], emails: [EMAIL.support, EMAIL.grants], icon: 'headset' },
  { name: 'Anthony Carr', role: 'Marketplace Tech Support', focus: ['Virtual marketplace troubleshooting', 'Vendor support'], emails: [EMAIL.vendors], icon: 'laptop' },
];
