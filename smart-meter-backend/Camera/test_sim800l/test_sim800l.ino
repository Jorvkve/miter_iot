#include "esp_camera.h"
#include <HardwareSerial.h>

// --- 1. ตั้งค่าพิน SIM800L ---
#define SIM800_RX_PIN 13 // ต่อกับ TX ของ SIM800L
#define SIM800_TX_PIN 14 // ต่อกับ RX ของ SIM800L

// --- 2. ตั้งค่า Server (⚠️ แก้ IP ตรงนี้ให้ตรงกับเครื่องคอมฯ ของคุณ) ---
// วิธีหา IP: เปิด cmd -> พิมพ์ ipconfig -> ดู IPv4
String serverUrl = "http://meter-test-02.loca.lt/api/upload"; 

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
  
  // 1. เริ่มที่ 9600 ก่อน (เผื่อบอร์ดจำค่าเก่าอยู่)
  sim800.begin(9600, SERIAL_8N1, SIM800_RX_PIN, SIM800_TX_PIN);
  delay(1000);
  
  Serial.println("-----------------------------------");
  Serial.println("Configuring SIM800L Baud Rate...");

  // 2. สั่งให้ SIM800L เปลี่ยนความเร็วเป็น 115200
  sim800.println("AT+IPR=115200");
  delay(500); // รอให้มันตั้งค่าเสร็จ
  
  // 3. ปิดการเชื่อมต่อเดิม แล้วเปิดใหม่ที่ 115200
  sim800.end(); 
  delay(500);
  sim800.begin(115200, SERIAL_8N1, SIM800_RX_PIN, SIM800_TX_PIN);
  delay(1000);

  // 4. ทดสอบว่าคุยกันรู้เรื่องไหม
  sim800.println("AT");
  delay(100);
  if(sim800.available()) {
    Serial.println("✅ Speed changed to 115200 success!");
    // ปิด Echo ทันที
    sim800.println("ATE0");
    while(sim800.available()) sim800.read(); 
  } else {
    Serial.println("❌ Speed change failed! Please check wiring.");
  }
  
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
    config.frame_size = FRAMESIZE_SVGA; // 800x600
    // ❌ ของเดิม: 12 (ชัดแต่ไฟล์ใหญ่ ส่งช้า)
    // config.jpeg_quality = 12;           

    // ✅ ของใหม่: 30 (ไฟล์เล็กลงครึ่งนึง ส่งไวขึ้นมาก)
    config.jpeg_quality = 30;           
    config.fb_count = 1;
  } else {
    config.frame_size = FRAMESIZE_VGA;
    config.jpeg_quality = 30; // แก้ตรงนี้ด้วย
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
  Serial.println("\n--- Starting New Round ---");

  // เคลียร์ค่าขยะก่อนเริ่ม
  while(sim800.available()) sim800.read();
  
  // ต่อเน็ตใหม่ (ซึ่งตอนนี้มี CIPSHUT อยู่ข้างในแล้ว จะสะอาดขึ้น)
  initGPRS();

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
  
  Serial.println("Waiting 2 minute for next round...");
  delay(120000); 
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
  
  // [เพิ่มตรงนี้] สั่งปิด connection เก่าที่อาจจะค้างอยู่ ทิ้งให้หมด!
  sendAT("AT+CIPSHUT", 1000, true); 
  delay(1000);
  
  sendAT("AT", 1000, true);
  
  // ... (โค้ดเช็ค SIM และ CREG อันเดิม) ...
  // 1. เช็คซิม
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

  // 2. เช็คสัญญาณ
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

  sendAT("AT+CSQ", 1000, true);

  // 3. ตั้งค่า GPRS
  Serial.println("Connecting to GPRS...");
  sendAT("AT+SAPBR=3,1,\"Contype\",\"GPRS\"", 1000, true);
  sendAT("AT+SAPBR=3,1,\"APN\",\"" + apn + "\"", 1000, true);
  
  // 4. เชื่อมต่อ (อันเดิม)
  for(int i=0; i<3; i++) {
    sendAT("AT+SAPBR=1,1", 5000, true); 
    String ip = sendAT("AT+SAPBR=2,1", 2000, true); 
    if(ip.indexOf("\"0.0.0.0\"") == -1 && ip.indexOf("ERROR") == -1) {
       Serial.println("✅ GPRS Online! IP Obtained.");
       return;
    }
    // ถ้าต่อไม่ติด ให้สั่งปิดแล้วลองใหม่
    sendAT("AT+SAPBR=0,1", 1000, true); 
    Serial.println("Retrying GPRS connection...");
    delay(2000);
  }
}

// --- ฟังก์ชันส่งรูป (Multipart POST) ---
void sendImageToBackend(camera_fb_t * fb) {
  Serial.println("Starting Upload...");
  
  // ล้าง Session เก่า
  sendAT("AT+HTTPTERM", 1000, true); 
  while(sim800.available()) sim800.read();
  
  // เช็คเน็ต
  sendAT("AT+SAPBR=2,1", 2000, true);

  sendAT("AT+HTTPINIT", 1000, true);
  sendAT("AT+HTTPPARA=\"CID\",1", 1000, true);
  
  // ⚠️ อย่าลืมแก้ serverUrl ด้านบนสุด ให้เป็น http://... (LocalTunnel)
  sendAT("AT+HTTPPARA=\"URL\",\"" + serverUrl + "\"", 1000, true);
  
  // ✅ กลับมาใช้ Header สำหรับ LocalTunnel
  sendAT("AT+HTTPPARA=\"USERDATA\",\"Bypass-Tunnel-Reminder: true\"", 1000, true); 
  
  sendAT("AT+HTTPPARA=\"CONTENT\",\"multipart/form-data; boundary=myboundary\"", 1000, true);

  String head = "--myboundary\r\nContent-Disposition: form-data; name=\"image\"; filename=\"meter.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--myboundary--\r\n";
  uint32_t totalLen = head.length() + fb->len + tail.length();
  
  Serial.printf("Total payload size: %d bytes\n", totalLen);
  
  sim800.println("AT+HTTPDATA=" + String(totalLen) + ",60000");
  
  // รอคำว่า DOWNLOAD
  long int startWait = millis();
  boolean readyToUpload = false;
  while(millis() - startWait < 5000) { 
    if(sim800.find("DOWNLOAD")) {
      readyToUpload = true;
      break;
    }
  }

  if(!readyToUpload) {
    Serial.println("❌ Error: Did not get DOWNLOAD prompt");
    sendAT("AT+HTTPTERM", 1000, true);
    sendAT("AT+SAPBR=0,1", 1000, true); // ปิดเน็ต
    return;
  }
  
  Serial.println("Writing Data...");
  sim800.print(head);                 
  
  int chunkSize = 1024;
  for (size_t i = 0; i < fb->len; i += chunkSize) {
    size_t len = (i + chunkSize < fb->len) ? chunkSize : (fb->len - i);
    sim800.write(fb->buf + i, len);
  }
  
  sim800.print(tail);                 
  
  delay(1000);
  while(sim800.available()) { Serial.write(sim800.read()); } 

  Serial.println("\nPOST Action...");
  String response = sendAT("AT+HTTPACTION=1", 120000, true); 

  if (response.indexOf("+HTTPACTION: 1,200") != -1) {
    Serial.println("\n✅ Upload Success! (Status 200)");
  } else {
    Serial.println("\n❌ Upload Failed!");
    sendAT("AT+HTTPREAD", 2000, true);
  }

  sendAT("AT+HTTPTERM", 1000, true);
  
  // ตัดเน็ตทิ้งทุกครั้งที่จบงาน (เพื่อความเสถียรในรอบหน้า)
  sendAT("AT+SAPBR=0,1", 1000, true);
}