#!/usr/bin/env python3
"""Converte stun_gun.zip (ou a pasta extraída) em stungun.js (window.STUNGUN_GLTF = string JSON do glTF com buffer e imagens embutidos).
Uso: python3 convert_stungun.py stun_gun.zip stungun.js [tamanho_max_textura=512]"""
import sys, json, base64, io, zipfile, os
from PIL import Image
src = sys.argv[1]; out = sys.argv[2]; mx = int(sys.argv[3]) if len(sys.argv) > 3 else 512
if os.path.isdir(src):
    rd = lambda p: open(os.path.join(src, p), 'rb').read()
else:
    z = zipfile.ZipFile(src); rd = lambda p: z.read(p)
g = json.loads(rd('scene.gltf').decode('utf8'))
for b in g['buffers']:
    b['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(rd(b['uri'])).decode()
for im in g.get('images', []):
    img = Image.open(io.BytesIO(rd(im['uri']))).convert('RGB')
    if max(img.size) > mx:
        r = mx / max(img.size); img = img.resize((max(1, round(img.width * r)), max(1, round(img.height * r))), Image.LANCZOS)
    bio = io.BytesIO(); img.save(bio, 'PNG', optimize=True)
    im['uri'] = 'data:image/png;base64,' + base64.b64encode(bio.getvalue()).decode()
g.pop('extensionsUsed', None); g.pop('extensionsRequired', None)
for m in g.get('materials', []): m.pop('extensions', None)   # KHR_materials_specular: o GLTFLoader r128 ignora; removido por segurança
s = json.dumps(g, separators=(',', ':'))
open(out, 'w', encoding='utf8').write('/* Stun Gun — "stun gun" por elite large cameraman (Sketchfab), CC-BY 4.0: https://sketchfab.com/3d-models/stun-gun-b9b2ebbc5af941f69e918d866823fa26\n   Gerado por convert_stungun.py. */\nwindow.STUNGUN_GLTF=' + json.dumps(s) + ';\n')
print('ok', out, os.path.getsize(out), 'bytes')
