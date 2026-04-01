import cv2
import numpy as np
import face_recognition
from typing import List, Tuple

import os

# YuNet DNN face detector - far superior to Haar/HOG at distances and angles
_YUNET_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "yunet.onnx")
_yunet = cv2.FaceDetectorYN.create(
    _YUNET_PATH, "", (320, 320),
    score_threshold=0.7,
    nms_threshold=0.3,
    top_k=5000
)

class FaceProcessor:
    """Improved face detection and recognition with better accuracy for poor lighting and distances"""

    # Configurable parameters
    MIN_FACE_SIZE = 15  # Minimum face width in pixels (lowered for better distance detection)
    ENCODING_JITTERS = 5  # Higher = more accurate encoding but slower
    DISTANCE_THRESHOLD = 0.55  # Lower = stricter matching (0.6 is default, we use 0.55 for good accuracy)

    @staticmethod
    def preprocess_image(frame: np.ndarray) -> np.ndarray:
        """
        Enhance image quality for better face detection in poor lighting and shadows.
        Uses gamma correction + CLAHE for robustness across environments.
        """
        # Auto gamma correction: brighten dark images toward target brightness of 128
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        avg_brightness = np.mean(gray)
        target = 128.0 / 255.0
        normalized = max(avg_brightness / 255.0, 0.01)
        gamma = np.log(normalized) / np.log(target)  # correct formula: raises to 1/gamma
        gamma = np.clip(gamma, 0.5, 3.0)
        inv_gamma = 1.0 / gamma

        table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in range(256)]).astype("uint8")
        gamma_corrected = cv2.LUT(frame, table)

        # CLAHE on luminance channel for local contrast enhancement (handles shadows)
        lab = cv2.cvtColor(gamma_corrected, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(6, 6))
        l = clahe.apply(l)
        enhanced = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)

        # Bilateral filter to reduce noise while preserving face edges
        denoised = cv2.bilateralFilter(enhanced, 7, 50, 50)

        return denoised

    @staticmethod
    def detect_faces_yunet(rgb_frame: np.ndarray) -> List[Tuple]:
        """
        Detect faces using YuNet DNN - handles distance, angles, and poor lighting
        much better than Haar or HOG.
        Returns face locations in (top, right, bottom, left) for face_recognition.
        """
        h, w = rgb_frame.shape[:2]
        bgr = cv2.cvtColor(rgb_frame, cv2.COLOR_RGB2BGR)

        _yunet.setInputSize((w, h))
        _, detections = _yunet.detect(bgr)

        if detections is None:
            return []

        face_locations = []
        for det in detections:
            x, y, fw, fh = int(det[0]), int(det[1]), int(det[2]), int(det[3])
            top    = max(0, y)
            left   = max(0, x)
            bottom = min(h, y + fh)
            right  = min(w, x + fw)
            face_locations.append((top, right, bottom, left))

        return face_locations

    @staticmethod
    def detect_faces_with_upsampling(
        rgb_frame: np.ndarray,
        use_cnn: bool = False,
        upsample_num_times: int = 1
    ) -> List[Tuple]:
        """
        Detect faces with optional upsampling for distant faces.

        Args:
            rgb_frame: RGB format image
            use_cnn: Use CNN model (slower but more accurate) instead of HOG
            upsample_num_times: Upsample image N times for distant faces (1=normal, 2=2x larger search)

        Returns:
            List of face locations (top, right, bottom, left)
        """
        model = "cnn" if use_cnn else "hog"
        face_locations = face_recognition.face_locations(
            rgb_frame,
            number_of_times_to_upsample=upsample_num_times,
            model=model
        )
        return face_locations

    @staticmethod
    def filter_faces_by_size(
        face_locations: List[Tuple],
        min_face_size: int = MIN_FACE_SIZE
    ) -> List[Tuple]:
        """
        Filter out very small faces that are likely false positives.

        Args:
            face_locations: List of face locations
            min_face_size: Minimum face width in pixels

        Returns:
            Filtered list of face locations
        """
        filtered = []
        for top, right, bottom, left in face_locations:
            width = right - left
            height = bottom - top
            if width >= min_face_size and height >= min_face_size:
                filtered.append((top, right, bottom, left))
        return filtered

    @staticmethod
    def get_face_encodings(
        rgb_frame: np.ndarray,
        face_locations: List[Tuple],
        num_jitters: int = ENCODING_JITTERS
    ) -> List[np.ndarray]:
        """
        Generate face encodings with higher accuracy (more jitters).

        Args:
            rgb_frame: RGB format image
            face_locations: List of face locations
            num_jitters: Number of times to resample (1=fast/low-accuracy, 5+= slow/high-accuracy)

        Returns:
            List of 128-dimensional face encodings
        """
        encodings = face_recognition.face_encodings(
            rgb_frame,
            face_locations,
            num_jitters=num_jitters,
            model="small"
        )
        return encodings

    @staticmethod
    def compare_faces_with_distance(
        known_encodings: List[np.ndarray],
        face_encoding: np.ndarray,
        distance_threshold: float = DISTANCE_THRESHOLD
    ) -> Tuple[bool, float]:
        """
        Compare a face encoding against known encodings with confidence score.

        Args:
            known_encodings: List of known face encodings
            face_encoding: Face encoding to compare
            distance_threshold: Maximum distance for a match

        Returns:
            (is_match: bool, confidence: float) - confidence is 1.0 - distance (0.0-1.0)
        """
        if not known_encodings:
            return False, 0.0

        # Get distances to all known faces
        distances = face_recognition.face_distance(known_encodings, face_encoding)

        if len(distances) == 0:
            return False, 0.0

        # Find the closest match
        min_distance = np.min(distances)
        is_match = min_distance <= distance_threshold
        confidence = 1.0 - min_distance  # Convert distance to confidence score

        return is_match, confidence

    @staticmethod
    def is_image_blurry(frame: np.ndarray, threshold: float = 100.0) -> bool:
        """
        Detect if image is too blurry using Laplacian variance.

        Args:
            frame: Image frame
            threshold: Laplacian variance threshold (lower = blurrier)

        Returns:
            True if image is blurry
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        return laplacian_var < threshold

    @staticmethod
    def is_image_too_dark(frame: np.ndarray, threshold: float = 30.0) -> bool:
        """
        Detect if image is too dark to process.

        Args:
            frame: Image frame
            threshold: Average brightness threshold (0-255)

        Returns:
            True if image is too dark
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        avg_brightness = np.mean(gray)
        return avg_brightness < threshold
