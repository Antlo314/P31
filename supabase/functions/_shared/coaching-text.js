// The three private-coaching intake forms, word for word from the Google Forms they replace
// (2026-10-14), in the order a client signs them: the Business Coaching Agreement, the
// Confidentiality & Non-Disclosure Agreement, then the Client Safety & Emergency Contact form.
// One file for the site (src/academy/coaching), the emails and the PDF copies (join-notify).
// Plain JavaScript with no imports, so both the browser and Deno can load it.

export const COACHING_TERMS_VERSION = '2026-10';
export const ORDER = ['coaching', 'confidentiality', 'safety'];

/** The Google Forms these replaced; the site keeps them as a fallback link. */
export const GOOGLE_FORMS = {
  coaching: 'https://docs.google.com/forms/d/e/1FAIpQLScgSyPZA3d21nR2nA7CyYwPjCjCL-5kB3wxJgBZe51xKE02lg/viewform',
  confidentiality: 'https://docs.google.com/forms/d/e/1FAIpQLSdkv5zcyFFzgiLmNcmehwRSAy6WGC0GPUKSbnepRaBW2UOUxg/viewform',
  safety: 'https://docs.google.com/forms/d/e/1FAIpQLSd4YflYO-GUMaNCjx1_f9i0rMybAm9iqOproUlvu41VuG01fQ/viewform',
};

/**
 * The four packages from section 5. Their prices are NOT here: they live in academy_plans (v47 adds one
 * monthly plan per package, editable in Systems → Academy) and reach the page only through a private
 * link, the same plan the client is later charged for. Mentorship prices are never public.
 */
export const PACKAGES = [
  { key: 'Option 1', name: 'Business Strategy & Development Coaching', cadence: 'Biweekly | 60 minutes', detail: 'Two private coaching sessions monthly, including individualized business strategy, development guidance, actionable business plans, and recommendations.' },
  { key: 'Option 2', name: 'Hybrid Private Mentorship & Business Coaching', cadence: 'Biweekly | 90 minutes', detail: 'Two private sessions monthly, integrating business strategy and development with personal growth, faith-based mentorship, and discipleship.' },
  { key: 'Option 3', name: 'Business Strategy & Development Coaching', cadence: 'Weekly | 60 minutes', detail: 'Four (4) private coaching sessions, monthly weekly sessions, sixty (60) minutes. Individualized business coaching and strategic guidance. Business action steps and recommendations.' },
  { key: 'Option 4', name: 'VIP Hybrid Private Mentorship & Business Coaching', cadence: 'Weekly | 90 minutes', detail: 'Four private sessions monthly, integrating business strategy, development, personal growth, and discipleship with comprehensive action planning, accountability, and priority support.' },
];

export const COACHING = {
  kind: 'coaching',
  title: 'P31 Business Coaching Agreement',
  subtitle: 'Business Coaching by Proverbs 31 Collective by NEBA',
  tagline: 'Business Strategy • Development • Accountability • Execution',
  intro: [
    'This Private Business Coaching Agreement (“Agreement”) is entered into on the date signed below between Melanie JC, Business Coach for P31 Collective by NEBA (“Coach”), and the Client named below (“Client”).',
    'Coaching services will be conducted virtually and/or in person, based on mutually agreed arrangements.',
  ],
  sections: [
    { title: '1. Purpose & Vision', paras: [
      'The purpose of P31 Collective Private Business Coaching is to equip aspiring and established entrepreneurs with strategic guidance, practical business knowledge, accountability, and actionable plans to develop, launch, manage, and grow their businesses.',
      'Rooted in the biblical principle of Habakkuk 2:2–3, this coaching program emphasizes clarity of vision, intentional planning, disciplined execution, and stewardship of God-given gifts and opportunities.',
    ] },
    { title: '2. Agreement Term', items: [
      'a. This Agreement becomes effective on the date signed and requires a minimum commitment of four (4) months.',
      'b. Following the initial four-month commitment, coaching services may continue on a month-to-month basis under the selected coaching plan.',
      'c. Either party may terminate the Agreement after the initial commitment by providing at least fourteen (14) days’ written notice, subject to the termination provisions below.',
    ] },
    { title: '3. Business Coaching Services', paras: ['The Coach agrees to provide individualized business coaching tailored to the Client’s entrepreneurial goals, business stage, and identified areas of development.', 'Coaching services include:'], items: [
      'Business Strategy & Development: Establishing business objectives, evaluating business models, and developing actionable growth strategies.',
      'Business Blueprint & Planning: Assisting with business plans, vision development, operational structure, and launch preparation.',
      'Brand Development & Positioning: Providing strategic feedback on branding, messaging, customer experience, and market positioning.',
      'Business Systems & Operations: Reviewing existing business processes, workflows, organizational systems, and opportunities for improvement.',
      'Action Plans & Accountability: Establishing measurable goals, assigning action steps, and evaluating progress.',
      'Launch & Growth Strategy: Providing guidance on product or service launches, marketing initiatives, and sustainable business development.',
      'Business Reviews: Evaluating current business systems, challenges, and progress to identify strategic priorities.',
      'Priority Support: Providing additional guidance between sessions when included in the selected coaching package.',
    ], after: ['The specific areas of focus will be determined by the Client’s business needs and mutually established goals.'] },
    { title: '4. Responsibilities', paras: ['A. Coach Responsibilities. The Coach agrees to:'], items: [
      'Provide professional business guidance, strategic insight, and practical recommendations.',
      'Assist the Client in establishing realistic business goals and developing actionable plans.',
      'Offer constructive feedback on business ideas, operations, branding, and strategic decisions.',
      'Provide relevant tools, resources, assignments, and recommendations when appropriate.',
      'Conduct progress reviews and provide accountability throughout the coaching relationship.',
      'Maintain professional boundaries and treat confidential business information with reasonable care.',
    ], paras2: ['B. Client Responsibilities. The Client agrees to:'], items2: [
      'Actively participate in all scheduled coaching sessions.',
      'Complete assigned business action plans, exercises, and agreed-upon deliverables.',
      'Provide accurate information regarding business operations, challenges, and goals.',
      'Remain receptive to constructive feedback and strategic recommendations.',
      'Take responsibility for implementing agreed-upon strategies and making independent business decisions.',
      'Communicate challenges, scheduling conflicts, and concerns promptly.',
      'Maintain timely payments according to the selected coaching package.',
    ], after: ['Coaching is a collaborative process. Progress depends significantly on the Client’s participation, consistency, decision-making, and implementation.'] },
    { title: '5. Coaching Packages & Investment', paras: ['The Client agrees to pay the coaching fees associated with the selected package for the duration of the Agreement.'], packages: true, after: ['Additional Benefits: All coaching packages include membership access to P31 Collective by NEBA, all membership perks and P31 vendor savings.'] },
    { title: '6. Payment Authorization & Collection', items: [
      'a. Monthly coaching fees will be automatically charged to the credit or debit card provided by the Client on the first day of each monthly billing cycle, as established in the Payment Authorization Form.',
      'b. The Client authorizes recurring charges associated with the selected coaching package throughout the Agreement’s active term.',
      'c. If a payment is declined, the Client will be notified and expected to resolve the outstanding balance within seven (7) calendar days.',
      'd. Following two (2) returned or declined payments within a six-month period, a $25 administrative fee may apply to subsequent returned payments, to the extent permitted by applicable law and disclosed in advance.',
      'e. Coaching sessions may be temporarily suspended until outstanding balances are satisfied. Suspension does not automatically cancel the Client’s contractual obligations.',
      'f. Any alternative payment arrangements must be approved in writing by program Founder.',
    ] },
    { title: '7. Scheduling, Rescheduling & Cancellation', items: [
      'a. All coaching sessions must be scheduled in advance based on mutual availability.',
      'b. Rescheduling or cancellation requests must be communicated at least twenty-four (24) hours before the scheduled session.',
      'c. Failure to provide the required notice may result in forfeiture of the scheduled session, which will count as a completed session.',
      'd. If the Client arrives more than fifteen (15) minutes late without prior notification, the appointment may be classified as a no-show and counted as a completed session.',
      'e. If the Coach must reschedule a session, the Client will be offered a mutually agreeable replacement date without additional charge.',
      'f. Unused monthly sessions do not automatically roll over into subsequent billing cycles unless an exception is approved in writing by the Coach.',
    ] },
    { title: '8. Termination & Refund Policy', items: [
      'a. The Client agrees to fulfill the initial four-month (4) coaching commitment.',
      'b. After the initial commitment, either party may terminate this Agreement by providing fourteen (14) days’ written notice.',
      'c. Notice of termination must be submitted before the next scheduled billing date to prevent additional recurring charges.',
      'd. Any prepaid fees for services that will not be delivered following an approved termination will be refunded within fourteen (14) calendar days of the effective termination date, subject to applicable law and the terms of this Agreement.',
      'e. Fees for completed sessions, late cancellations, and no-shows are nonrefundable, except where required by law.',
      'f. If the Coach terminates the Agreement without cause, the Client will receive a refund for prepaid services not delivered.',
      'g. Early termination during the initial four-month commitment must be agreed upon in writing, except where termination rights are provided by applicable law.',
    ] },
    { title: '9. Confidentiality & Intellectual Property', items: [
      'a. Both parties agree to respect the confidentiality of private business information exchanged during coaching sessions.',
      'b. The Coach will not intentionally disclose the Client’s confidential business information to unauthorized third parties without consent, except when required by law.',
      'c. All original coaching materials, business frameworks, templates, worksheets, and educational resources provided by P31 Collective by NEBA remain the intellectual property of their respective owners.',
      'd. The Client receives a limited right to use provided coaching materials for personal or internal business development purposes.',
      'e. The Client may not reproduce, resell, redistribute, or commercially teach proprietary coaching materials without written authorization.',
    ] },
    { title: '10. Professional Scope & Business Results', items: [
      'a. The Client acknowledges that business coaching provides educational guidance, strategic recommendations, and accountability. It does not constitute legal, tax, accounting, investment, or other regulated professional advice.',
      'b. The Coach does not guarantee specific financial outcomes, revenue increases, business success, customer acquisition, or profitability.',
      'c. The Client maintains full responsibility for business decisions, financial commitments, legal compliance, and implementation of strategies.',
      'd. The Client is encouraged to seek appropriately licensed professional advice when circumstances require specialized legal, financial, or regulatory expertise.',
      'e. The Coach will provide services in good faith, with professionalism and reasonable care.',
    ] },
    { title: '11. Agreement & Acknowledgment', paras: [
      'By signing below, both parties acknowledge that they have reviewed and understand the terms of this Private Business Coaching Agreement.',
      'The Client confirms that participation is voluntary and agrees to the selected coaching package, payment obligations, scheduling policies, and minimum commitment.',
    ] },
  ],
  coach: ['Melanie JC', 'Business Coach / Private mentor', 'P31 Collective by NEBA'],
  ack: 'By entering your full name below, you acknowledge and agree to the above contract and are ready to begin.',
};

export const CONFIDENTIALITY = {
  kind: 'confidentiality',
  title: 'P31 Business Coaching Confidentiality Agreement',
  subtitle: 'Business Coaching Service of Proverbs 31 Collective by NEBA',
  tagline: 'Business Coaching Confidentiality & Non-Disclosure Agreement',
  intro: [
    'This Business Coaching Confidentiality and Non-Disclosure Agreement (“Agreement”) is entered into as of the date signed below by and between Melanie JC, operating through Proverbs 31 Business Coaching by P31 Collective by NEBA (“Coach”), and the Client named below (“Client”), collectively referred to as the “Parties.”',
  ],
  sections: [
    { title: '1. Purpose', paras: [
      'The Parties intend to establish a professional, one-on-one business coaching relationship designed to support entrepreneurial development, strategic business planning, brand development, operational systems, business growth, and professional accountability.',
      'The coaching relationship may incorporate faith-based principles, leadership development, and purpose-driven entrepreneurship.',
    ] },
    { title: '2. Confidential Information', paras: ['During the coaching relationship, either Party may disclose confidential, proprietary, or sensitive information to the other.', '“Confidential Information” includes, but is not limited to:'], items: [
      'Business plans, strategies, concepts, and development initiatives.',
      'Financial records, pricing structures, revenue information, and business projections.',
      'Customer information, vendor relationships, and business contacts.',
      'Marketing strategies, branding concepts, and operational procedures.',
      'Proprietary coaching methods, frameworks, training materials, templates, and resources.',
      'Personal or professional information shared during private coaching sessions.',
      'Other information reasonably understood to be confidential based on its nature or the circumstances of disclosure.',
    ] },
    { title: '3. Mutual Confidentiality Obligations', paras: ['Both Parties agree to:'], items: [
      'a. Maintain the confidentiality of information disclosed during the coaching relationship.',
      'b. Refrain from sharing, distributing, reproducing, or disclosing Confidential Information to unauthorized third parties without prior written consent.',
      'c. Use Confidential Information solely for purposes directly related to the coaching relationship.',
      'd. Exercise reasonable care to safeguard confidential business documents, communications, and proprietary information.',
    ], after: ['These obligations apply equally to the Coach and Client.'] },
    { title: '4. Protection of Coaching Materials & Intellectual Property', paras: [
      'All original coaching frameworks, business development strategies, worksheets, templates, educational materials, presentations, and resources developed or owned by the Coach remain the intellectual property of their respective owner.',
      'Unless otherwise agreed in writing, the Client receives a limited, nonexclusive, nontransferable license to use Coach-provided materials for the Client’s own business development purposes.',
      'The Client may not reproduce, resell, distribute, publish, or commercially exploit the Coach’s proprietary materials without prior written authorization.',
      'The Client retains ownership of the Client’s preexisting business ideas, brands, documents, strategies, and other intellectual property.',
    ] },
    { title: '5. Exceptions to Confidentiality', paras: ['Confidentiality obligations shall not apply to information that:'], items: [
      'a. Becomes publicly available through no violation of this Agreement.',
      'b. Was lawfully known to the receiving Party before disclosure.',
      'c. Is independently developed without use of the other Party’s Confidential Information.',
      'd. Is lawfully obtained from an independent third party without confidentiality restrictions.',
      'e. Must be disclosed pursuant to applicable law, court order, or lawful governmental requirement.',
    ], after: ['When legally permitted, the disclosing Party shall provide reasonable notice before any legally required disclosure.'] },
    { title: '6. Business Coaching Relationship', paras: [
      'The Client acknowledges that business coaching is a professional developmental service intended to provide education, strategic guidance, accountability, and business development support.',
      'The Coach does not guarantee specific financial outcomes, business revenue, profitability, or commercial success.',
      'The Client remains responsible for business decisions, implementation, legal compliance, financial obligations, and operational results.',
      'Coaching services do not constitute licensed legal, tax, accounting, investment, or mental health services.',
    ] },
    { title: '7. Protection of Private Sessions', paras: [
      'Both Parties agree to respect the privacy of individual coaching sessions.',
      'Neither Party shall record, publish, livestream, or distribute private coaching conversations without the other Party’s prior written consent, except where required or permitted by applicable law.',
      'Client testimonials, business results, photographs, and identifying information shall not be used for public marketing or promotional purposes without appropriate authorization.',
    ] },
    { title: '8. Return or Destruction of Confidential Materials', paras: [
      'Upon termination of the coaching relationship or upon reasonable written request, each Party shall return or securely destroy the other Party’s Confidential Information in their possession, except information required to be retained by law, necessary for legitimate recordkeeping, or maintained in routine secure backups.',
      'Any retained Confidential Information shall remain subject to this Agreement.',
    ] },
    { title: '9. Duration & Termination', paras: [
      'This Agreement becomes effective upon execution by both Parties and remains applicable throughout the professional coaching relationship.',
      'The confidentiality obligations shall survive termination for three (3) years, except that trade secrets shall remain protected for as long as they qualify as trade secrets under applicable law.',
      'Either Party may terminate the coaching relationship in accordance with any separate written coaching services agreement.',
      'Termination does not eliminate obligations concerning confidentiality, intellectual property, or unauthorized disclosure.',
    ] },
    { title: '10. Governing Law', paras: ['This Agreement shall be governed by and construed in accordance with the laws of the State of Georgia, United States of America.'] },
    { title: '11. Entire Agreement', paras: [
      'This Agreement constitutes the entire understanding between the Parties concerning confidentiality and protection of proprietary information and supersedes prior agreements addressing the same subject matter, unless otherwise expressly agreed in writing.',
      'Any amendments must be made in writing and acknowledged by both Parties.',
    ] },
    { title: '12. Acknowledgment & Acceptance', paras: ['By signing below, both Parties acknowledge that they have read, understood, and voluntarily agreed to the terms outlined in this Business Coaching Confidentiality and Non-Disclosure Agreement.'] },
  ],
  coachNote: 'As your Mentor, I agree to the Confidentiality Agreement above.',
  coach: ['Melanie JC', 'Business Coach', 'Proverbs 31 Business Coaching | P31 Collective by NEBA'],
  ack: 'By typing your name below, you are agreeing to the entirety of the above Confidentiality Agreement.',
};

export const SAFETY = {
  kind: 'safety',
  title: 'Client Safety & Emergency Contact Form',
  subtitle: 'P31 Collective by NEBA | Private Mentorship & Business Coaching',
  tagline: 'Safety & Emergency Contact Disclosure',
  intro: [
    'P31 Collective by NEBA is committed to maintaining a safe, respectful, and supportive environment for all clients participating in private mentorship and business coaching services.',
    'If a client communicates information or demonstrates behavior that gives the Mentor/Coach reasonable concern that the client may pose an immediate danger to themselves or others, P31 Collective by NEBA reserves the right to contact the client’s designated emergency contact and/or appropriate emergency services or authorities when reasonably necessary to protect the safety and well-being of those involved.',
    'Information disclosed in such circumstances will be limited to what is reasonably necessary to address the safety concern, consistent with applicable laws.',
  ],
  sections: [
    { title: 'Emergency Contact Information', paras: ['Please provide the information of a trusted adult (18 years or older) whom we may contact only in the event of a serious safety concern or emergency as described above.'] },
  ],
  ack: 'By entering your full name below, you acknowledge and agree to the above.',
};

export const FORMS = { coaching: COACHING, confidentiality: CONFIDENTIALITY, safety: SAFETY };

/** "$325/month" from a plan price in cents (prices: { 'Option 2': 32500, ... }). */
export const packagePrice = (key, prices = {}) => {
  const c = prices[key];
  if (c == null) return 'Price shared by your mentor';
  return `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0 })}/month`;
};

/** The agreement as sections for the PDF copy (the same words as the page). */
export function pdfSections(doc, answers = {}, prices = {}) {
  const out = [];
  if (doc.tagline) out.push({ paragraph: doc.tagline });
  for (const p of doc.intro || []) out.push({ paragraph: p });
  for (const s of doc.sections || []) {
    const sec = { heading: s.title, bullets: [] };
    const parts = [];
    for (const p of s.paras || []) parts.push({ paragraph: p });
    if (s.items) parts.push({ bullets: s.items });
    for (const p of s.paras2 || []) parts.push({ paragraph: p });
    if (s.items2) parts.push({ bullets: s.items2 });
    if (s.packages) parts.push({ bullets: PACKAGES.map((p) => `${p.key} — ${p.name}: ${packagePrice(p.key, prices)}, ${p.cadence}. ${p.detail}`) });
    for (const p of s.after || []) parts.push({ paragraph: p });
    // The first part carries the heading; the rest follow it.
    if (parts.length) { out.push({ heading: sec.heading, ...parts[0] }); out.push(...parts.slice(1)); } else out.push(sec);
  }
  if (doc.kind === 'coaching' && answers.package) {
    const p = PACKAGES.find((x) => x.key === answers.package);
    out.push({ heading: 'Selected package', rows: [['Package', p ? `${p.key} — ${p.name}` : answers.package], ['Investment', packagePrice(answers.package, prices)], ['Sessions', p?.cadence || '']] });
  }
  if (doc.coachNote) out.push({ paragraph: doc.coachNote });
  if (doc.coach) out.push({ paragraph: doc.coach.join(', ') });
  if (doc.ack) out.push({ heading: 'Client acknowledgment', paragraph: doc.ack });
  return out;
}
