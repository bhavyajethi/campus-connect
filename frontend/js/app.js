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

function getTicketState(ticket, eventDate) {
    if (ticket.is_verified === true) return 'used';

    const parsedEventDate = new Date(`${eventDate}T00:00:00`);
    if (Number.isNaN(parsedEventDate.getTime())) return 'valid';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return parsedEventDate < today ? 'expired' : 'valid';
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
    const user = getSessionUser();
    authContainer.replaceChildren();

    if (!token || !user) {
        const loginButton = document.createElement('button');
        loginButton.type = 'button';
        loginButton.className = 'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700';
        loginButton.textContent = 'Login / Register';
        loginButton.addEventListener('click', openAuthModal);
        authContainer.appendChild(loginButton);
        document.getElementById('btn-my-tickets').classList.add('hidden');
        updateCreateEventVisibility(null);
        return;
    }

    document.getElementById('btn-my-tickets').classList.remove('hidden');

    const isAdmin = user.role === 'admin';
    const initials = isAdmin ? 'A' : getInitials(user.name);
    const wrapper = document.createElement('div');
    wrapper.className = 'relative flex items-center gap-2';

    const avatarButton = document.createElement('button');
    avatarButton.type = 'button';
    avatarButton.className = `flex h-9 w-9 items-center justify-center rounded-full font-bold text-white shadow-sm ${isAdmin ? 'bg-indigo-600' : 'bg-slate-700'}`;
    avatarButton.textContent = initials;
    avatarButton.setAttribute('aria-label', 'Open account menu');
    avatarButton.setAttribute('aria-expanded', 'false');

    const roleLabel = document.createElement('span');
    roleLabel.className = `text-[10px] font-bold ${isAdmin ? 'text-indigo-700' : 'text-slate-500'}`;
    roleLabel.textContent = isAdmin ? 'ADMIN' : '';

    const menu = document.createElement('div');
    menu.className = 'absolute right-0 top-12 z-50 hidden w-64 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-xl';
    menu.setAttribute('role', 'menu');

    const name = document.createElement('p');
    name.className = 'truncate text-sm font-semibold text-slate-900';
    name.textContent = user.name;
    const email = document.createElement('p');
    email.className = 'mt-1 truncate text-xs text-slate-500';
    email.textContent = user.email;
    const role = document.createElement('span');
    role.className = 'mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-700';
    role.textContent = isAdmin ? 'Admin' : 'Student';
    const logoutButton = document.createElement('button');
    logoutButton.type = 'button';
    logoutButton.className = 'mt-4 w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50';
    logoutButton.textContent = 'Logout';
    logoutButton.addEventListener('click', logout);
    menu.append(name, email, role, logoutButton);

    avatarButton.addEventListener('click', () => {
        const isOpen = !menu.classList.contains('hidden');
        menu.classList.toggle('hidden', isOpen);
        avatarButton.setAttribute('aria-expanded', String(!isOpen));
    });
    wrapper.append(avatarButton, roleLabel, menu);
    authContainer.appendChild(wrapper);
    updateCreateEventVisibility(user);
}

function getSessionUser() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        return user && typeof user.name === 'string' && typeof user.role === 'string' ? user : null;
    } catch {
        return null;
    }
}

function getInitials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return parts.length === 1
        ? parts[0].slice(0, 1).toUpperCase()
        : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function updateCreateEventVisibility(user = getSessionUser()) {
    const button = document.getElementById('btn-create-event');
    if (button) button.classList.toggle('hidden', user?.role !== 'admin');
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    updateAuthUI();
    showToast('Logged out successfully.', 'info');
}

function openEventModal() {
    if (getSessionUser()?.role !== 'admin') return;
    document.getElementById('event-modal').classList.remove('hidden');
}

function closeEventModal() {
    document.getElementById('event-modal').classList.add('hidden');
}

// --- Tab Switching Navigation ---
function switchTab(tabName) {
    const tabs = ['events', 'register', 'scanner', 'my-tickets'];
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
    if (tabName === 'my-tickets') {
        return loadMyTickets();
    }
}

// --- Load Events Catalog & Populate Selection Dropdown ---
async function loadEvents() {
    const grid = document.getElementById('events-grid');
    const selectDropdown = document.getElementById('reg-event-select');
    updateCreateEventVisibility();
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
            const option = document.createElement('option');
            option.value = event.id;
            option.textContent = event.name;
            option.dataset.eventDate = event.date;
            selectDropdown.appendChild(option);
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

async function loadMyTickets() {
    const grid = document.getElementById('my-tickets-grid');
    if (!localStorage.getItem('token')) {
        grid.innerHTML = '<p class="col-span-full rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">Log in to view your tickets.</p>';
        return;
    }

    grid.innerHTML = '<p class="col-span-full py-8 text-center text-sm text-slate-500">Loading your tickets...</p>';
    try {
        const tickets = await api.fetchMyRegistrations();
        if (tickets.length === 0) {
            grid.innerHTML = '<p class="col-span-full rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">You have not registered for any events yet.</p>';
            return;
        }

        grid.replaceChildren();
        tickets.forEach((ticket) => {
            const card = document.createElement('article');
            card.className = 'flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm';

            const details = document.createElement('div');
            const heading = document.createElement('h2');
            heading.className = 'font-semibold text-slate-900';
            heading.textContent = ticket.event_name;
            const date = document.createElement('p');
            date.className = 'mt-1 text-sm text-slate-500';
            date.textContent = new Date(`${ticket.event_date}T00:00:00`).toLocaleDateString();
            const badge = document.createElement('span');
            const ticketState = getTicketState(ticket, ticket.event_date);
            const badgeStyles = {
                valid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
                used: 'bg-slate-100 text-slate-600 border border-slate-200',
                expired: 'bg-rose-50 text-rose-700 border border-rose-200'
            };
            badge.className = `mt-3 inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${badgeStyles[ticketState]}`;
            badge.textContent = ticketState[0].toUpperCase() + ticketState.slice(1);
            details.append(heading, date, badge);

            const viewButton = document.createElement('button');
            viewButton.type = 'button';
            viewButton.className = 'self-start rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50';
            viewButton.textContent = 'View Pass';
            viewButton.addEventListener('click', () => viewTicketPass(ticket.event_id, ticket.event_name, ticket.event_date));
            card.append(details, viewButton);
            grid.appendChild(card);
        });
    } catch (error) {
        grid.innerHTML = '';
        const errorMessage = document.createElement('p');
        errorMessage.className = 'col-span-full rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800';
        errorMessage.textContent = `Unable to load your tickets: ${error.message}`;
        grid.appendChild(errorMessage);
    }
}

async function viewTicketPass(eventId, eventName, eventDate) {
    await switchTab('register');
    const selectDropdown = document.getElementById('reg-event-select');
    if (!Array.from(selectDropdown.options).some((option) => option.value === eventId)) {
        const option = new Option(eventName, eventId);
        option.dataset.eventDate = eventDate;
        selectDropdown.add(option);
    }
    selectDropdown.value = eventId;
    await restoreSelectedEventTicket();
}

async function prefillRegister(eventId) {
    await switchTab('register');
    const selectDropdown = document.getElementById('reg-event-select');
    selectDropdown.value = eventId;
    await restoreSelectedEventTicket();
}

function displayTicket(registration, eventDate = null) {
    generatedTicketId = registration.id;
    const selectedOption = document.getElementById('reg-event-select').selectedOptions[0];
    const resolvedEventDate = eventDate || selectedOption?.dataset.eventDate;
    const ticketState = getTicketState(registration, resolvedEventDate);
    const isVerified = ticketState === 'used';
    const isExpired = ticketState === 'expired';
    const qrImage = document.getElementById('qr-image');
    const usedOverlay = document.getElementById('ticket-used-overlay');
    const automateButton = document.getElementById('btn-automate-verify');
    usedOverlay.classList.toggle('hidden', !isVerified && !isExpired);
    usedOverlay.classList.toggle('is-expired', isExpired);
    usedOverlay.textContent = isExpired ? 'EXPIRED' : 'CHECKED IN';
    automateButton.classList.toggle('hidden', isVerified || isExpired);
    qrImage.classList.toggle('is-used', isVerified || isExpired);
    document.getElementById('ticket-event-name').textContent =
        document.getElementById('reg-event-select').selectedOptions[0]?.textContent || 'Campus Event';

    qrImage.src = api.getQrCodeUrl(registration.id);

    const badge = document.getElementById('ticket-state-badge');
    badge.textContent = isVerified ? '● Used at Gate' : isExpired ? '● Expired' : '● Valid Ticket';
    badge.className = isVerified
        ? 'ticket-state-badge border-slate-200 bg-slate-100 text-slate-600'
        : isExpired
            ? 'ticket-state-badge border-rose-200 bg-rose-50 text-rose-700'
            : 'ticket-state-badge border-emerald-200 bg-emerald-50 text-emerald-700';
    document.getElementById('ticket-result').classList.remove('hidden');
    setTicketClaimedButton(true, false, isVerified || isExpired);
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
        showToast(
            registration.is_verified === true
                ? 'This ticket has already been used and checked in at the gate.'
                : 'Ticket Previously Claimed. Your digital pass is ready.',
            'info'
        );
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
        localStorage.setItem('user', JSON.stringify({
            id: data.user_id,
            name: data.name,
            email: data.email,
            role: data.role
        }));
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
        localStorage.setItem('user', JSON.stringify({
            id: data.user_id,
            name: data.name,
            email: data.email,
            role: data.role
        }));
        updateAuthUI();
        closeAuthModal();
        showToast('Account created and logged in successfully.', 'success');
    } catch (err) {
        if (err.status !== 401) showToast(`Signup failed: ${err.message}`, 'error');
    }
});

document.getElementById('event-create-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const user = getSessionUser();
    const token = localStorage.getItem('token');
    if (user?.role !== 'admin' || !token) {
        showToast('Admin access is required to create events.', 'error');
        return;
    }

    const eventData = {
        name: document.getElementById('event-name').value.trim(),
        description: document.getElementById('event-description').value.trim() || null,
        date: document.getElementById('event-date').value
    };

    try {
        await api.createEvent(eventData, token);
        document.getElementById('event-create-form').reset();
        closeEventModal();
        showToast('Event created successfully.', 'success');
        await loadEvents();
    } catch (error) {
        showToast(`Unable to create event: ${error.message}`, 'error');
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
            showToast(
                existingTicket.is_verified === true
                    ? 'This ticket has already been used and checked in at the gate.'
                    : 'Ticket Previously Claimed. Your digital pass is ready.',
                'info'
            );
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
                showToast(
                    existingTicket.is_verified === true
                        ? 'This ticket has already been used and checked in at the gate.'
                        : 'Ticket Previously Claimed. Your digital pass is ready.',
                    'info'
                );
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