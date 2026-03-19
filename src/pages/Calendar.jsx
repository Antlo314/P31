import React from 'react';
import './Calendar.css';

const Calendar = () => {
  return (
    <div className="calendar-v2 container-fluid">
      <div className="cal-header-v2">
        <h1 className="cal-title-huge">The Experience</h1>
        <p className="cal-subtitle">Mark your calendars. A curated market unlike any other.</p>
      </div>

      <div className="cal-list-v2">
        
        {/* Event Entry */}
        <div className="cal-row-v2">
          <div className="cal-date-col">
            <span className="cal-day">28</span>
            <span className="cal-month">August '26</span>
          </div>
          <div className="cal-info-col">
            <h2>Atlanta Summer Pop-Up</h2>
            <ul className="cal-meta">
              <li>Atlanta, GA</li>
              <li>10:00 AM &mdash; 4:00 PM EST</li>
            </ul>
            <p className="cal-desc">
              Join us for our signature summer showcase. An exclusive outdoor sanctuary 
              featuring 30+ elite women creatives, live music, and premium artisan goods.
            </p>
            <div className="cal-actions">
               <a href="https://www.eventbrite.com/e/proverbs-31-marketplace-tickets-1984190041828" target="_blank" rel="noreferrer" className="btn-primary">
                 RSVP Entry
               </a>
            </div>
          </div>
        </div>

        {/* Event Entry */}
        <div className="cal-row-v2 tba-row">
          <div className="cal-date-col">
            <span className="cal-day">TBA</span>
            <span className="cal-month">Fall '26</span>
          </div>
          <div className="cal-info-col">
            <h2>Fall Collection Showcase</h2>
            <ul className="cal-meta">
              <li>Location TBA</li>
            </ul>
            <p className="cal-desc">
              The tour continues. Highlighting seasonal apparel, 
              rich fragrances, and luxury homeware for the autumn season.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Calendar;
