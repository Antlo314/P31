// Starting a walkthrough from anywhere (Tour.jsx listens): startTour('studio', { autoplay: true }).
export const TOUR_EVENT = 'p31:tour';
export const startTour = (id, opts = {}) => window.dispatchEvent(new CustomEvent(TOUR_EVENT, { detail: { id, ...opts } }));
