const updateEvent = (index, updatedEvent) => {
  const updatedEvents = [...events];
  updatedEvents[index] = updatedEvent;

  setEvents(updatedEvents);

  // Update chrome.storage.local
  chrome.storage.local.set({ pendingEvents: updatedEvents }, () => {
    console.log("Event approved and updated:", updatedEvent);
  });
};

const rejectEvent = (index) => {
  const updatedEvents = [...events];
  const [removedEvent] = updatedEvents.splice(index, 1); // Remove the event

  setEvents(updatedEvents);

  // Update chrome.storage.local
  chrome.storage.local.set({ pendingEvents: updatedEvents }, () => {
    console.log("Event rejected and removed:", removedEvent);
  });
};