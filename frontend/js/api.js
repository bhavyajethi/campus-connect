const API_BASE = "http://127.0.0.1:8000";

async function apiRequest(path, options = {}, fallbackMessage = "Request failed") {
    const headers = new Headers(options.headers || {});
    const token = localStorage.getItem("token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    else headers.delete("Authorization");

    let response;
    try {
        response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    } catch (cause) {
        const error = new Error("Unable to connect. Check your network or make sure the Campus Connect server is running.", { cause });
        error.isNetworkError = true;
        throw error;
    }

    let data = null;
    if (response.status !== 204) {
        try {
            data = await response.json();
        } catch {
            data = null;
        }
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
        const error = new Error(data?.detail || data?.message || fallbackMessage);
        error.status = response.status;
        throw error;
    }
    return data;
}

const api = {
    async fetchEvents(includePast = false) {
        const query = includePast ? "?include_past=true" : "";
        return apiRequest(`/events/${query}`, {}, "Unable to load events.");
    },

    async createEvent(eventData, token) {
        return apiRequest("/events/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify(eventData)
        }, "Unable to create event.");
    },

    async login(email, password) {
        return apiRequest("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        }, "Login failed.");
    },

    async signup(userData) {
        return apiRequest("/users/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...userData, role: "student" })
        }, "Signup failed.");
    },

    async fetchMyTicket(eventId, token) {
        return apiRequest(`/registrations/my-ticket/${encodeURIComponent(eventId)}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        }, "Unable to load ticket.");
    },

    async fetchMyRegistrations(token) {
        return apiRequest("/registrations/me", {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        }, "Unable to load registrations.");
    },

    async registerAuthenticated(eventId, token) {
        return apiRequest(`/registrations/authenticated/?event_id=${encodeURIComponent(eventId)}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            }
        }, "Unable to register for event.");
    },

    async verifyTicket(ticketId) {
        return apiRequest(`/registrations/${encodeURIComponent(ticketId)}/verify`, {
            method: "POST"
        }, "Ticket verification failed.");
    },

    async fetchAdminStats() {
        return apiRequest("/admin/stats", {}, "Unable to load admin dashboard.");
    },

    async downloadAttendeeCsv() {
        const token = localStorage.getItem("token");
        let response;
        try {
            response = await fetch(`${API_BASE}/admin/attendees.csv`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
        } catch (cause) {
            throw new Error("Unable to connect to the Campus Connect server.", { cause });
        }
        if (response.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            if (typeof updateAuthUI === "function") updateAuthUI();
            if (typeof openAuthModal === "function") openAuthModal();
        }
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            const error = new Error(data.detail || "Unable to download attendee list.");
            error.status = response.status;
            throw error;
        }
        return response.blob();
    },

    getQrCodeUrl(ticketId) {
        return `${API_BASE}/registrations/${encodeURIComponent(ticketId)}/qr`;
    }
};
