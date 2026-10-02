const API_BASE = "http://127.0.0.1:8000";

const api = {
    // 1. Auth Endpoints
    async login(email, password) {
        const response = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Login failed");
        return data;
    },

    async signup(name, email, year, password) {
        const response = await fetch(`${API_BASE}/users/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, year, password, role: "student" })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Signup failed");
        return data;
    },

    // 2. Events Endpoint
    async fetchEvents() {
        const response = await fetch(`${API_BASE}/events/`);
        if (!response.ok) throw new Error("Failed to fetch events");
        return await response.json();
    },

    // 3. Authenticated Registration Endpoint
    async registerAuthenticated(eventId, token) {
        const response = await fetch(`${API_BASE}/registrations/authenticated/?event_id=${eventId}`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Registration failed");
        return data;
    },

    // 4. Gate Verification & QR Endpoints
    async verifyTicket(ticketId) {
        const response = await fetch(`${API_BASE}/registrations/${ticketId}/verify`, {
            method: "POST"
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Verification failed");
        return data;
    },

    getQrCodeUrl(ticketId) {
        return `${API_BASE}/registrations/${ticketId}/qr`;
    }
};