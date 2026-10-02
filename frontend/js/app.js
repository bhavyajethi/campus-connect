let html5QrCode = null;

// --- Auth Modal & State Management ---
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
    alert('Logged out successfully');
}

// --- Tab Switching Utility ---
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
    } else {
        loadEvents();
    }
}

// --- Load Events ---
async function loadEvents() {
    const grid = document.getElementById('events-grid');
    grid.innerHTML = `<p class="text-sm text-slate-400 col-span-full text-center py-10">Loading events...</p>`;
    
    try {
        const events = await api.fetchEvents();
        if (events.length === 0) {
            grid.innerHTML = `<p class="text-sm text-slate-400 col-span-full text-center py-10">No upcoming events found.</p>`;
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

function prefillRegister(eventId, eventName) {
    switchTab('register');
    const eventInput = document.getElementById('reg-event-id');
    eventInput.value = eventId;
    eventInput.classList.add('border-indigo-600', 'bg-indigo-50/50');
}

// --- Auth Form Submit Handlers ---
document.getElementById('auth-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();

    try {
        const data = await api.login(email, password);
        localStorage.setItem('token', data.access_token);
        updateAuthUI();
        closeAuthModal();
        alert('Login successful!');
    } catch (err) {
        alert(`Login failed: ${err.message}`);
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
        alert('Account created! Logging in...');
        const data = await api.login(email, password);
        localStorage.setItem('token', data.access_token);
        updateAuthUI();
        closeAuthModal();
    } catch (err) {
        alert(`Signup failed: ${err.message}`);
    }
});

// --- Handle Ticket Registration Submit ---
document.getElementById('registration-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const eventId = document.getElementById('reg-event-id').value.trim();
    const token = localStorage.getItem('token');
    const resultBox = document.getElementById('ticket-result');
    const qrImg = document.getElementById('qr-image');

    if (!token) {
        alert("Please login first to register for events!");
        openAuthModal();
        return;
    }

    try {
        const data = await api.registerAuthenticated(eventId, token);
        qrImg.src = api.getQrCodeUrl(data.id);
        resultBox.classList.remove('hidden');
    } catch (err) {
        alert(`Registration Error: ${err.message}`);
    }
});

// --- Live Camera Scanner Functions (`html5-qrcode`) ---
async function startCameraScanner() {
    const resultBox = document.getElementById('scanner-result');
    resultBox.classList.add('hidden');

    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }

    try {
        await html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 200, height: 200 } },
            async (decodedText) => {
                // On QR scan success
                stopCameraScanner();
                await processTicketVerification(decodedText);
            },
            () => {} // Silent catch on frame scan misses
        );
    } catch (err) {
        alert(`Camera access error: ${err.message}`);
    }
}

async function stopCameraScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        await html5QrCode.stop();
    }
}

// Common ticket verification logic
async function processTicketVerification(ticketId) {
    const resultBox = document.getElementById('scanner-result');
    try {
        const data = await api.verifyTicket(ticketId);
        resultBox.className = "p-4 rounded-xl text-sm font-medium bg-emerald-50 text-emerald-800 border border-emerald-200";
        resultBox.textContent = `Success! ${data.message} (User ID: ${data.user_id})`;
        resultBox.classList.remove('hidden');
    } catch (err) {
        resultBox.className = "p-4 rounded-xl text-sm font-medium bg-rose-50 text-rose-800 border border-rose-200";
        resultBox.textContent = `Denied: ${err.message}`;
        resultBox.classList.remove('hidden');
    }
}

// Manual Scanner Form Handler
document.getElementById('scanner-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ticketId = document.getElementById('scan-ticket-id').value.trim();
    await processTicketVerification(ticketId);
});

// Startup Initialization
updateAuthUI();
loadEvents();