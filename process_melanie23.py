from rembg import remove
from PIL import Image
import sys

input_path = "C:\\Users\\aarons\\Desktop\\P31\\melanie23.jpeg"
output_path = "c:\\Users\\aarons\\.gemini\\antigravity\\scratch\\P31\\src\\assets\\melanie23_rm.png"

try:
    print(f"Loading {input_path}")
    img = Image.open(input_path)
    
    print("Resizing (enhancing resolution)...")
    # Increase resolution by 2x using Lanczos
    new_size = (img.width * 2, img.height * 2)
    img = img.resize(new_size, Image.Resampling.LANCZOS)
    
    print("Removing background...")
    img_nobg = remove(img)
    
    print(f"Saving to {output_path}")
    img_nobg.save(output_path)
    print("Done!")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
