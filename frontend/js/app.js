let html5QrCode = null;
let generatedTicketId = null;

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const styles = {
        success: 'bg-emerald-700 text-white border-emerald-800',
        error: 'bg-rose-700 text-white border-rose-800',
        info: 'bg-slate-900 text-white border-slate-950'
    };
    toast.className = `rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg ${styles[type] || styles.info}`;
    toast.textContent = message;
    container.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3000);
}

// --- Auth Modal & Session State Handlers ---
function openAuthModal() {
    document.getElementById('auth-modal').classList.remove('hidden');
}

function closeAuthModal() {
    document.getElementById('auth-modal').classList.add('hidden');
}

function toggleAuthMode(mode) {
    if (mode === 'signup') {
        document.getElementById('auth-modal-title').textContent = 'Create Student Account';
        document.getElementById('auth-login-form').classList.add('hidden');
        document.getElementById('auth-signup-form').classList.remove('hidden');
    } else {
        document.getElementById('auth-modal-title').textContent = 'Student Login';
        document.getElementById('auth-signup-form').classList.add('hidden');
        document.getElementById('auth-login-form').classList.remove('hidden');
    }
}

function updateAuthUI() {
    const token = localStorage.getItem('token');
    const authContainer = document.getElementById('auth-nav-container');
    if (token) {
        authContainer.innerHTML = `
            <button onclick="logout()" class="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition">Logout</button>
        `;
    } else {
        authContainer.innerHTML = `
            <button onclick="openAuthModal()" class="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">Login / Register</button>
        `;
    }
}

function logout() {
    localStorage.removeItem('token');
    updateAuthUI();
    showToast('Logged out successfully.', 'info');
}

// --- Tab Switching Navigation ---
function switchTab(tabName) {
    const tabs = ['events', 'register', 'scanner'];
    tabs.forEach(t => {
        document.getElementById(`tab-${t}`).classList.add('hidden');
        document.getElementById(`btn-${t}`).className = "px-4 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition";
    });

    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    document.getElementById(`btn-${tabName}`).className = "px-4 py-2 text-sm font-medium rounded-lg bg-indigo-50 text-indigo-600 transition";

    if (tabName !== 'scanner') {
        stopCameraScanner();
    }
    
    if (tabName === 'events' || tabName === 'register') {
        return loadEvents();
    }
}

// --- Load Events Catalog & Populate Selection Dropdown ---
async function loadEvents() {
    const grid = document.getElementById('events-grid');
    const selectDropdown = document.getElementById('reg-event-select');
    grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
    grid.innerHTML = `<p class="text-sm text-slate-400 col-span-full text-center py-10">Loading events...</p>`;
    
    try {
        const events = await api.fetchEvents();
        
        const selectedEventId = selectDropdown.value;
        selectDropdown.innerHTML = `<option value="" disabled selected>-- Select an Event --</option>`;

        if (events.length === 0) {
            grid.innerHTML = `<p class="text-sm text-slate-400 col-span-full text-center py-10">No upcoming events found. Create one in Swagger UI with a future date!</p>`;
            return;
        }

        // Populate Dropdown & Event Cards Grid
        events.forEach(event => {
            selectDropdown.innerHTML += `<option value="${event.id}">${event.name}</option>`;
        });
        if (events.some(event => event.id === selectedEventId)) {
            selectDropdown.value = selectedEventId;
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
                <div class="pt-4 border-t border-slate-100 flex items-center justify-end">
                    <button onclick="prefillRegister('${event.id}')" class="text-xs bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium">Select Event</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        grid.textContent = `Unable to load events: ${err.message}`;
        grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm text-rose-700';
        if (err.status !== 401) showToast(err.message, 'error');
    }
}

async function prefillRegister(eventId) {
    await switchTab('register');
    const selectDropdown = document.getElementById('reg-event-select');
    selectDropdown.value = eventId;
    await restoreSelectedEventTicket();
}

function displayTicket(registration) {
    generatedTicketId = registration.id;
    const isVerified = registration.is_verified === true;
    const qrImage = document.getElementById('qr-image');
    const usedOverlay = document.getElementById('ticket-used-overlay');
    const automateButton = document.getElementById('btn-automate-verify');
    usedOverlay.classList.toggle('hidden', !isVerified);
    automateButton.classList.toggle('hidden', isVerified);
    qrImage.classList.toggle('is-used', isVerified);
    document.getElementById('ticket-event-name').textContent =
        document.getElementById('reg-event-select').selectedOptions[0]?.textContent || 'Campus Event';

    qrImage.src = api.getQrCodeUrl(registration.id);

    const badge = document.getElementById('ticket-state-badge');
    badge.textContent = isVerified ? '● Used at Gate' : '● Valid Ticket';
    badge.className = isVerified
        ? 'ticket-state-badge border-slate-200 bg-slate-100 text-slate-600'
        : 'ticket-state-badge border-emerald-200 bg-emerald-50 text-emerald-700';
    document.getElementById('ticket-result').classList.remove('hidden');
    setTicketClaimedButton(true, false, isVerified);
}

function setTicketClaimedButton(claimed, checking = false, verified = false) {
    const button = document.getElementById('btn-generate-ticket');
    button.disabled = claimed || checking;
    button.classList.toggle('hidden', claimed || verified);
    button.textContent = verified
        ? 'Ticket Used / Checked In'
        : claimed
        ? 'Ticket Already Claimed'
        : checking
            ? 'Checking Ticket...'
            : 'Generate QR Ticket';
    button.classList.toggle('opacity-50', button.disabled);
    button.classList.toggle('cursor-not-allowed', button.disabled);
    button.classList.toggle('bg-rose-700', verified);
    button.classList.toggle('hover:bg-rose-800', verified);
    button.classList.toggle('bg-indigo-600', !verified);
    button.classList.toggle('hover:bg-indigo-700', !verified);
}

async function restoreSelectedEventTicket() {
    const eventId = document.getElementById('reg-event-select').value;
    const token = localStorage.getItem('token');
    const resultBox = document.getElementById('ticket-result');
    generatedTicketId = null;
    resultBox.classList.add('hidden');
    setTicketClaimedButton(false, Boolean(eventId && token));
    if (!eventId || !token) {
        setTicketClaimedButton(false);
        return;
    }

    try {
        const registration = await api.fetchMyTicket(eventId, token);
        if (document.getElementById('reg-event-select').value !== eventId) return;
        displayTicket(registration);
        showToast('Ticket Previously Claimed. Your existing QR ticket is ready.', 'info');
    } catch (err) {
        if (document.getElementById('reg-event-select').value !== eventId) return;
        setTicketClaimedButton(false);
        if (err.status !== 404 && err.status !== 401) showToast(err.message, 'error');
    }
}

document.getElementById('reg-event-select').addEventListener('change', restoreSelectedEventTicket);

// --- Auth Form Listeners ---
document.getElementById('auth-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();

    try {
        const data = await api.login(email, password);
        localStorage.setItem('token', data.access_token);
        updateAuthUI();
        closeAuthModal();
        showToast('Login successful.', 'success');
    } catch (err) {
        if (err.status !== 401) showToast(`Login failed: ${err.message}`, 'error');
    }
});

document.getElementById('auth-signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const year = parseInt(document.getElementById('signup-year').value);
    const password = document.getElementById('signup-password').value.trim();

    try {
        await api.signup(name, email, year, password);
        const data = await api.login(email, password);
        localStorage.setItem('token', data.access_token);
        updateAuthUI();
        closeAuthModal();
        showToast('Account created and logged in successfully.', 'success');
    } catch (err) {
        if (err.status !== 401) showToast(`Signup failed: ${err.message}`, 'error');
    }
});

// --- Ticket Registration Submission ---
document.getElementById('registration-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const eventId = document.getElementById('reg-event-select').value;
    const token = localStorage.getItem('token');

    if (!eventId) {
        showToast('Please select an event from the list.', 'error');
        return;
    }

    if (!token) {
        showToast('Please log in to claim a ticket.', 'info');
        toggleAuthMode('login');
        openAuthModal();
        return;
    }

    try {
        const existingTicket = await api.fetchMyTicket(eventId, token).catch(error => {
            if (error.status === 404) return null;
            throw error;
        });
        if (existingTicket) {
            displayTicket(existingTicket);
            showToast('Ticket Previously Claimed. Your existing QR ticket is ready.', 'info');
            return;
        }

        setTicketClaimedButton(false);
        const registration = await api.registerAuthenticated(eventId);
        displayTicket(registration);
        showToast('Ticket successfully generated.', 'success');
    } catch (err) {
        if (err.status === 400) {
            try {
                const existingTicket = await api.fetchMyTicket(eventId, localStorage.getItem('token'));
                displayTicket(existingTicket);
                showToast('Ticket Previously Claimed. Your existing QR ticket is ready.', 'info');
                return;
            } catch (lookupError) {
                if (lookupError.status === 401) return;
            }
        }
        if (err.status !== 401) showToast(`Ticket request failed: ${err.message}`, 'error');
    }
});

async function automateGateCheckInVerification() {
    if (!generatedTicketId) return;
    const ticketId = generatedTicketId;
    const eventId = document.getElementById('reg-event-select').value;
    const verified = await processTicketVerification(ticketId);
    if (!verified || !eventId) return;

    try {
        const registration = await api.fetchMyTicket(eventId, localStorage.getItem('token'));
        if (document.getElementById('reg-event-select').value === eventId) {
            displayTicket(registration);
        }
    } catch (err) {
        if (err.status !== 401) showToast(`Unable to refresh ticket status: ${err.message}`, 'error');
    }
}

// --- Live Camera Scanner Functions ---
async function startCameraScanner() {
    const resultBox = document.getElementById('scanner-result');
    resultBox.classList.add('hidden');

    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }

    try {
        await html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 220, height: 220 } },
            async (decodedText) => {
                stopCameraScanner();
                await processTicketVerification(decodedText);
            },
            () => {} // Silent catch for unmatched video frames
        );
    } catch (err) {
        showToast(`Camera access error: ${err.message}`, 'error');
    }
}

async function stopCameraScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        await html5QrCode.stop();
    }
}

async function processTicketVerification(ticketId) {
    const resultBox = document.getElementById('scanner-result');
    try {
        const data = await api.verifyTicket(ticketId);
        resultBox.className = "p-4 rounded-xl text-sm font-medium bg-emerald-50 text-emerald-800 border border-emerald-200";
        resultBox.textContent = `SUCCESS: Checked In - User Validated · ${new Date().toLocaleString()}`;
        resultBox.classList.remove('hidden');
        showToast('Ticket checked in successfully.', 'success');
        return true;
    } catch (err) {
        resultBox.className = "p-4 rounded-xl text-sm font-medium bg-rose-50 text-rose-800 border border-rose-200";
        resultBox.textContent = err.message === "Ticket Already Verified / Double-Entry Blocked"
            ? "DENIED: Ticket Already Verified / Double-Entry Blocked"
            : `DENIED: ${err.message}`;
        resultBox.classList.remove('hidden');
        if (err.status !== 401) showToast(resultBox.textContent, 'error');
        return false;
    }
}

// Initializing state on app start
updateAuthUI();
loadEvents();