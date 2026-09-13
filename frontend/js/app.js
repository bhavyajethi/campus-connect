// Tab Switching Utility
function switchTab(tabName) {
    const tabs = ['events', 'register', 'scanner'];
    tabs.forEach(t => {
        document.getElementById(`tab-${t}`).classList.add('hidden');
        document.getElementById(`btn-${t}`).className = "px-4 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition";
    });

    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    document.getElementById(`btn-${tabName}`).className = "px-4 py-2 text-sm font-medium rounded-lg bg-indigo-50 text-indigo-600 transition";

    if (tabName === 'events') {
        loadEvents();
    }
}

// Load and Render Events Catalog
async function loadEvents() {
    const grid = document.getElementById('events-grid');
    grid.innerHTML = `<p class="text-sm text-slate-400 col-span-full text-center py-10">Loading events...</p>`;
    
    try {
        const events = await api.fetchEvents();
        if (events.length === 0) {
            grid.innerHTML = `<p class="text-sm text-slate-400 col-span-full text-center py-10">No events found.</p>`;
            return;
        }

        grid.innerHTML = events.map(event => `
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-bold text-slate-900 text-lg">${event.name}</h3>
                        <span class="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-semibold">${event.date}</span>
                    </div>
                    <p class="text-sm text-slate-600 line-clamp-3">${event.description || "No description provided."}</p>
                </div>
                <div class="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span class="text-xs text-slate-400 font-mono truncate max-w-[180px]">ID: ${event.id}</span>
                    <button onclick="prefillRegister('${event.id}', '${event.name}')" class="text-xs bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg font-medium">Select</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        grid.innerHTML = `<p class="text-sm text-rose-600 col-span-full text-center py-10">Error loading events: ${err.message}</p>`;
    }
}

// Quick prefill helper when clicking "Select" on an event card
// Enhanced prefill helper when clicking "Select" on an event card
function prefillRegister(eventId, eventName) {
    // 1. Switch to the registration tab
    switchTab('register');
    
    // 2. Auto-fill the event ID input field
    const eventInput = document.getElementById('reg-event-id');
    eventInput.value = eventId;
    
    // 3. Provide visual feedback (highlight the auto-filled input)
    eventInput.classList.add('border-indigo-600', 'bg-indigo-50/50');
    
    // 4. Focus the user ID field so the student only has to enter their own ID
    document.getElementById('reg-user-id').focus();
}

// Handle Registration Form Submit
document.getElementById('registration-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('reg-user-id').value.trim();
    const eventId = document.getElementById('reg-event-id').value.trim();
    const resultBox = document.getElementById('ticket-result');
    const qrImg = document.getElementById('qr-image');

    try {
        const data = await api.registerUser(userId, eventId);
        qrImg.src = api.getQrCodeUrl(data.id);
        resultBox.classList.remove('hidden');
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
});

// Handle Admin Scanner Form Submit
document.getElementById('scanner-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ticketId = document.getElementById('scan-ticket-id').value.trim();
    const resultBox = document.getElementById('scanner-result');

    try {
        const data = await api.verifyTicket(ticketId);
        resultBox.className = "p-4 rounded-xl text-sm font-medium bg-emerald-50 text-emerald-800 border border-emerald-200";
        resultBox.textContent = `Success! ${data.message} (User: ${data.user_id})`;
        resultBox.classList.remove('hidden');
    } catch (err) {
        resultBox.className = "p-4 rounded-xl text-sm font-medium bg-rose-50 text-rose-800 border border-rose-200";
        resultBox.textContent = `Denied: ${err.message}`;
        resultBox.classList.remove('hidden');
    }
});

// Initial load on startup
loadEvents();