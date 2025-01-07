document.addEventListener("DOMContentLoaded", async () => {
    const eventList = document.getElementById("eventList");
    const fetchEmailsButton = document.getElementById("fetchEmailsButton");
    const statusMessage = document.getElementById("statusMessage");

    // Fetch emails on button click
    if (fetchEmailsButton) {
        fetchEmailsButton.addEventListener("click", async () => {
            statusMessage.textContent = "Fetching emails...";
            chrome.runtime.sendMessage({ action: "fetchEmails" }, (response) => {
                if (response && response.success) {
                    statusMessage.textContent = "Emails fetched successfully!";
                    loadPendingEvents();
                } else {
                    statusMessage.textContent = "Failed to fetch emails.";
                    console.error("Error fetching emails:", response.error);
                }
            });
        });
    }

   
    // Load and render pending events
    // Load and render pending events
    // Load and render pending events
    async function loadPendingEvents() {
        const events = await new Promise((resolve) =>
            chrome.storage.local.get("pendingEvents", (result) => resolve(result.pendingEvents || []))
        );

        eventList.innerHTML = ""; // Clear existing content

        if (events.length === 0) {
            eventList.innerHTML = "<li>No pending events to review.</li>";
            return;
        }

        events.forEach((event, index) => {
            const listItem = document.createElement("li");
            listItem.className = "event-item";

            // Format date and time
            const formatDateTime = (dateTime) => {
                const date = new Date(dateTime);
                const options = {
                    weekday: "short", // Short form for the day of the week
                    month: "numeric",
                    day: "numeric",
                    year: "2-digit",
                };
                const timeOptions = {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                };

                const formattedDate = date.toLocaleDateString("en-US", options); // e.g., "Tue, 1/14/25"
                const formattedTime = date.toLocaleTimeString("en-US", timeOptions); // e.g., "10:00 AM"
                return { formattedDate, formattedTime };
            };

            const start = formatDateTime(event.start.dateTime);
            const end = formatDateTime(event.end.dateTime);

            listItem.innerHTML = `
                <div contenteditable="true" class="event-summary">${event.summary || "No Title"}</div>
                <div class="event-details">
                    <span contenteditable="true">${start.formattedDate} from ${start.formattedTime} to ${end.formattedTime}</span><br>
                    <span contenteditable="true">Location: ${event.location || "No location"}</span>
                </div>
                <button class="approve-button" data-index="${index}">✔ Approve</button>
                <button class="reject-button" data-index="${index}">✘ Reject</button>
            `;

            // Approve event
            listItem.querySelector(".approve-button").addEventListener("click", () => {
                approveEvent(index, events);
            });

            // Reject event
            listItem.querySelector(".reject-button").addEventListener("click", () => {
                rejectEvent(index, events);
            });

            eventList.appendChild(listItem);
        });
    }

    // Approve an event and send to Google Calendar
    async function approveEvent(index, events) {
        const event = events[index];
        events.splice(index, 1); // Remove event from the queue
        await chrome.storage.local.set({ pendingEvents: events });
        await createCalendarEvent(event); // Send to Google Calendar
        loadPendingEvents(); // Refresh UI
    }

    // Reject an event
    async function rejectEvent(index, events) {
        events.splice(index, 1); // Remove event from the queue
        await chrome.storage.local.set({ pendingEvents: events });
        loadPendingEvents(); // Refresh UI
    }

    // Helper function to send an event to Google Calendar
    async function createCalendarEvent(eventDetails) {
        const token = await getAuthToken();
        try {
            const response = await fetch(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(eventDetails),
                }
            );
            if (response.ok) {
                console.log("Event successfully created.");
            } else {
                console.error("Error creating event:", await response.json());
            }
        } catch (error) {
            console.error("Unexpected error in createCalendarEvent:", error);
        }
    }

    // Helper function to get auth token
    async function getAuthToken() {
        return new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive: true }, (token) => {
                if (chrome.runtime.lastError || !token) {
                    reject(chrome.runtime.lastError || new Error("Failed to get token"));
                } else {
                    resolve(token);
                }
            });
        });
    }

    // Initial load of pending events
    loadPendingEvents();
});