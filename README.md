# Campus Connect 🎓

Campus Connect is a full-stack, production-ready campus event registration and verification system built with **FastAPI**, **PostgreSQL**, and a modular frontend interface. The platform supports secure JWT authentication, relational database modeling, real-time date filtering, and dynamic in-memory QR code ticket generation with gate check-in capabilities.

---

## 🚀 Features

- **User Authentication & Security**: Password hashing using `bcrypt` and stateless session handling via **JSON Web Tokens (JWT)** (`python-jose`).
- **Relational Event Management**: Fully managed PostgreSQL database with automatic database-level filtering (`WHERE date >= CURRENT_DATE`) using **SQLAlchemy** ORM.
- **Dynamic In-Memory QR Generation**: Streams binary QR code images on the fly via HTTP `StreamingResponse` without saving temporary files to disk.
- **Admin Gate Check-In & Verification**: Prevents double-entry ticket reuse with atomic check-in validation states.
- **Modular Frontend Architecture**: Clean separation of UI, styling, and API integration layers utilizing HTML, **Tailwind CSS**, and modern JavaScript ES6 modules.

---

## 🛠️ Tech Stack

- **Backend Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Database**: PostgreSQL (Hosted via [Neon](https://neon.tech/))
- **ORM & Validation**: SQLAlchemy & Pydantic v2
- **Authentication**: JWT (`python-jose`) & `passlib` (`bcrypt==4.0.1`)
- **QR Code Generation**: `qrcode` & `io.BytesIO`
- **Frontend**: HTML5, Tailwind CSS (via CDN), JavaScript ES6 (`fetch` API)

---

## 📁 Project Structure

```text
campus-connect/
├── backend/
│   ├── auth.py          # JWT generation, verification, & password hashing
│   ├── database.py      # SQLAlchemy engine & session dependency
│   ├── main.py          # FastAPI application & API endpoints
│   ├── models.py        # Database relational models (User, Event, Registration)
│   ├── schemas.py       # Pydantic validation schemas
│   └── requirements.txt # Python dependencies
└── frontend/
    ├── css/
    │   └── styles.css   # Custom layout polishes & transition styles
    ├── js/
    │   ├── api.js       # Centralized API network request layer
    │   └── app.js       # DOM rendering, UI tab-switching, & event handlers
    └── index.html       # Primary application UI layout
```

---

## 🔌 API Endpoints Reference

### 🔐 Authentication & Users

- `POST /users/` — Register a new user profile.
- `POST /login` — Authenticate credentials and retrieve a JWT Access Token.

### 📅 Events

- `GET /events/` — Fetch all active and future events (automatically excludes past dates).
- `POST /events/` — Create a new campus event listing.

### 🎟️ Registrations & QR Verification

- `POST /registrations/` — Register a user for an event (unauthenticated fallback).
- `POST /registrations/authenticated/` — Register for an event using a JWT Bearer Token (auto-extracts user identity).
- `GET /registrations/{ticket_id}/qr` — Stream the generated QR ticket image directly to the browser.
- `POST /registrations/{ticket_id}/verify` — Admin endpoint to verify tickets at the gate and mark them as used.

---

## ⚙️ Getting Started

### Prerequisites

- Python 3.10+ installed
- PostgreSQL connection URI (e.g., Neon PostgreSQL)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/campus-connect.git
cd campus-connect
```

### 2. Set Up the Backend Environment

```bash
# Create and activate virtual environment
python -m venv .venv

# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1

# macOS/Linux
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

Ensure your `DATABASE_URL` environment variable or connection string inside `backend/database.py` points to your PostgreSQL instance.

### 3. Run the Backend Server

```bash
cd backend
uvicorn main:app --reload
```

The FastAPI backend server will start at `http://127.0.0.1:8000`. Interactive API documentation is available at `http://127.0.0.1:8000/docs`.

### 4. Launch the Frontend

Open `frontend/index.html` directly in your web browser or serve it using VS Code Live Server.

---
