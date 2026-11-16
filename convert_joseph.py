#!/usr/bin/env python3
"""Converte Joseph.obj + Joseph.png (Joseph Joestar, JoJo's Bizarre Adventure: Diamond Records) em joseph.js.

SEM otimização: todos os vértices, faces, normais e UVs do OBJ são mantidos (os vértices só são expandidos por
combinação v/vt/vn, como qualquer carregador faz) e a textura PNG vai exatamente como veio.

O que o script faz para o modelo funcionar no esqueleto de 11 ossos do jogo (o mesmo do Goku):
  1. escala uniforme (SCALE) para a altura do esqueleto do jogo (quadril em y=0.845);
  2. T-pose -> pose em A (os braços do esqueleto do jogo descem 22,3° da vertical), girando só os braços em volta do ombro,
     com transição suave no ombro (as normais giram junto);
  3. pesos de skin (hip, upper, hm, LA, LE, RA, RE, LL, LK, RL, RK) por região, com transições suaves nas juntas.

Uso: python3 convert_joseph.py Joseph.obj Joseph.png joseph.js
"""
import sys, re, json, base64
import numpy as np

SCALE = 0.885                       # altura 2.0 -> ~1.77 (ombro 1.62 -> 1.433, virilha 0.955 -> 0.845, joelho 0.519 -> 0.459)
SH_RAW = np.array([0.218, 1.62])    # pivô do ombro (x>0 = esquerda do personagem) no modelo original
EL_X_RAW = 0.655                    # cotovelo (x) no modelo original (T-pose)
ARM_DEG = 90 - np.degrees(np.arctan2(0.14698795180722893, 0.3582831325301206))   # 67.7°: de horizontal para 22,3° da vertical

ORDER = ["hip", "upper", "hm", "LA", "LE", "RA", "RE", "LL", "LK", "RL", "RK"]
IX = {n: i for i, n in enumerate(ORDER)}


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def load_obj(path):
    V, VT, VN, F = [], [], [], []
    for l in open(path):
        p = l.split()
        if not p:
            continue
        if p[0] == 'v': V.append([float(x) for x in p[1:4]])
        elif p[0] == 'vt': VT.append([float(x) for x in p[1:3]])
        elif p[0] == 'vn': VN.append([float(x) for x in p[1:4]])
        elif p[0] == 'f':
            F.append([tuple((int(x) if x else 0) for x in (t.split('/') + ['', ''])[:3]) for t in p[1:]])
    V, VT, VN = np.array(V), np.array(VT), np.array(VN)
    # expande por combinação (v, vt, vn)
    key = {}; pos = []; uv = []; nrm = []; idx = []
    for f in F:
        ids = []
        for a in f:
            if a not in key:
                key[a] = len(pos)
                pos.append(V[a[0] - 1]); uv.append(VT[a[1] - 1] if a[1] else [0, 0])
                nrm.append(VN[a[2] - 1] if a[2] else [0, 1, 0])
            ids.append(key[a])
        for i in range(1, len(ids) - 1):
            idx.append([ids[0], ids[i], ids[i + 1]])
    return np.array(pos), np.array(uv), np.array(nrm), np.array(idx), V, F


def components(n, idx, pos):
    par = list(range(n))
    def find(x):
        while par[x] != x:
            par[x] = par[par[x]]; x = par[x]
        return x
    # une vértices na MESMA posição (costuras de UV/normal) e pelas faces
    q = {}
    for i, p in enumerate(np.round(pos, 5)):
        k = tuple(p)
        if k in q: par[find(i)] = find(q[k])
        else: q[k] = i
    for a, b, c in idx:
        par[find(b)] = find(a); par[find(c)] = find(a)
    comp = np.array([find(i) for i in range(n)])
    return comp


def main(obj, png, out):
    pos, uv, nrm, idx, V0, F0 = load_obj(obj)
    n = len(pos)
    x, y, z = pos[:, 0].copy(), pos[:, 1].copy(), pos[:, 2].copy()
    ax = np.abs(x)

    # ---- cachecol (componentes que vão bem pra trás): segue o torso, não o braço ----
    comp = components(n, idx, pos)
    scarf = np.zeros(n, bool)
    for c in np.unique(comp):
        m = comp == c
        if pos[m, 2].min() < -0.3:
            scarf |= m

    # ---- 1) T-pose -> pose em A (em volta do ombro, só os braços) ----
    wA = sstep(0.20, 0.30, ax) * sstep(1.42, 1.52, y) * (1 - sstep(1.76, 1.86, y))
    wA[scarf] = 0
    th = np.radians(ARM_DEG)
    P = pos.copy(); N = nrm.copy()
    for side in (1, -1):
        m = (np.sign(x) == side) & (wA > 0)
        a = -th * side                              # +x gira p/ baixo (ângulo negativo em z); -x espelhado
        c, s = np.cos(a), np.sin(a)
        dx = x[m] - side * SH_RAW[0]; dy = y[m] - SH_RAW[1]
        rx = side * SH_RAW[0] + dx * c - dy * s; ry = SH_RAW[1] + dx * s + dy * c
        w = wA[m]
        P[m, 0] = x[m] + (rx - x[m]) * w; P[m, 1] = y[m] + (ry - y[m]) * w
        nx, ny = N[m, 0], N[m, 1]
        N[m, 0] = nx + (nx * c - ny * s - nx) * w; N[m, 1] = ny + (nx * s + ny * c - ny) * w
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    P *= SCALE
    px, py, pz = P[:, 0], P[:, 1], P[:, 2]

    # ---- 2) pesos de skin ----
    W = np.zeros((n, len(ORDER)))
    wE = sstep(EL_X_RAW - 0.055, EL_X_RAW + 0.055, ax)              # antebraço (cotovelo em diante)
    wH = sstep(1.50, 1.57, py) * (1 - sstep(0.10, 0.20, ax))        # cabeça (não pega ombros)
    wH[scarf] = 0
    a_tot = wA
    rest = np.clip(1 - a_tot - wH, 0, 1)
    left = sstep(-0.04, 0.04, x)                                   # perna esquerda (x>0) x direita
    wLeg = 1 - sstep(0.74, 0.88, py)                               # coxa começa na virilha
    wLeg[scarf] = 0
    wK = 1 - sstep(0.41, 0.51, py)                                 # joelho (pivô em y=0.459)
    wUp = sstep(0.84, 1.00, py)                                    # cintura: quadril abaixo, tronco acima
    tors = rest * (1 - wLeg); legs = rest * wLeg
    W[:, IX['upper']] = tors * wUp
    W[:, IX['hip']] = tors * (1 - wUp)
    W[:, IX['hm']] = wH
    W[:, IX['LA']] = a_tot * (1 - wE) * (x > 0) + a_tot * (1 - wE) * (x == 0) * .5
    W[:, IX['RA']] = a_tot * (1 - wE) * (x < 0) + a_tot * (1 - wE) * (x == 0) * .5
    W[:, IX['LE']] = a_tot * wE * (x > 0) + a_tot * wE * (x == 0) * .5
    W[:, IX['RE']] = a_tot * wE * (x < 0) + a_tot * wE * (x == 0) * .5
    W[:, IX['LL']] = legs * left * (1 - wK); W[:, IX['LK']] = legs * left * wK
    W[:, IX['RL']] = legs * (1 - left) * (1 - wK); W[:, IX['RK']] = legs * (1 - left) * wK
    # fatia final: os 4 maiores pesos, renormalizados
    si = np.zeros((n, 4), np.uint8); sw = np.zeros((n, 4), np.float64)
    for i in range(n):
        o = np.argsort(-W[i])[:4]; w = W[i][o]; s = w.sum()
        if s <= 1e-9: o = np.array([IX['hip'], 0, 0, 0]); w = np.array([1.0, 0, 0, 0]); s = 1
        si[i] = o; sw[i] = w / s
    sw8 = np.round(sw * 255).astype(np.int32)
    for i in range(n):           # garante soma 255
        sw8[i, int(np.argmax(sw8[i]))] += 255 - int(sw8[i].sum())
    sw8 = sw8.astype(np.uint8)

    # ---- física do cachecol: "liberdade" de cada vértice (0 = preso ao pescoço/ombro, 1 = ponta solta) ----
    clothFr = np.zeros(n)
    if scarf.any():
        top = scarf & (py >= py[scarf].max() - 0.03)
        att = P[top].mean(axis=0)                                   # onde as fitas saem do pescoço
        dist = np.linalg.norm(P[scarf] - att, axis=1)
        clothFr[scarf] = sstep(0.02, 0.95, dist / dist.max())
    # vértices na mesma posição (costuras de UV/normal) formam um grupo: a simulação os trata como um só
    gkey = {}; grp = np.zeros(n, np.uint16)
    for i, p in enumerate(np.round(pos, 5)):
        grp[i] = gkey.setdefault(tuple(p), len(gkey))

    # ---- 3) saída ----
    b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
    nrm8 = np.round(N * 127).astype(np.int8)
    assert n < 65536
    png_b64 = base64.b64encode(open(png, 'rb').read()).decode()
    data = {
        'name': 'Joseph Joestar', 'n': n,
        'pos': b64(P.astype('<f4')), 'nrm': b64(nrm8), 'uv': b64(uv.astype('<f4')),
        'idx': b64(idx.astype('<u2').ravel()), 'si': b64(si), 'sw': b64(sw8),
        'tex': 'data:image/png;base64,' + png_b64,
        'fr': b64(np.round(clothFr * 255).astype(np.uint8)), 'grp': b64(grp.astype('<u2')),
    }
    with open(out, 'w') as f:
        f.write("/* Joseph Joestar (JoJo's Bizarre Adventure: Diamond Records) — corpo extra do criador de personagem.\n"
                "   Gerado por convert_joseph.py a partir de Joseph.obj + Joseph.png, SEM otimização da malha nem da textura.\n"
                "   Modelo fornecido pelo dono do projeto; não incluído no CREDITS por licença conhecida. Carrega ANTES de avatar.js. */\n")
        f.write("window.OWM=window.OWM||{};OWM.bodyPacks=OWM.bodyPacks||{};OWM.bodyPacks.joseph=" + json.dumps(data) + ";\n")
    np.savez(out + '.debug.npz', P=P, N=N, uv=uv, idx=idx, si=si, sw=sw)
    print('ok', n, 'vértices', len(idx), 'triângulos; altura', P[:, 1].max().round(3), '; arquivo', out)


if __name__ == '__main__':
    main(*sys.argv[1:4])
