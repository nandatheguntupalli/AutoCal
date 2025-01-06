document.getElementById("authButton").addEventListener("click", () => {
    console.log("Authenticate button clicked.");
    document.getElementById("statusMessage").textContent = "Authenticating...";
    // Call background.js authenticate function here if needed
});

document.getElementById("fetchEmailsButton").addEventListener("click", () => {
    console.log("Fetch Emails button clicked.");
    document.getElementById("statusMessage").textContent = "Fetching emails...";

    // Send message to background.js to fetch emails
    chrome.runtime.sendMessage({ action: "fetchEmails" }, (response) => {
        if (response.success) {
            console.log("Emails fetched:", response.data);
            const emailsList = document.getElementById("emailsList");
            emailsList.innerHTML = ""; // Clear the previous list
            response.data.forEach((email) => {
                const listItem = document.createElement("li");
                listItem.textContent = email.snippet; // Display email snippet
                emailsList.appendChild(listItem);
            });
            document.getElementById("statusMessage").textContent = "Emails fetched successfully!";
        } else {
            console.error("Error fetching emails:", response.error);
            document.getElementById("statusMessage").textContent = "Error fetching emails.";
        }
    });
});