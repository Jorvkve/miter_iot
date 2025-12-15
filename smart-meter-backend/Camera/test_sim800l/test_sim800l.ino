#include "esp_camera.h"
#include <HardwareSerial.h>

// --- 1. ตั้งค่าพิน SIM800L ---
#define SIM800_RX_PIN 13 // ต่อกับ TX ของ SIM800L
#define SIM800_TX_PIN 14 // ต่อกับ RX ของ SIM800L

// --- 2. ตั้งค่า Server (⚠️ ต้องแก้ตรงนี้!) ---
// วิธีหา IP: เปิด cmd ในคอม -> พิมพ์ ipconfig -> ดู IPv4 Address
String serverUrl = "http://192.168.1.126:3000/api/upload"; // <--- แก้เลขนี้ให้ตรงกับคอมคุณ

// ตั้งค่า APN (AIS, True, Dtac ส่วนใหญ่ใช้คำว่า internet ได้เลย)
String apn = "internet"; 

HardwareSerial sim800(1);

// --- 3. ตั้งค่ากล้อง (AI Thinker Model) ---
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
  // เริ่มต้น SIM800L ที่ Baud rate 9600 (มาตรฐาน)
  sim800.begin(9600, SERIAL_8N1, SIM800_RX_PIN, SIM800_TX_PIN);
  delay(1000);

  Serial.println("-----------------------------------");
  Serial.println("Starting ESP32-CAM Smart Meter...");
  
  // 1. เริ่มต้นกล้อง
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
    config.frame_size = FRAMESIZE_SVGA; // ใช้ขนาด SVGA (800x600) กำลังดี ส่งไม่ช้าเกินไป
    config.jpeg_quality = 12;           // คุณภาพ (10-63) ยิ่งน้อยยิ่งชัด
    config.fb_count = 1;
  } else {
    config.frame_size = FRAMESIZE_VGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }
  Serial.println("Camera Ready! 📷");

  // 2. เริ่มต้นเชื่อมต่อเน็ต
  initGPRS();
}

void loop() {
  // ทำงานทุกๆ 60 วินาที (เปลี่ยนตัวเลขได้)
  Serial.println("\n--- Taking Photo ---");
  
  camera_fb_t * fb = esp_camera_fb_get();
  if(!fb) {
    Serial.println("Camera capture failed");
    delay(1000);
    return;
  }
  
  Serial.printf("Picture taken! Size: %d bytes\n", fb->len);
  
  // ส่งรูปภาพขึ้น Server
  sendImageToBackend(fb);
  
  esp_camera_fb_return(fb); // คืนหน่วยความจำ
  
  Serial.println("Waiting 1 minute for next round...");
  delay(60000); 
}

// --- ฟังก์ชันส่งคำสั่ง AT ---
String sendAT(String command, const int timeout, boolean debug) {
  String response = "";
  sim800.println(command);
  long int time = millis();
  while ((time + timeout) > millis()) {
    while (sim800.available()) {
      char c = sim800.read();
      response += c;
    }
  }
  if (debug) { Serial.print(response); }
  return response;
}

// --- ฟังก์ชันเชื่อมต่อ GPRS ---
void initGPRS() {
  Serial.println("Initializing SIM800L...");
  sendAT("AT", 1000, true);
  sendAT("AT+CPIN?", 1000, true); // เช็กซิม
  sendAT("AT+CSQ", 1000, true);   // เช็กสัญญาณ

  Serial.println("Connecting to GPRS...");
  sendAT("AT+SAPBR=3,1,\"Contype\",\"GPRS\"", 1000, true);
  sendAT("AT+SAPBR=3,1,\"APN\",\"" + apn + "\"", 1000, true);
  sendAT("AT+SAPBR=1,1", 5000, true); // เปิดเน็ต (รอนานหน่อย 5วิ)
  sendAT("AT+SAPBR=2,1", 2000, true); // เช็ก IP ที่ได้มา
}

// --- ฟังก์ชันส่งรูป (Multipart POST) ---
void sendImageToBackend(camera_fb_t * fb) {
  Serial.println("Starting Upload...");
  
  // เริ่ม HTTP
  sendAT("AT+HTTPINIT", 1000, true);
  sendAT("AT+HTTPPARA=\"CID\",1", 1000, true);
  sendAT("AT+HTTPPARA=\"URL\",\"" + serverUrl + "\"", 1000, true);
  
  // ตั้งค่า Content-Type เป็น Multipart
  sendAT("AT+HTTPPARA=\"CONTENT\",\"multipart/form-data; boundary=myboundary\"", 1000, true);

  // สร้าง Header และ Footer
  String head = "--myboundary\r\nContent-Disposition: form-data; name=\"image\"; filename=\"meter.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--myboundary--\r\n";

  // คำนวณขนาด
  uint32_t totalLen = head.length() + fb->len + tail.length();
  
  // แจ้งขนาดข้อมูลที่จะส่ง
  Serial.printf("Total payload size: %d bytes\n", totalLen);
  // สั่ง HTTPDATA (ให้เวลา 30 วินาทีในการส่งข้อมูลเข้าโมดูล)
  sim800.print("AT+HTTPDATA=" + String(totalLen) + ",30000\r\n"); 
  
  delay(1000); // รอคำว่า DOWNLOAD
  
  // ส่งข้อมูลดิบ
  Serial.println("Writing Data...");
  sim800.print(head);                 
  sim800.write(fb->buf, fb->len);     
  sim800.print(tail);                 

  delay(1000);

  // สั่ง POST (Action 1)
  Serial.println("POST Action...");
  String response = sendAT("AT+HTTPACTION=1", 20000, true); // รอนานๆ เลยเผื่อเน็ตช้า

  if (response.indexOf("+HTTPACTION: 1,200") != -1) {
    Serial.println("\n✅ Upload Success! (Status 200)");
  } else {
    Serial.println("\n❌ Upload Failed!");
    sendAT("AT+HTTPREAD", 2000, true); // อ่าน Error ดู
  }

  sendAT("AT+HTTPTERM", 1000, true);
}