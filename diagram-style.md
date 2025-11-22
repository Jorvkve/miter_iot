```mermaid
graph LR %% <-- ปรับตรงนี้จาก TD เป็น LR

    subgraph "อุปกรณ์ (Device)"
        direction LR
        A[ESP32-CAM] -- "1. ถ่ายภาพ" --> B(มิเตอร์ไฟฟ้า)
        A -- "2. ส่งภาพ (HTTP POST)" --> C(SIM800L)
    end

    subgraph "เครือข่าย (Network)"
        direction LR
        C -- "3. เครือข่ายมือถือ (GPRS/4G)" --> D[Backend Server]
    end

    subgraph "Backend Server (Node.js)"
        direction TB
        D -- "4. รับไฟล์ (API: POST /upload)" --> E[Express Route]
        E -- "5. ประมวลผลภาพ" --> F["บริการ OCR (Tesseract.js)"]
        F -- "6. ดึงข้อความ (ตัวเลข)" --> G[Business Logic]
        G -- "7. บันทึกข้อมูล (INSERT)" --> H[(ฐานข้อมูล MySQL)]
        
        I["API: GET /meter-data"] -- "9. ขอข้อมูล (SELECT)" --> H
        H -- "10. ส่งข้อมูล" --> I
    end

    subgraph "ผู้ใช้งาน (Frontend)"
        direction TB
        J(เบราว์เซอร์ผู้ใช้) -- "12. รับข้อมูล (JSON)" --> K[Google Charts API]
        K -- "13. แสดงผลกราฟ" --> L[แดชบอร์ด]
    end

    %% --- การเชื่อมต่อข้ามกล่อง (Cross-Subgraph Connections) ---
    %% การเชื่อมต่อส่วนนี้จะดูสะอาดตาขึ้นมากในแนวนอน
    I -- "11. ส่ง JSON ให้ Client" --> J
    J -- "8. โหลดหน้าเว็บ (HTML/CSS/JS)" --> I
```