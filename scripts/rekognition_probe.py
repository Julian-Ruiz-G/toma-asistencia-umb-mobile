import boto3
import io
import os
from PIL import Image, ImageOps

# CONFIG
REGION = 'us-east-2'                # <<-- AJUSTA a la región donde tienes la colección y la tabla
COLLECTION = 'famouspersons'        # <<-- nombre de tu colección
DDB_TABLE = 'face_recognition'      # <<-- tabla DynamoDB
FACE_MATCH_THRESHOLD = 70           # baja a ~60 para pruebas si quieres
MAX_MATCHES = 5
DEBUG_SAVE_CROPS = True             # guarda los crops en disco para inspección

# Clientes
rekognition = boto3.client('rekognition', region_name=REGION)
dynamodb = boto3.client('dynamodb', region_name=REGION)

def load_image_bytes(path):
    img = Image.open(path)
    img = ImageOps.exif_transpose(img)   # corrige rotación EXIF
    img = img.convert('RGB')
    buf = io.BytesIO()
    img.save(buf, 'JPEG')
    return img, buf.getvalue()

def bytes_from_pil(img):
    buf = io.BytesIO()
    img.save(buf, 'JPEG')
    return buf.getvalue()

image_path = input("Enter path of the image to check: ").strip()
img, image_bytes = load_image_bytes(image_path)
width, height = img.size
print(f"Image loaded: {image_path} (w={width}, h={height})")

# 1) Detectar caras en la imagen completa
try:
    detect_resp = rekognition.detect_faces(Image={'Bytes': image_bytes}, Attributes=['DEFAULT'])
except Exception as e:
    print("Error calling detect_faces:", e)
    raise

face_details = detect_resp.get('FaceDetails', [])
print(f"Detected {len(face_details)} face(s) by Rekognition.")

if not face_details:
    print("No se detectaron rostros en la imagen (detect_faces vacío).")
else:
    any_found = False
    for i, fd in enumerate(face_details, start=1):
        box = fd['BoundingBox']
        # coordenadas en píxeles
        left = int(box['Left'] * width)
        top = int(box['Top'] * height)
        w_box = int(box['Width'] * width)
        h_box = int(box['Height'] * height)

        # Añadir padding (20% del lado mayor)
        pad = int(0.20 * max(w_box, h_box))
        l = max(0, left - pad)
        t = max(0, top - pad)
        r = min(width, left + w_box + pad)
        b = min(height, top + h_box + pad)

        # Evitar crops cero o negativos
        if r <= l or b <= t:
            print(f"Skipping face {i}: invalid crop coordinates.")
            continue

        cropped = img.crop((l, t, r, b))

        # Si el crop es muy pequeño, redimensiona (mantén razonablemente buena calidad)
        min_pixels = 120
        if cropped.width < min_pixels or cropped.height < min_pixels:
            new_w = max(min_pixels, cropped.width)
            new_h = max(min_pixels, cropped.height)
            cropped = cropped.resize((new_w, new_h), Image.LANCZOS)

        if DEBUG_SAVE_CROPS:
            os.makedirs('debug_faces', exist_ok=True)
            fn = f"debug_faces/face_{i}.jpg"
            cropped.save(fn)
            print(f"Saved crop for face {i} -> {fn} (w={cropped.width}, h={cropped.height})")

        face_bytes = bytes_from_pil(cropped)

        # 2) Buscar cada rostro recortado en la colección
        try:
            search_resp = rekognition.search_faces_by_image(
                CollectionId=COLLECTION,
                Image={'Bytes': face_bytes},
                FaceMatchThreshold=FACE_MATCH_THRESHOLD,
                MaxFaces=MAX_MATCHES
            )
        except Exception as e:
            print(f"Error calling search_faces_by_image for face {i}:", e)
            continue

        matches = search_resp.get('FaceMatches', [])
        if not matches:
            print(f"Face {i}: no matches (threshold={FACE_MATCH_THRESHOLD}).")
            continue

        for m in matches:
            fid = m['Face']['FaceId']
            conf = m['Face']['Confidence']
            print(f"Face {i} match: FaceId={fid}, Confidence={conf:.2f}%")

            # 3) Buscar metadata en DynamoDB
            try:
                face_item = dynamodb.get_item(TableName=DDB_TABLE, Key={'RekognitionId': {'S': fid}})
            except Exception as e:
                print("DynamoDB get_item error:", e)
                continue

            if 'Item' in face_item:
                name = face_item['Item'].get('FullName', {}).get('S', '<sin FullName>')
                print(f"→ Found Person: {name} (from DynamoDB)")
                any_found = True
            else:
                print("→ FaceId not present in DynamoDB table.")

    if not any_found:
        print("Ninguna persona reconocida en la imagen (tras buscar todas las caras detectadas).")
