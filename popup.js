// adding a new bookmark row to the popup
const addNewBookmark = () => {};

const viewBookmarks = () => {};

const onPlay = e => {};

const onDelete = e => {};

const setBookmarkAttributes =  () => {};

document.addEventListener("DOMContentLoaded", () => {});

document.getElementById("authButton").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "authenticate" }, (response) => {
        console.log(response.status);
    });
});
