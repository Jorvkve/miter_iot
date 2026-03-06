from ultralytics import YOLO
import cv2
import os

model = YOLO("runs/detect/train4/weights/best.pt")

folder = "uploads"

for file in os.listdir(folder):

    if file.endswith(".jpg") or file.endswith(".png"):

        path = os.path.join(folder, file)

        img = cv2.imread(path)

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

        if len(digits) > 5:
            digits = sorted(digits, key=lambda x: x[2], reverse=True)[:5]

        digits = sorted(digits, key=lambda x: x[0])

        meter = "".join(str(d[1]) for d in digits)

        print(file, "->", meter)