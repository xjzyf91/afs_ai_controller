#include <iostream>
#include <cstdlib>
#include <ctime>
#include <cmath>
#include <thread>
#include <chrono>
#include <boost/beast.hpp>
#include <boost/asio.hpp>
#include <string>
#include <sstream>

namespace beast = boost::beast;
namespace http = beast::http;
namespace websocket = beast::websocket;
namespace net = boost::asio;
using tcp = boost::asio::ip::tcp;

double getRandomDouble(double min, double max)
{
    return min + static_cast<double>(rand()) / (static_cast<double>(RAND_MAX / (max - min)));
}

void do_session(websocket::stream<tcp::socket> ws)
{
    try
    {
        ws.accept();

        // 模型1初始值
        double yaw1 = 0.0, pitch1 = 0.0, roll1 = 0.0;
        double latitude1 = 39.921984;
        double longitude1 = 116.398389;
        double altitude1 = 1000.0;

        // 模型2初始值
        double yaw2 = 0.0, pitch2 = 0.0, roll2 = 0.0;
        double latitude2 = 39.931984; // 稍微偏移位置以区分
        double longitude2 = 116.408389;
        double altitude2 = 1200.0;

        while (ws.is_open())
        {
            // 模型1数据更新
            yaw1 += getRandomDouble(-5, 5);
            pitch1 += getRandomDouble(-5, 5);
            roll1 += getRandomDouble(-5, 5);

            // 边界检查
            if (yaw1 > 360 || yaw1 < -360)
                yaw1 = 0;
            if (pitch1 > 90 || pitch1 < -90)
                pitch1 = 0;
            if (roll1 > 180 || roll1 < -180)
                roll1 = 0;

            latitude1 += getRandomDouble(-0.01, 0.01);
            longitude1 += getRandomDouble(0.01, 0.02);
            altitude1 += getRandomDouble(-10, 10);

            // 模型2数据更新
            yaw2 += getRandomDouble(-3, 3);
            pitch2 += getRandomDouble(-3, 3);
            roll2 += getRandomDouble(-3, 3);

            // 边界检查
            if (yaw2 > 360 || yaw2 < -360)
                yaw2 = 0;
            if (pitch2 > 90 || pitch2 < -90)
                pitch2 = 0;
            if (roll2 > 180 || roll2 < -180)
                roll2 = 0;

            latitude2 += getRandomDouble(-0.005, 0.005);
            longitude2 += getRandomDouble(0.005, 0.01);
            altitude2 += getRandomDouble(-5, 5);

            // 创建包含两个模型数据的JSON消息
            std::ostringstream json;
            json << "{"
                 << "\"model1\": {"
                 << "\"yaw\":" << yaw1 << ","
                 << "\"pitch\":" << pitch1 << ","
                 << "\"roll\":" << roll1 << ","
                 << "\"latitude\":" << latitude1 << ","
                 << "\"longitude\":" << longitude1 << ","
                 << "\"altitude\":" << altitude1
                 << "},"
                 << "\"model2\": {"
                 << "\"yaw\":" << yaw2 << ","
                 << "\"pitch\":" << pitch2 << ","
                 << "\"roll\":" << roll2 << ","
                 << "\"latitude\":" << latitude2 << ","
                 << "\"longitude\":" << longitude2 << ","
                 << "\"altitude\":" << altitude2
                 << "}"
                 << "}";

            // 发送消息
            ws.write(net::buffer(json.str()));

            std::this_thread::sleep_for(std::chrono::milliseconds(200));
        }
    }
    catch (beast::system_error const &se)
    {
        if (se.code() != websocket::error::closed)
        {
            std::cerr << "Error: " << se.code().message() << std::endl;
        }
    }
    catch (std::exception const &e)
    {
        std::cerr << "Error: " << e.what() << std::endl;
    }
}

int main()
{
    try
    {
        srand(static_cast<unsigned int>(time(nullptr)));

        auto const address = net::ip::make_address("0.0.0.0");
        auto const port = static_cast<unsigned short>(8080);

        net::io_context ioc{1};
        tcp::acceptor acceptor{ioc, {address, port}};

        std::cout << "WebSocket服务器监听在 " << address << ":" << port << std::endl;

        while (true)
        {
            tcp::socket socket{ioc};
            acceptor.accept(socket);

            // 创建websocket::stream后再传递给do_session
            std::thread([socket = std::move(socket)]() mutable
                        {
                try {
                    websocket::stream<tcp::socket> ws{std::move(socket)};
                    do_session(std::move(ws));
                } catch(...) {
                    std::cerr << "Thread exception" << std::endl;
                } })
                .detach();
        }
    }
    catch (std::exception const &e)
    {
        std::cerr << "Error: " << e.what() << std::endl;
        return EXIT_FAILURE;
    }
}