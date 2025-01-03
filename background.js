// Existing Code: Handle YouTube tabs
chrome.tabs.onUpdated.addListener((tabId, tab) => {
  if (tab.url && tab.url.includes("youtube.com/watch")) {
      const queryParameters = tab.url.split("?")[1];
      const urlParameters = new URLSearchParams(queryParameters);

      chrome.tabs.sendMessage(tabId, {
          type: "NEW",
          videoId: urlParameters.get("v"),
      });
  }
});

// New Code: Authentication and API Integration

// Function to authenticate user and get access token
function authenticate() {
  chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
          console.error("Auth Error:", chrome.runtime.lastError.message);
          return;
      }
      console.log("Access Token:", token);
  });
}
function decodeBase64(encodedString) {
    try {
        if (!encodedString) {
            throw new Error("Encoded string is null or undefined.");
        }
        // Replace URL-safe characters and decode the Base64 string
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
async function fetchEmailDetails(token, messageId) {
    try {
        const response = await fetch(
            `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
            {
                headers: { Authorization: `Bearer ${token}` },
            }
        );

        if (response.ok) {
            const emailDetails = await response.json();
            console.log("Fetched Email Details:", emailDetails);
            return emailDetails;
        } else {
            console.error(
                "Error fetching email details:",
                response.statusText
            );
            return null;
        }
    } catch (error) {
        console.error("Error in fetchEmailDetails:", error);
        return null;
    }
}
// Function to fetch Gmail emails
async function fetchEmails() {
    try {
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

            // Ensure at least one email exists
            if (data.messages && data.messages.length > 0) {
                const messageId = data.messages[0].id;
                const emailDetails = await fetchEmailDetails(token, messageId);

                if (emailDetails) {
                    // Extract the encoded email body
                    const encodedBody =
                        emailDetails.payload.parts?.[0]?.body?.data ||
                        emailDetails.payload.body?.data;

                    if (encodedBody) {
                        const emailBody = decodeBase64(encodedBody);
                        console.log("Decoded Email Body:", emailBody);

                        // Parse email content with AI
                        const parsedDetails = await parseEmailWithAI(emailBody);
                        console.log("Parsed Event Details:", parsedDetails);

                        // Use parsed details to create a calendar event
                        if (parsedDetails) {
                            const eventDetails = {
                                summary: parsedDetails.title || "Untitled Event",
                                location: parsedDetails.location || "No Location",
                                start: { dateTime: parsedDetails.start },
                                end: { dateTime: parsedDetails.end },
                            };
                            await createCalendarEvent(eventDetails);
                            console.log("Calendar event created successfully.");
                        } else {
                            console.error("Failed to parse event details.");
                        }
                    } else {
                        console.error("No email body found.");
                    }
                } else {
                    console.error("Failed to fetch email details.");
                }
            } else {
                console.warn("No emails found in the Gmail account.");
            }
        } else {
            console.error("Error fetching emails:", response.statusText);
        }
    } catch (error) {
        console.error("Error in fetchEmails:", error);
    }
}

async function parseEmailWithAI(emailBody) {
    console.log("Mocking AI response for testing...");
    return {
        summary: "Meeting", // Event title
        start: {
            dateTime: "2024-12-30T11:00:00", // Start time in ISO 8601 format
            timeZone: "America/New_York", // Time zone
        },
        end: {
            dateTime: "2024-12-30T12:00:00", // End time in ISO 8601 format
            timeZone: "America/New_York", // Time zone
        }
    };
}
// Function to create a calendar event
async function createCalendarEvent(eventDetails) {
    // Validate event details
    if (!eventDetails || !eventDetails.summary || !eventDetails.start || !eventDetails.end) {
        console.error("Invalid event details provided:", eventDetails);
        throw new Error("Event details must include 'summary', 'start', and 'end'.");
    }

    console.log("Event Details Sent to Google Calendar API:", eventDetails);

    const token = await getAuthToken();
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
}

(async () => {
    const eventDetails = {
        summary: "Meeting", // Event title
        start: {
            dateTime: "2024-12-30T11:00:00", // Start time
            timeZone: "America/New_York", // Time zone
        },
        end: {
            dateTime: "2024-12-30T12:00:00", // End time
            timeZone: "America/New_York", // Time zone
        },
    };

    try {
        console.log("Testing with Event Details:", eventDetails);
        await createCalendarEvent(eventDetails);
    } catch (error) {
        console.error("Error testing createCalendarEvent:", error);
    }
})();

// Helper Function to Get OAuth Token
function getAuthToken() {
  return new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
          resolve(token);
      });
  });
}

// Example: Automatically authenticate when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed.");
  authenticate(); // Authenticate on installation (for testing)
});

/* async function parseEmailWithAI(emailBody) {
    const apiKey = "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"; // Replace with your actual API key

    try {
        const requestBody = {
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are an assistant that extracts event details from email content.",
                },
                {
                    role: "user",
                    content: `Extract event details as JSON with the following keys: "title", "start", "end", "location". Email Content: "${emailBody}"`,
                },
            ],
        };

        console.log("Sending Request Body to OpenAI API:", JSON.stringify(requestBody));

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (response.ok) {
            const data = await response.json();
            console.log("AI Parsed Data:", data.choices[0].message.content.trim());
            return JSON.parse(data.choices[0].message.content.trim());
        } if (!response.ok) {
            const errorData = await response.json();
            console.error("Error calling AI API:", JSON.stringify(errorData, null, 2));
            return null;
        } else {
            const errorData = await response.json();
            console.error("Error calling AI API:", errorData);
            return null;
        }
    } catch (error) {
        console.error("Unexpected Error in parseEmailWithAI:", error);
        return null;
    }
} */
// Add the Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "authenticate") {
      authenticate(); // Trigger the authenticate function
      sendResponse({ status: "Authentication triggered" }); // Respond to the popup
  } else {
      sendResponse({ status: "Unknown action" });
  }
});