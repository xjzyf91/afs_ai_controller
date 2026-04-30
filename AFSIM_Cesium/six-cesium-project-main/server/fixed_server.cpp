#include <iostream>
#include <string>
#include <cmath>
#include <sstream>
#include <ctime>
#include <cstdlib>
#include <thread>
#include <chrono>
#include <vector>
#include <arpa/inet.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <signal.h>

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
        if (pos.pitch > 45.0) pos.pitch = 45.0;
        if (pos.pitch < -45.0) pos.pitch = -45.0;
        if (pos.roll > 60.0) pos.roll = 60.0;
        if (pos.roll < -60.0) pos.roll = -60.0;
        
        return pos;
    }
    
    std::string getName() const { return model_name; }
};

// 全局变量
bool server_running = true;
std::vector<TrajectoryModel*> models;

void signal_handler(int signal) {
    std::cout << "\n正在关闭服务器..." << std::endl;
    server_running = false;
}

void handle_client(int client_socket) {
    std::cout << "客户端已连接" << std::endl;
    
    double time_counter = 0.0;
    
    while (server_running) {
        // 生成JSON数据
        std::ostringstream json;
        json.precision(6);
        json << "{";
        
        for (size_t i = 0; i < models.size(); ++i) {
            TrajectoryModel::Position pos = models[i]->getPosition(time_counter);
            
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
        
        json << "}\n";
        
        // 发送数据
        ssize_t sent = send(client_socket, json.str().c_str(), json.str().length(), 0);
        if (sent <= 0) {
            std::cout << "客户端已断开连接" << std::endl;
            break;
        }
        
        time_counter += 0.1;
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
    
    close(client_socket);
    std::cout << "客户端连接已关闭" << std::endl;
}

int main() {
    // 设置信号处理
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);
    
    // 初始化随机数种子
    std::srand(std::time(nullptr));
    
    // 创建轨迹模型 - 使用new而不是make_unique
    models.push_back(new TrajectoryModel("model1", 39.9042, 116.4074, 500.0, 0.01, 0.05, 50.0, 0.0));
    models.push_back(new TrajectoryModel("model2", 40.0042, 116.4074, 600.0, 0.015, 0.08, 80.0, M_PI/4));
    
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
        std::cerr << "绑定地址失败，可能端口被占用" << std::endl;
        return 1;
    }
    
    // 监听连接
    if (listen(server_socket, 10) < 0) {
        std::cerr << "监听失败" << std::endl;
        return 1;
    }
    
    std::cout << "TCP服务器运行在端口 8080" << std::endl;
    std::cout << "等待客户端连接..." << std::endl;
    std::cout << "按 Ctrl+C 退出服务器" << std::endl;
    
    // 接受所有连接 - 简化版本
    while (server_running) {
        struct sockaddr_in client_addr;
        socklen_t client_len = sizeof(client_addr);
        int client_socket = accept(server_socket, (struct sockaddr*)&client_addr, &client_len);
        
        if (client_socket < 0) {
            if (server_running) {
                std::cerr << "接受连接失败" << std::endl;
            }
            continue;
        }
        
        // 打印客户端信息
        char client_ip[INET_ADDRSTRLEN];
        inet_ntop(AF_INET, &(client_addr.sin_addr), client_ip, INET_ADDRSTRLEN);
        std::cout << "新连接来自: " << client_ip << ":" << ntohs(client_addr.sin_port) << std::endl;
        
        // 创建线程处理客户端
        std::thread client_thread(handle_client, client_socket);
        client_thread.detach();
    }
    
    // 清理
    close(server_socket);
    
    // 释放内存
    for (size_t i = 0; i < models.size(); ++i) {
        delete models[i];
    }
    models.clear();
    
    std::cout << "服务器已关闭" << std::endl;
    
    return 0;
} 