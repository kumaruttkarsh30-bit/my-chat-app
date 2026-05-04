// server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// maxHttpBufferSize badha diya hai taaki 50MB tak ki Photos/Videos ja sakein
const io = new Server(server, { maxHttpBufferSize: 5e7 }); 

// Server encrypted messages ko store karega (Offline messaging ke liye)
// Note: Server ko sirf gibberish dikhega, password ke bina wo kuch nahi padh sakta.
let messageHistory = [];

// ==========================================
// 1. FRONTEND: Secret Room RGB UI + Media + Offline Sync
// ==========================================
const frontendHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secret E2EE Room</title>
    <script src="/socket.io/socket.io.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-dark: #050505;
            --room-dark: #0a0a0a;
            --text-main: #e0e0e0;
            --accent: #222;
        }
        * { box-sizing: border-box; }
        body {
            font-family: 'Space Mono', monospace; background-color: var(--bg-dark); color: var(--text-main);
            display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; padding: 10px;
            overflow: hidden;
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

        /* Anti-Snoop Blur */
        .blur-mode { filter: blur(15px) grayscale(100%); pointer-events: none; }

        .header {
            padding: 15px; text-align: center; border-bottom: 1px solid #222; background: #000;
        }
        .badge {
            font-size: 0.65rem; color: #00ff00; border: 1px solid #00ff00; padding: 2px 6px;
            border-radius: 4px; display: inline-block; margin-bottom: 5px; text-transform: uppercase;
            letter-spacing: 1px;
        }
        .header h2 { margin: 0; font-size: 1.1rem; color: #fff; font-weight: normal; }

        #setup-area { padding: 40px 20px; text-align: center; display: flex; flex-direction: column; gap: 20px; flex: 1; justify-content: center; }
        input[type="password"], input[type="text"] {
            width: 100%; padding: 15px; border-radius: 8px; border: 1px solid #333;
            background: #000; color: #00ff00; font-family: 'Space Mono', monospace; outline: none;
        }
        input:focus { border-color: #555; }
        button {
            padding: 15px; border-radius: 8px; border: 1px solid #444; background: #111; color: #fff;
            cursor: pointer; font-family: 'Space Mono', monospace; transition: 0.3s;
        }
        button:hover { background: #333; }

        #chat-area { display: none; flex-direction: column; flex: 1; overflow: hidden; }
        #chat-box { flex: 1; padding: 15px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; }
        
        .msg { padding: 10px 15px; border-radius: 8px; max-width: 85%; font-size: 0.9rem; word-wrap: break-word; }
        .my-msg { background: #1a1a1a; align-self: flex-end; border: 1px solid #333; border-right: 3px solid #00ff00; }
        .friend-msg { background: #0f0f0f; align-self: flex-start; border: 1px solid #333; border-left: 3px solid #0015ff; }
        .system-msg { color: #666; font-size: 0.75rem; align-self: center; text-align: center; }

        /* Media Styling */
        .msg img, .msg video { max-width: 100%; border-radius: 4px; margin-top: 5px; border: 1px solid #333; }

        .input-area { padding: 10px; background: #000; border-top: 1px solid #222; display: flex; gap: 8px; align-items: center; }
        .input-area input[type="text"] { flex: 1; margin: 0; padding: 12px; }
        
        .file-upload-btn { background: transparent; border: none; font-size: 1.5rem; cursor: pointer; padding: 0 5px; color: #888; }
        .file-upload-btn:hover { color: #fff; background: transparent;}
        #file-input { display: none; }
    </style>
</head>
<body>

<div class="app-container" id="app">
    <div class="header">
        <div class="badge">🔒 End-to-End Encrypted</div>
        <h2>Secret Room</h2>
    </div>

    <!-- Login -->
    <div id="setup-area">
        <p style="color: #666; font-size: 0.8rem;">Enter the exact access key to unlock historical & live comms.</p>
        <input type="password" id="secret-key" placeholder="Enter Access Key...">
        <button onclick="setupSecurity()">Decrypt Room</button>
    </div>

    <!-- Chat -->
    <div id="chat-area">
        <div id="chat-box"></div>
        <div class="input-area">
            <input type="file" id="file-input" accept="image/*,video/*" onchange="handleFileUpload(event)">
            <button class="file-upload-btn" onclick="document.getElementById('file-input').click()">📎</button>
            <input type="text" id="message" placeholder="Type..." autocomplete="off" onkeypress="if(event.key === 'Enter') sendMessage()">
            <button onclick="sendMessage()">Send</button>
        </div>
    </div>
</div>

<script>
    const socket = io();
    let cryptoKey = null;

    // --- Anti-Screenshot / Privacy feature ---
    // Jab user dusra app kholega, chat blur ho jayegi
    window.addEventListener('blur', () => {
        if(cryptoKey) document.getElementById('app').classList.add('blur-mode');
    });
    window.addEventListener('focus', () => {
        document.getElementById('app').classList.remove('blur-mode');
    });

    // --- Military Crypto ---
    async function deriveKey(password) {
        const enc = new TextEncoder();
        const salt = enc.encode("Secret-Room-X-2026"); 
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
            
            displayMessage("System", "Syncing historical data...", 'system-msg');
            
            // Server se purani history maang rahe hain
            socket.emit('request_history');
        } catch(e) {
            alert("Security Error!");
        }
    }

    // Send Text Message
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

    // Send Photo/Video
    function handleFileUpload(event) {
        const file = event.target.files[0];
        if(!file) return;

        // Size check (Max 50MB limit lagayi hai taaki browser crash na ho)
        if(file.size > 50000000) return alert("File size must be under 50MB for secure encryption.");

        displayMessage("System", "Encrypting and uploading media... please wait.", 'system-msg');

        const reader = new FileReader();
        reader.onload = async function(e) {
            const dataUrl = e.target.result; // data:image/png;base64,....
            try {
                const encrypted = await encryptData(dataUrl);
                socket.emit('secure_payload', encrypted);
                displayMessage("You", dataUrl, 'my-msg');
            } catch(error) {
                alert("Media encryption failed!");
            }
        };
        reader.readAsDataURL(file);
    }

    // Listeners
    socket.on('secure_payload', async (encryptedPayload) => {
        if(!cryptoKey) return; 
        try {
            const decryptedMsg = await decryptData(encryptedPayload);
            displayMessage("Ghost", decryptedMsg, 'friend-msg');
        } catch(e) { /* Ignore wrong passwords silently */ }
    });

    socket.on('chat_history', async (historyArray) => {
        if(!cryptoKey) return;
        document.getElementById('chat-box').innerHTML = ''; // clear loading msg
        let count = 0;
        
        for(let encryptedPayload of historyArray) {
            try {
                const decryptedMsg = await decryptData(encryptedPayload);
                displayMessage("Ghost", decryptedMsg, 'friend-msg');
                count++;
            } catch(e) { /* Unreadable by this password */ }
        }
        displayMessage("System", count + " messages decrypted from offline storage.", 'system-msg');
    });

    // Display Logic
    function displayMessage(sender, msg, className) {
        const chatBox = document.getElementById('chat-box');
        let content = '';

        // Check if message is Image or Video Base64
        if(msg.startsWith('data:image')) {
            content = \`<img src="\${msg}">\`;
        } else if(msg.startsWith('data:video')) {
            content = \`<video src="\${msg}" controls></video>\`;
        } else {
            // Normal Text (XSS bachane ke liye)
            content = msg.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }

        chatBox.innerHTML += "<div class='msg " + className + "'>" + content + "</div>";
        chatBox.scrollTop = chatBox.scrollHeight;
    }
</script>
</body>
</html>
`;

// ==========================================
// 2. BACKEND (Offline Sync Logic)
// ==========================================
app.get('/', (req, res) => {
    res.send(frontendHTML);
});

io.on('connection', (socket) => {
    
    // Jab naya user password daalkar online aata hai
    socket.on('request_history', () => {
        // Usko pura purana encrypted database bhej do
        socket.emit('chat_history', messageHistory);
    });

    socket.on('secure_payload', (payload) => {
        // Message server pe save ho gaya (Encrypted form me hi, safe hai)
        messageHistory.push(payload);
        
        // Memory bachane ke liye sirf last 100 messages hi store rakhenge
        if(messageHistory.length > 100) messageHistory.shift(); 
        
        // Dusre active users ko bhej do
        socket.broadcast.emit('secure_payload', payload);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("✅ Secret Room E2E Chat is LIVE!");
    console.log(`👉 Access URL: http://localhost:${PORT}`);
});
