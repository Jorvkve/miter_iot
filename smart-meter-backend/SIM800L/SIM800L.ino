#include <HardwareSerial.h>

// เลือกใช้ขาที่ต่ออยู่ (แนะนำ 13, 12 หรือ 14, 15 เพื่อเลี่ยงปัญหา PSRAM)
#define MODEM_RX 14 
#define MODEM_TX 13 

HardwareSerial SerialGSM(1);

void setup() {
  Serial.begin(115200);
  // ลองเริ่มที่ 9600 ถ้าไม่ได้ค่อยลองเปลี่ยนเป็น 115200
  SerialGSM.begin(9600, SERIAL_8N1, MODEM_RX, MODEM_TX); 
  
  Serial.println("--- SIM800L Signal Debugger ---");
  Serial.println("พิมพ์คำสั่งด้านล่างเพื่อเช็คสัญญาณ:");
}

void loop() {
  if (Serial.available()) SerialGSM.write(Serial.read());
  if (SerialGSM.available()) Serial.write(SerialGSM.read());
}