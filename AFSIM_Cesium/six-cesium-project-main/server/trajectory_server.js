const WebSocket = require("ws");
const http = require("http");

// 创建HTTP服务器
const server = http.createServer();
// 创建WebSocket服务器，监听8080端口（与前端默认配置一致）
const wss = new WebSocket.Server({ server });

// 服务器配置
const PORT = 8080;
const UPDATE_INTERVAL = 50;

// 存储所有WebSocket客户端
const clients = new Set();

// 仿真状态
let isSimulationRunning = false;
let simulationTimer = null;

// 模型轨迹参数
const trajectoryParams = {
    model1: {
        // 模型1：圆形轨迹
        centerLon: 116.4, // 北京经度
        centerLat: 39.9, // 北京纬度
        radius: 0.5, // 轨迹半径（度）
        altitude: 500, // 高度（米）
        speed: 0.05, // 角速度（弧度/秒）
        currentAngle: 0, // 当前角度
        // 姿态参数
        yawSpeed: 0.2, // 偏航角速度（度/秒）
        pitchAmplitude: 10, // 俯仰角幅度（度）
        rollAmplitude: 5, // 滚转角幅度（度）
    },
    model2: {
        // 模型2：8字形轨迹
        centerLon: 116.4,
        centerLat: 40.0, // 纬度相差0.1度
        radiusX: 0.5, // 从0.03增加到0.15
        radiusY: 0.085, // 从0.015增加到0.075
        altitude: 600, // 高度稍高一些
        speed: 0.04, // 角速度
        currentAngle: 0,
        // 姿态参数
        yawSpeed: -0.3, // 反向旋转
        pitchAmplitude: 15,
        rollAmplitude: 8,
    },
};

// 生成模型1的位置（圆形轨迹）
function generateModel1Position(deltaTime) {
    const params = trajectoryParams.model1;

    // 更新角度
    params.currentAngle += params.speed * deltaTime;
    if (params.currentAngle > 2 * Math.PI) {
        params.currentAngle -= 2 * Math.PI;
    }

    // 计算位置
    const longitude =
        params.centerLon + params.radius * Math.cos(params.currentAngle);
    const latitude =
        params.centerLat + params.radius * Math.sin(params.currentAngle);
    const altitude = params.altitude + 50 * Math.sin(params.currentAngle * 2); // 高度变化

    // 计算姿态角
    const time = Date.now() / 1000;
    const yaw = (params.yawSpeed * time) % 360;
    const pitch = params.pitchAmplitude * Math.sin(time * 0.5);
    const roll = params.rollAmplitude * Math.cos(time * 0.3);

    return {
        longitude: longitude,
        latitude: latitude,
        altitude: altitude,
        yaw: yaw,
        pitch: pitch,
        roll: roll,
    };
}

// 生成模型2的位置（8字形轨迹）
function generateModel2Position(deltaTime) {
    const params = trajectoryParams.model2;

    // 更新角度
    params.currentAngle += params.speed * deltaTime;
    if (params.currentAngle > 2 * Math.PI) {
        params.currentAngle -= 2 * Math.PI;
    }

    // 8字形轨迹（利萨如曲线）
    const longitude =
        params.centerLon + params.radiusX * Math.sin(params.currentAngle);
    const latitude =
        params.centerLat + params.radiusY * Math.sin(2 * params.currentAngle);
    const altitude = params.altitude + 80 * Math.cos(params.currentAngle); // 高度变化

    // 计算姿态角
    const time = Date.now() / 1000;
    const yaw = (params.yawSpeed * time) % 360;
    const pitch = params.pitchAmplitude * Math.cos(time * 0.4);
    const roll = params.rollAmplitude * Math.sin(time * 0.6);

    return {
        longitude: longitude,
        latitude: latitude,
        altitude: altitude,
        yaw: yaw,
        pitch: pitch,
        roll: roll,
    };
}

// 生成并发送轨迹数据
function generateAndSendTrajectoryData() {
    if (!isSimulationRunning || clients.size === 0) {
        return;
    }

    const deltaTime = UPDATE_INTERVAL / 1000; // 转换为秒

    // 生成两个模型的位置和姿态数据
    const model1Data = generateModel1Position(deltaTime);
    const model2Data = generateModel2Position(deltaTime);

    // 构造发送给前端的数据格式
    const trajectoryData = {
        timestamp: Date.now(),
        model1: model1Data,
        model2: model2Data,
    };

    // 发送数据到所有连接的客户端
    const message = JSON.stringify(trajectoryData);
    broadcastToClients(message);

    // 可选：打印调试信息
    if (Math.random() < 0.1) {
        // 10%的概率打印，避免日志过多
        console.log(
            `📍 Model1: (${model1Data.longitude.toFixed(
                6
            )}, ${model1Data.latitude.toFixed(
                6
            )}, ${model1Data.altitude.toFixed(1)})`
        );
        console.log(
            `📍 Model2: (${model2Data.longitude.toFixed(
                6
            )}, ${model2Data.latitude.toFixed(
                6
            )}, ${model2Data.altitude.toFixed(1)})`
        );
    }
}

// 广播消息到所有客户端
function broadcastToClients(message) {
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(message);
            } catch (error) {
                console.error("❌ 发送消息失败:", error.message);
                clients.delete(client);
            }
        }
    });
}

// 开始仿真
function startSimulation() {
    if (isSimulationRunning) {
        return;
    }

    console.log("🚀 开始轨迹仿真...");
    isSimulationRunning = true;

    // 重置轨迹参数
    trajectoryParams.model1.currentAngle = 0;
    trajectoryParams.model2.currentAngle = 0;

    // 启动定时器
    simulationTimer = setInterval(
        generateAndSendTrajectoryData,
        UPDATE_INTERVAL
    );
}

// 停止仿真
function stopSimulation() {
    if (!isSimulationRunning) {
        return;
    }

    console.log("⏹️ 停止轨迹仿真");
    isSimulationRunning = false;

    if (simulationTimer) {
        clearInterval(simulationTimer);
        simulationTimer = null;
    }
}

// 处理WebSocket连接
wss.on("connection", (ws, request) => {
    const clientIP = request.socket.remoteAddress;
    console.log(`🌐 新客户端连接: ${clientIP}`);

    clients.add(ws);

    // 发送欢迎消息和当前状态
    ws.send(
        JSON.stringify({
            type: "welcome",
            message: "已连接到轨迹仿真服务器",
            isSimulationRunning: isSimulationRunning,
            updateInterval: UPDATE_INTERVAL,
        })
    );

    // 如果仿真正在运行且这是第一个客户端，自动开始发送数据
    if (clients.size === 1 && !isSimulationRunning) {
        startSimulation();
    }

    // 处理客户端消息
    ws.on("message", message => {
        try {
            const data = JSON.parse(message.toString());
            console.log("📨 收到客户端消息:", data);

            switch (data.type) {
                case "start_simulation":
                    startSimulation();
                    break;
                case "stop_simulation":
                    stopSimulation();
                    break;
                case "get_status":
                    ws.send(
                        JSON.stringify({
                            type: "status",
                            isSimulationRunning: isSimulationRunning,
                            clientCount: clients.size,
                        })
                    );
                    break;
                default:
                    console.log("❓ 未知消息类型:", data.type);
            }
        } catch (error) {
            console.error("❌ 解析客户端消息失败:", error.message);
        }
    });

    // 处理连接关闭
    ws.on("close", () => {
        console.log(`🔌 客户端断开连接: ${clientIP}`);
        clients.delete(ws);

        // 如果没有客户端了，停止仿真
        if (clients.size === 0) {
            stopSimulation();
        }
    });

    // 处理连接错误
    ws.on("error", error => {
        console.error("❌ WebSocket错误:", error.message);
        clients.delete(ws);
    });
});

// 启动服务器
server.listen(PORT, () => {
    console.log("🚀 轨迹仿真WebSocket服务器启动成功!");
    console.log(`📡 监听端口: ${PORT}`);
    console.log(
        `🔄 更新频率: ${1000 / UPDATE_INTERVAL}Hz (每${UPDATE_INTERVAL}ms)`
    );
    console.log(`🌐 前端连接地址: ws://localhost:${PORT}`);
    console.log("");
    console.log("轨迹说明:");
    console.log("  📍 模型1: 圆形轨迹 (北京 116.4°, 39.9°)");
    console.log("  📍 模型2: 8字形轨迹 (北京 116.4°, 40.0°)");
    console.log("");
});

// 处理服务器错误
server.on("error", error => {
    console.error("❌ 服务器错误:", error.message);
});

// 优雅关闭
process.on("SIGINT", () => {
    console.log("\n🛑 正在关闭服务器...");

    stopSimulation();

    // 通知所有客户端服务器即将关闭
    broadcastToClients(
        JSON.stringify({
            type: "server_shutdown",
            message: "服务器即将关闭",
        })
    );

    // 关闭所有WebSocket连接
    clients.forEach(client => {
        client.close();
    });

    // 关闭HTTP服务器
    server.close(() => {
        console.log("✅ 服务器已关闭");
        process.exit(0);
    });
});

// 处理未捕获的异常
process.on("uncaughtException", error => {
    console.error("❌ 未捕获的异常:", error);
    process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ 未处理的Promise拒绝:", reason);
});
