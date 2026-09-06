const API_BASE = "http://127.0.0.1:8000";

const api = {
    async fetchEvents() {
        const response = await fetch(`${API_BASE}/events/`);
        if (!response.ok) throw new Error("Failed to fetch events");
        return await response.json();
    },

    async registerUser(userId, eventId) {
        const response = await fetch(`${API_BASE}/registrations/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, event_id: eventId })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Registration failed");
        return data;
    },

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