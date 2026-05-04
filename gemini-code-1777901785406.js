// server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ==========================================
// 1. FRONTEND: Pura HTML, CSS, aur JS yahan ek variable mein hai
// ==========================================
const frontendHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Safe E2E Chat (Single File)</title>
    <script src="/socket.io/socket.io.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>
    <style>
        body { font-family: 'Segoe UI', Tahoma, sans-serif; background-color: #121212; color: #fff; display: flex; justify-content: center; padding: 20px; }
        .container { width: 100%; max-width: 500px; background: #1e1e1e; padding: 20px; border-radius: 12px; box-shadow: 0 8px 16px rgba(0,0,0,0.5); }
        h2 { text-align: center; color: #00e676; margin-top: 0; }
        #chat-box { height: 350px; border: 1px solid #333; border-radius: 8px; overflow-y: auto; padding: 15px; margin-bottom: 15px; background: #2c2c2c; display: flex; flex-direction: column; gap: 10px; }
        .msg { padding: 10px 14px; border-radius: 8px; width: fit-content; max-width: 75%; word-wrap: break-word; line-height: 1.4; }
        .my-msg { background: #005c4b; align-self: flex-end; border-bottom-right-radius: 0; }
        .friend-msg { background: #333333; align-self: flex-start; border-bottom-left-radius: 0; }
        .system-msg { color: #aaa; font-size: 0.85em; align-self: center; text-align: center; width: 100%; }
        input { padding: 12px; width: calc(100% - 26px); border-radius: 6px; border: 1px solid #444; background: #333; color: white; margin-bottom: 10px; font-size: 16px; outline: none; }
        input:focus { border-color: #00e676; }
        button { padding: 12px; width: 100%; background: #00e676; color: #000; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 16px; }
        button:hover { background: #00c853; }
        .info-text { font-size: 13px; color: #888; text-align: center; margin-top: 10px; }
    </style>
</head>
<body>

<div class="container">
    <h2>🔒 Stealth Chat</h2>
    
    <div id="setup-area">
        <input type="password" id="secret-key" placeholder="Enter Secret Password (Shared)">
        <button onclick="setKey()">Start Secure Session</button>
        <p class="info-text">Both users must enter the exact same password.</p>
    </div>

    <div id="chat-area" style="display:none;">
        <div id="chat-box"></div>
        <input type="text" id="message" placeholder="Type a message..." onkeypress="if(event.key === 'Enter') sendMessage()">
        <button onclick="sendMessage()">Send Encrypted</button>
    </div>
</div>

<script>
    const socket = io();
    let secretKey = '';

    function setKey() {
        secretKey = document.getElementById('secret-key').value;
        if(secretKey.trim() === '') return alert("Password is required!");
        document.getElementById('setup-area').style.display = 'none';
        document.getElementById('chat-area').style.display = 'block';
        displayMessage("System", "Encryption active. Ready to chat securely.", 'system-msg');
    }

    function sendMessage() {
        const msgInput = document.getElementById('message');
        const msg = msgInput.value;
        if(msg.trim() === '') return;

        // AES Encryption
        const encryptedMessage = CryptoJS.AES.encrypt(msg, secretKey).toString();
        socket.emit('encrypted_message', encryptedMessage);
        
        displayMessage("You", msg, 'my-msg');
        msgInput.value = '';
    }

    socket.on('encrypted_message', (encryptedMsg) => {
        if(!secretKey) return; 
        try {
            // AES Decryption
            const decryptedBytes = CryptoJS.AES.decrypt(encryptedMsg, secretKey);
            const originalText = decryptedBytes.toString(CryptoJS.enc.Utf8);
            if(originalText) displayMessage("Friend", originalText, 'friend-msg');
            else displayMessage("System", "⚠️ Decryption failed. Wrong password?", 'system-msg');
        } catch(e) {
            displayMessage("System", "⚠️ Decryption error.", 'system-msg');
        }
    });

    function displayMessage(sender, msg, className) {
        const chatBox = document.getElementById('chat-box');
        let prefix = sender === "System" ? "" : "<b>" + sender + ":</b><br>";
        chatBox.innerHTML += "<div class='msg " + className + "'>" + prefix + msg + "</div>";
        chatBox.scrollTop = chatBox.scrollHeight;
    }
</script>
</body>
</html>
`;

// ==========================================
// 2. BACKEND: Routing aur Socket Logic
// ==========================================

// Jab browser '/' par aayega, toh upar wala pura HTML bhej diya jayega
app.get('/', (req, res) => {
    res.send(frontendHTML);
});

// Socket.io event handling
io.on('connection', (socket) => {
    console.log('Naya user connect hua:', socket.id);
    
    // Server sirf pass kar raha hai, padh nahi raha
    socket.on('encrypted_message', (msg) => {
        socket.broadcast.emit('encrypted_message', msg);
    });
});

// Server Start Karna
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("==========================================");
    console.log(`✅ Single-File Secure Chat chal raha hai!`);
    console.log(`👉 Browser mein open karein: http://localhost:${PORT}`);
    console.log("==========================================");
});