const eventList = document.getElementById("eventList");
const fetchEmailsButton = document.getElementById("fetchEmailsButton");
const statusMessage = document.getElementById("statusMessage");

// Fetch emails on button click
if (fetchEmailsButton) {
    fetchEmailsButton.addEventListener("click", async () => {
        console.log("Fetch Emails clicked")

        chrome.runtime.sendMessage({ action: "fetchEmails" }, (response) => {
            if (response && response.success) {
                loadPendingEvents();
            } else {
                console.error("Error fetching emails:", response.error);
            }
        });
    });
}

// Load and render pending events
async function loadPendingEvents() {
    const events = await new Promise((resolve) =>
        chrome.storage.local.get("pendingEvents", (result) => resolve(result.pendingEvents || []))
    );

    eventList.innerHTML = "";

    if (events.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "empty-state";
        emptyState.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
            <!-- Checkmark -->
            <path d="M80 120 L110 150 L170 90" 
                    stroke="#4CAF50" 
                    stroke-width="12" 
                    stroke-linecap="round" 
                    stroke-linejoin="round" 
                    fill="none"/>
            </svg>
        `
        eventList.appendChild(emptyState);
        return;
    }

    events.forEach((event, index) => {
        const card = document.createElement("div");
        card.className = "event-card";

        // Convert dates to local timezone
        const startDate = new Date(event.start.dateTime);
        const endDate = new Date(event.end.dateTime);

        // Format date for input values
        const formatDateForInput = (date) => {
            try {
                return date.toISOString().split('T')[0];
            } catch (RangeError) {
                return "";
            }
        };

        // Format time for input values
        const formatTimeForInput = (date) => {
            let s = date.toTimeString().slice(0, 5);
            if (s === "Inval") {
                return "";
            }
            return s;
        };

        // Calculate duration
        const calculateDuration = (start, end) => {
            const diff = end - start;
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            
            if (hours === 23 && minutes === 59) {
                return "all day";
            }

            if (isNaN(hours) || isNaN(minutes)) {
                return "";
            }

            if (hours === 0) {
                return `${minutes} minutes`;
            } else if (minutes === 0) {
                return `${hours} hour${hours !== 1 ? 's' : ''}`;
            } else {
                return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
            }
        };

        card.innerHTML = `
            <div class="event-header">
                <div class="event-title" contenteditable="true">${event.summary}</div>
                <a href="${event.emailLink}" target="_blank" class="email-icon" title="View Original Email">
                    <span class="material-symbols-outlined">outgoing_mail</span>
                </a>
            </div>
            <div class="date container">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed"><path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Z"/></svg>
                <span class="detail-label">Date</span>
                <input type="date" class="detail-input date-input" 
                    value="${formatDateForInput(startDate)}">
            </div>

            <div class="time container">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed"><path d="m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z"/></svg>
                <span class="detail-label">Time (${calculateDuration(startDate, endDate)})</span>
                <div class="time-div">
                    <input type="time" class="detail-input time-input start-time" 
                        value="${formatTimeForInput(startDate)}">
                    <span>to</span>
                    <input type="time" class="detail-input time-input end-time" 
                        value="${formatTimeForInput(endDate)}">
                </div>
            </div>
            <div class="event-location container location">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed"><path d="M480-480q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Zm0 294q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 106Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Zm0-480Z"/></svg>
                <span class="detail-label">Location</span>
                <input type="text" class="location-input" 
                    value="${event.location || ''}" 
                    placeholder="Add location">
            </div>
            <div class="event-actions">
                <button class="event-button approve-button">
                    <span>✔</span>Accept
                </button>
                <button class="event-button reject-button">
                    <span>✘</span>Reject
                </button>
            </div>
        `;

        // Add event listeners for date/time changes
        const dateInput = card.querySelector('.date-input');
        const startTimeInput = card.querySelector('.start-time');
        const endTimeInput = card.querySelector('.end-time');
        const locationInput = card.querySelector('.location-input');
        const titleElement = card.querySelector('.event-title');
        const durationDisplay = card.querySelector('.time.container .detail-label');

        // Function to validate and update times
        const validateAndUpdateTimes = () => {
            const date = dateInput.value;
            const startTime = startTimeInput.value;
            const endTime = endTimeInput.value;

            const startDateTime = new Date(`${date}T${startTime}`);
            const endDateTime = new Date(`${date}T${endTime}`);

            // Reset styles
            startTimeInput.classList.remove('invalid-time');
            endTimeInput.classList.remove('invalid-time');
            
            if (startTime == "" || endTime == "") {
                if (startTime == "") startTimeInput.classList.add("invalid-time");
                if (endTime == "") endTimeInput.classList.add("invalid-time");
                return false;
            } else if (endDateTime <= startDateTime) {
                endTimeInput.classList.add('invalid-time');
                return false;
            }

            // Update duration display
            const duration = calculateDuration(startDateTime, endDateTime);
            durationDisplay.textContent = `Time (${duration})`;
            return true;
        };

        // Update event object when inputs change
        const updateEventDateTime = () => {
            const newDate = dateInput.value;
            const newStartTime = startTimeInput.value;
            const newEndTime = endTimeInput.value;

            if (!validateAndUpdateTimes()) {
                return;
            }

            // Create new DateTime strings
            const newStartDateTime = `${newDate}T${newStartTime}:00`;
            const newEndDateTime = `${newDate}T${newEndTime}:00`;

            // Update the event object
            events[index].start.dateTime = newStartDateTime;
            events[index].end.dateTime = newEndDateTime;
            chrome.storage.local.set({ pendingEvents: events });
        };

        dateInput.addEventListener('change', updateEventDateTime);
        startTimeInput.addEventListener('change', updateEventDateTime);
        endTimeInput.addEventListener('change', updateEventDateTime);

        // Update location
        locationInput.addEventListener('change', () => {
            events[index].location = locationInput.value;
            chrome.storage.local.set({ pendingEvents: events });
        });

        // Update title
        titleElement.addEventListener('blur', () => {
            events[index].summary = titleElement.textContent;
            chrome.storage.local.set({ pendingEvents: events });
        });

        // Approve/Reject handlers
        card.querySelector('.approve-button').addEventListener('click', () => {
            approveEvent(index, events);
        });

        card.querySelector('.reject-button').addEventListener('click', () => {
            rejectEvent(index, events);
        });

        eventList.appendChild(card);
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