let html5QrCode = null;
let generatedTicketId = null;
let userRegistrations = [];
let currentTicket = null;

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const colors = {
        success: 'bg-emerald-700 text-white border-emerald-800',
        error: 'bg-rose-700 text-white border-rose-800',
        info: 'bg-slate-900 text-white border-slate-950'
    };
    const toast = document.createElement('div');
    toast.className = `rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg ${colors[type] || colors.info}`;
    toast.textContent = message;
    container.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3000);
}

function getSessionUser() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        return user && typeof user === 'object' ? user : null;
    } catch {
        return null;
    }
}

function getDecodedSessionUser() {
    const savedUser = getSessionUser();
    if (savedUser && typeof savedUser.role === 'string') {
        return savedUser;
    }

    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
        const payload = token.split('.')[1];
        const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = JSON.parse(atob(normalizedPayload));
        if (!decoded) return null;
        return {
            id: decoded.sub || decoded.user_id || null,
            name: decoded.name || 'Campus Connect User',
            email: decoded.email || '',
            role: decoded.role || 'student'
        };
    } catch {
        return null;
    }
}

function getInitials(name = '') {
    const names = name.trim().split(/\s+/).filter(Boolean);
    if (!names.length) return '?';
    if (names.length === 1) return names[0][0].toUpperCase();
    return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
}

function openAuthModal() {
    document.getElementById('auth-modal')?.classList.remove('hidden');
}

function closeAuthModal() {
    document.getElementById('auth-modal')?.classList.add('hidden');
}

function toggleAuthMode(mode) {
    const signup = mode === 'signup';
    document.getElementById('auth-modal-title').textContent = signup ? 'Create Student Account' : 'Student Login';
    document.getElementById('auth-login-form').classList.toggle('hidden', signup);
    document.getElementById('auth-signup-form').classList.toggle('hidden', !signup);
}

function updateAuthUI() {
    const token = localStorage.getItem('token');
    const user = getDecodedSessionUser();
    const role = user?.role || 'guest';
    const isGuest = !token || role === 'guest';
    const isStudent = role === 'student';
    const isAdmin = role === 'admin';

    const eventsButton = document.getElementById('btn-events');
    const registerButton = document.getElementById('btn-register');
    const myTicketsButton = document.getElementById('btn-my-tickets');
    const scannerButton = document.getElementById('btn-scanner');
    const adminDashboardButton = document.getElementById('btn-admin-dashboard');
    const loginButton = document.getElementById('btn-auth');
    const userMenu = document.getElementById('user-menu-container');
    const createEventButton = document.getElementById('btn-create-event');

    const activeButtonClass = 'px-4 py-2 text-sm font-medium rounded-lg bg-indigo-50 text-indigo-600 transition';
    const inactiveButtonClass = 'px-4 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition';

    eventsButton.className = activeButtonClass;
    registerButton.className = inactiveButtonClass;
    myTicketsButton.className = inactiveButtonClass;
    scannerButton.className = inactiveButtonClass;
    adminDashboardButton.className = inactiveButtonClass;

    if (isGuest) {
        eventsButton.classList.remove('hidden');
        registerButton.classList.add('hidden');
        myTicketsButton.classList.add('hidden');
        scannerButton.classList.add('hidden');
        adminDashboardButton.classList.add('hidden');
        loginButton.classList.remove('hidden');
        userMenu.classList.add('hidden');
        userMenu.replaceChildren();
        createEventButton?.classList.add('hidden');
        return;
    }

    if (isStudent) {
        eventsButton.classList.remove('hidden');
        registerButton.classList.remove('hidden');
        myTicketsButton.classList.remove('hidden');
        scannerButton.classList.add('hidden');
        adminDashboardButton.classList.add('hidden');
        loginButton.classList.add('hidden');
        userMenu.classList.remove('hidden');
        createEventButton?.classList.add('hidden');
    } else if (isAdmin) {
        eventsButton.classList.remove('hidden');
        registerButton.classList.add('hidden');
        myTicketsButton.classList.add('hidden');
        scannerButton.classList.remove('hidden');
        adminDashboardButton.classList.remove('hidden');
        loginButton.classList.add('hidden');
        userMenu.classList.remove('hidden');
        createEventButton?.classList.remove('hidden');
    }

    const isAdminAvatar = isAdmin;
    const wrapper = document.createElement('div');
    wrapper.className = 'relative flex items-center gap-2';
    const avatarButton = document.createElement('button');
    avatarButton.type = 'button';
    avatarButton.className = `flex h-9 w-9 items-center justify-center rounded-full font-bold text-white shadow-sm ${isAdminAvatar ? 'bg-indigo-600' : 'bg-slate-700'}`;
    avatarButton.textContent = isAdminAvatar ? 'A' : getInitials(user?.name || 'Campus Connect User');
    avatarButton.setAttribute('aria-label', 'Open account menu');
    avatarButton.setAttribute('aria-expanded', 'false');

    const roleTag = document.createElement('span');
    roleTag.className = `text-[10px] font-bold ${isAdminAvatar ? 'text-indigo-700' : 'text-slate-500'}`;
    roleTag.textContent = isAdminAvatar ? 'ADMIN' : '';

    const menu = document.createElement('div');
    menu.className = 'absolute right-0 top-12 z-50 hidden w-64 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-xl';
    menu.setAttribute('role', 'menu');

    const name = document.createElement('p');
    name.className = 'truncate text-sm font-semibold text-slate-900';
    name.textContent = user?.name || 'Campus Connect User';
    const email = document.createElement('p');
    email.className = 'mt-1 truncate text-xs text-slate-500';
    email.textContent = user?.email || '';
    const roleBadge = document.createElement('span');
    roleBadge.className = 'mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-700';
    roleBadge.textContent = isAdminAvatar ? 'Admin' : 'Student';

    const logoutButton = document.createElement('button');
    logoutButton.type = 'button';
    logoutButton.className = 'mt-4 w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50';
    logoutButton.textContent = 'Logout';
    logoutButton.addEventListener('click', logout);

    menu.append(name, email, roleBadge, logoutButton);
    avatarButton.addEventListener('click', () => {
        const willOpen = menu.classList.contains('hidden');
        menu.classList.toggle('hidden', !willOpen);
        avatarButton.setAttribute('aria-expanded', String(willOpen));
    });

    wrapper.append(avatarButton, roleTag, menu);
    userMenu.replaceChildren(wrapper);
}

function switchTab(tabName) {
    const tabs = {
        events: ['tab-events', 'btn-events'],
        register: ['tab-register', 'btn-register'],
        'my-tickets': ['tab-my-tickets', 'btn-my-tickets'],
        scanner: ['tab-scanner', 'btn-scanner'],
        'admin-dashboard': ['tab-admin-dashboard', 'btn-admin-dashboard']
    };
    if (!tabs[tabName]) return;

    const user = getDecodedSessionUser();
    const role = user?.role || 'guest';

    if (!user && tabName !== 'events') {
        showToast('Please log in to access that page.', 'info');
        openAuthModal();
        tabName = 'events';
    }

    if (role === 'admin' && (tabName === 'register' || tabName === 'my-tickets')) {
        showToast('Admin users cannot access student ticketing tabs.', 'error');
        tabName = 'events';
    }

    if (role === 'student' && (tabName === 'scanner' || tabName === 'admin-dashboard')) {
        showToast('Student users cannot access admin tools.', 'error');
        tabName = 'events';
    }

    Object.values(tabs).forEach(([sectionId, buttonId]) => {
        document.getElementById(sectionId)?.classList.add('hidden');
        const button = document.getElementById(buttonId);
        if (!button) return;
        button.className = 'px-4 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition';
    });

    const [activeSection, activeButton] = tabs[tabName];
    document.getElementById(activeSection)?.classList.remove('hidden');
    const selectedButton = document.getElementById(activeButton);
    if (selectedButton) {
        selectedButton.className = 'px-4 py-2 text-sm font-medium rounded-lg bg-indigo-50 text-indigo-600 transition';
    }

    updateAuthUI();

    if (tabName !== 'scanner') stopCameraScanner();
    if (tabName === 'events') return loadEvents();
    if (tabName === 'register') return loadEvents();
    if (tabName === 'my-tickets') return loadMyTickets();
    if (tabName === 'admin-dashboard') return loadAdminDashboard();
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    userRegistrations = [];
    currentTicket = null;
    generatedTicketId = null;
    document.getElementById('events-grid').replaceChildren();
    document.getElementById('active-tickets-grid').replaceChildren();
    document.getElementById('past-tickets-grid').replaceChildren();
    document.getElementById('ticket-result').replaceChildren();
    document.getElementById('ticket-result').classList.add('hidden');
    updateAuthUI();
    switchTab('events');
    showToast('Logged out successfully.', 'success');
}

function openEventModal() {
    if (getSessionUser()?.role !== 'admin' || !localStorage.getItem('token')) return;
    document.getElementById('create-event-modal').classList.remove('hidden');
}

function closeEventModal() {
    document.getElementById('create-event-modal').classList.add('hidden');
}

function getTicketState(ticket, eventDate) {
    if (ticket?.is_verified === true) return 'used';
    if (!eventDate) return 'valid';
    const eventDay = new Date(`${eventDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Number.isNaN(eventDay.getTime()) || eventDay >= today ? 'valid' : 'expired';
}

function setTicketClaimedButton(state) {
    const button = document.getElementById('btn-generate-ticket');
    if (!button) return;
    const claimed = state !== 'unclaimed';
    button.disabled = claimed;
    button.textContent = state === 'used' || state === 'expired'
        ? 'Ticket Used / Checked In'
        : state === 'claimed'
            ? 'Ticket Already Claimed'
            : 'Generate QR Ticket';
    button.classList.toggle('opacity-50', claimed);
    button.classList.toggle('cursor-not-allowed', claimed);
    button.classList.toggle('bg-rose-700', state === 'used' || state === 'expired');
    button.classList.toggle('hover:bg-rose-800', state === 'used' || state === 'expired');
}

function ensureTicketMarkup() {
    const result = document.getElementById('ticket-result');
    if (!document.getElementById('ticket-state-badge')) {
        result.replaceChildren(document.getElementById('ticket-result-template').content.cloneNode(true));
    }
    return result;
}

function displayTicket(ticket, event = null) {
    const result = ensureTicketMarkup();
    const select = document.getElementById('reg-event-select');
    const option = select.selectedOptions[0];
    const state = getTicketState(ticket, event?.date || option?.dataset.eventDate);
    const used = state === 'used' || state === 'expired';
    const venue = event?.venue || option?.dataset.eventVenue || 'Campus venue';
    currentTicket = ticket;
    generatedTicketId = ticket.id;

    document.getElementById('ticket-event-name').textContent = event?.name || option?.textContent || 'Campus Event';
    document.getElementById('ticket-event-venue').textContent = venue;
    const badge = document.getElementById('ticket-state-badge');
    badge.textContent = state === 'used' ? '● Used at Gate' : state === 'expired' ? '● Expired' : '● Valid Ticket';
    badge.className = state === 'used'
        ? 'ticket-state-badge border-slate-200 bg-slate-100 text-slate-600'
        : state === 'expired'
            ? 'ticket-state-badge border-rose-200 bg-rose-50 text-rose-700'
            : 'ticket-state-badge border-emerald-200 bg-emerald-50 text-emerald-700';
    const qr = document.getElementById('qr-image');
    qr.src = api.getQrCodeUrl(ticket.id);
    qr.classList.toggle('is-used', used);
    const stamp = document.getElementById('ticket-used-overlay');
    stamp.textContent = state === 'expired' ? 'EXPIRED' : 'CHECKED IN';
    stamp.classList.toggle('hidden', !used);
    stamp.classList.toggle('is-expired', state === 'expired');
    document.getElementById('btn-automate-verify').classList.toggle('hidden', used);
    result.classList.remove('hidden');
    setTicketClaimedButton(state === 'valid' && ticket.id ? 'claimed' : state);
}

async function loadEvents() {
    const grid = document.getElementById('events-grid');
    const select = document.getElementById('reg-event-select');
    const token = localStorage.getItem('token');
    grid.innerHTML = '<p class="col-span-full py-10 text-center text-sm text-slate-500">Loading events...</p>';
    try {
        const events = await api.fetchEvents();
        if (token !== localStorage.getItem('token')) return;
        if (token) userRegistrations = await api.fetchMyRegistrations(token);
        else userRegistrations = [];
        if (token !== localStorage.getItem('token')) return;

        const selectedEventId = select.value;
        select.replaceChildren(new Option('-- Select an Event --', '', true, true));
        events.forEach((event) => {
            const option = new Option(event.name, event.id);
            option.dataset.eventDate = event.date;
            option.dataset.eventVenue = event.venue || 'Campus venue';
            select.add(option);
        });
        if (events.some((event) => event.id === selectedEventId)) select.value = selectedEventId;

        const registeredIds = new Set(userRegistrations.map((registration) => registration.event_id));
        renderEventCards(events, registeredIds);
    } catch (error) {
        if (token !== localStorage.getItem('token')) return;
        grid.textContent = `Unable to load events: ${error.message}`;
        showToast(error.message, 'error');
    }
}

function renderEventCards(events, registeredIds) {
    const grid = document.getElementById('events-grid');
    if (!events.length) {
        grid.innerHTML = '<p class="col-span-full py-10 text-center text-sm text-slate-500">No upcoming events found.</p>';
        return;
    }
    const cards = events.map((event) => {
        const capacity = Number(event.capacity) || 100;
        const claimed = Number(event.current_registrations) || 0;
        const remaining = Math.max(0, Number(event.seats_remaining ?? capacity - claimed));
        const soldOut = remaining === 0;
        const percent = Math.min(100, claimed / capacity * 100);
        const card = document.createElement('article');
        card.className = 'event-card flex flex-col justify-between gap-5 rounded-xl bg-white p-6 shadow-sm';
        const info = document.createElement('div');
        const heading = document.createElement('div');
        heading.className = 'mb-3 flex items-start justify-between gap-3';
        const title = document.createElement('h2');
        title.className = 'text-lg font-bold text-slate-900';
        title.textContent = event.name;
        const category = document.createElement('span');
        category.className = 'rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700';
        category.textContent = event.category || 'Tech';
        heading.append(title, category);
        const dateVenue = document.createElement('p');
        dateVenue.className = 'text-sm text-slate-600';
        dateVenue.textContent = `${event.date} · ${event.venue || 'Campus venue'}`;
        const description = document.createElement('p');
        description.className = 'mt-2 text-sm leading-6 text-slate-600';
        description.textContent = event.description || 'No description provided.';
        const availability = document.createElement('div');
        availability.className = 'mt-5';
        const label = document.createElement('div');
        label.className = 'mb-2 flex justify-between text-xs font-semibold';
        const claimLabel = document.createElement('span');
        claimLabel.className = 'text-slate-600';
        claimLabel.textContent = `${claimed} / ${capacity} Seats Claimed`;
        const remainingLabel = document.createElement('span');
        remainingLabel.className = soldOut ? 'text-rose-700' : 'text-slate-500';
        remainingLabel.textContent = soldOut ? 'Sold Out' : `${remaining} left`;
        label.append(claimLabel, remainingLabel);
        const track = document.createElement('div');
        track.className = 'availability-track';
        const fill = document.createElement('div');
        fill.className = `availability-fill ${soldOut ? 'is-sold-out' : percent >= 80 ? 'is-nearly-full' : ''}`;
        fill.style.width = `${percent}%`;
        track.append(fill);
        availability.append(label, track);
        info.append(heading, dateVenue, description, availability);
        const footer = document.createElement('div');
        footer.className = 'flex items-center justify-between gap-2 border-t border-slate-100 pt-4';

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        const currentRole = getDecodedSessionUser()?.role || 'guest';
        if (currentRole === 'admin') {
            deleteButton.setAttribute('onclick', `handleDeleteEvent('${event.id}')`);
            deleteButton.className = 'text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1';
            deleteButton.textContent = 'Delete';
            deleteButton.title = 'Delete event';
        }

        const action = document.createElement('button');
        action.type = 'button';
        if (soldOut && !registeredIds.has(event.id)) {
            action.disabled = true;
            action.className = 'cursor-not-allowed rounded-lg bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700';
            action.textContent = 'Sold Out';
        } else {
            action.className = registeredIds.has(event.id)
                ? 'flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700'
                : 'rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800';
            action.textContent = registeredIds.has(event.id) ? 'Registered ✓' : 'Select Event';
            action.addEventListener('click', () => handleEventSelection(event.id));
        }
        if (currentRole === 'admin') {
            footer.append(deleteButton, action);
        } else {
            footer.append(action);
        }
        card.append(info, footer);
        return card;
    });
    grid.replaceChildren(...cards);
}

async function handleDeleteEvent(eventId) {
    if (!confirm('Are you sure you want to cancel and delete this event?')) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        await api.deleteEvent(eventId, token);
        showToast('Event deleted successfully', 'success');
        await loadEvents();
    } catch (error) {
        showToast(error.message || 'Failed to delete event', 'error');
    }
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

async function prefillRegister(eventId) {
    await switchTab('register');
    const select = document.getElementById('reg-event-select');
    if (!Array.from(select.options).some((option) => option.value === eventId)) {
        const registration = userRegistrations.find((item) => item.event_id === eventId);
        const option = new Option(registration?.event_name || 'Selected Event', eventId);
        option.dataset.eventDate = registration?.event_date || '';
        option.dataset.eventVenue = registration?.event_venue || 'Campus venue';
        select.add(option);
    }
    select.value = eventId;
    await restoreSelectedEventTicket();
}

async function loadMyTickets() {
    const activeGrid = document.getElementById('active-tickets-grid');
    const pastGrid = document.getElementById('past-tickets-grid');
    const token = localStorage.getItem('token');
    if (!token) {
        switchTab('events');
        openAuthModal();
        return;
    }
    activeGrid.innerHTML = '<p class="text-sm text-slate-500">Loading active passes...</p>';
    pastGrid.innerHTML = '<p class="text-sm text-slate-400">Loading history...</p>';
    try {
        const tickets = await api.fetchMyRegistrations(token);
        if (localStorage.getItem('token') !== token) return;
        const states = tickets.map((ticket) => ({ ticket, state: getTicketState(ticket, ticket.event_date) }));
        renderTicketCards(activeGrid, states.filter((item) => item.state === 'valid').map((item) => item.ticket), false);
        renderTicketCards(pastGrid, states.filter((item) => item.state !== 'valid').map((item) => item.ticket), true);
    } catch (error) {
        if (localStorage.getItem('token') !== token) return;
        activeGrid.textContent = `Unable to load tickets: ${error.message}`;
        pastGrid.replaceChildren();
    }
}

function renderTicketCards(grid, tickets, history) {
    if (!tickets.length) {
        grid.innerHTML = `<p class="col-span-full text-sm text-slate-400">${history ? 'No ticket history yet.' : 'No active passes found.'}</p>`;
        return;
    }
    const nodes = tickets.map((ticket) => {
        const state = getTicketState(ticket, ticket.event_date);
        const card = document.createElement('article');
        card.className = `rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${history ? 'opacity-80' : ''}`;
        const title = document.createElement('h2');
        title.className = 'font-semibold text-slate-900';
        title.textContent = ticket.event_name;
        const date = document.createElement('p');
        date.className = 'mt-1 text-sm text-slate-500';
        date.textContent = new Date(`${ticket.event_date}T00:00:00`).toLocaleDateString();
        const badge = document.createElement('span');
        badge.className = `mt-3 inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${state === 'valid' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : state === 'used' ? 'border-slate-200 bg-slate-100 text-slate-600' : 'border-rose-200 bg-rose-50 text-rose-700'}`;
        badge.textContent = state[0].toUpperCase() + state.slice(1);
        const view = document.createElement('button');
        view.type = 'button';
        view.className = 'mt-4 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50';
        view.textContent = 'View Pass';
        view.addEventListener('click', () => viewTicketPass(ticket));
        card.append(title, date, badge, view);
        return card;
    });
    grid.replaceChildren(...nodes);
}

async function viewTicketPass(ticket) {
    await switchTab('register');
    const select = document.getElementById('reg-event-select');
    if (!Array.from(select.options).some((option) => option.value === ticket.event_id)) {
        const option = new Option(ticket.event_name, ticket.event_id);
        option.dataset.eventDate = ticket.event_date;
        option.dataset.eventVenue = ticket.event_venue || 'Campus venue';
        select.add(option);
    }
    select.value = ticket.event_id;
    await restoreSelectedEventTicket();
}

function displayTicket(ticket) {
    const result = document.getElementById('ticket-result');
    if (!document.getElementById('ticket-state-badge')) {
        result.replaceChildren(document.getElementById('ticket-result-template').content.cloneNode(true));
    }
    const select = document.getElementById('reg-event-select');
    const option = select.selectedOptions[0];
    const state = getTicketState(ticket, option?.dataset.eventDate);
    const used = state === 'used' || state === 'expired';
    currentTicket = ticket;
    generatedTicketId = ticket.id;
    document.getElementById('ticket-event-name').textContent = option?.textContent || 'Campus Event';
    document.getElementById('ticket-event-venue').textContent = option?.dataset.eventVenue || 'Campus venue';
    const badge = document.getElementById('ticket-state-badge');
    badge.textContent = state === 'used' ? '● Used at Gate' : state === 'expired' ? '● Expired' : '● Valid Ticket';
    badge.className = state === 'valid'
        ? 'ticket-state-badge border-emerald-200 bg-emerald-50 text-emerald-700'
        : state === 'used'
            ? 'ticket-state-badge border-slate-200 bg-slate-100 text-slate-600'
            : 'ticket-state-badge border-rose-200 bg-rose-50 text-rose-700';
    const qr = document.getElementById('qr-image');
    qr.src = api.getQrCodeUrl(ticket.id);
    qr.classList.toggle('is-used', used);
    const stamp = document.getElementById('ticket-used-overlay');
    stamp.textContent = state === 'expired' ? 'EXPIRED' : 'CHECKED IN';
    stamp.classList.toggle('hidden', !used);
    stamp.classList.toggle('is-expired', state === 'expired');
    document.getElementById('btn-automate-verify').classList.toggle('hidden', used);
    result.classList.remove('hidden');
    setTicketClaimedButton(state === 'valid' ? 'claimed' : state);
}

async function restoreSelectedEventTicket() {
    const eventId = document.getElementById('reg-event-select').value;
    const token = localStorage.getItem('token');
    const result = document.getElementById('ticket-result');
    currentTicket = null;
    generatedTicketId = null;
    result.classList.add('hidden');
    setTicketClaimedButton('unclaimed');
    if (!eventId || !token) return;
    try {
        const ticket = await api.fetchMyTicket(eventId, token);
        if (token !== localStorage.getItem('token') || eventId !== document.getElementById('reg-event-select').value) return;
        displayTicket(ticket);
        const state = getTicketState(ticket, document.getElementById('reg-event-select').selectedOptions[0]?.dataset.eventDate);
        showToast(state === 'used' ? 'This ticket has already been used and checked in at the gate.' : 'Ticket Previously Claimed. Your digital pass is ready.', 'info');
    } catch (error) {
        if (token !== localStorage.getItem('token') || eventId !== document.getElementById('reg-event-select').value) return;
        if (error.status !== 404 && error.status !== 401) showToast(error.message, 'error');
    }
}

async function submitTicketRegistration(event) {
    event.preventDefault();
    const eventId = document.getElementById('reg-event-select').value;
    const token = localStorage.getItem('token');
    if (!eventId) return showToast('Please select an event from the list.', 'error');
    if (!token) {
        toggleAuthMode('login');
        openAuthModal();
        return showToast('Please log in to claim a ticket.', 'info');
    }
    try {
        let ticket = null;
        try {
            ticket = await api.fetchMyTicket(eventId, token);
        } catch (error) {
            if (error.status !== 404) throw error;
        }
        if (ticket) {
            displayTicket(ticket);
            return showToast(getTicketState(ticket, document.getElementById('reg-event-select').selectedOptions[0]?.dataset.eventDate) === 'used'
                ? 'This ticket has already been used and checked in at the gate.'
                : 'Ticket Previously Claimed. Your digital pass is ready.', 'info');
        }
        ticket = await api.registerAuthenticated(eventId, token);
        displayTicket(ticket);
        showToast('Ticket successfully generated.', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function automateGateCheckInVerification() {
    if (!generatedTicketId) return;
    try {
        await api.verifyTicket(generatedTicketId);
        showToast('Check-in successful', 'success');
        const ticket = currentTicket ? { ...currentTicket, is_verified: true } : { id: generatedTicketId, is_verified: true };
        displayTicket(ticket);
        switchTab('scanner');
        const scannerResult = document.getElementById('scanner-result');
        scannerResult.className = 'rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-800';
        scannerResult.textContent = 'SUCCESS: Checked In';
        scannerResult.classList.remove('hidden');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function processTicketVerification(ticketId) {
    try {
        const result = await api.verifyTicket(ticketId);
        const scannerResult = document.getElementById('scanner-result');
        scannerResult.className = 'rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-800';
        scannerResult.textContent = 'SUCCESS: Checked In';
        scannerResult.classList.remove('hidden');
        showToast('Check-in successful', 'success');
        return result;
    } catch (error) {
        const scannerResult = document.getElementById('scanner-result');
        scannerResult.className = 'rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-sm font-semibold text-rose-800';
        scannerResult.textContent = `DENIED: ${error.message}`;
        scannerResult.classList.remove('hidden');
        showToast(error.message, 'error');
        return null;
    }
}

async function startCameraScanner() {
    if (typeof Html5Qrcode === 'undefined') return showToast('QR scanner library is unavailable.', 'error');
    if (!html5QrCode) html5QrCode = new Html5Qrcode('reader');
    try {
        await html5QrCode.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 220, height: 220 } },
            async (decodedText) => {
                await stopCameraScanner();
                await processTicketVerification(decodedText);
            },
            () => {}
        );
    } catch (error) {
        showToast(`Camera access error: ${error.message}`, 'error');
    }
}

async function stopCameraScanner() {
    if (html5QrCode?.isScanning) {
        try {
            await html5QrCode.stop();
        } catch (error) {
            showToast(`Unable to stop camera: ${error.message}`, 'error');
        }
    }
}

async function loadAdminDashboard() {
    if (getSessionUser()?.role !== 'admin') return switchTab('events');
    const metrics = document.getElementById('admin-metrics');
    const breakdown = document.getElementById('admin-event-breakdown');
    try {
        const stats = await api.fetchAdminStats();
        metrics.replaceChildren(...[
            ['Total Users', stats.total_users],
            ['Total Tickets', stats.total_tickets],
            ['Gate Check-Ins', `${stats.checkin_percentage}%`]
        ].map(([label, value]) => {
            const card = document.createElement('article');
            card.className = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm';
            card.innerHTML = `<p class="text-sm text-slate-500">${label}</p><p class="mt-2 text-3xl font-bold text-slate-900">${value}</p>`;
            return card;
        }));
        const rows = stats.registrations_per_event.map((entry) => {
            const row = document.createElement('div');
            row.className = 'flex justify-between gap-4 py-4';
            const title = document.createElement('span');
            title.className = 'font-semibold text-slate-900';
            title.textContent = entry.event_name;
            const count = document.createElement('span');
            count.className = 'text-sm text-slate-600';
            count.textContent = `${entry.registered_count} registered · ${entry.verified_count} checked in`;
            row.append(title, count);
            return row;
        });
        breakdown.replaceChildren(...rows);
    } catch (error) {
        metrics.textContent = `Unable to load dashboard: ${error.message}`;
    }
}

async function downloadAttendeeCsv() {
    try {
        const blob = await api.downloadAttendeeCsv();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'campus-connect-attendees.csv';
        link.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function saveSession(data) {
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify({
        id: data.user_id,
        name: data.name,
        email: data.email,
        role: data.role
    }));
    updateAuthUI();
    closeAuthModal();
    switchTab('events');
}

function initializeApp() {
    document.getElementById('auth-login-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            const data = await api.login(
                document.getElementById('login-email').value.trim(),
                document.getElementById('login-password').value
            );
            saveSession(data);
            showToast('Login successful.', 'success');
        } catch (error) {
            showToast(`Login failed: ${error.message}`, 'error');
        }
    });

    document.getElementById('auth-signup-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const userData = {
            name: document.getElementById('signup-name').value.trim(),
            email: document.getElementById('signup-email').value.trim(),
            year: Number(document.getElementById('signup-year').value),
            password: document.getElementById('signup-password').value
        };
        try {
            await api.signup(userData);
            saveSession(await api.login(userData.email, userData.password));
            showToast('Account created and logged in successfully.', 'success');
        } catch (error) {
            showToast(`Signup failed: ${error.message}`, 'error');
        }
    });

    document.getElementById('event-create-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const createEventForm = document.getElementById('event-create-form');
        const modal = document.getElementById('create-event-modal');
        const user = getSessionUser();
        const token = localStorage.getItem('token');
        if (!token || user?.role !== 'admin') return showToast('Admin access is required to create events.', 'error');
        const eventData = {
            name: document.getElementById('event-name').value.trim(),
            description: document.getElementById('event-description').value.trim() || null,
            date: document.getElementById('event-date').value,
            category: document.getElementById('event-category').value,
            venue: document.getElementById('event-venue').value.trim(),
            capacity: Number(document.getElementById('event-capacity').value)
        };
        try {
            await api.createEvent(eventData, token);
            if (modal) modal.classList.add('hidden');
            if (createEventForm) createEventForm.reset();
            showToast('Event created successfully!', 'success');
            await loadEvents();
        } catch (error) {
            showToast(error.message || 'Failed to create event', 'error');
        }
    });

    document.getElementById('registration-form').addEventListener('submit', submitTicketRegistration);
    document.getElementById('reg-event-select').addEventListener('change', restoreSelectedEventTicket);
    document.getElementById('scanner-form').addEventListener('submit', (event) => event.preventDefault());

    updateAuthUI();
    switchTab('events');
}

document.addEventListener('DOMContentLoaded', initializeApp);
