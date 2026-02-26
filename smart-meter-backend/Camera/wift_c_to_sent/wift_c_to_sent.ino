#include <WiFi.h>
#include "esp_camera.h"
#include <HTTPClient.h>

// --- 1. ตั้งค่า WiFi (Hotspot มือถือ) ---
const char* ssid = "Jorvkve_2.4G";      // ⚠️ แก้ชื่อ WiFi
const char* password = "Tewit8123"; // ⚠️ แก้รหัส WiFi

// --- 2. ตั้งค่า Server (ใช้ IP เครื่องคอม) ---
// ดู IP: เปิด cmd -> ipconfig -> ดู IPv4
String serverUrl = "http://192.168.1.104:3000/api/upload"; // ⚠️ แก้ IP ให้ตรง

// --- 3. ตั้งค่ากล้อง ---
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
  Serial.begin(115200);
  Serial.println();

  // 1. เชื่อมต่อ WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi Connected!");
  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());
  

  // 2. ตั้งค่ากล้อง
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
    config.frame_size = FRAMESIZE_SVGA; // ใช้ SVGA (800x600) ได้เลย เพราะ WiFi เร็ว!
    config.jpeg_quality = 10;
    config.fb_count = 1;
  } else {
    config.frame_size = FRAMESIZE_VGA;
    config.jpeg_quality = 10;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }
  Serial.println("Camera Ready! Press 'c' to take photo.");

  pinMode(4, OUTPUT);
}

void loop() {
  if (Serial.available()) {
    char cmd = Serial.read();
    if (cmd == 'c' || cmd == 'C') {
      takePhotoAndSend();
    }
  }
  delay(100);
}

void takePhotoAndSend() {
  Serial.println("\n--- Taking Photo ---");
  
  // 1. เปิดไฟแฟลช
  //digitalWrite(4, HIGH);
  //delay(300); // รอไฟสว่างเต็มที่และให้เซนเซอร์รับแสงนิดนึง
  
  // --------------------------------------------------------
  // 🔥 สูตรแก้ภาพมืด: ถ่ายทิ้ง 1 ครั้ง เพื่อเคลียร์ภาพเก่าใน Buffer
  // --------------------------------------------------------
  camera_fb_t * fb = esp_camera_fb_get();
  esp_camera_fb_return(fb); // ทิ้งไปเลย ไม่ต้องส่ง
  delay(100); // พักนิดนึงให้กล้องเตรียมตัวถ่ายจริง
  // --------------------------------------------------------

  // 2. ถ่ายรูปจริง (รอบนี้แสงจะเข้าแล้ว)
  fb = esp_camera_fb_get();
  
  // 3. ปิดไฟทันที
  //digitalWrite(4, LOW);
  
  if(!fb) {
    Serial.println("Camera capture failed");
    return;
  }
  Serial.printf("Picture taken! Size: %d bytes\n", fb->len);

  // ส่งรูปผ่าน WiFi
  if(WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    
    Serial.println("Connecting to Server: " + serverUrl);
    http.begin(serverUrl);
    
    String boundary = "------------------------ebf9f03029db4c27";
    String contentType = "multipart/form-data; boundary=" + boundary;
    http.addHeader("Content-Type", contentType);
    
    // สร้าง Body
    String head = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"image\"; filename=\"meter.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n";
    String tail = "\r\n--" + boundary + "--\r\n";
    
    uint32_t imageLen = fb->len;
    uint32_t extraLen = head.length() + tail.length();
    uint32_t totalLen = imageLen + extraLen;
  
    // เริ่มส่ง
    Serial.println("Sending Data...");
    // เราต้องใช้ ptr เพื่อส่งแบบ stream (แอดวานซ์นิดหน่อยแต่ชัวร์)
    // แต่วิธีง่ายคือส่งเป็นก้อนเดียวไปเลยสำหรับ ESP32 WiFi
    
    uint8_t * payload = (uint8_t *) malloc(totalLen);
    if(payload) {
        memcpy(payload, head.c_str(), head.length());
        memcpy(payload + head.length(), fb->buf, imageLen);
        memcpy(payload + head.length() + imageLen, tail.c_str(), tail.length());
        
        int httpResponseCode = http.POST(payload, totalLen);
        free(payload);

        if (httpResponseCode > 0) {
          Serial.printf("✅ Upload Success! Status: %d\n", httpResponseCode);
          String response = http.getString();
          Serial.println("Server Response: " + response);
        } else {
          Serial.printf("❌ Upload Failed! Error: %s\n", http.errorToString(httpResponseCode).c_str());
        }
    } else {
        Serial.println("Malloc failed");
    }
    http.end();
  } else {
    Serial.println("❌ WiFi Disconnected");
  }
  
  esp_camera_fb_return(fb); 
  Serial.println("--- Done. Waiting for command 'c' ---");
}