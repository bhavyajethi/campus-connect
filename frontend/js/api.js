const API_BASE = "http://127.0.0.1:8000";

async function apiRequest(url, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = localStorage.getItem("token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    else headers.delete("Authorization");

    let response;
    try {
        response = await fetch(url, { ...options, headers });
    } catch {
        const error = new Error("Unable to connect. Check your network or make sure the Campus Connect server is running.");
        error.isNetworkError = true;
        throw error;
    }
    let data = {};
    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        if (typeof updateAuthUI === "function") updateAuthUI();
        if (typeof toggleAuthMode === "function") toggleAuthMode("login");
        if (typeof showToast === "function") showToast("Session expired. Please log in again.", "error");
        if (typeof openAuthModal === "function") openAuthModal();
    }

    if (!response.ok) {
        const error = new Error(data.detail || "Request failed");
        error.status = response.status;
        throw error;
    }
    return data;
}

const api = {
    // 1. User Authentication APIs
    async login(email, password) {
        return apiRequest(`${API_BASE}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
    },

    async signup(name, email, year, password) {
        return apiRequest(`${API_BASE}/users/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, year, password, role: "student" })
        });
    },

    // 2. Event Catalog APIs
    async fetchEvents() {
        return apiRequest(`${API_BASE}/events/`);
    },

    async createEvent(eventData, token) {
        return apiRequest(`${API_BASE}/events/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(eventData)
        });
    },

    // 3. Authenticated Event Registration API
    async registerAuthenticated(eventId) {
        return apiRequest(`${API_BASE}/registrations/authenticated/?event_id=${encodeURIComponent(eventId)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });
    },

    async fetchMyTicket(eventId, token) {
        const headers = token ? { "Authorization": `Bearer ${token}` } : {};
        return apiRequest(`${API_BASE}/registrations/my-ticket/${encodeURIComponent(eventId)}`, { headers });
    },

    // 4. Admin Gate QR Verification APIs
    async verifyTicket(ticketId) {
        return apiRequest(`${API_BASE}/registrations/${encodeURIComponent(ticketId)}/verify`, {
            method: "POST"
        });
    },

    getQrCodeUrl(ticketId) {
        return `${API_BASE}/registrations/${ticketId}/qr`;
    }
};