import React from "react";

const EventCard = ({ event }) => {
  return (
    <div className="event-card">
      <h2>{event.title}</h2>
      <p>{event.date}</p>
      <div className="event-actions">
        <button className="approve-button">✔ Accept</button>
        <button className="reject-button">✘ Reject</button>
      </div>
    </div>
  );
};

export default EventCard;