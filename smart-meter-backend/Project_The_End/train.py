from ultralytics import YOLO

# โหลดโมเดลเริ่มต้น
model = YOLO("yolov8n.pt")

# train
model.train(
    data="data_digits.yaml",
    epochs=100,
    imgsz=640
)