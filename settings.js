document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("fade-in");
});

document.querySelector(".back-button").addEventListener("click", () => {
    document.body.classList.add("fade-out");
    setTimeout(() => {
        sessionStorage.setItem("returning", true);
        location.href = "popup.html";
    }, 200);
});