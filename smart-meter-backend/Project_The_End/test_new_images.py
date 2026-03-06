from ultralytics import YOLO
import cv2
import os

model = YOLO("runs/detect/train5/weights/best.pt")

folder = "test_images_unseen"

for file in os.listdir(folder):

    if not (file.endswith(".jpg") or file.endswith(".png")):
        continue

    path = os.path.join(folder, file)

    img = cv2.imread(path)

    if img is None:
        continue

    h, w = img.shape[:2]

    results = model(img, conf=0.25)

    digits = []

    for box, cls, conf in zip(
        results[0].boxes.xyxy,
        results[0].boxes.cls,
        results[0].boxes.conf):

        x1 = int(box[0])
        x2 = int(box[2])

        center_x = (x1 + x2) // 2

        digits.append((center_x, int(cls), float(conf)))

    if len(digits) == 0:
        print(file, "-> No digits detected")
        continue

    # เลือก 5 digit ที่ confidence สูงสุด
    digits = sorted(digits, key=lambda x: x[2], reverse=True)[:5]

    # เรียงจากซ้ายไปขวา
    digits = sorted(digits, key=lambda x: x[0])

    meter = "".join(str(d[1]) for d in digits)

    print(file, "->", meter)