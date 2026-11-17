import zlib
import struct
import math
import os

os.makedirs("icons", exist_ok=True)

def make_png(width, height, rgba_data):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    header = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filter type 0 (None)
        raw.extend(rgba_data[y * width * 4 : (y + 1) * width * 4])
    idat = zlib.compress(bytes(raw), 9)
    return header + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')

def render_icon(size, is_maskable=False):
    # Create bytearray for RGBA
    buf = bytearray(size * size * 4)
    cx, cy = size / 2.0, size / 2.0
    corner_radius = size * 0.23 if not is_maskable else 0.0  # Full bleed for maskable
    
    # Safe area scale for maskable: safe area is 80% circle
    scale = 0.70 if is_maskable else 0.85
    
    for y in range(size):
        ny = (y - cy) / (size / 2.0)
        for x in range(size):
            nx = (x - cx) / (size / 2.0)
            
            # Distance from center
            dist = math.sqrt(nx * nx + ny * ny)
            
            # Base background: squircle or full-bleed
            in_shape = True
            alpha_bg = 1.0
            
            if not is_maskable:
                # Rounded rectangle (squircle)
                rx = abs(x - cx)
                ry = abs(y - cy)
                half_w = (size * 0.96) / 2.0
                half_h = (size * 0.96) / 2.0
                cr = size * 0.22
                
                dx = rx - (half_w - cr)
                dy = ry - (half_h - cr)
                if dx > 0 and dy > 0:
                    d = math.sqrt(dx * dx + dy * dy)
                    if d > cr:
                        alpha_bg = max(0.0, 1.0 - (d - cr))
                        if alpha_bg <= 0.0:
                            in_shape = False
                elif rx > half_w or ry > half_h:
                    in_shape = False
            
            if not in_shape or alpha_bg <= 0.0:
                idx = (y * size + x) * 4
                buf[idx] = 0
                buf[idx+1] = 0
                buf[idx+2] = 0
                buf[idx+3] = 0
                continue
            
            # Radiant Gradient Background: Deep Orange (#c2410c) to Bright Orange (#ea580c) to Gold (#f59e0b)
            # Diagonal gradient from top-left to bottom-right
            t = (nx + ny + 2.0) / 4.0
            t = max(0.0, min(1.0, t))
            
            # Gradient colors:
            # t=0: (234, 88, 12)  # Brand orange
            # t=1: (245, 158, 11) # Golden amber
            r_bg = int(234 * (1 - t) + 245 * t)
            g_bg = int(88 * (1 - t) + 158 * t)
            b_bg = int(12 * (1 - t) + 11 * t)
            
            # Default pixel is background
            r, g, b, a = r_bg, g_bg, b_bg, int(255 * alpha_bg)
            
            # Draw Foreground Graphics (scaled to center)
            # Normalized coordinates for icon elements
            gx = (x - cx) / (cx * scale)
            gy = (y - cy) / (cy * scale)
            
            # 1. Food Bowl base (half ellipse / bowl shape at bottom)
            # Bowl sits between gy in [0.05, 0.55], gx in [-0.60, 0.60]
            bowl_y = gy - 0.15
            if 0.0 <= bowl_y <= 0.40:
                width_at_y = 0.60 * (1.0 - 0.25 * (bowl_y / 0.40))
                if abs(gx) <= width_at_y:
                    # Bottom curve
                    curve_check = (gx / width_at_y) ** 2 + ((bowl_y - 0.0) / 0.40) ** 2
                    if curve_check <= 1.05:
                        # Inside white bowl
                        r, g, b = 255, 255, 255
                        # Inner bowl shadow / contour
                        if abs(gx) > width_at_y - 0.08 or bowl_y > 0.32:
                            r, g, b = 254, 243, 199 # Amber tint rim
            
            # Bowl rim top (ellipse at gy ~ 0.15)
            rim_dist = (gx / 0.60) ** 2 + ((gy - 0.15) / 0.10) ** 2
            if rim_dist <= 1.0:
                r, g, b = 255, 255, 255
            
            # 2. Food mound / Jollof rice dome rising from bowl
            # gy in [-0.22, 0.15], gx in [-0.48, 0.48]
            dome_dist = (gx / 0.48) ** 2 + ((gy - 0.08) / 0.28) ** 2
            if dome_dist <= 1.0 and gy <= 0.15:
                # Rich golden-orange meal color
                r, g, b = 245, 158, 11 # Golden Jollof
                # Texture / highlight on food dome
                if ((gx + 0.1) / 0.32) ** 2 + ((gy - 0.0) / 0.18) ** 2 <= 0.8:
                    r, g, b = 251, 191, 36 # Bright yellow highlight
            
            # 3. Floating Steam / Flavor Swirls rising up
            # Left steam swirl
            s1_x = gx + 0.22 - 0.06 * math.sin(gy * 8.0)
            if -0.58 <= gy <= -0.15 and abs(s1_x) < 0.045:
                r, g, b = 255, 255, 255
            
            # Center steam swirl (taller)
            s2_x = gx - 0.06 * math.sin(gy * 9.0)
            if -0.72 <= gy <= -0.15 and abs(s2_x) < 0.05:
                r, g, b = 255, 255, 255
                
            # Right steam swirl
            s3_x = gx - 0.22 + 0.06 * math.sin(gy * 8.0)
            if -0.58 <= gy <= -0.15 and abs(s3_x) < 0.045:
                r, g, b = 255, 255, 255
            
            # 4. Sparkle Star (✨) in top right
            star_gx = gx - 0.48
            star_gy = gy - (-0.48)
            star_dist = math.sqrt(star_gx ** 2 + star_gy ** 2)
            if star_dist < 0.18:
                # 4-pointed star
                if abs(star_gx * star_gy) < 0.005:
                    r, g, b = 255, 255, 255
            
            # Save RGBA
            idx = (y * size + x) * 4
            buf[idx] = r
            buf[idx+1] = g
            buf[idx+2] = b
            buf[idx+3] = a
            
    return bytes(buf)

# Generate Icons
sizes = [(192, False), (512, False), (192, True), (512, True), (180, False)]

for s, maskable in sizes:
    suffix = "-maskable" if maskable else ""
    if s == 180:
        filename = "icons/apple-touch-icon.png"
    else:
        filename = f"icons/icon-{s}{suffix}.png"
    
    print(f"Generating {filename} ({s}x{s})...")
    raw_pixels = render_icon(s, is_maskable=maskable)
    png_bytes = make_png(s, s, raw_pixels)
    with open(filename, "wb") as f:
        f.write(png_bytes)
    print(f"Wrote {filename} ({len(png_bytes)} bytes)")

print("All PNG icons generated successfully!")
