#include <HardwareSerial.h>

// กำหนดขา Serial ที่จะคุยกับ SIM800L
#define SIM800_TX_PIN 14
#define SIM800_RX_PIN 15

HardwareSerial sim800(1); // ใช้ Hardware Serial 1

void setup() {
  Serial.begin(115200);
  while (!Serial);

  Serial.println("ESP32-CAM SIM800L Test Starting...");

  // เริ่มต้น Serial สำหรับ SIM800L (Baud rate ปกติคือ 9600 หรือ 115200 ลองเช็กดูครับ)
  sim800.begin(9600, SERIAL_8N1, SIM800_RX_PIN, SIM800_TX_PIN);
  delay(1000);

  Serial.println("Sending AT...");
  sim800.println("AT"); // ส่งคำสั่งทดสอบ
}

void loop() {
  // ถ้า SIM800L ส่งอะไรมา ให้พิมพ์ออก Serial Monitor
  if (sim800.available()) {
    Serial.write(sim800.read());
  }
  // ถ้าเราพิมพ์อะไรใน Serial Monitor ให้ส่งไปหา SIM800L
  if (Serial.available()) {
    sim800.write(Serial.read());
  }
}