document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const teacherInfo = document.getElementById("teacher-info");
  const teacherName = document.getElementById("teacher-name");

  let isAuthenticated = false;
  let teacherCredentials = null;

  // Authentication functions
  function updateAuthUI() {
    if (isAuthenticated) {
      loginBtn.classList.add("hidden");
      teacherInfo.classList.remove("hidden");
      teacherName.textContent = `Welcome, ${teacherCredentials.teacher}!`;
    } else {
      loginBtn.classList.remove("hidden");
      teacherInfo.classList.add("hidden");
    }
  }

  async function checkAuthStatus() {
    if (!teacherCredentials) return false;
    
    try {
      const response = await fetch("/auth/status", {
        headers: {
          'Authorization': `Basic ${teacherCredentials.encodedCredentials}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        isAuthenticated = true;
        teacherCredentials.teacher = result.teacher;
        updateAuthUI();
        return true;
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    }
    
    isAuthenticated = false;
    teacherCredentials = null;
    updateAuthUI();
    return false;
  }

  function login() {
    const username = prompt("Enter teacher username:");
    const password = prompt("Enter teacher password:");
    
    if (username && password) {
      const encodedCredentials = btoa(`${username}:${password}`);
      teacherCredentials = {
        username: username,
        encodedCredentials: encodedCredentials,
        teacher: username
      };
      checkAuthStatus();
    }
  }

  function logout() {
    isAuthenticated = false;
    teacherCredentials = null;
    updateAuthUI();
    showMessage("Logged out successfully", "success");
    fetchActivities(); // Refresh to hide delete buttons
  }

  // Function to show messages
  function showMessage(message, type) {
    messageDiv.textContent = message;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    // Hide message after 5 seconds
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons only for authenticated teachers
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${isAuthenticated ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>` : ''}</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!isAuthenticated) {
      showMessage("Please log in as a teacher to manage student registrations", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            'Authorization': `Basic ${teacherCredentials.encodedCredentials}`
          }
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isAuthenticated) {
      showMessage("Please log in as a teacher to register students", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            'Authorization': `Basic ${teacherCredentials.encodedCredentials}`
          }
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // Event listeners
  loginBtn.addEventListener("click", login);
  logoutBtn.addEventListener("click", logout);

  // Initialize app
  updateAuthUI();
  fetchActivities();
});
