// Open World Mayhem — simplificador de malha por colapso de arestas (Garland–Heckbert, métrica de quádricas) com UV.
// Usado por convert_hair.py para reduzir o "spiky hair" (~970 mil triângulos) a ~1 MB mantendo a textura.
//   g++ -O2 -o qem_simplify qem_simplify.cpp
//   ./qem_simplify entrada.bin saida.bin <triângulos-alvo>
// Entrada : int32 nV, int32 nF | float32 pos[nV*3] | int32 tri[nF*3] | float32 uv[nF*6]  (uv por CANTO de triângulo)
// Saída   : int32 nV, int32 nF | float32 pos[nV*3] | int32 tri[nF*3] | float32 uv[nF*6]  (vértices compactados)
// O UV de cada canto é atualizado com o mapa afim da própria face (3D→UV), então emendas de UV não viram rachaduras 3D.
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <vector>
#include <queue>
#include <algorithm>
#include <unordered_map>
using namespace std;
struct V3{double x,y,z;};
static V3 operator-(V3 a,V3 b){return{a.x-b.x,a.y-b.y,a.z-b.z};}
static V3 operator+(V3 a,V3 b){return{a.x+b.x,a.y+b.y,a.z+b.z};}
static V3 operator*(V3 a,double k){return{a.x*k,a.y*k,a.z*k};}
static double dot(V3 a,V3 b){return a.x*b.x+a.y*b.y+a.z*b.z;}
static V3 cross(V3 a,V3 b){return{a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x};}
static double len(V3 a){return sqrt(dot(a,a));}
struct Q{double a[10]={0,0,0,0,0,0,0,0,0,0};   // xx xy xz xw yy yz yw zz zw ww
 void add(const Q&o){for(int i=0;i<10;i++)a[i]+=o.a[i];}
 void plane(double A,double B,double C,double D,double w){
  a[0]+=w*A*A;a[1]+=w*A*B;a[2]+=w*A*C;a[3]+=w*A*D;a[4]+=w*B*B;a[5]+=w*B*C;a[6]+=w*B*D;a[7]+=w*C*C;a[8]+=w*C*D;a[9]+=w*D*D;}
 double err(V3 p)const{return a[0]*p.x*p.x+2*a[1]*p.x*p.y+2*a[2]*p.x*p.z+2*a[3]*p.x+a[4]*p.y*p.y+2*a[5]*p.y*p.z+2*a[6]*p.y+a[7]*p.z*p.z+2*a[8]*p.z+a[9];}
};
struct Cand{double cost;int a,b,va,vb;V3 p;bool operator<(const Cand&o)const{return cost>o.cost;}};
struct Face{int v[3];float uv[3][2];bool alive;};
static vector<V3> pos;static vector<Face> F;static vector<vector<int>> vf;static vector<Q> Qv;static vector<int> ver;static vector<char> valive;

static void cleanVF(int v){auto&l=vf[v];size_t k=0;for(size_t i=0;i<l.size();i++)if(F[l[i]].alive)l[k++]=l[i];l.resize(k);}
static void faceQ(int f,Q&q,double w=1){
 V3 a=pos[F[f].v[0]],b=pos[F[f].v[1]],c=pos[F[f].v[2]];V3 n=cross(b-a,c-a);double ar=len(n);if(ar<1e-18)return;n=n*(1/ar);
 q.plane(n.x,n.y,n.z,-dot(n,a),w*ar*.5);
}
static bool solve(const Q&q,V3&p){
 double m[3][4]={{q.a[0],q.a[1],q.a[2],-q.a[3]},{q.a[1],q.a[4],q.a[5],-q.a[6]},{q.a[2],q.a[5],q.a[7],-q.a[8]}};
 for(int i=0;i<3;i++){int pv=i;for(int r=i+1;r<3;r++)if(fabs(m[r][i])>fabs(m[pv][i]))pv=r;
  if(fabs(m[pv][i])<1e-12)return false;
  for(int c=0;c<4;c++)swap(m[i][c],m[pv][c]);
  for(int r=0;r<3;r++)if(r!=i){double f=m[r][i]/m[i][i];for(int c=i;c<4;c++)m[r][c]-=f*m[i][c];}}
 p={m[0][3]/m[0][0],m[1][3]/m[1][1],m[2][3]/m[2][2]};return true;
}
static void pushEdge(priority_queue<Cand>&pq,int a,int b){
 Q q=Qv[a];q.add(Qv[b]);V3 pa=pos[a],pb=pos[b],mid=(pa+pb)*.5,p;
 double el=len(pb-pa);bool ok=solve(q,p);
 if(ok&&len(p-mid)>el*.75)ok=false;                 // posição ótima longe da aresta: instável
 double best=1e300;V3 bp=mid;
 if(ok){best=q.err(p);bp=p;}
 for(V3 c:{pa,pb,mid}){double e=q.err(c);if(e<best){best=e;bp=c;}}
 pq.push({max(best,0.0)+1e-12*el*el,a,b,ver[a],ver[b],bp});
}
static void neighbors(int v,vector<int>&out){out.clear();for(int f:vf[v])if(F[f].alive)for(int k=0;k<3;k++)if(F[f].v[k]!=v)out.push_back(F[f].v[k]);sort(out.begin(),out.end());out.erase(unique(out.begin(),out.end()),out.end());}
// deslocamento 3D de um canto → variação de UV, pelo mapa afim da face (antes da mudança)
static void cornerShift(int f,int corner,V3 d,float*duv){
 Face&F0=F[f];V3 p0=pos[F0.v[corner]],p1=pos[F0.v[(corner+1)%3]],p2=pos[F0.v[(corner+2)%3]];
 V3 e1=p1-p0,e2=p2-p0;double g11=dot(e1,e1),g12=dot(e1,e2),g22=dot(e2,e2),det=g11*g22-g12*g12;
 duv[0]=duv[1]=0;if(fabs(det)<1e-30)return;
 double r1=dot(d,e1),r2=dot(d,e2),s=(r1*g22-r2*g12)/det,t=(r2*g11-r1*g12)/det;
 const float*u0=F0.uv[corner],*u1=F0.uv[(corner+1)%3],*u2=F0.uv[(corner+2)%3];
 duv[0]=(float)(s*(u1[0]-u0[0])+t*(u2[0]-u0[0]));duv[1]=(float)(s*(u1[1]-u0[1])+t*(u2[1]-u0[1]));
}
static bool flips(int v,int skip,V3 np){   // mover v para np vira alguma face do avesso / degenera?
 for(int f:vf[v]){if(!F[f].alive)continue;Face&fc=F[f];if(skip>=0&&(fc.v[0]==skip||fc.v[1]==skip||fc.v[2]==skip))continue;
  V3 a=pos[fc.v[0]],b=pos[fc.v[1]],c=pos[fc.v[2]];V3 n0=cross(b-a,c-a);
  if(fc.v[0]==v)a=np;else if(fc.v[1]==v)b=np;else c=np;V3 n1=cross(b-a,c-a);
  double l0=len(n0),l1=len(n1);if(l0<1e-20)continue;if(l1<l0*.02)return true;if(dot(n0,n1)<.25*l0*l1)return true;}
 return false;
}
int main(int argc,char**argv){
 if(argc<4){fprintf(stderr,"uso: qem_simplify in out alvo\n");return 1;}
 FILE*fi=fopen(argv[1],"rb");int nV,nF;fread(&nV,4,1,fi);fread(&nF,4,1,fi);
 vector<float> p3(nV*3);vector<int> tri(nF*3);vector<float> uv(nF*6);
 fread(p3.data(),4,nV*3,fi);fread(tri.data(),4,nF*3,fi);fread(uv.data(),4,nF*6,fi);fclose(fi);
 int target=atoi(argv[3]);
 pos.resize(nV);for(int i=0;i<nV;i++)pos[i]={p3[i*3],p3[i*3+1],p3[i*3+2]};
 F.resize(nF);vf.assign(nV,{});Qv.assign(nV,Q());ver.assign(nV,0);valive.assign(nV,1);
 int alive=0;
 for(int f=0;f<nF;f++){Face&fc=F[f];for(int k=0;k<3;k++){fc.v[k]=tri[f*3+k];fc.uv[k][0]=uv[f*6+k*2];fc.uv[k][1]=uv[f*6+k*2+1];}
  fc.alive=!(fc.v[0]==fc.v[1]||fc.v[1]==fc.v[2]||fc.v[0]==fc.v[2]);if(fc.alive)alive++;
  if(fc.alive)for(int k=0;k<3;k++)vf[fc.v[k]].push_back(f);}
 for(int f=0;f<nF;f++)if(F[f].alive){Q q;faceQ(f,q);for(int k=0;k<3;k++)Qv[F[f].v[k]].add(q);}
 // arestas de borda (1 face) ganham um plano perpendicular com peso alto → o contorno não encolhe
 {unordered_map<unsigned long long,vector<int>> em;em.reserve(nF*2);
  for(int f=0;f<nF;f++)if(F[f].alive)for(int k=0;k<3;k++){int a=F[f].v[k],b=F[f].v[(k+1)%3];if(a>b)swap(a,b);em[(unsigned long long)a<<32|(unsigned)b].push_back(f);}
  for(auto&kv:em)if(kv.second.size()==1){int a=kv.first>>32,b=kv.first&0xffffffffu,f=kv.second[0];
   V3 e=pos[b]-pos[a];V3 fn=cross(F[f].v[0]==a?pos[F[f].v[1]]-pos[a]:pos[F[f].v[0]]-pos[a],e);V3 n=cross(e,fn);double l=len(n);if(l<1e-20)continue;n=n*(1/l);
   Q q;q.plane(n.x,n.y,n.z,-dot(n,pos[a]),50*dot(e,e));Qv[a].add(q);Qv[b].add(q);}}
 priority_queue<Cand> pq;
 {vector<unsigned long long> keys;for(int f=0;f<nF;f++)if(F[f].alive)for(int k=0;k<3;k++){int a=F[f].v[k],b=F[f].v[(k+1)%3];if(a>b)swap(a,b);keys.push_back((unsigned long long)a<<32|(unsigned)b);}
  sort(keys.begin(),keys.end());keys.erase(unique(keys.begin(),keys.end()),keys.end());
  for(auto k:keys)pushEdge(pq,(int)(k>>32),(int)(k&0xffffffffu));}
 fprintf(stderr,"in: %d verts, %d faces, %zu edges\n",nV,alive,pq.size());
 vector<int> na,nb,nn;int done=0;
 while(alive>target&&!pq.empty()){
  Cand c=pq.top();pq.pop();int a=c.a,b=c.b;   // a some, b fica
  if(!valive[a]||!valive[b]||ver[a]!=c.va||ver[b]!=c.vb)continue;
  cleanVF(a);cleanVF(b);
  // faces compartilhadas e condição de link
  int shared=0;for(int f:vf[a]){Face&fc=F[f];if(fc.v[0]==b||fc.v[1]==b||fc.v[2]==b)shared++;}
  if(shared==0||shared>2)continue;
  neighbors(a,na);neighbors(b,nb);int common=0;{size_t i=0,j=0;while(i<na.size()&&j<nb.size()){if(na[i]==nb[j]){common++;i++;j++;}else if(na[i]<nb[j])i++;else j++;}}
  if(common!=shared)continue;
  if(flips(a,b,c.p)||flips(b,a,c.p))continue;
  // aplica: UV dos cantos que se movem
  V3 pa=pos[a],pb=pos[b];
  vector<int> fa=vf[a],fb=vf[b];
  for(int f:fa){Face&fc=F[f];if(fc.v[0]==b||fc.v[1]==b||fc.v[2]==b)continue;int k=fc.v[0]==a?0:fc.v[1]==a?1:2;float d[2];cornerShift(f,k,c.p-pa,d);fc.uv[k][0]+=d[0];fc.uv[k][1]+=d[1];}
  for(int f:fb){Face&fc=F[f];if(fc.v[0]==a||fc.v[1]==a||fc.v[2]==a)continue;int k=fc.v[0]==b?0:fc.v[1]==b?1:2;float d[2];cornerShift(f,k,c.p-pb,d);fc.uv[k][0]+=d[0];fc.uv[k][1]+=d[1];}
  for(int f:fa){Face&fc=F[f];if(fc.v[0]==b||fc.v[1]==b||fc.v[2]==b){fc.alive=false;alive--;}else{for(int k=0;k<3;k++)if(fc.v[k]==a)fc.v[k]=b;vf[b].push_back(f);}}
  pos[b]=c.p;Qv[b].add(Qv[a]);valive[a]=0;ver[b]++;vf[a].clear();cleanVF(b);
  neighbors(b,nn);for(int n:nn)pushEdge(pq,b,n);
  if(++done%100000==0)fprintf(stderr,"  %d colapsos, %d faces\n",done,alive);
 }
 // compacta
 vector<int> remap(nV,-1);vector<float> op;vector<int> ot;vector<float> ou;int cnt=0;
 for(int f=0;f<nF;f++)if(F[f].alive){for(int k=0;k<3;k++){int v=F[f].v[k];if(remap[v]<0){remap[v]=cnt++;op.push_back(pos[v].x);op.push_back(pos[v].y);op.push_back(pos[v].z);}ot.push_back(remap[v]);ou.push_back(F[f].uv[k][0]);ou.push_back(F[f].uv[k][1]);}}
 FILE*fo=fopen(argv[2],"wb");int nf2=ot.size()/3;fwrite(&cnt,4,1,fo);fwrite(&nf2,4,1,fo);fwrite(op.data(),4,op.size(),fo);fwrite(ot.data(),4,ot.size(),fo);fwrite(ou.data(),4,ou.size(),fo);fclose(fo);
 fprintf(stderr,"out: %d verts, %d faces\n",cnt,nf2);return 0;
}
