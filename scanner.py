import cv2
import numpy as np
from pyzbar.pyzbar import decode

def decode_image(image_bytes: bytes):
    """
    Decodes an image payload (bytes) and extracts QR/Barcode data.
    Returns a list of dictionaries with type, data, and bounding_box.
    """
    try:
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        # Decode image
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return []

        # Convert to grayscale for better detection
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Pyzbar detection can fail with poor lighting or contrast
        # We will try several preprocessing techniques until a barcode is detected
        images_to_try = [
            gray, # Original Grayscale
            cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1], # Otsu Threshold
            cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2) # Adaptive Threshold
        ]
        
        # Try CLAHE (Contrast Limited Adaptive Histogram Equalization)
        try:
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            clahe_img = clahe.apply(gray)
            images_to_try.append(clahe_img)
            images_to_try.append(cv2.threshold(clahe_img, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1])
        except Exception:
            pass
            
        detected_objects = []
        for test_img in images_to_try:
            detected_objects = decode(test_img)
            if detected_objects:
                break
                
        results = []
        
        for obj in detected_objects:
            obj_type = obj.type
            # Determine standard classification
            if obj_type == 'QRCODE':
                code_type = 'QR'
            else:
                code_type = 'BARCODE'
                
            code_data = obj.data.decode("utf-8")
            
            # polygon contains the (x, y) coordinates of the bounding box
            points = [{"x": pt.x, "y": pt.y} for pt in obj.polygon]
            
            results.append({
                "type": code_type,
                "data": code_data,
                "points": points
            })
            
        return results
    except Exception as e:
        print(f"Error decoding image: {e}")
        return []
