from ultralytics import YOLO
import cv2
import os

model = YOLO("runs/detect/train4/weights/best.pt")

image_folder = "meter_dataset/images/train"
label_folder = "meter_dataset/labels/train"

correct = 0
total = 0

for file in os.listdir(image_folder):

    if file.endswith(".jpg") or file.endswith(".png"):

        img_path = os.path.join(image_folder, file)
        label_path = os.path.join(label_folder, file.rsplit(".",1)[0] + ".txt")

        img = cv2.imread(img_path)

        results = model(img, conf=0.25)

        digits = []

        for box, cls, conf in zip(
            results[0].boxes.xyxy,
            results[0].boxes.cls,
            results[0].boxes.conf
        ):

            x1 = int(box[0])
            x2 = int(box[2])

            center_x = (x1 + x2) // 2

            digits.append((center_x, int(cls), float(conf)))

        if len(digits) == 0:
            continue

        # เลือก 5 detection ที่ confidence สูงสุด
        digits = sorted(digits, key=lambda x: x[2], reverse=True)[:5]

        # เรียงจากซ้ายไปขวา
        digits = sorted(digits, key=lambda x: x[0])

        pred = "".join(str(d[1]) for d in digits)

        if os.path.exists(label_path):

            real_digits = []

            with open(label_path) as f:

                for line in f:

                    parts = line.split()

                    cls = int(parts[0])
                    x_center = float(parts[1])

                    real_digits.append((x_center, cls))

            real_digits = sorted(real_digits, key=lambda x: x[0])

            real = "".join(str(d[1]) for d in real_digits)

            if pred == real:
                correct += 1
                status = "✓"
            else:
                status = "✗"

            print(file, "→", pred, "| real:", real, status)

            total += 1

print("\nCorrect:", correct)
print("Total:", total)

if total > 0:
    print("Accuracy:", round(correct/total*100,2), "%")