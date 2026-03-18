from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import jwt
import os
from datetime import datetime, timedelta
from passlib.context import CryptContext
from twilio.rest import Client

app = Flask(__name__)
CORS(app)

SECRET_KEY = "change-this-in-production"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_NUMBER = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")
TARGET_PHONE = "+919438057028"

def get_db():
    conn = sqlite3.connect("users.db")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT UNIQUE,
                password_hash TEXT NOT NULL,
                ai_name TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                user_email TEXT,
                key TEXT,
                value TEXT,
                PRIMARY KEY (user_email, key)
            )
        """)

init_db()

def create_token(email):
    payload = {
        "sub": email,
        "exp": datetime.utcnow() + timedelta(days=1)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

# ---------- Auth Routes ----------
@app.route("/auth/register", methods=["POST"])
def register():
    data = request.json
    name = data.get("name")
    email = data.get("email")
    phone = data.get("phone")
    password = data.get("password")
    ai_name = data.get("ai_name")
    if not all([name, email, phone, password, ai_name]):
        return jsonify({"error": "Missing fields"}), 400
    hash_pw = pwd_context.hash(password)
    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO users (name, email, phone, password_hash, ai_name) VALUES (?, ?, ?, ?, ?)",
                (name, email, phone, hash_pw, ai_name)
            )
            conn.commit()
        return jsonify({"message": "User created"})
    except sqlite3.IntegrityError:
        return jsonify({"error": "Email or phone already exists"}), 400

@app.route("/auth/login", methods=["POST"])
def login():
    data = request.json
    identifier = data.get("identifier")
    password = data.get("password")
    with get_db() as conn:
        user = conn.execute(
            "SELECT email, password_hash, ai_name FROM users WHERE email = ? OR phone = ?",
            (identifier, identifier)
        ).fetchone()
    if not user or not pwd_context.verify(password, user["password_hash"]):
        return jsonify({"error": "Invalid credentials"}), 401
    token = create_token(user["email"])
    return jsonify({"access_token": token, "ai_name": user["ai_name"], "email": user["email"]})

# ---------- Memory Routes ----------
@app.route("/memory/set", methods=["POST"])
def set_memory():
    data = request.json
    token = data.get("token")
    key = data.get("key")
    value = data.get("value")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        email = payload["sub"]
    except:
        return jsonify({"error": "Invalid token"}), 401
    with get_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO memories (user_email, key, value) VALUES (?, ?, ?)",
            (email, key, value)
        )
        conn.commit()
    return jsonify({"message": "Memory stored"})

@app.route("/memory/get", methods=["POST"])
def get_memory():
    data = request.json
    token = data.get("token")
    key = data.get("key")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        email = payload["sub"]
    except:
        return jsonify({"error": "Invalid token"}), 401
    with get_db() as conn:
        row = conn.execute(
            "SELECT value FROM memories WHERE user_email = ? AND key = ?",
            (email, key)
        ).fetchone()
    if row:
        return jsonify({"value": row["value"]})
    else:
        return jsonify({"value": None})

# ---------- Command Processing ----------
@app.route("/commands/process", methods=["POST"])
def process_command():
    data = request.json
    token = data.get("token")
    text = data.get("text", "").lower().strip()
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        email = payload["sub"]
    except:
        return jsonify({"error": "Unauthorized"}), 401

    if text.startswith("remember "):
        parts = text.replace("remember ", "").split(" is ", 1)
        if len(parts) == 2:
            key, value = parts
            with get_db() as conn:
                conn.execute(
                    "INSERT OR REPLACE INTO memories (user_email, key, value) VALUES (?, ?, ?)",
                    (email, key.strip(), value.strip())
                )
                conn.commit()
            return jsonify({"response": f"OK, I'll remember that {key.strip()} is {value.strip()}"})

    if text.startswith("what is my ") or text.startswith("what's my "):
        key = text.replace("what is my ", "").replace("what's my ", "").strip()
        with get_db() as conn:
            row = conn.execute(
                "SELECT value FROM memories WHERE user_email = ? AND key = ?",
                (email, key)
            ).fetchone()
        if row:
            return jsonify({"response": f"Your {key} is {row['value']}"})
        else:
            return jsonify({"response": f"I don't know your {key} yet."})

    offline_commands = {
        "open youtube": "Opening YouTube",
        "open calculator": "Opening Calculator",
        "increase volume": "Volume increased",
        "decrease volume": "Volume decreased",
        "shutdown system": "Shutting down (simulated)",
    }
    for phrase, response in offline_commands.items():
        if phrase in text:
            return jsonify({"response": response})

    return jsonify({"response": "I heard you, but I don't know how to do that yet."})

# ---------- Alert Endpoint ----------
@app.route("/security/upload_alert_video", methods=["POST"])
def upload_alert_video():
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    file = request.files['file']
    filename = f"alert_{datetime.now().strftime('%Y%m%d_%H%M%S')}.webm"
    os.makedirs("recordings", exist_ok=True)
    file.save(os.path.join("recordings", filename))
    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        message = f"⚠️ Security alert at {datetime.now()}\nRecording saved: {filename}"
        client.messages.create(
            body=message,
            from_=TWILIO_WHATSAPP_NUMBER,
            to=f"whatsapp:{TARGET_PHONE}"
        )
    return jsonify({"status": "alert sent", "filename": filename})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
