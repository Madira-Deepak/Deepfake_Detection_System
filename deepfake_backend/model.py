from transformers import pipeline
from PIL import Image
import numpy as np
import cv2
from mtcnn import MTCNN

# Load pretrained deepfake detection model
model = pipeline(
    task="image-classification",
    model="shunda012/vit-deepfake-detector"
)

# Initialize face detector
face_detector = MTCNN()


def extract_faces(image: Image.Image) -> list:
    """
    Detect and return cropped face regions from the image.
    Falls back to the full image if no faces are found.
    """
    img_array = np.array(image)
    faces = face_detector.detect_faces(img_array)
    cropped_faces = []

    for face in faces:
        x, y, w, h = face["box"]
        x, y = max(0, x), max(0, y)

        # Add 10% padding around detected face
        pad_x = int(w * 0.10)
        pad_y = int(h * 0.10)
        x1 = max(0, x - pad_x)
        y1 = max(0, y - pad_y)
        x2 = min(img_array.shape[1], x + w + pad_x)
        y2 = min(img_array.shape[0], y + h + pad_y)

        cropped = img_array[y1:y2, x1:x2]
        if cropped.size == 0:
            continue

        cropped = cv2.resize(cropped, (224, 224))
        cropped_faces.append(Image.fromarray(cropped))

    if not cropped_faces:
        cropped_faces.append(image.resize((224, 224)))

    return cropped_faces


def predict_image(image: Image.Image) -> dict:
    """
    Predict whether the image is REAL or FAKE.
    Returns prediction, confidence, per-class probabilities, and face count.
    """
    faces = extract_faces(image)
    real_scores = []
    fake_scores = []

    for face in faces:
        results = model(face)
        for r in results:
            label = r["label"].lower()
            if label == "real":
                real_scores.append(r["score"])
            elif label == "fake":
                fake_scores.append(r["score"])

    real_prob = float(np.mean(real_scores)) if real_scores else 0.0
    fake_prob = float(np.mean(fake_scores)) if fake_scores else 0.0

    # Normalize in case scores don't sum to 1
    total = real_prob + fake_prob
    if total > 0:
        real_prob /= total
        fake_prob /= total

    if fake_prob > real_prob:
        prediction = "FAKE"
        confidence = fake_prob
    else:
        prediction = "REAL"
        confidence = real_prob

    return {
        "prediction": prediction,
        "confidence_percentage": round(confidence * 100, 2),
        "real_probability": round(real_prob * 100, 2),
        "fake_probability": round(fake_prob * 100, 2),
        "faces_detected": len(faces)
    }