// Opens the "Join the collective" dialog (components/LeadPopup.jsx) from anywhere.
export const openJoin = () => window.dispatchEvent(new Event('p31:join'));
