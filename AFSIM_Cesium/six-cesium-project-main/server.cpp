#include <iostream>
#include <cstdlib> // For rand() and srand()
#include <ctime>   // For time()
#include <cmath>   // For sin(), cos(), etc.
#include <thread>  // For std::this_thread::sleep_for
#include <chrono>  // For std::chrono

// Function to generate random double within a range
double getRandomDouble(double min, double max)
{
    return min + static_cast<double>(rand()) / (static_cast<double>(RAND_MAX / (max - min)));
}

int main()
{
    // Seed the random number generator with current time
    srand(static_cast<unsigned int>(time(nullptr)));

    // Initial values for yaw, pitch, roll in degrees and latitude, longitude in decimal degrees
    double yaw = 0.0, pitch = 0.0, roll = 0.0;
    double latitude = 39.921984;   // Example: Latitude of Beijing
    double longitude = 116.398389; // Example: Longitude of Beijing

    // Loop to simulate flight path data generation every half second
    while (true)
    {
        // Generate small changes in yaw, pitch, roll
        yaw += getRandomDouble(-5, 5);
        pitch += getRandomDouble(-5, 5);
        roll += getRandomDouble(-5, 5);

        // Ensure yaw, pitch, roll stay within reasonable bounds
        if (yaw > 360 || yaw < -360)
            yaw = 0;
        if (pitch > 90 || pitch < -90)
            pitch = 0;
        if (roll > 180 || roll < -180)
            roll = 0;

        // Slowly change latitude and longitude by small amounts
        latitude += getRandomDouble(-0.0001, 0.0001);  // Small changes
        longitude += getRandomDouble(-0.0001, 0.0001); // Small changes

        // Print out the generated data
        std::cout << "Yaw: " << yaw << ", Pitch: " << pitch << ", Roll: " << roll << "\n";
        std::cout << "Latitude: " << latitude << ", Longitude: " << longitude << "\n\n";

        // Sleep for half a second
        std::this_thread::sleep_for(std::chrono::milliseconds(500));
    }

    return 0;
}