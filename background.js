// Authenticate and get access token
function getAuthToken() {
    return new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError) {
                console.error("Auth Error:", chrome.runtime.lastError.message);
                resolve(null);
            } else {
                resolve(token);
            }
        });
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

// Fetch Gmail emails
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
            // Extract email body
            const encodedBody = emailDetails.payload.parts?.[0]?.body?.data;
            const emailBody = decodeBase64(encodedBody);
            console.log("Email Body Content:", emailBody); // Log the email body here

            // Pass the email body to ChatGPT for parsing
            const parsedDetails = await parseEmailWithChatGPT(emailBody);
            console.log("Parsed Event Details:", parsedDetails); // Log parsed details

            // Use parsed details to create a calendar event
            if (parsedDetails) {
                await createCalendarEvent(parsedDetails);
            }
        }
    } else {
        console.error("Error fetching emails:", response.statusText);
    }
}

// Parse email content using ChatGPT
async function parseEmailWithChatGPT(emailBody) {
    const apiKey = "ysk-proj-eLKHZvpOHyjhaa8rYjGrbGADFppBCBqfbhaGL74wbj8tT1VDEoH0LFA5zYIZ0WcaGR4ZSzhfpGT3BlbkFJ94xFpwEMV31VXexvGE96lHoGwAuDRboNAEchQrs2o9F5POfQUSxc7CESZZw4tnfplBwe_L_mgA"; // Replace with your OpenAI API key

    try {
        // Send a POST request to the OpenAI API
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are an assistant that extracts event details (title, start time, end time, and location) as JSON from email content.",
                    },
                    {
                        role: "user",
                        content: `Extract event details as JSON from the following email content: "${emailBody}"`,
                    },
                ],
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
    if (!eventDetails.summary || !eventDetails.start || !eventDetails.end) {
        console.error("Invalid event details provided:", eventDetails);
        return;
    }

    const token = await getAuthToken();
    if (!token) return;

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
            console.log("Event Created Successfully:", await response.json());
        } else {
            const error = await response.json();
            console.error("Error creating calendar event:", error);
        }
    } catch (error) {
        console.error("Error in createCalendarEvent:", error);
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