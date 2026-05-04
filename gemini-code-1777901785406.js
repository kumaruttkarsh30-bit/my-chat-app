// server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ==========================================
// 1. FRONTEND: Premium Smooth UI + Military E2E
// ==========================================
const frontendHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Private Chat</title>
    <script src="/socket.io/socket.io.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-main: #0f172a;
            --bg-card: #1e293b;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --primary: #3b82f6;
            --primary-hover: #2563eb;
            --bubble-me: #3b82f6;
            --bubble-friend: #334155;
            --danger: #ef4444;
            --success: #22c55e;
        }
        * { box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif; background-color: var(--bg-main); color: var(--text-main);
            display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; padding: 20px;
        }
        .app-container {
            width: 100%; max-width: 400px; background: var(--bg-card); border-radius: 24px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.4); overflow: hidden; display: flex; flex-direction: column;
            height: 85vh; max-height: 750px; border: 1px solid rgba(255,255,255,0.05);
        }
        .header {
            padding: 20px; text-align: center; background: rgba(30, 41, 59, 0.95);
            border-bottom: 1px solid rgba(255,255,255,0.05); z-index: 10;
        }
        .header h2 { margin: 0; font-size: 1.25rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 10px; }
        .status-dot { width: 10px; height: 10px; background: var(--danger); border-radius: 50%; display: inline-block; box-shadow: 0 0 10px var(--danger); transition: 0.3s; }
        .status-dot.safe { background: var(--success); box-shadow: 0 0 10px var(--success); }
        .header p { margin: 5px 0 0; font-size: 0.8rem; color: var(--text-muted); }

        /* Login / Setup Area */
        #setup-area {
            padding: 40px 30px; display: flex; flex-direction: column; gap: 20px; flex: 1; justify-content: center;
            animation: fadeIn 0.5s ease;
        }
        .input-group label { font-size: 0.9rem; color: var(--text-muted); display: block; margin-bottom: 8px; }
        input {
            width: 100%; padding: 16px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);
            background: rgba(15, 23, 42, 0.5); color: white; font-size: 1rem; outline: none; transition: 0.3s; font-family: 'Inter', sans-serif;
        }
        input:focus { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15); background: rgba(15, 23, 42, 0.8); }
        button {
            width: 100%; padding: 16px; border-radius: 16px; border: none; background: var(--primary); color: white;
            font-size: 1rem; font-weight: 600; cursor: pointer; transition: 0.2s; font-family: 'Inter', sans-serif;
        }
        button:hover { background: var(--primary-hover); transform: translateY(-1px); }
        button:active { transform: translateY(1px); }

        /* Chat Area */
        #chat-area { display: none; flex-direction: column; flex: 1; overflow: hidden; animation: fadeIn 0.4s ease; }
        #chat-box {
            flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px;
            scroll-behavior: smooth;
        }
        #chat-box::-webkit-scrollbar { width: 5px; }
        #chat-box::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        
        .msg { padding: 12px 18px; border-radius: 20px; max-width: 80%; word-wrap: break-word; font-size: 0.95rem; line-height: 1.4; animation: slideUp 0.3s ease; }
        .my-msg { background: var(--bubble-me); align-self: flex-end; border-bottom-right-radius: 4px; }
        .friend-msg { background: var(--bubble-friend); align-self: flex-start; border-bottom-left-radius: 4px; }
        .system-msg { background: transparent; color: var(--text-muted); font-size: 0.8rem; align-self: center; text-align: center; margin: 10px 0; }

        .input-area { padding: 15px; background: var(--bg-card); border-top: 1px solid rgba(255,255,255,0.05); display: flex; gap: 10px; }
        .input-area input { border-radius: 24px; padding: 14px 20px; margin: 0; }
        .input-area button { width: auto; padding: 0 24px; border-radius: 24px; display: flex; align-items: center; justify-content: center; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>

<div class="app-container">
    <div class="header">
        <h2><span id="status-dot" class="status-dot"></span> Private Room</h2>
        <p id="status-text">Waiting for key...</p>
    </div>

    <!-- Step 1: Login Screen -->
    <div id="setup-area">
        <div style="text-align: center; margin-bottom: 10px;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
        </div>
        <div class="input-group">
            <label>Secret Room Password</label>
            <input type="password" id="secret-key" placeholder="Enter password to join..." onkeypress="if(event.key === 'Enter') setupSecurity()">
        </div>
        <button onclick="setupSecurity()">Enter Chat</button>
    </div>

    <!-- Step 2: Chat Screen -->
    <div id="chat-area">
        <div id="chat-box"></div>
        <div class="input-area">
            <input type="text" id="message" placeholder="Message..." autocomplete="off" onkeypress="if(event.key === 'Enter') sendMessage()">
            <button onclick="sendMessage()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
        </div>
    </div>
</div>

<script>
    const socket = io();
    let cryptoKey = null;

    // --- Web Crypto API Functions ---
    async function deriveKey(password) {
        const enc = new TextEncoder();
        const salt = enc.encode("Smooth-Secure-Salt-2026"); 
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw", enc.encode(password), {name: "PBKDF2"}, false, ["deriveKey"]
        );
        return window.crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
            keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
        );
    }

    async function encryptMessage(text, key) {
        const enc = new TextEncoder();
        const iv = window.crypto.getRandomValues(new Uint8Array(12)); 
        const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(text));
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0); combined.set(new Uint8Array(encrypted), iv.length);
        return btoa(String.fromCharCode(...combined));
    }

    async function decryptMessage(base64Str, key) {
        const combined = new Uint8Array(atob(base64Str).split('').map(c => c.charCodeAt(0)));
        const iv = combined.slice(0, 12); 
        const data = combined.slice(12);
        const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data);
        return new TextDecoder().decode(decrypted);
    }

    // --- UI Logic ---
    async function setupSecurity() {
        const password = document.getElementById('secret-key').value;
        if(password.trim() === '') return;
        
        try {
            cryptoKey = await deriveKey(password);
            
            // UI Switch Smoothly
            document.getElementById('setup-area').style.display = 'none';
            document.getElementById('chat-area').style.display = 'flex';
            
            // Update Header Status
            document.getElementById('status-dot').classList.add('safe');
            document.getElementById('status-text').innerText = 'End-to-End Encrypted';
            
            displayMessage("System", "Chat secured. Only users with the same password can read messages.", 'system-msg');
            setTimeout(() => document.getElementById('message').focus(), 100);
        } catch(e) {
            alert("Security Error! Make sure you are using localhost or https://");
        }
    }

    async function sendMessage() {
        const msgInput = document.getElementById('message');
        const msg = msgInput.value;
        if(msg.trim() === '' || !cryptoKey) return;

        try {
            const encryptedCiphertext = await encryptMessage(msg, cryptoKey);
            socket.emit('secure_payload', encryptedCiphertext);
            displayMessage("You", msg, 'my-msg');
            msgInput.value = '';
        } catch(e) { console.error("Encryption failed", e); }
    }

    socket.on('secure_payload', async (encryptedCiphertext) => {
        if(!cryptoKey) return; 
        try {
            const originalText = await decryptMessage(encryptedCiphertext, cryptoKey);
            displayMessage("Friend", originalText, 'friend-msg');
        } catch(e) {
            displayMessage("System", "⚠️ Someone sent a message with a wrong password.", 'system-msg');
        }
    });

    function displayMessage(sender, msg, className) {
        const chatBox = document.getElementById('chat-box');
        let content = sender === "System" ? msg : msg;
        chatBox.innerHTML += "<div class='msg " + className + "'>" + content + "</div>";
        chatBox.scrollTop = chatBox.scrollHeight;
    }
</script>
</body>
</html>
`;

// ==========================================
// 2. BACKEND
// ==========================================
app.get('/', (req, res) => {
    res.send(frontendHTML);
});

io.on('connection', (socket) => {
    console.log('User connected');
    socket.on('secure_payload', (payload) => {
        socket.broadcast.emit('secure_payload', payload);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("✅ Premium Smooth E2E Chat Running!");
    console.log(`👉 Open: http://localhost:${PORT}`);
});
