"""Bake posed skinned GLB into a temporary unskinned GLB for render QA.
Not for production: do not distribute baked GLBs in place of animated rigged model.
"""
from pathlib import Path
import json,struct,sys,copy
import numpy as np
from scipy.spatial.transform import Rotation,Slerp
sys.path.insert(0,str(Path(__file__).resolve().parent))
from audit_signalink_glb_v4 import read_glb,get_accessor

def mat(node, rot=None):
    m=np.eye(4);q=np.asarray(rot if rot is not None else node.get('rotation',[0,0,0,1]))
    m[:3,:3]=Rotation.from_quat(q).as_matrix()
    m[:3,3]=node.get('translation',[0,0,0]);return m

def get_worlds(g,overrides):
    nodes=g['nodes'];parents={j:i for i,n in enumerate(nodes) for j in n.get('children',[])}
    cache={}
    def world(i):
        if i not in cache:
            M=mat(nodes[i],overrides.get(i))
            cache[i]=world(parents[i])@M if i in parents else M
        return cache[i]
    return [world(i) for i in range(len(nodes))]

def animation_overrides(g,blob,clip,time):
    a=next(z for z in g['animations'] if z['name']==clip)
    overrides={}
    for ch in a['channels']:
        if ch['target']['path']!='rotation':continue
        sm=a['samplers'][ch['sampler']]
        times=np.array(get_accessor(g,blob,sm['input'])).ravel()
        quats=np.asarray(get_accessor(g,blob,sm['output']))
        overrides[ch['target']['node']]=Slerp(times,Rotation.from_quat(quats))([np.clip(time,times[0],times[-1])]).as_quat()[0]
    return overrides

def bake(original,clip,t,dest):
    orig=Path(original);g,blob=read_glb(orig);overrides=animation_overrides(g,blob,clip,t)
    worlds=get_worlds(g,overrides)
    names=[]; stats={}
    for i,n in enumerate(g['nodes']):
        if i in overrides:n['rotation']=list(map(float,overrides[i]))
        if 'skin' not in n:continue
        skin=g['skins'][n['skin']]
        mats=[]
        for node_id,ibm in zip(skin['joints'],get_accessor(g,blob,skin['inverseBindMatrices'])):
            invbind=np.array(ibm).reshape((4,4),order='F')
            mats.append(worlds[node_id]@invbind)
        mesh=g['meshes'][n['mesh']]
        for p in mesh['primitives']:
            at=p['attributes']
            v=np.asarray(get_accessor(g,blob,at['POSITION']),dtype=np.float64)
            w=np.asarray(get_accessor(g,blob,at['WEIGHTS_0']))
            js=np.asarray(get_accessor(g,blob,at['JOINTS_0']),dtype=np.int32)
            warped=np.zeros_like(v)
            for k in range(4):
                jk=js[:,k];wk=w[:,k]
                valid=wk>1e-7
                if not np.any(valid):continue
                for j in np.unique(jk[valid]):
                    ix=(jk==j)&valid
                    m=mats[j]
                    warped[ix]+=wk[ix,None]*(v[ix]@m[:3,:3].T+m[:3,3])
            norms=np.asarray(get_accessor(g,blob,at['NORMAL']),dtype=np.float64)
            newnorms=np.zeros_like(norms)
            for k in range(4):
                jk=js[:,k];wk=w[:,k]
                valid=wk>1e-7
                if not np.any(valid):continue
                for j in np.unique(jk[valid]):
                    ix=(jk==j)&valid
                    m=mats[j]
                    newnorms[ix]+=wk[ix,None]*(norms[ix]@m[:3,:3].T)
            newnorms/=np.maximum(np.linalg.norm(newnorms,axis=1,keepdims=True),1e-6)
            dx=np.linalg.norm(warped-v,axis=1)
            stats[n['name']]={'mean_delta_m':round(float(np.mean(dx)),4),'max_delta_m':round(float(np.max(dx)),4),'vertices':len(v)}
            names.append(n['name'])
            for typ,data in [('POSITION',warped),('NORMAL',newnorms)]:
                data=np.asarray(data,dtype='<f4');start=len(blob)
                while start%4:blob+=b'\x00';start+=1
                raw=data.tobytes();blob+=raw
                view=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(raw),'target':34962})
                aidx=len(g['accessors']);access={'bufferView':view,'componentType':5126,'count':len(data),'type':'VEC3'}
                if typ=='POSITION':access['min']=data.min(axis=0).tolist();access['max']=data.max(axis=0).tolist()
                g['accessors'].append(access);at[typ]=aidx
            at.pop('JOINTS_0',None);at.pop('WEIGHTS_0',None)
        n.pop('skin')
    # remove animations, skins so importer doesn't apply second transformation
    g.pop('animations',None);g.pop('skins',None)
    while len(blob)%4:blob+=b'\0'
    g['buffers'][0]['byteLength']=len(blob)
    data=json.dumps(g,separators=(',',':'),ensure_ascii=False).encode('utf8')
    while len(data)%4:data+=b' '
    dest=Path(dest);dest.write_bytes(struct.pack('<4sII',b'glTF',2,12+8+len(data)+8+len(blob))+struct.pack('<I4s',len(data),b'JSON')+data+struct.pack('<I4s',len(blob),b'BIN\0')+blob)
    return stats
if __name__=='__main__':
    s=bake(sys.argv[1],sys.argv[2],float(sys.argv[3]),sys.argv[4]);print(json.dumps(s,indent=2))
