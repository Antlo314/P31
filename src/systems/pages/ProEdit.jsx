import React from 'react';
import ProEditPanel from '../../features/pro-edit/ProEditPanel';
import { useAuth } from '../../context/AuthContext';

const ProEdit = () => {
  const { user } = useAuth();
  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Pro Edit</p>
        <h1>DaVinci edits by Iris</h1>
        <p className="sys-muted">Premium curators’ requests and your own. Iris picks queued jobs up from LumenCommand and posts results back here.</p>
      </header>
      <ProEditPanel userId={user?.id} operatorView />
    </div>
  );
};

export default ProEdit;
