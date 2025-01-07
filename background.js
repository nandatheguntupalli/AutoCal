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
    const response = await fetch(
        "https://www.googleapis.com/gmail/v1/users/me/messages",
        {
            headers: { Authorization: `Bearer ${token}` },
        }
    );

    if (response.ok) {
        const data = await response.json();
        console.log("Fetched Emails Metadata:", data);

        // Fetch details for the first email as an example
        const messageId = data.messages[0].id;
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

            // Fallback: Iterate through parts if the body is not in payload.body
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
                return; // Exit if no body is found
            }

            const emailBody = decodeBase64(encodedBody);

            // Pass the email body and metadata to ChatGPT for parsing
            const parsedDetails = await parseEmailWithChatGPT(emailBody, sender, subject, emailDate);
            console.log("Parsed Event Details:", parsedDetails);

            // Validate parsed details
            if (!parsedDetails || !parsedDetails.summary || !parsedDetails.start_time || !parsedDetails.end_time) {
                console.error("Invalid event details provided:", parsedDetails);
                return; // Exit if parsed details are missing or invalid
            }

            // Transform parsed details into the required format for createCalendarEvent
            const eventDetails = {
                summary: parsedDetails.summary,
                location: parsedDetails.location || "", // Default to empty string if location is null
                start: {
                    dateTime: parsedDetails.start_time,
                    timeZone: "UTC", // Set the appropriate time zone
                },
                end: {
                    dateTime: parsedDetails.end_time,
                    timeZone: "UTC", // Set the appropriate time zone
                },
            };

            // Log the transformed event details for debugging
            console.log("Event Details Sent to Google Calendar API:", eventDetails);

            // Create the calendar event
            await createCalendarEvent(eventDetails);
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
        console.log("Email Sender:", sender);
        console.log("Email Date:", emailDate);
        console.log("Email Body Content:", emailBody);
        
        
        const gptInput = `
            Extract event details as JSON from the following email content and metadata:\n
            Email Received Date: ${emailDate}\n
            Sender: ${sender}\n
            Subject: ${subject}\n
            Email Content: "${emailBody}"\n
            Current Local Date for User: ${(new Date).toString()}\n
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
                        You are an assistant that extracts event details (summary, start_time, end_time, and location) as JSON from email content.
                        You will be given the email data in the following format, where things in {} represent a variable:
                        -- Start of Input --
                        Email Received Date: {The date the email was received by the user, given in UTC}
                        Sender: {The email address of the user that sent the email}
                        Subject: {The subject line of the email}
                        Email Content: "{The actual text inside the body of the email}"
                        Current Local Date for User: {The day of the week, date, and time in the user's local time zone}
                        -- End of Input --
                        You should extract the summary of the event from the email body. Find the start_time and end_time by looking through the email body. The start_time and end_time are assumed to be in the user's local time zone, which is in the "Current Local Date for User" line.
                        If a relative date (e.g., "this Friday") is mentioned, calculate the exact date using the "Current Local Date for User" line as a reference. For example, if the email says "this Friday" and today is Monday, then **this Friday** should be the next Friday in the calendar, not the previous Friday.
                        Finally, when returning the start_time and end_time, convert the dates and times from the user's local time zone to UTC. If the event is scheduled at night (e.g., 10 PM), ensure the time conversion accounts for the time zone difference, and if needed, adjust the date to the next day in UTC. If the event is schedule in the morning, ensure that the time conversion accounts for the time zone difference, and if needed, adjust the date to the previous day in UTC. If no location is mentioned, leave the location field blank.
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

// Authenticate on installation
chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed.");
});