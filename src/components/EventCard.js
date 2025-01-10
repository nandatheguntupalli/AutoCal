import React from "react";

const EventCard = ({ event, index, onUpdate, onReject }) => {
  const startDate = new Date(event.start.dateTime || event.start.date);
  const endDate = new Date(event.end.dateTime || event.end.date);

  return (
    <div className="card mb-3 shadow-sm">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="fw-bold">{event.summary || "Untitled Event"}</h5>
        <a
          href={event.emailLink}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-link text-decoration-none"
          title="View Original Email"
        >
          📧
        </a>
      </div>
      <div className="card-body">
        <p>
          <strong>Date:</strong> {startDate.toDateString()}
        </p>
        <p>
          <strong>Time:</strong> {startDate.toLocaleTimeString()} to{" "}
          {endDate.toLocaleTimeString()}
        </p>
        <p>
          <strong>Location:</strong> {event.location || "Not specified"}
        </p>
      </div>
      <div className="card-footer d-flex justify-content-between">
        <button className="btn btn-danger" onClick={() => onReject(index)}>
          Reject
        </button>
        <button className="btn btn-success" onClick={() => onUpdate(index, event)}>
          Approve
        </button>
      </div>
    </div>
  );
};

export default EventCard;