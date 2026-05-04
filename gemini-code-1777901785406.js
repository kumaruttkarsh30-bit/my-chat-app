// server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

// 50MB tak ki Photos/Videos ke liye size bada diya hai
const io = new Server(server, { maxHttpBufferSize: 5e7 }); 

// ==========================================
// DATABASE LOGIC (Permanent Storage)
// ==========================================
const dbFile = path.join(__dirname, 'secure_db.json');

// File se purani chat history load karna (agar hai toh)
let messageHistory = [];
if (fs.existsSync(dbFile)) {
    try {
        const data = fs.readFileSync(dbFile, 'utf8');
        messageHistory = JSON.parse(data);
    } catch (e) {
        console.log("Database read error, starting fresh.");
        messageHistory = [];
    }
}

// Jab naya message aaye toh file me permanently save karna
function saveDatabase() {
    fs.writeFileSync(dbFile, JSON.stringify(messageHistory));
}

// ==========================================
// 1. FRONTEND: UI + Permanent Storage Logic
// ==========================================
const frontendHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Permanent Secret Room</title>
    <script src="/socket.io/socket.io.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
    <style>
        :root { --bg-dark: #050505; --room-dark: #0a0a0a; --text-main: #e0e0e0; }
        * { box-sizing: border-box; }
        body {
            font-family: 'Space Mono', monospace; background-color: var(--bg-dark); color: var(--text-main);
            display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; padding: 10px; overflow: hidden;
        }

        /* RGB Glowing Secret Room Effect */
        @keyframes rgbGlow {
            0% { box-shadow: 0 0 15px rgba(255, 0, 0, 0.2), inset 0 0 20px rgba(255, 0, 0, 0.05); border-color: rgba(255,0,0,0.3); }
            33% { box-shadow: 0 0 15px rgba(0, 255, 0, 0.2), inset 0 0 20px rgba(0, 255, 0, 0.05); border-color: rgba(0,255,0,0.3); }
            66% { box-shadow: 0 0 15px rgba(0, 150, 255, 0.2), inset 0 0 20px rgba(0, 150, 255, 0.05); border-color: rgba(0,150,255,0.3); }
            100% { box-shadow: 0 0 15px rgba(255, 0, 255, 0.2), inset 0 0 20px rgba(255, 0, 255, 0.05); border-color: rgba(255,0,255,0.3); }
        }

        .app-container {
            width: 100%; max-width: 450px; background: var(--room-dark); border-radius: 12px;
            display: flex; flex-direction: column; height: 90vh; max-height: 800px;
            border: 1px solid #333; animation: rgbGlow 6s infinite alternate; transition: filter 0.3s;
        }

        .blur-mode { filter: blur(15px) grayscale(100%); pointer-events: none; }

        .header {
            padding: 15px; text-align: center; border-bottom: 1px solid #222; background: #000;
            display: flex; justify-content: space-between; align-items: center;
        }
        .badge-container { display: flex; flex-direction: column; align-items: flex-start; }
        .badge {
            font-size: 0.60rem; color: #00ff00; border: 1px solid #00ff00; padding: 2px 6px;
            border-radius: 4px; display: inline-block; text-transform: uppercase; letter-spacing: 1px;
        }
        .header h2 { margin: 5px 0 0 0; font-size: 1.1rem; color: #fff; font-weight: normal; }
        
        .delete-btn {
            background: #2a0000; color: #ff4444; border: 1px solid #ff0000; padding: 6px 10px;
            border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-family: 'Space Mono', monospace; display: none;
        }
        .delete-btn:hover { background: #ff0000; color: #fff; }

        #setup-area { padding: 40px 20px; text-align: center; display: flex; flex-direction: column; gap: 20px; flex: 1; justify-content: center; }
        input[type="password"], input[type="text"] {
            width: 100%; padding: 15px; border-radius: 8px; border: 1px solid #333;
            background: #000; color: #00ff00; font-family: 'Space Mono', monospace; outline: none;
        }
        input:focus { border-color: #555; }
        button.action-btn {
            padding: 15px; border-radius: 8px; border: 1px solid #444; background: #111; color: #fff;
            cursor: pointer; font-family: 'Space Mono', monospace; transition: 0.3s;
        }
        button.action-btn:hover { background: #333; }

        #chat-area { display: none; flex-direction: column; flex: 1; overflow: hidden; }
        #chat-box { flex: 1; padding: 15px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; }
        
        .msg { padding: 10px 15px; border-radius: 8px; max-width: 85%; font-size: 0.9rem; word-wrap: break-word; }
        .my-msg { background: #1a1a1a; align-self: flex-end; border: 1px solid #333; border-right: 3px solid #00ff00; }
        .friend-msg { background: #0f0f0f; align-self: flex-start; border: 1px solid #333; border-left: 3px solid #0015ff; }
        .system-msg { color: #666; font-size: 0.75rem; align-self: center; text-align: center; background: #111; padding: 4px 10px; border-radius: 10px;}

        .msg img, .msg video { max-width: 100%; border-radius: 4px; margin-top: 5px; border: 1px solid #333; }

        .input-area { padding: 10px; background: #000; border-top: 1px solid #222; display: flex; gap: 8px; align-items: center; }
        .input-area input[type="text"] { flex: 1; margin: 0; padding: 12px; }
        
        .file-upload-btn { background: transparent; border: none; font-size: 1.5rem; cursor: pointer; padding: 0 5px; color: #888; }
        .file-upload-btn:hover { color: #fff; }
        #file-input { display: none; }
    </style>
</head>
<body>

<div class="app-container" id="app">
    <div class="header">
        <div class="badge-container">
            <div class="badge">🔒 E2E Encrypted</div>
            <h2>Secret Room</h2>
        </div>
        <button id="clear-btn" class="delete-btn" onclick="wipeRoom()">🗑️ Clear</button>
    </div>

    <!-- Login -->
    <div id="setup-area">
        <p style="color: #666; font-size: 0.8rem;">Permanent Storage Active.<br>Enter key to unlock historical comms.</p>
        <input type="password" id="secret-key" placeholder="Enter Secret Room Key...">
        <button class="action-btn" onclick="setupSecurity()">Decrypt Room</button>
    </div>

    <!-- Chat -->
    <div id="chat-area">
        <div id="chat-box"></div>
        <div class="input-area">
            <input type="file" id="file-input" accept="image/*,video/*" onchange="handleFileUpload(event)">
            <button class="file-upload-btn" onclick="document.getElementById('file-input').click()">📎</button>
            <input type="text" id="message" placeholder="Type secret message..." autocomplete="off" onkeypress="if(event.key === 'Enter') sendMessage()">
            <button class="action-btn" style="padding: 12px 15px;" onclick="sendMessage()">Send</button>
        </div>
    </div>
</div>

<script>
    const socket = io();
    let cryptoKey = null;

    // --- Anti-Screenshot ---
    window.addEventListener('blur', () => { if(cryptoKey) document.getElementById('app').classList.add('blur-mode'); });
    window.addEventListener('focus', () => { document.getElementById('app').classList.remove('blur-mode'); });

    // --- Military Crypto ---
    async function deriveKey(password) {
        const enc = new TextEncoder();
        const salt = enc.encode("Permanent-Secret-Room-X"); 
        const keyMaterial = await window.crypto.subtle.importKey("raw", enc.encode(password), {name: "PBKDF2"}, false, ["deriveKey"]);
        return window.crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    }

    async function encryptData(text) {
        const enc = new TextEncoder();
        const iv = window.crypto.getRandomValues(new Uint8Array(12)); 
        const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, cryptoKey, enc.encode(text));
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0); combined.set(new Uint8Array(encrypted), iv.length);
        return btoa(String.fromCharCode(...combined));
    }

    async function decryptData(base64Str) {
        const combined = new Uint8Array(atob(base64Str).split('').map(c => c.charCodeAt(0)));
        const iv = combined.slice(0, 12); 
        const data = combined.slice(12);
        const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, cryptoKey, data);
        return new TextDecoder().decode(decrypted);
    }

    // --- UI Logic ---
    async function setupSecurity() {
        const password = document.getElementById('secret-key').value;
        if(password.trim() === '') return;
        
        try {
            cryptoKey = await deriveKey(password);
            document.getElementById('setup-area').style.display = 'none';
            document.getElementById('chat-area').style.display = 'flex';
            document.getElementById('clear-btn').style.display = 'block';
            
            socket.emit('request_history');
        } catch(e) { alert("Security Error!"); }
    }

    // Send Message
    async function sendMessage() {
        const msgInput = document.getElementById('message');
        const msg = msgInput.value;
        if(msg.trim() === '' || !cryptoKey) return;

        try {
            const encrypted = await encryptData(msg);
            socket.emit('secure_payload', encrypted);
            displayMessage("You", msg, 'my-msg');
            msgInput.value = '';
        } catch(e) {}
    }

    // File Upload
    function handleFileUpload(event) {
        const file = event.target.files[0];
        if(!file) return;
        if(file.size > 50000000) return alert("File max size is 50MB.");

        displayMessage("System", "Encrypting media to permanent storage...", 'system-msg');
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const encrypted = await encryptData(e.target.result);
                socket.emit('secure_payload', encrypted);
                displayMessage("You", e.target.result, 'my-msg');
            } catch(error) { alert("Encryption failed!"); }
        };
        reader.readAsDataURL(file);
    }

    // Wipe Room (Permanent Delete)
    function wipeRoom() {
        if(confirm("DANGER: This will permanently delete the entire chat history for both of you. Are you sure?")) {
            socket.emit('clear_database');
        }
    }

    // Listeners
    socket.on('secure_payload', async (encryptedPayload) => {
        if(!cryptoKey) return; 
        try {
            const decryptedMsg = await decryptData(encryptedPayload);
            displayMessage("Ghost", decryptedMsg, 'friend-msg');
        } catch(e) { }
    });

    socket.on('chat_history', async (historyArray) => {
        if(!cryptoKey) return;
        document.getElementById('chat-box').innerHTML = ''; 
        let count = 0;
        for(let encryptedPayload of historyArray) {
            try {
                const decryptedMsg = await decryptData(encryptedPayload);
                displayMessage("Ghost", decryptedMsg, 'friend-msg');
                count++;
            } catch(e) { }
        }
        displayMessage("System", count > 0 ? "Historical data loaded." : "Room is empty.", 'system-msg');
    });

    socket.on('room_wiped', () => {
        document.getElementById('chat-box').innerHTML = '';
        displayMessage("System", "🚨 Room history has been permanently wiped.", 'system-msg');
    });

    // Display
    function displayMessage(sender, msg, className) {
        const chatBox = document.getElementById('chat-box');
        let content = '';
        if(msg.startsWith('data:image')) content = \`<img src="\${msg}">\`;
        else if(msg.startsWith('data:video')) content = \`<video src="\${msg}" controls></video>\`;
        else content = msg.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        chatBox.innerHTML += "<div class='msg " + className + "'>" + content + "</div>";
        chatBox.scrollTop = chatBox.scrollHeight;
    }
</script>
</body>
</html>
`;

// ==========================================
// 2. BACKEND & OFFLINE SYNC
// ==========================================
app.get('/', (req, res) => { res.send(frontendHTML); });

io.on('connection', (socket) => {
    
    // User login karta hai toh use puri permanent history bhej do
    socket.on('request_history', () => {
        socket.emit('chat_history', messageHistory);
    });

    // Naya message aane par
    socket.on('secure_payload', (payload) => {
        messageHistory.push(payload);
        
        // Storage bachane ke liye max 1000 messages permanent rakh rahe hain
        if(messageHistory.length > 1000) messageHistory.shift(); 
        
        // Data turant hard drive (file) me save kar do
        saveDatabase();
        
        // Dusre active users ko forward karo
        socket.broadcast.emit('secure_payload', payload);
    });

    // Jab koi 'Clear' button dabaye
    socket.on('clear_database', () => {
        messageHistory = []; // Array clear
        saveDatabase();      // File clear
        io.emit('room_wiped'); // Sabki screen se gayab
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("===================================");
    console.log("✅ Permanent E2E Secret Room Live!");
    console.log(`👉 Database: ${dbFile}`);
    console.log(`👉 URL: http://localhost:${PORT}`);
    console.log("===================================");
});
