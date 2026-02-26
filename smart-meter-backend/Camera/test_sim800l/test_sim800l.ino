#include "esp_camera.h"
#include <HardwareSerial.h>

// --- 1. ตั้งค่าพิน SIM800L ---
#define SIM800_RX_PIN 13 
#define SIM800_TX_PIN 14 

// --- 2. ตั้งค่า Server (⚠️ ต้องแก้ URL ให้ตรงกับจอดำบนคอมเสมอ!) ---
String serverUrl = "http://meter-test-02.loca.lt/api/upload"; 

// ตั้งค่า APN
String apn = "internet"; 

HardwareSerial sim800(1);

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
  
  // ตั้งค่าไฟแฟลช
  pinMode(4, OUTPUT);
  digitalWrite(4, LOW);

  sim800.begin(115200, SERIAL_8N1, SIM800_RX_PIN, SIM800_TX_PIN);
  delay(1000);
  
  Serial.println("-----------------------------------");
  Serial.println("Configuring SIM800L...");
  // บังคับความเร็ว 115200
  sim800.println("AT+IPR=115200");
  delay(500);
  sim800.end();
  delay(500);
  sim800.begin(115200, SERIAL_8N1, SIM800_RX_PIN, SIM800_TX_PIN);
  delay(1000);
  
  sim800.println("ATE0"); // ปิด Echo เพื่อลดขยะ

  // เริ่มต้นกล้อง
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
    // ✅ ใช้ QVGA (320x240) เพื่อให้ไฟล์เล็ก (3-5KB) ส่งผ่านแน่นอน
    config.frame_size = FRAMESIZE_QVGA; 
    config.jpeg_quality = 12; // ปรับให้ชัดหน่อยเพราะภาพเล็ก
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
  Serial.println("Camera Ready! 📷");
  
  // เชื่อมต่อเน็ตครั้งแรก
  initGPRS();
}

void loop() {
  // สั่งถ่ายด้วยการพิมพ์ 'c' ใน Serial Monitor (หรือเปลี่ยนเป็น Timer ก็ได้)
  // แต่แนะนำ Manual Trigger เพื่อทดสอบความเสถียร
  if (Serial.available()) {
    char cmd = Serial.read();
    if (cmd == 'c' || cmd == 'C') {
       Serial.println("\n--- Starting New Round ---");
       while(sim800.available()) sim800.read();
       
       // รีเซ็ตเน็ตทุกรอบ
       initGPRS();

       Serial.println("\n--- Taking Photo ---");
       
       // เปิดไฟแฟลช + ถ่ายทิ้ง 1 รูป (แก้ภาพมืด)
       digitalWrite(4, HIGH);
       delay(300);
       camera_fb_t * fb = esp_camera_fb_get();
       esp_camera_fb_return(fb); 
       delay(100);

       // ถ่ายจริง
       fb = esp_camera_fb_get();
       digitalWrite(4, LOW);

       if(!fb) {
         Serial.println("Camera capture failed");
         return;
       }
       Serial.printf("Picture taken! Size: %d bytes\n", fb->len);
       sendImageToBackend(fb);
       esp_camera_fb_return(fb); 
    }
  }
  delay(100);
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

// --- ฟังก์ชันเชื่อมต่อ GPRS (Deep Clean) ---
void initGPRS() {
  Serial.println("Initializing SIM800L...");
  sendAT("AT+CIPSHUT", 1000, true); // ตัดทุกอย่างทิ้งก่อน
  delay(1000);
  sendAT("AT", 1000, true);
  
  // เช็คซิมและสัญญาณ (แบบย่อ)
  sendAT("AT+CPIN?", 1000, true);
  sendAT("AT+CREG?", 1000, true);
  sendAT("AT+CSQ", 1000, true);

  Serial.println("Connecting to GPRS...");
  sendAT("AT+SAPBR=3,1,\"Contype\",\"GPRS\"", 1000, true);
  sendAT("AT+SAPBR=3,1,\"APN\",\"" + apn + "\"", 1000, true);
  
  for(int i=0; i<3; i++) {
    sendAT("AT+SAPBR=1,1", 5000, true); 
    String ip = sendAT("AT+SAPBR=2,1", 2000, true); 
    if(ip.indexOf("\"0.0.0.0\"") == -1 && ip.indexOf("ERROR") == -1) {
       Serial.println("✅ GPRS Online!");
       return;
    }
    sendAT("AT+SAPBR=0,1", 1000, true); 
    delay(2000);
  }
}

// --- ฟังก์ชันส่งรูป ---
void sendImageToBackend(camera_fb_t * fb) {
  Serial.println("Starting Upload...");
  sendAT("AT+HTTPTERM", 1000, true); 
  while(sim800.available()) sim800.read();
  
  sendAT("AT+SAPBR=2,1", 2000, true);
  sendAT("AT+HTTPINIT", 1000, true);
  sendAT("AT+HTTPPARA=\"CID\",1", 1000, true);
  sendAT("AT+HTTPPARA=\"URL\",\"" + serverUrl + "\"", 1000, true);
  
  // Header สำหรับ LocalTunnel
  sendAT("AT+HTTPPARA=\"USERDATA\",\"Bypass-Tunnel-Reminder: true\"", 1000, true); 
  sendAT("AT+HTTPPARA=\"CONTENT\",\"multipart/form-data; boundary=myboundary\"", 1000, true);

  String head = "--myboundary\r\nContent-Disposition: form-data; name=\"image\"; filename=\"meter.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--myboundary--\r\n";
  uint32_t totalLen = head.length() + fb->len + tail.length();
  
  Serial.printf("Total payload size: %d bytes\n", totalLen);
  sim800.println("AT+HTTPDATA=" + String(totalLen) + ",60000");
  
  long int startWait = millis();
  boolean readyToUpload = false;
  while(millis() - startWait < 5000) { 
    if(sim800.find("DOWNLOAD")) {
      readyToUpload = true;
      break;
    }
  }

  if(!readyToUpload) {
    Serial.println("❌ Error: No DOWNLOAD prompt");
    sendAT("AT+HTTPTERM", 1000, true);
    sendAT("AT+SAPBR=0,1", 1000, true);
    return;
  }
  
  Serial.println("Writing Data...");
  sim800.print(head);                 
  
  int chunkSize = 1024;
  for (size_t i = 0; i < fb->len; i += chunkSize) {
    size_t len = (i + chunkSize < fb->len) ? chunkSize : (fb->len - i);
    sim800.write(fb->buf + i, len);
    delay(50); // ✅ เพิ่ม Delay ตรงนี้ ช่วยให้ส่งผ่านง่ายขึ้น
  }
  
  sim800.print(tail);                 
  delay(1000);
  
  Serial.println("\nPOST Action...");
  String response = sendAT("AT+HTTPACTION=1", 120000, true); // รอ 2 นาที

  if (response.indexOf("+HTTPACTION: 1,200") != -1) {
    Serial.println("\n✅ Upload Success! (Status 200)");
  } else {
    Serial.println("\n❌ Upload Failed!");
  }

  sendAT("AT+HTTPTERM", 1000, true);
  sendAT("AT+SAPBR=0,1", 1000, true);
}