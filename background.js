// Authenticate and get access token

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "fetchEmails") {
        fetchEmails()
            .then((result) => {
                sendResponse({ success: true, data: result });
            })
            .catch((error) => {
                console.error("Error in fetchEmails:", error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Keep the message channel open for asynchronous response
    }
});
function saveFirstUseTimestamp() {
    const firstUseTimestamp = new Date().toISOString();
    chrome.storage.local.set({ firstUseTimestamp }, () => {
        console.log("First use timestamp saved:", firstUseTimestamp);
    });
}

function getFirstUseTimestamp() {
    return new Promise((resolve) => {
        chrome.storage.local.get("firstUseTimestamp", (result) => {
            resolve(result.firstUseTimestamp || null);
        });
    });
}
chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed.");
});

function getAuthToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError || !token) {
                console.error("Auth Error:", chrome.runtime.lastError?.message || "No token returned");
                reject(chrome.runtime.lastError || new Error("Failed to get token"));
                return;
            }
            console.log("Access Token:", token);
            resolve(token);
        });
    });
}

// Fetch the user's information using their access token
async function getUserInfo(token) {
    try {
        const response = await fetch("https://www.googleapis.com/oauth2/v3/tokeninfo", {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
            const userInfo = await response.json();
            console.log("User Info:", userInfo);
            return userInfo.email; // Use the email to uniquely identify the user
        } else {
            console.error("Error fetching user info:", await response.json());
        }
    } catch (error) {
        console.error("Error in getUserInfo:", error);
    }
    return null;
}

// Clear the cached authentication token (e.g., for logout or reauth)
function clearAuthToken() {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (token) {
            chrome.identity.removeCachedAuthToken({ token }, () => {
                console.log("Token invalidated");
            });
        }
    });
}

// Decode Base64 email content
function decodeBase64(encodedString) {
    try {
        if (!encodedString) throw new Error("Encoded string is null or undefined.");
        return decodeURIComponent(
            atob(encodedString.replace(/-/g, "+").replace(/_/g, "/"))
                .split("")
                .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                .join("")
        );
    } catch (error) {
        console.error("Error decoding Base64 string:", error.message);
        return null;
    }
}

// Save processed message IDs
function saveProcessedEmailIds(ids) {
    chrome.storage.local.set({ processedEmailIds: ids }, () => {
        console.log("Processed email IDs saved.");
    });
}

// Get processed message IDs
function getProcessedEmailIds() {
    return new Promise((resolve) => {
        chrome.storage.local.get("processedEmailIds", (result) => {
            resolve(result.processedEmailIds || []);
        });
    });
}
// Fetch email details
async function fetchEmailDetails(token, messageId) {
    try {
        const response = await fetch(
            `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.ok) {
            const emailDetails = await response.json();
            console.log("Fetched Email Details:", emailDetails);
            return emailDetails;
        } else {
            console.error("Error fetching email details:", response.statusText);
            return null;
        }
    } catch (error) {
        console.error("Error in fetchEmailDetails:", error);
        return null;
    }
}

async function fetchEmails() {
    const token = await getAuthToken();
    const firstUseTimestamp = await getFirstUseTimestamp();

    const response = await fetch(
        "https://www.googleapis.com/gmail/v1/users/me/messages",
        {
            headers: { Authorization: `Bearer ${token}` },
        }
    );

    if (response.ok) {
        const data = await response.json();

        idsToProcess = [];

        // if calling for first time
        if (!firstUseTimestamp) {
            console.log("First time fetching emails");
            saveFirstUseTimestamp();
            for (let i = 0; i < 30; i++) {
                const id = data.messages[i].id;
                idsToProcess.push(id);
            }
            saveProcessedEmailIds(idsToProcess);
        } else {
            console.log("First use date: ", firstUseTimestamp)
            console.log("Continuing fetching from previously searched emails")
            let searchedIds = await getProcessedEmailIds();
            for (const message of data.messages) {
                if (!searchedIds.includes(message.id)) {
                    searchedIds.push(message.id);
                    idsToProcess.push(message.id);
                }
            }
            saveProcessedEmailIds(searchedIds);
        }

        console.log("New email ids:", idsToProcess);

        for (const messageId of idsToProcess) {
            const emailDetails = await fetchEmailDetails(token, messageId);

            if (emailDetails) {
                // Extract metadata
                const headers = emailDetails.payload.headers;
                const fromHeader = headers.find((header) => header.name === "From");
                const sender = fromHeader ? fromHeader.value : "Unknown Sender";

                const subjectHeader = headers.find((header) => header.name === "Subject");
                const subject = subjectHeader ? subjectHeader.value : "No Subject";

                const dateHeader = headers.find((header) => header.name === "Date");
                const emailDate = dateHeader ? new Date(dateHeader.value).toISOString() : null;

                console.log("Sender:", sender);
                console.log("Subject:", subject);
                console.log("Email Date:", emailDate);

                // Extract email body
                let encodedBody = emailDetails.payload.body?.data;

                // Fallback: Check parts for the body
                if (!encodedBody && emailDetails.payload.parts) {
                    for (const part of emailDetails.payload.parts) {
                        if (part.mimeType === "text/plain" && part.body?.data) {
                            encodedBody = part.body.data;
                            break;
                        }
                    }
                }

                if (!encodedBody) {
                    console.error("Encoded email body not found.");
                    continue; // Skip if no body is found
                }

                const emailBody = decodeBase64(encodedBody);

                // Pass the email body and metadata to ChatGPT for parsing
                const parsedDetails = await parseEmailWithChatGPT(emailBody, sender, subject, emailDate);
                console.log("Parsed Event Details:", parsedDetails);

                // Validate parsed details
                if (!parsedDetails || !parsedDetails.summary || !parsedDetails.start_time || !parsedDetails.end_time) {
                    console.error("Invalid event details provided:", parsedDetails);
                    continue; // Skip invalid event details
                }

                // Transform parsed details into the required format for createCalendarEvent
                const eventDetails = {
                    summary: parsedDetails.summary,
                    location: parsedDetails.location || "", // Default to empty string if location is null
                    start: {
                        dateTime: parsedDetails.start_time.slice(0, -1),
                        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Set the appropriate time zone
                    },
                    end: {
                        dateTime: parsedDetails.end_time.slice(0, -1),
                        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Set the appropriate time zone
                    },
                };

                // Log the transformed event details for debugging
                console.log("Event Details Sent to Google Calendar API:", eventDetails);

                // Create the calendar event
                await createCalendarEvent(eventDetails);
            }
        }
    } else {
        console.error("Error fetching emails:", response.statusText);
    }
}

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function parseEmailWithChatGPT(emailBody, sender, subject, emailDate) {
    const apiKey = "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"; // Replace with your OpenAI API key

    try {
        // Send a POST request to the OpenAI API
        const dateObjUTC = new Date(emailDate);
        const localDateString = dateObjUTC.toLocaleString("en-US", {
            timeZoneName: "short",
            hour12: false
        });
        const localDate = new Date(localDateString);
        const formattedLocalDate = localDate.toISOString();
        
        console.log("Email Sender:", sender);
        console.log("Email Date:", formattedLocalDate);
        console.log("Email Body Content:", emailBody);
        
        const gptInput = `
            Email Received Date: ${formattedLocalDate}\n
            Sender: ${sender}\n
            Subject: ${subject}\n
            Email Content: "${emailBody}"\n
        `;

        console.log("ChatGPT Input:\n", gptInput);

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `
                        You are an assistant that extracts event details (summary, start_time, end_time, and location) as JSON from email content. You will be given the email data in the following format, where things in {} represent a variable:
                        \n-- Start of Input –-\n
                        Email Received Date: {The date and time the email was received by the user, given in the user’s local timezone}\n
                        Sender: {The email address of the user that sent the email}\n
                        Subject: {The subject line of the email}\n
                        Email Content: "{The actual text inside the body of the email}"\n
                        -- End of Input –-\n
                        You should extract the summary of the event from the email body. Find the start_time and end_time by looking through the email body. The start_time and end_time are assumed to be in the user's local time zone. If a relative date (e.g., "this Friday") is mentioned, calculate the exact date using the "Current Local Date for User" line as a reference. For example, if the email says "this Friday" and today is Monday, then **this Friday** should be the next Friday in the calendar, not the previous Friday. If there is no specific end time mentioned, the default length of the event should be 1 hour. Finally, when returning the start_time and end_time, format these in the ISO format, which matches the format of the input. If no location is mentioned, leave the location field blank.
                        If there is no event mentioned, set everything to null. Do not create an event for every email that is sent only the ones that specifically talk about an event that is happening.\n
                        Return the extracted details in this format:\n
                        {\n
                        "summary": "Event Summary",\n
                        "start_time": "YYYY-MM-DDThh:mm:ssZ",\n
                        "end_time": "YYYY-MM-DDThh:mm:ssZ",\n
                        "location": "Event Location",\n
                        "sender": {\n
                        "name": "Sender Name",\n
                        "email": "sender@example.com"\n
                        }\n
                        }
                        `
                    },
                    {
                        role: "user",
                        content: gptInput
                    }
                ],
                response_format: { type: "json_object" },
            }),
        });

        // Check if the response is OK
        if (response.ok) {
            const data = await response.json();

            // Log and parse the result from ChatGPT's response
            const extractedContent = data.choices[0]?.message?.content?.trim();
            console.log("ChatGPT Parsed Response:", extractedContent);

            try {
                // Attempt to parse the response as JSON
                return JSON.parse(extractedContent);
            } catch (jsonError) {
                console.error("Failed to parse ChatGPT response as JSON:", jsonError);
                return null;
            }
        } else {
            // Log the error details from the API response
            const errorData = await response.json();
            console.error("Error calling ChatGPT API:", errorData);
            return null;
        }
    } catch (error) {
        // Handle unexpected errors (e.g., network issues)
        console.error("Unexpected error in parseEmailWithChatGPT:", error);
        return null;
    }
}

// Create calendar event
async function createCalendarEvent(eventDetails) {
    const token = await getAuthToken(); // Ensure token is fetched correctly

    try {
        const response = await fetch(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(eventDetails),
            }
        );

        if (response.ok) {
            const eventData = await response.json();
            console.log("Event Created Successfully:", eventData);
        } else {
            const errorData = await response.json();
            console.error("Error creating calendar event:", errorData);
        }
    } catch (error) {
        console.error("Unexpected error in createCalendarEvent:", error);
    }
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchEmails") {
        fetchEmails().then(() => sendResponse({ status: "Emails fetched and processed" }));
    }
    return true;
});
