import React from "react";
import Header from "./components/Header";
import EventCard from "./components/EventCard";

const App = () => {
  const sampleEvent = { title: "Sample Event", date: "2025-01-01" };

  return (
    <div className="popup-container">
      <Header />
      <div className="events-container">
        {/* Add multiple EventCards dynamically */}
        <EventCard event={sampleEvent} />
        <EventCard event={sampleEvent} />
      </div>
    </div>
  );
};

export default App;