import React from 'react';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { JOIN_PATH } from '../lib/academy';
import { isCollective, hrefFor } from '../lib/site';

/** The "Join P31 Collective" button: opens the membership application at thep31collective.org/join. */
const JoinCollective = ({ className = 'k-btn k-btn--gold', size = 18, label = 'Join P31 Collective' }) => (
  isCollective
    ? <Link to={JOIN_PATH} className={className}><UserPlus size={size} /> {label}</Link>
    : <a href={hrefFor(JOIN_PATH)} className={className}><UserPlus size={size} /> {label}</a>
);

export default JoinCollective;
