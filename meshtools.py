"""Open World Mayhem — ferramentas de malha compartilhadas pelos conversores (simplificação por quadrics, base64). Só precisa de numpy."""
import heapq,base64
import numpy as np

def b64(a,dt):return base64.b64encode(np.ascontiguousarray(a).astype(dt).tobytes()).decode()

def simplificar(P,F,C,alvo):
    """Colapso de arestas com quadrics. P (n,3), F (m,3), C (n,3) cor. Vértices com cor diferente nunca estão soldados, então
    a fronteira tronco/folha vira borda aberta e ganha plano de penalidade (não é comida)."""
    n=len(P);Q=np.zeros((n,4,4));F=[tuple(f) for f in F];vivo=[True]*len(F)
    def plano(a,b,c):
        nr=np.cross(P[b]-P[a],P[c]-P[a]);ar=np.linalg.norm(nr)
        if ar<1e-12:return None,0
        nr/=ar;return np.array([nr[0],nr[1],nr[2],-nr.dot(P[a])]),ar/2
    arestas={}
    for fi,(a,b,c) in enumerate(F):
        pl,ar=plano(a,b,c)
        if pl is not None:
            K=np.outer(pl,pl)*ar
            for v in (a,b,c):Q[v]+=K
        for u,v in ((a,b),(b,c),(c,a)):arestas.setdefault((min(u,v),max(u,v)),[]).append(fi)
    for (u,v),fs in arestas.items():
        if len(fs)==1:   # borda: plano perpendicular à face passando pela aresta
            a,b,c=F[fs[0]];pl,ar=plano(a,b,c)
            if pl is None:continue
            e=P[v]-P[u];l=np.linalg.norm(e)
            if l<1e-12:continue
            bn=np.cross(e/l,pl[:3]);bn/=np.linalg.norm(bn)+1e-12
            q=np.array([bn[0],bn[1],bn[2],-bn.dot(P[u])]);K=np.outer(q,q)*(l*l*8+1e-6)
            Q[u]+=K;Q[v]+=K
    vf=[set() for _ in range(n)]
    for fi,f in enumerate(F):
        for v in f:vf[v].add(fi)
    P=P.copy();C=C.copy();ver=[0]*n;heap=[];nf=len(F)
    def custo(u,v):
        Qs=Q[u]+Q[v];melhor=None
        for x in (P[u],P[v],(P[u]+P[v])/2):
            h=np.append(x,1.);e=h@Qs@h
            if melhor is None or e<melhor[0]:melhor=(e,x)
        # não deixa inverter triângulos vizinhos
        for fi in vf[u]|vf[v]:
            a,b,c=F[fi]
            if (u in (a,b,c)) and (v in (a,b,c)):continue
            old=np.cross(P[b]-P[a],P[c]-P[a])
            q=[melhor[1] if t in (u,v) else P[t] for t in (a,b,c)]
            new=np.cross(q[1]-q[0],q[2]-q[0]);ln=np.linalg.norm(old)*np.linalg.norm(new)
            if ln<1e-14 or old.dot(new)/ln<.2:return None
        return melhor
    def empurra(u,v):
        r=custo(u,v)
        if r is not None:heapq.heappush(heap,(r[0],u,v,ver[u],ver[v],r[1]))
    for (u,v) in arestas:empurra(u,v)
    while nf>alvo and heap:
        e,u,v,vu,vv,x=heapq.heappop(heap)
        if ver[u]!=vu or ver[v]!=vv or not vf[u] or not vf[v]:continue
        if v not in {t for fi in vf[u] for t in F[fi]}:continue
        # funde v em u
        P[u]=x;C[u]=(C[u]+C[v])/2;Q[u]=Q[u]+Q[v]
        for fi in list(vf[v]):
            a,b,c=F[fi]
            if u in (a,b,c):   # face contém a aresta: morre
                vivo[fi]=False;nf-=1
                for t in (a,b,c):vf[t].discard(fi)
            else:
                F[fi]=tuple(u if t==v else t for t in (a,b,c));vf[u].add(fi)
        vf[v]=set();ver[u]+=1;ver[v]+=1
        viz={t for fi in vf[u] for t in F[fi] if t!=u}
        for t in viz:empurra(min(u,t),max(u,t))
    faces=[F[i] for i in range(len(F)) if vivo[i] and len(set(F[i]))==3]
    return P,C,np.array(faces)
