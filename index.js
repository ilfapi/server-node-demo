const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Cho phép tất cả các nguồn truy cập (có thể thay đổi theo nhu cầu)
        methods: ["GET", "POST"],
    },
});

// Sử dụng middleware CORS cho Express
app.use(cors());
// Mảng lưu trữ thông tin người dùng đã đăng nhập
let loggedInUsers = [];
// Mảng lưu trữ các bộ đếm thời gian để kiểm tra lại
let disconnectTimers = {};

app.get("/", (req, res) => {
    res.send("Server is running");
});

// Lắng nghe sự kiện 'connection' từ client
io.on("connection", (socket) => {
    console.log("A user connected");

    // Lắng nghe sự kiện 'login'
    socket.on("login", (data) => {
        console.log("User trying to log in with data:", data);
        console.log("emit login - loggedInUsers:", loggedInUsers);
        const userExists = loggedInUsers.find((user) => user.username === data.username);

        if (userExists) {
            socket.emit("login_response", { success: false, message: "User already logged in" });
        } else {
            // Tạo mã session và lưu trữ cùng với thông tin người dùng
            const sessionToken = uuidv4();
            loggedInUsers.push({ username: data.username, password: data.password, socketId: socket.id, sessionToken });
            socket.emit("login_response", { success: true, message: "Login successful", sessionToken });
        }
    });

    // Lắng nghe sự kiện 'register_login'
    socket.on("register_login", (data) => {
        console.log("User trying to register_login with session token:", data.sessionToken);
        console.log("emit register_login - loggedInUsers:", loggedInUsers);
        const user = loggedInUsers.find((user) => user.sessionToken === data.sessionToken);
    
        if (user) {
            clearInterval(disconnectTimers[user.socketId]);
            delete disconnectTimers[user.socketId];
            user.socketId = socket.id;
            socket.emit("register_login_response", { success: true, message: "Re-login successful" });
        } else {
            socket.emit("register_login_response", { success: false, message: "Invalid session token" });
        }
    });

    // Lắng nghe sự kiện 'disconnect'
    socket.on("disconnect", () => {
        console.log("A user disconnected");
        console.log("disconnect - loggedInUsers:", loggedInUsers);
    
        const user = loggedInUsers.find((user) => user.socketId === socket.id);
        if (user) {
            // Đặt bộ đếm thời gian 10 giây trước khi xóa người dùng
            let countdown = 10; // 10 giây
            disconnectTimers[socket.id] = setInterval(() => {
                countdown--;
                if (countdown <= 0) {
                    clearInterval(disconnectTimers[socket.id]);
                    loggedInUsers = loggedInUsers.filter((u) => u.socketId !== socket.id);
                    delete disconnectTimers[socket.id];
                    console.log("User removed from loggedInUsers due to disconnect timeout");
                    console.log("remove - loggedInUsers:", loggedInUsers);
                } else {
                    console.log(`Countdown for removing user: ${countdown} seconds`);
                    console.log("stop count - loggedInUsers:", loggedInUsers);
                }
            }, 1000); // 1 giây
        }
    });
    
});

const PORT = process.env.PORT || 2024;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
