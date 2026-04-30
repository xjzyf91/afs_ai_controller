#include <iostream>
#include <string>
#include <cmath>
#include <sstream>
#include <ctime>
#include <cstdlib>
#include <thread>
#include <chrono>
#include <vector>
#include <memory>
#include <arpa/inet.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <signal.h>
#include <openssl/sha.h>
#include <openssl/evp.h>
#include <openssl/bio.h>
#include <openssl/buffer.h>

// 轨迹模型类
class TrajectoryModel {
private:
    double time_offset;
    double base_lat, base_lon, base_alt;
    double radius;
    double speed;
    double altitude_amplitude;
    std::string model_name;
    
public:
    TrajectoryModel(const std::string& name, double lat, double lon, double alt, 
                   double r, double s, double amp, double offset = 0.0) 
        : model_name(name), base_lat(lat), base_lon(lon), base_alt(alt),
          radius(r), speed(s), altitude_amplitude(amp), time_offset(offset) {}
    
    struct Position {
        double latitude;
        double longitude;
        double altitude;
        double yaw;
        double pitch;
        double roll;
    };
    
    Position getPosition(double time) {
        Position pos;
        double t = time + time_offset;
        
        // 圆周运动轨迹
        pos.longitude = base_lon + radius * cos(speed * t);
        pos.latitude = base_lat + radius * sin(speed * t);
        pos.altitude = base_alt + altitude_amplitude * sin(0.2 * t);
        
        // 计算运动方向的偏航角
        double dx = -radius * speed * sin(speed * t);
        double dy = radius * speed * cos(speed * t);
        pos.yaw = atan2(dy, dx) * 180.0 / M_PI;
        if (pos.yaw < 0) pos.yaw += 360;
        
        // 俯仰角和滚转角
        pos.pitch = 5 * sin(0.3 * t);
        pos.roll = 10 * cos(0.25 * t);
        
        // 限制角度范围
        pos.pitch = std::max(-45.0, std::min(45.0, pos.pitch));
        pos.roll = std::max(-60.0, std::min(60.0, pos.roll));
        
        return pos;
    }
    
    std::string getName() const { return model_name; }
};

// 简单的WebSocket实现
class SimpleWebSocket {
private:
    int client_socket;
    bool is_connected;
    
    std::string base64_encode(const unsigned char* data, size_t len) {
        BIO *bio, *b64;
        BUF_MEM *bufferPtr;
        
        b64 = BIO_new(BIO_f_base64());
        bio = BIO_new(BIO_s_mem());
        bio = BIO_push(b64, bio);
        
        BIO_set_flags(bio, BIO_FLAGS_BASE64_NO_NL);
        BIO_write(bio, data, len);
        BIO_flush(bio);
        BIO_get_mem_ptr(bio, &bufferPtr);
        
        std::string result(bufferPtr->data, bufferPtr->length);
        BIO_free_all(bio);
        
        return result;
    }
    
    bool performHandshake() {
        char buffer[4096];
        int bytes_received = recv(client_socket, buffer, sizeof(buffer) - 1, 0);
        if (bytes_received <= 0) return false;
        
        buffer[bytes_received] = '\0';
        std::string request(buffer);
        
        // 查找WebSocket密钥
        size_t key_pos = request.find("Sec-WebSocket-Key: ");
        if (key_pos == std::string::npos) return false;
        
        key_pos += 19; // "Sec-WebSocket-Key: "的长度
        size_t key_end = request.find("\r\n", key_pos);
        if (key_end == std::string::npos) return false;
        
        std::string client_key = request.substr(key_pos, key_end - key_pos);
        
        // WebSocket魔法字符串
        std::string magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
        std::string combined = client_key + magic;
        
        // 计算SHA1哈希
        unsigned char hash[SHA_DIGEST_LENGTH];
        SHA1(reinterpret_cast<const unsigned char*>(combined.c_str()), combined.length(), hash);
        
        // Base64编码
        std::string accept_key = base64_encode(hash, SHA_DIGEST_LENGTH);
        
        // 构建响应
        std::ostringstream response;
        response << "HTTP/1.1 101 Switching Protocols\r\n"
                << "Upgrade: websocket\r\n"
                << "Connection: Upgrade\r\n"
                << "Sec-WebSocket-Accept: " << accept_key << "\r\n"
                << "\r\n";
        
        std::string response_str = response.str();
        return send(client_socket, response_str.c_str(), response_str.length(), 0) > 0;
    }
    
public:
    SimpleWebSocket(int socket) : client_socket(socket), is_connected(false) {
        is_connected = performHandshake();
    }
    
    bool isConnected() const { return is_connected; }
    
    bool sendMessage(const std::string& message) {
        if (!is_connected) return false;
        
        std::vector<uint8_t> frame;
        
        // WebSocket帧头
        frame.push_back(0x81); // FIN=1, opcode=1 (text)
        
        size_t payload_len = message.length();
        if (payload_len < 126) {
            frame.push_back(static_cast<uint8_t>(payload_len));
        } else if (payload_len < 65536) {
            frame.push_back(126);
            frame.push_back(static_cast<uint8_t>(payload_len >> 8));
            frame.push_back(static_cast<uint8_t>(payload_len & 0xFF));
        } else {
            frame.push_back(127);
            for (int i = 7; i >= 0; i--) {
                frame.push_back(static_cast<uint8_t>((payload_len >> (i * 8)) & 0xFF));
            }
        }
        
        // 添加消息内容
        frame.insert(frame.end(), message.begin(), message.end());
        
        ssize_t sent = send(client_socket, frame.data(), frame.size(), 0);
        return sent > 0;
    }
    
    ~SimpleWebSocket() {
        if (client_socket >= 0) {
            close(client_socket);
        }
    }
};

// 全局变量
bool server_running = true;
std::vector<std::unique_ptr<TrajectoryModel>> models;

void signal_handler(int signal) {
    std::cout << "\n正在关闭服务器..." << std::endl;
    server_running = false;
}

void handle_client(int client_socket) {
    std::cout << "客户端已连接" << std::endl;
    
    SimpleWebSocket ws(client_socket);
    if (!ws.isConnected()) {
        std::cout << "WebSocket握手失败" << std::endl;
        return;
    }
    
    std::cout << "WebSocket连接建立成功" << std::endl;
    
    double time_counter = 0.0;
    
    while (server_running && ws.isConnected()) {
        // 生成JSON数据
        std::ostringstream json;
        json.precision(6);
        json << "{";
        
        for (size_t i = 0; i < models.size(); ++i) {
            auto pos = models[i]->getPosition(time_counter);
            
            json << "\"" << models[i]->getName() << "\":{";
            json << "\"latitude\":" << pos.latitude << ",";
            json << "\"longitude\":" << pos.longitude << ",";
            json << "\"altitude\":" << pos.altitude << ",";
            json << "\"yaw\":" << pos.yaw << ",";
            json << "\"pitch\":" << pos.pitch << ",";
            json << "\"roll\":" << pos.roll;
            json << "}";
            
            if (i < models.size() - 1) {
                json << ",";
            }
        }
        
        json << "}";
        
        // 发送数据
        if (!ws.sendMessage(json.str())) {
            std::cout << "发送数据失败，客户端可能已断开" << std::endl;
            break;
        }
        
        time_counter += 0.1;
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
    
    std::cout << "客户端连接已关闭" << std::endl;
}

int main() {
    // 设置信号处理
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);
    
    // 初始化随机数种子
    std::srand(std::time(nullptr));
    
    // 创建轨迹模型
    models.push_back(std::make_unique<TrajectoryModel>(
        "model1", 39.9042, 116.4074, 500.0, 0.01, 0.05, 50.0, 0.0
    ));
    
    models.push_back(std::make_unique<TrajectoryModel>(
        "model2", 40.0042, 116.4074, 600.0, 0.015, 0.08, 80.0, M_PI/4
    ));
    
    // 创建服务器套接字
    int server_socket = socket(AF_INET, SOCK_STREAM, 0);
    if (server_socket == -1) {
        std::cerr << "创建套接字失败" << std::endl;
        return 1;
    }
    
    // 设置端口重用
    int opt = 1;
    if (setsockopt(server_socket, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt)) < 0) {
        std::cerr << "设置套接字选项失败" << std::endl;
        return 1;
    }
    
    // 绑定地址
    struct sockaddr_in server_addr;
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = INADDR_ANY;
    server_addr.sin_port = htons(8080);
    
    if (bind(server_socket, (struct sockaddr*)&server_addr, sizeof(server_addr)) < 0) {
        std::cerr << "绑定地址失败" << std::endl;
        return 1;
    }
    
    // 监听连接
    if (listen(server_socket, 5) < 0) {
        std::cerr << "监听失败" << std::endl;
        return 1;
    }
    
    std::cout << "WebSocket服务器运行在端口 8080" << std::endl;
    std::cout << "等待客户端连接..." << std::endl;
    std::cout << "按 Ctrl+C 退出服务器" << std::endl;
    
    // 接受连接
    while (server_running) {
        fd_set read_fds;
        FD_ZERO(&read_fds);
        FD_SET(server_socket, &read_fds);
        
        struct timeval timeout;
        timeout.tv_sec = 1;
        timeout.tv_usec = 0;
        
        int activity = select(server_socket + 1, &read_fds, NULL, NULL, &timeout);
        
        if (activity < 0 && errno != EINTR) {
            std::cerr << "Select错误" << std::endl;
            continue;
        }
        
        if (activity == 0) {
            continue; // 超时，继续循环
        }
        
        if (FD_ISSET(server_socket, &read_fds)) {
            struct sockaddr_in client_addr;
            socklen_t client_len = sizeof(client_addr);
            int client_socket = accept(server_socket, (struct sockaddr*)&client_addr, &client_len);
            
            if (client_socket < 0) {
                std::cerr << "接受连接失败" << std::endl;
                continue;
            }
            
            // 创建线程处理客户端
            std::thread client_thread(handle_client, client_socket);
            client_thread.detach();
        }
    }
    
    // 清理
    close(server_socket);
    std::cout << "服务器已关闭" << std::endl;
    
    return 0;
} 