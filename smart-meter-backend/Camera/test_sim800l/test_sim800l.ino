#include "esp_camera.h"
#include <HardwareSerial.h>

// --- 1. ตั้งค่าพิน SIM800L ---
#define SIM800_RX_PIN 13 // ต่อกับ TX ของ SIM800L
#define SIM800_TX_PIN 14 // ต่อกับ RX ของ SIM800L

// --- 2. ตั้งค่า Server (⚠️ แก้ IP ตรงนี้ให้ตรงกับเครื่องคอมฯ ของคุณ) ---
// วิธีหา IP: เปิด cmd -> พิมพ์ ipconfig -> ดู IPv4
String serverUrl = "http://44096080e839.ngrok-free.app/api/upload"; 

// ตั้งค่า APN (ซิม True/AIS ใช้คำว่า internet ได้เลย)
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
  // เริ่มต้น SIM800L (ถ้าบอร์ดคุณใช้ 115200 ให้แก้ตรงนี้)
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
    config.frame_size = FRAMESIZE_SVGA; // 800x600 (ขนาดกำลังดี ส่งไว)
    config.jpeg_quality = 12;           // 10-63 (ยิ่งน้อยยิ่งชัด)
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

  // 2. เริ่มต้นเชื่อมต่อเน็ต (แบบรอจนกว่าจะพร้อม)
  initGPRS();
}

void loop() {
  // ทำงานทุกๆ 60 วินาที
  Serial.println("\n--- Taking Photo ---");
  
  // ถ่ายรูป
  camera_fb_t * fb = esp_camera_fb_get();
  if(!fb) {
    Serial.println("Camera capture failed");
    delay(1000);
    return;
  }
  
  Serial.printf("Picture taken! Size: %d bytes\n", fb->len);
  
  // ส่งรูปภาพ
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

// --- ฟังก์ชันเชื่อมต่อ GPRS (ฉบับอัปเกรด: รอจนกว่าจะพร้อม) ---
void initGPRS() {
  Serial.println("Initializing SIM800L...");
  sendAT("AT", 1000, true);
  
  // 1. วนลูปรอจนกว่าจะอ่านซิมเจอ (READY)
  Serial.print("Checking SIM Card...");
  while(true) {
    String resp = sendAT("AT+CPIN?", 1000, false);
    if(resp.indexOf("READY") != -1) {
      Serial.println(" OK! ✅");
      break;
    }
    Serial.print(".");
    delay(1000);
  }

  // 2. วนลูปรอสัญญาณเครือข่าย (CREG: 0,1 หรือ 0,5)
  Serial.print("Waiting for Network...");
  while(true) {
    String resp = sendAT("AT+CREG?", 1000, false);
    if(resp.indexOf("0,1") != -1 || resp.indexOf("0,5") != -1) {
      Serial.println(" Connected! ✅");
      break;
    }
    Serial.print(".");
    delay(2000);
  }

  // 3. เช็กความแรงสัญญาณ
  sendAT("AT+CSQ", 1000, true);

  // 4. เชื่อมต่อเน็ต GPRS
  Serial.println("Connecting to GPRS...");
  sendAT("AT+SAPBR=3,1,\"Contype\",\"GPRS\"", 1000, true);
  sendAT("AT+SAPBR=3,1,\"APN\",\"" + apn + "\"", 1000, true);
  
  // ลองต่อเน็ต 3 รอบ (กันพลาด)
  for(int i=0; i<3; i++) {
    sendAT("AT+SAPBR=1,1", 5000, true); // สั่งเปิดเน็ต
    String ip = sendAT("AT+SAPBR=2,1", 2000, true); // ขอ IP
    if(ip.indexOf("\"0.0.0.0\"") == -1 && ip.indexOf("ERROR") == -1) {
       Serial.println("✅ GPRS Online! IP Obtained.");
       return;
    }
    Serial.println("Retrying GPRS connection...");
    delay(2000);
  }
}

// --- ฟังก์ชันส่งรูป (Multipart POST) ---
void sendImageToBackend(camera_fb_t * fb) {
  Serial.println("Starting Upload...");
  
  // เริ่ม HTTP Session
  sendAT("AT+HTTPINIT", 1000, true);
  sendAT("AT+HTTPPARA=\"CID\",1", 1000, true);
  sendAT("AT+HTTPPARA=\"URL\",\"" + serverUrl + "\"", 1000, true);
  sendAT("AT+HTTPPARA=\"CONTENT\",\"multipart/form-data; boundary=myboundary\"", 1000, true);
  // เพิ่มบรรทัดนี้ลงไป เพื่อทะลุหน้า Warning ของ Ngrok
  sendAT("AT+HTTPPARA=\"USERDATA\",\"ngrok-skip-browser-warning: true\"", 1000, true);

  // สร้าง Header/Footer
  String head = "--myboundary\r\nContent-Disposition: form-data; name=\"image\"; filename=\"meter.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--myboundary--\r\n";

  // คำนวณขนาด
  uint32_t totalLen = head.length() + fb->len + tail.length();
  
  Serial.printf("Total payload size: %d bytes\n", totalLen);
  // สั่ง HTTPDATA (ให้เวลา 60 วิในการส่งข้อมูล)
  sim800.print("AT+HTTPDATA=" + String(totalLen) + ",60000\r\n"); 
  
  delay(1000); // รอคำว่า DOWNLOAD
  
  // ส่งข้อมูล
  Serial.println("Writing Data...");
  sim800.print(head);                 
  // เขียนข้อมูลทีละนิด (ป้องกัน Buffer เต็ม)
  int chunkSize = 1024; // ส่งทีละ 1KB
  for (size_t i = 0; i < fb->len; i += chunkSize) {
    size_t len = (i + chunkSize < fb->len) ? chunkSize : (fb->len - i);
    sim800.write(fb->buf + i, len);
    // delay(10); // ถ้าส่งเร็วไปให้เปิดบรรทัดนี้
  }
   
  sim800.print(tail);                 

  delay(1000);

  // สั่ง POST (Action 1)
  Serial.println("POST Action...");
  String response = sendAT("AT+HTTPACTION=1", 20000, true); // รอนานๆ เผื่อเน็ตช้า

  if (response.indexOf("+HTTPACTION: 1,200") != -1) {
    Serial.println("\n✅ Upload Success! (Status 200)");
  } else {
    Serial.println("\n❌ Upload Failed!");
    sendAT("AT+HTTPREAD", 2000, true); // อ่าน Error
  }

  sendAT("AT+HTTPTERM", 1000, true);
}