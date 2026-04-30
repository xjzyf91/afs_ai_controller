const net = require("net");
const WebSocket = require("ws");
const http = require("http");

// 创建HTTP服务器
const server = http.createServer();
// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// 监听8081端口 (避免与C++服务器的8080冲突)
server.listen(8081, () => {
    console.log("WebSocket桥接服务器运行在端口 8081");
    console.log("前端请连接: ws://localhost:8081");
});

// 存储所有WebSocket客户端
const wsClients = new Set();

// TCP客户端连接到C++服务器
const tcpClient = new net.Socket();
let isTcpConnected = false;

// 连接到C++服务器
function connectToTcpServer() {
    console.log("尝试连接到C++服务器...");
    tcpClient.connect(8080, "localhost", () => {
        console.log("✅ 已连接到C++服务器 (端口 8080)");
        isTcpConnected = true;

        // 通知所有WebSocket客户端连接状态
        broadcastToClients(
            JSON.stringify({
                type: "connection_status",
                connected: true,
                message: "已连接到数据服务器",
            })
        );
    });
}

// 处理TCP连接错误
tcpClient.on("error", err => {
    console.log("❌ TCP连接错误:", err.message);
    isTcpConnected = false;

    // 通知WebSocket客户端连接断开
    broadcastToClients(
        JSON.stringify({
            type: "connection_status",
            connected: false,
            message: "TCP服务器连接失败",
        })
    );

    // 3秒后重试连接
    setTimeout(connectToTcpServer, 3000);
});

// 处理TCP连接关闭
tcpClient.on("close", () => {
    console.log("🔌 TCP连接已关闭");
    isTcpConnected = false;

    broadcastToClients(
        JSON.stringify({
            type: "connection_status",
            connected: false,
            message: "TCP服务器连接已断开",
        })
    );

    // 3秒后重试连接
    setTimeout(connectToTcpServer, 3000);
});

// 处理来自TCP服务器的数据
let buffer = "";
tcpClient.on("data", data => {
    buffer += data.toString();

    // 处理可能的多个JSON数据包
    let endIndex;
    while ((endIndex = buffer.indexOf("\n")) >= 0) {
        const jsonStr = buffer.slice(0, endIndex).trim();
        buffer = buffer.slice(endIndex + 1);

        if (jsonStr.length > 0) {
            try {
                const jsonData = JSON.parse(jsonStr);

                // 添加数据类型标识
                const message = JSON.stringify({
                    type: "model_data",
                    data: jsonData,
                });

                // 广播数据到所有WebSocket客户端
                broadcastToClients(message);

                // 可选：打印数据日志
                // console.log('转发数据:', jsonStr);
            } catch (e) {
                console.error("❌ JSON解析错误:", e.message);
                console.error("原始数据:", jsonStr);
            }
        }
    }
});

// 广播消息到所有WebSocket客户端
function broadcastToClients(message) {
    wsClients.forEach(function (client) {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(message);
            } catch (error) {
                console.error("发送消息到客户端失败:", error);
                wsClients.delete(client);
            }
        }
    });
}

// 处理WebSocket连接
wss.on("connection", function connection(ws) {
    console.log("🌐 WebSocket客户端已连接");
    wsClients.add(ws);

    // 发送当前连接状态
    ws.send(
        JSON.stringify({
            type: "connection_status",
            connected: isTcpConnected,
            message: isTcpConnected
                ? "已连接到数据服务器"
                : "正在连接数据服务器...",
        })
    );

    ws.on("message", function incoming(message) {
        console.log("📨 收到WebSocket客户端消息:", message.toString());
    });

    ws.on("close", function () {
        console.log("🔌 WebSocket客户端已断开");
        wsClients.delete(ws);
    });

    ws.on("error", function (error) {
        console.error("WebSocket客户端错误:", error);
        wsClients.delete(ws);
    });
});

// 处理服务器错误
wss.on("error", function (error) {
    console.error("WebSocket服务器错误:", error);
});

// 优雅关闭
process.on("SIGINT", function () {
    console.log("\n�� 正在关闭WebSocket桥接服务器...");

    // 关闭TCP连接
    if (tcpClient) {
        tcpClient.destroy();
    }

    // 关闭所有WebSocket连接
    wsClients.forEach(client => {
        client.close();
    });

    // 关闭HTTP服务器
    server.close(() => {
        console.log("✅ WebSocket桥接服务器已关闭");
        process.exit(0);
    });
});

// 启动时连接到TCP服务器
console.log("🚀 启动WebSocket桥接服务器...");
connectToTcpServer();
