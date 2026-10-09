import React from 'react';
import { UserPlus } from 'lucide-react';
import { JOIN_COLLECTIVE_URL } from '../lib/academy';

/** The "Join P31 Collective" button: opens the Collective's sign-up form in a new tab. */
const JoinCollective = ({ className = 'k-btn k-btn--gold', size = 18, label = 'Join P31 Collective' }) => (
  <a href={JOIN_COLLECTIVE_URL} target="_blank" rel="noopener noreferrer" className={className}>
    <UserPlus size={size} /> {label}
  </a>
);

export default JoinCollective;
