let html5QrCode = null;
let generatedTicketId = null;
let userRegistrations = [];
let currentTicket = null;
let currentEvents = [];
let selectedEventCategory = 'All';

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
    const loginButton = document.getElementById('btn-auth');
    const userMenuContainer = document.getElementById('user-menu-container');
    const storedUser = getSessionUser();
    const hasSession = Boolean(token);
    const user = hasSession
        ? storedUser || { name: 'Campus Connect User', email: '', role: 'student' }
        : null;
    const myTicketsButton = document.getElementById('btn-my-tickets');
    const adminDashboardButton = document.getElementById('btn-admin-dashboard');
    myTicketsButton.classList.toggle('hidden', !hasSession);
    adminDashboardButton.classList.toggle('hidden', user?.role !== 'admin');
    loginButton.classList.toggle('hidden', hasSession);
    userMenuContainer.classList.toggle('hidden', !hasSession);

    if (!hasSession) {
        purgePrivateState();
        userMenuContainer.replaceChildren();
        updateCreateEventVisibility(null);
        if (
            !document.getElementById('tab-my-tickets').classList.contains('hidden') ||
            !document.getElementById('tab-admin-dashboard').classList.contains('hidden')
        ) {
            switchTab('events');
        }
        return;
    }

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
    userMenuContainer.replaceChildren(wrapper);
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

function purgePrivateState() {
    userRegistrations = [];
    currentTicket = null;
    generatedTicketId = null;
    document.getElementById('active-tickets-grid').replaceChildren();
    document.getElementById('past-tickets-grid').replaceChildren();
    const ticketResult = document.getElementById('ticket-result');
    ticketResult.replaceChildren();
    ticketResult.classList.add('hidden');
    document.getElementById('reg-event-select').value = '';
    setTicketClaimedButton(false);
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    purgePrivateState();
    updateAuthUI();
    switchTab('events');
    showToast('Logged out successfully.', 'success');
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
    const tabs = {
        events: { section: 'tab-events', button: 'btn-events' },
        register: { section: 'tab-register', button: 'btn-register' },
        scanner: { section: 'tab-scanner', button: 'btn-scanner' },
        'my-tickets': { section: 'tab-my-tickets', button: 'btn-my-tickets' },
        'admin-dashboard': { section: 'tab-admin-dashboard', button: 'btn-admin-dashboard' }
    };

    if (!tabs[tabName]) return;
    if (tabName === 'my-tickets' && !localStorage.getItem('token')) {
        showToast('Please log in to view your tickets', 'info');
        toggleAuthMode('login');
        openAuthModal();
        tabName = 'events';
    }
    if (tabName === 'admin-dashboard' && (!localStorage.getItem('token') || getSessionUser()?.role !== 'admin')) {
        showToast('Admin access required.', 'error');
        tabName = 'events';
    }

    Object.values(tabs).forEach(({ section, button }) => {
        document.getElementById(section).classList.add('hidden');
        document.getElementById(button).className = 'px-4 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition';
    });

    const activeTab = tabs[tabName];
    document.getElementById(activeTab.section).classList.remove('hidden');
    document.getElementById(activeTab.button).className = 'px-4 py-2 text-sm font-medium rounded-lg bg-indigo-50 text-indigo-600 transition';
    updateAuthUI();

    if (tabName !== 'scanner') {
        stopCameraScanner();
    }
    
    if (tabName === 'events' || tabName === 'register') {
        return loadEvents();
    }
    if (tabName === 'my-tickets') {
        return loadMyTickets();
    }
    if (tabName === 'admin-dashboard') {
        return loadAdminDashboard();
    }
}

// --- Load Events Catalog & Populate Selection Dropdown ---
async function loadEvents() {
    const grid = document.getElementById('events-grid');
    const selectDropdown = document.getElementById('reg-event-select');
    const token = localStorage.getItem('token');
    updateCreateEventVisibility();
    if (!token) userRegistrations = [];
    grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
    grid.innerHTML = `<p class="text-sm text-slate-400 col-span-full text-center py-10">Loading events...</p>`;
    
    try {
        const events = await api.fetchEvents();
        if (localStorage.getItem('token') !== token) return;
        currentEvents = events;
        if (token && localStorage.getItem('token') === token) {
            try {
                const registrations = await api.fetchMyRegistrations(token);
                if (localStorage.getItem('token') !== token) return;
                userRegistrations = registrations;
            } catch (error) {
                if (localStorage.getItem('token') !== token) return;
                userRegistrations = [];
                if (error.status !== 401) showToast(`Unable to check your registrations: ${error.message}`, 'error');
            }
        }
        const registeredEventIds = new Set(userRegistrations.map((registration) => registration.event_id));
        
        const selectedEventId = selectDropdown.value;
        selectDropdown.innerHTML = `<option value="" disabled selected>-- Select an Event --</option>`;

        if (events.length === 0) {
            renderEventCards(new Set(userRegistrations.map((registration) => registration.event_id)));
            grid.innerHTML = `<p class="text-sm text-slate-400 col-span-full text-center py-10">No upcoming events found. Create one in Swagger UI with a future date!</p>`;
            return;
        }

        // Populate Dropdown & Event Cards Grid
        events.forEach(event => {
            const option = document.createElement('option');
            option.value = event.id;
            option.textContent = event.name;
            option.dataset.eventDate = event.date;
            option.dataset.eventVenue = event.venue || 'Campus venue';
            selectDropdown.appendChild(option);
        });
        if (events.some(event => event.id === selectedEventId)) {
            selectDropdown.value = selectedEventId;
        }
        renderEventCards(registeredEventIds);
    } catch (err) {
        grid.textContent = `Unable to load events: ${err.message}`;
        grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm text-rose-700';
        if (err.status !== 401) showToast(err.message, 'error');
    }
}

function setEventCategory(category) {
    selectedEventCategory = category;
    document.querySelectorAll('.category-filter').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.category === category);
    });
    renderEventCards(new Set(userRegistrations.map((registration) => registration.event_id)));
}

function renderEventCards(registeredEventIds = new Set(userRegistrations.map((registration) => registration.event_id))) {
    const grid = document.getElementById('events-grid');
    const searchTerm = document.getElementById('event-search').value.trim().toLowerCase();
    const filteredEvents = currentEvents.filter((event) => {
        const matchesCategory = selectedEventCategory === 'All' || event.category === selectedEventCategory;
        const searchableText = `${event.name} ${event.description || ''} ${event.venue || ''}`.toLowerCase();
        return matchesCategory && searchableText.includes(searchTerm);
    });

    if (filteredEvents.length === 0) {
        grid.innerHTML = '<p class="col-span-full py-10 text-center text-sm text-slate-500">No events match these filters.</p>';
        return;
    }

    const cards = filteredEvents.map((event) => {
        const capacity = Number(event.capacity) || 100;
        const claimed = Number(event.current_registrations) || 0;
        const remaining = Number.isFinite(Number(event.seats_remaining))
            ? Math.max(0, Number(event.seats_remaining))
            : Math.max(0, capacity - claimed);
        const soldOut = remaining <= 0 || claimed >= capacity;
        const percentage = Math.min(100, capacity ? claimed / capacity * 100 : 0);
        const card = document.createElement('article');
        card.className = 'event-card flex flex-col justify-between gap-5 rounded-xl bg-white p-6 shadow-sm';

        const content = document.createElement('div');
        const header = document.createElement('div');
        header.className = 'mb-3 flex items-start justify-between gap-3';
        const title = document.createElement('h2');
        title.className = 'text-lg font-bold text-slate-900';
        title.textContent = event.name;
        const category = document.createElement('span');
        category.className = 'shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700';
        category.textContent = event.category || 'Tech';
        header.append(title, category);

        const dateVenue = document.createElement('p');
        dateVenue.className = 'text-sm font-medium text-slate-600';
        dateVenue.textContent = `${event.date} · ${event.venue || 'Campus venue'}`;
        const description = document.createElement('p');
        description.className = 'mt-2 line-clamp-3 text-sm leading-6 text-slate-600';
        description.textContent = event.description || 'No description provided.';

        const availability = document.createElement('div');
        availability.className = 'mt-5';
        const availabilityLabel = document.createElement('div');
        availabilityLabel.className = 'mb-2 flex justify-between gap-3 text-xs font-semibold';
        const count = document.createElement('span');
        count.className = 'text-slate-600';
        count.textContent = `${claimed} / ${capacity} Seats Claimed`;
        const remainingLabel = document.createElement('span');
        remainingLabel.className = soldOut ? 'text-rose-700' : 'text-slate-500';
        remainingLabel.textContent = soldOut ? 'Sold Out' : `${remaining} left`;
        availabilityLabel.append(count, remainingLabel);
        const track = document.createElement('div');
        track.className = 'availability-track';
        const fill = document.createElement('div');
        fill.className = `availability-fill ${soldOut ? 'is-sold-out' : percentage >= 80 ? 'is-nearly-full' : ''}`;
        fill.style.width = `${percentage}%`;
        track.appendChild(fill);
        availability.append(availabilityLabel, track);
        content.append(header, dateVenue, description, availability);

        const actionRow = document.createElement('div');
        actionRow.className = 'flex items-center justify-end border-t border-slate-100 pt-4';
        const action = document.createElement('button');
        action.type = 'button';
        if (soldOut && !registeredEventIds.has(event.id)) {
            action.disabled = true;
            action.className = 'cursor-not-allowed rounded-lg bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700';
            action.textContent = 'Sold Out';
        } else if (registeredEventIds.has(event.id)) {
            action.className = 'flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700';
            action.innerHTML = '<span>Registered</span><span aria-hidden="true">✓</span>';
            action.addEventListener('click', () => handleEventSelection(event.id));
        } else {
            action.className = 'rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-800';
            action.textContent = 'Select Event';
            action.addEventListener('click', () => handleEventSelection(event.id));
        }
        actionRow.appendChild(action);
        card.append(content, actionRow);
        return card;
    });
    grid.replaceChildren(...cards);
}

document.getElementById('event-search').addEventListener('input', () => {
    renderEventCards(new Set(userRegistrations.map((registration) => registration.event_id)));
});

function initializeEventFilters() {
    document.querySelectorAll('.category-filter').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.category === selectedEventCategory);
    });
}

function handleEventSelection(eventId) {
    if (!localStorage.getItem('token')) {
        showToast('Please log in to claim tickets', 'info');
        toggleAuthMode('login');
        openAuthModal();
        return;
    }
    return prefillRegister(eventId);
}

async function loadMyTickets() {
    const activeGrid = document.getElementById('active-tickets-grid');
    const pastGrid = document.getElementById('past-tickets-grid');
    const token = localStorage.getItem('token');
    if (!token) {
        activeGrid.innerHTML = '<p class="col-span-full text-sm text-slate-500">Log in to view your tickets.</p>';
        pastGrid.innerHTML = '<p class="col-span-full text-sm text-slate-400">Log in to view ticket history.</p>';
        return;
    }

    activeGrid.innerHTML = '<p class="col-span-full py-4 text-sm text-slate-500">Loading active passes...</p>';
    pastGrid.innerHTML = '<p class="col-span-full py-4 text-sm text-slate-400">Loading history...</p>';
    try {
        const tickets = await api.fetchMyRegistrations(token);
        if (localStorage.getItem('token') !== token) return;
        const ticketsWithState = tickets.map((ticket) => ({
            ticket,
            state: getTicketState(ticket, ticket.event_date)
        }));
        const activeTickets = ticketsWithState
            .filter(({ state }) => state === 'valid')
            .map(({ ticket }) => ticket);
        const pastTickets = ticketsWithState
            .filter(({ state }) => state === 'used' || state === 'expired')
            .map(({ ticket }) => ticket);

        renderTicketCards(activeGrid, activeTickets, false);
        renderTicketCards(pastGrid, pastTickets, true);
    } catch (error) {
        if (localStorage.getItem('token') !== token) return;
        const errorMessage = document.createElement('p');
        errorMessage.className = 'col-span-full text-sm text-rose-700';
        errorMessage.textContent = `Unable to load your tickets: ${error.message}`;
        activeGrid.replaceChildren(errorMessage.cloneNode(true));
        pastGrid.replaceChildren(errorMessage);
    }
}

function renderTicketCards(grid, tickets, isHistory) {
    if (tickets.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'col-span-full text-sm text-slate-400';
        emptyMessage.textContent = isHistory ? 'No ticket history yet.' : 'No active passes found.';
        grid.replaceChildren(emptyMessage);
        return;
    }

    const badgeStyles = {
        valid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        used: 'bg-slate-100 text-slate-600 border border-slate-200',
        expired: 'bg-rose-50 text-rose-700 border border-rose-200'
    };
    const cards = tickets.map((ticket) => {
        const state = getTicketState(ticket, ticket.event_date);
        const card = document.createElement('article');
        card.className = `flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${isHistory ? 'opacity-80' : ''}`;

        const details = document.createElement('div');
        const heading = document.createElement('h2');
        heading.className = isHistory ? 'font-semibold text-slate-700' : 'font-semibold text-slate-900';
        heading.textContent = ticket.event_name;
        const date = document.createElement('p');
        date.className = 'mt-1 text-sm text-slate-500';
        date.textContent = new Date(`${ticket.event_date}T00:00:00`).toLocaleDateString();
        const badge = document.createElement('span');
        badge.className = `mt-3 inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${badgeStyles[state]}`;
        badge.textContent = state[0].toUpperCase() + state.slice(1);
        details.append(heading, date, badge);

        const viewButton = document.createElement('button');
        viewButton.type = 'button';
        viewButton.className = 'self-start rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50';
        viewButton.textContent = 'View Pass';
        viewButton.addEventListener('click', () => viewTicketPass(ticket.event_id, ticket.event_name, ticket.event_date, ticket.event_venue));
        card.append(details, viewButton);
        return card;
    });
    grid.replaceChildren(...cards);
}

async function loadAdminDashboard() {
    if (getSessionUser()?.role !== 'admin') {
        switchTab('events');
        return;
    }

    const metrics = document.getElementById('admin-metrics');
    const breakdown = document.getElementById('admin-event-breakdown');
    metrics.innerHTML = '<p class="text-sm text-slate-500">Loading metrics...</p>';
    breakdown.replaceChildren();
    try {
        const stats = await api.fetchAdminStats();
        if (getSessionUser()?.role !== 'admin') return;
        const metricCards = [
            { label: 'Total Users', value: stats.total_users },
            { label: 'Total Tickets', value: stats.total_tickets },
            { label: 'Gate Check-Ins', value: `${stats.checkin_percentage}%` }
        ];
        metrics.replaceChildren(...metricCards.map(({ label, value }) => {
            const card = document.createElement('article');
            card.className = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm';
            const title = document.createElement('p');
            title.className = 'text-sm font-medium text-slate-500';
            title.textContent = label;
            const number = document.createElement('p');
            number.className = 'mt-2 text-3xl font-bold text-slate-900';
            number.textContent = String(value);
            card.append(title, number);
            return card;
        }));

        const rows = stats.registrations_per_event.map((item) => {
            const row = document.createElement('div');
            row.className = 'flex flex-wrap items-center justify-between gap-3 py-4';
            const eventInfo = document.createElement('div');
            const name = document.createElement('p');
            name.className = 'font-semibold text-slate-900';
            name.textContent = item.event_name;
            const date = document.createElement('p');
            date.className = 'text-sm text-slate-500';
            date.textContent = `${item.event_date} · ${item.capacity} seats`;
            eventInfo.append(name, date);
            const count = document.createElement('p');
            count.className = 'text-sm font-semibold text-slate-700';
            count.textContent = `${item.registered_count} registered · ${item.verified_count} checked in`;
            row.append(eventInfo, count);
            return row;
        });
        if (rows.length) breakdown.replaceChildren(...rows);
        else breakdown.innerHTML = '<p class="py-5 text-sm text-slate-500">No event registrations yet.</p>';
    } catch (error) {
        metrics.innerHTML = '';
        const message = document.createElement('p');
        message.className = 'text-sm text-rose-700';
        message.textContent = `Unable to load dashboard: ${error.message}`;
        metrics.appendChild(message);
    }
}

async function downloadAttendeeCsv() {
    if (getSessionUser()?.role !== 'admin') {
        showToast('Admin access required.', 'error');
        return;
    }
    try {
        const blob = await api.downloadAttendeeCsv();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'campus-connect-attendees.csv';
        link.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        showToast(`Unable to download attendee list: ${error.message}`, 'error');
    }
}

async function viewTicketPass(eventId, eventName, eventDate, eventVenue = 'Campus venue') {
    await switchTab('register');
    const selectDropdown = document.getElementById('reg-event-select');
    if (!Array.from(selectDropdown.options).some((option) => option.value === eventId)) {
        const option = new Option(eventName, eventId);
        option.dataset.eventDate = eventDate;
        option.dataset.eventVenue = eventVenue;
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
    const ticketResult = document.getElementById('ticket-result');
    if (!document.getElementById('ticket-state-badge')) {
        ticketResult.replaceChildren(
            document.getElementById('ticket-result-template').content.cloneNode(true)
        );
    }
    generatedTicketId = registration.id;
    currentTicket = registration;
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
    document.getElementById('ticket-event-venue').textContent = selectedOption?.dataset.eventVenue || 'Campus venue';

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
        if (localStorage.getItem('token') !== token || document.getElementById('reg-event-select').value !== eventId) return;
        displayTicket(registration);
        showToast(
            registration.is_verified === true
                ? 'This ticket has already been used and checked in at the gate.'
                : 'Ticket Previously Claimed. Your digital pass is ready.',
            'info'
        );
    } catch (err) {
        if (localStorage.getItem('token') !== token || document.getElementById('reg-event-select').value !== eventId) return;
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
        loadEvents();
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
        loadEvents();
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
        date: document.getElementById('event-date').value,
        category: document.getElementById('event-category').value,
        venue: document.getElementById('event-venue').value.trim(),
        capacity: Number(document.getElementById('event-capacity').value)
        category: document.getElementById('event-category').value,
        venue: document.getElementById('event-venue').value.trim(),
        capacity: Number(document.getElementById('event-capacity').value)
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
initializeEventFilters();
updateAuthUI();
loadEvents();