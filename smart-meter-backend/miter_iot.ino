#include <Arduino.h>
#include <WiFi.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "esp_camera.h"

// --- 1. ตั้งค่า WiFi ---
const char* ssid = "Tekung1234_2.4GHz";
const char* password = "tewit8123";

// --- 2. ตั้งค่า Backend Server ---
// **สำคัญมาก:** เปลี่ยน IP นี้ให้เป็น IP ของเครื่องคอมพิวเตอร์ของคุณที่รัน Node.js อยู่
String serverName = "192.168.1.136"; // <--- แก้ตรงนี้!
const int serverPort = 3000;
String serverPath = "/api/upload";

// --- ตั้งค่ากล้อง (AI Thinker ESP32-CAM) ---
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

void setup() {
  // 1. ปิดตัวตรวจจับไฟตกทันที (สำคัญ!)
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); 
  
  // 2. อย่าเพิ่งรีบเปิด Serial หรือ WiFi
  // ให้เวลา Capacitor ชาร์จไฟให้เต็มก่อน
  delay(2000); 
  
  // ... (โค้ดกระพริบไฟ) ...
  // --- ส่วนที่เพิ่ม: กระพริบไฟเช็กชีพจร ---
  pinMode(4, OUTPUT); // GPIO 4 คือไฟแฟลชดวงใหญ่
  
  // กระพริบ 3 ครั้งรัวๆ เพื่อบอกว่า "ฉันตื่นแล้ว!"
  for(int i=0; i<3; i++){
    digitalWrite(4, HIGH); // ไฟติด
    delay(100);
    digitalWrite(4, LOW);  // ไฟดับ
    delay(100);
  }
  delay(1000); // พักแป๊บนึง
  // ------------------------------------
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // ปิด Brown-out detector กันรีเซ็ตเอง

  Serial.begin(115200);
  Serial.println();

  // --- เริ่มต้น WiFi ---
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // --- เริ่มต้นกล้อง ---
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if(psramFound()){
    config.frame_size = FRAMESIZE_QVGA; // ขนาดภาพ 1600x1200 (ปรับลดได้ถ้าต้องการเร็วขึ้น เช่น FRAMESIZE_SVGA)
    config.jpeg_quality = 12; // 0-63, ยิ่งน้อยยิ่งชัด (10 กำลังดี)
    config.fb_count = 1;
  } else {
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }
  Serial.println("Camera Ready!");
}

/*void loop() {
  // รอรับคำสั่งจาก Serial Monitor เพื่อถ่ายรูป (พิมพ์ 'c' แล้วกด Enter)
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    if (cmd == 'c') {
      Serial.println("Capturing and sending photo...");
      sendPhoto();
    }
  }
  // หรือถ้าอยากให้ถ่ายอัตโนมัติทุก 1 นาที ให้ uncomment บรรทัดล่างนี้
  // delay(60000); sendPhoto();
}*/

void loop() {
  // ไม่รอรับค่า 'c' แล้ว ให้ทำงานเลย
  Serial.println("Auto capturing in 3 seconds...");
  delay(3000); // รอแป๊บนึงเพื่อให้ระบบนิ่ง

  sendPhoto(); // สั่งถ่ายและส่งรูป

  // รอเวลาครั้งต่อไป (เช่น 1 นาที = 60000 มิลลิวินาที)
  // ช่วงทดสอบอาจจะตั้งไว้สัก 30 วินาที (30000) ก็พอครับ จะได้ไม่ต้องรอนาน
  Serial.println("Waiting for next capture...");
  delay(30000); 
}

// --- ฟังก์ชันถ่ายรูปและส่งไปยัง Server (เวอร์ชันแก้ภาพค้าง) ---
void sendPhoto() {
  camera_fb_t * fb = NULL;

  // =========================================================
  // 🧹 ส่วนที่เพิ่ม: ถ่ายทิ้งเพื่อเคลียร์ Buffer และปรับแสง
  // =========================================================
  Serial.println("Flushing camera buffer...");
  // วนลูปถ่ายทิ้ง 2 รูป (บางทีรูปเดียวไม่พอ)
  for (int i = 0; i < 2; i++) {
    fb = esp_camera_fb_get(); // สั่งถ่าย
    esp_camera_fb_return(fb); // คืนค่าหน่วยความจำทันที (ทิ้งรูป)
    delay(200); // รอแป๊บนึงให้เซนเซอร์กล้องรีเซ็ต
  }
  // =========================================================

  // --- เริ่มถ่ายรูปจริง (Real Capture) ---
  fb = esp_camera_fb_get();
  if(!fb) {
    Serial.println("Camera capture failed");
    return;
  }

  Serial.printf("Picture taken! Size: %u bytes\n", fb->len);

  // ... (ส่วนการเชื่อมต่อ WiFi และส่งข้อมูล เหมือนเดิมทุกอย่าง) ...
  WiFiClient client;
  if (client.connect(serverName.c_str(), serverPort)) {
    // ... (ก๊อปปี้โค้ดเดิมส่วนส่งข้อมูลมาใส่ตรงนี้ได้เลย) ...
    // หรือใช้โค้ดเต็มด้านล่างนี้
    Serial.println("Connected to server!");
    String boundary = "------------------------esp32cam";
    String head = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"image\"; filename=\"esp32-cam.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n";
    String tail = "\r\n--" + boundary + "--\r\n";
    String extra_field = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"house_id\"\r\n\r\n1\r\n";

    uint32_t totalLen = head.length() + fb->len + tail.length() + extra_field.length();

    client.println("POST " + serverPath + " HTTP/1.1");
    client.println("Host: " + serverName);
    client.println("Content-Length: " + String(totalLen));
    client.println("Content-Type: multipart/form-data; boundary=" + boundary);
    client.println();
    client.print(extra_field);
    client.print(head);

    uint8_t *fbBuf = fb->buf;
    size_t fbLen = fb->len;
    for (size_t n=0; n<fbLen; n=n+1024) {
      if (n+1024 < fbLen) {
        client.write(fbBuf, 1024);
        fbBuf += 1024;
      } else if (fbLen%1024>0) {
        size_t remainder = fbLen%1024;
        client.write(fbBuf, remainder);
      }
    }
    client.print(tail);

    while (client.connected()) {
        String line = client.readStringUntil('\n');
        if (line == "\r") {
          Serial.println("Headers received");
          break;
        }
    }
    String responseBody = client.readString();
    Serial.println("Response from server:");
    Serial.println(responseBody);
    client.stop();
  } else {
    Serial.println("Connection to server failed");
  }

  esp_camera_fb_return(fb); // คืนหน่วยความจำภาพจริง
}