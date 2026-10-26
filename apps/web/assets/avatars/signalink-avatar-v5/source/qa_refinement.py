"""Independent geometry/deformation QA of the generated GLB (not LSB validation)."""
import argparse, json
from pathlib import Path
import numpy as np
import trimesh
from scipy.spatial.transform import Rotation, Slerp
from audit_signalink_glb_v4 import read_glb, get_accessor


def audit(path):
    g,b=read_glb(path); nodes=g['nodes']; parents={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}
    read=lambda i:np.array(get_accessor(g,b,i))
    inverse=[read(s['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1) for s in g['skins']]
    meshes=[];topology={}
    for i,node in enumerate(nodes):
        if 'mesh' not in node:continue
        for p in g['meshes'][node['mesh']]['primitives']:
            a=p['attributes'];v=read(a['POSITION']);f=read(p['indices']).reshape(-1,3)
            mesh=trimesh.Trimesh(vertices=v,faces=f,process=True)
            if 'HandMesh' in node['name'] or 'HeadFace' in node['name']:
                topology[node['name']]={'watertight':bool(mesh.is_watertight),'consistent_winding':bool(mesh.is_winding_consistent),'vertices':len(v)}
                assert mesh.is_watertight and mesh.is_winding_consistent,node['name']
            meshes.append((i,v,read(a['JOINTS_0']).astype(int) if 'skin' in node else None,read(a['WEIGHTS_0']) if 'skin' in node else None))
    samples=0;max_position=0
    for clip in g['animations']:
        channels=[]
        for channel in clip['channels']:
            s=clip['samplers'][channel['sampler']];channels.append((channel['target'],read(s['input']).ravel(),read(s['output'])))
        duration=max(t[-1] for _,t,_ in channels)
        for time in np.linspace(0,duration,9):
            pose=[dict(n) for n in nodes]
            for target,t,v in channels:
                if target['path']=='rotation':pose[target['node']]['rotation']=Slerp(t,Rotation.from_quat(v))([np.clip(time,t[0],t[-1])]).as_quat()[0]
            cache={}
            def world(i):
                if i in cache:return cache[i]
                n=pose[i];m=np.eye(4);m[:3,:3]=Rotation.from_quat(n.get('rotation',[0,0,0,1])).as_matrix();m[:3,3]=n.get('translation',[0,0,0]);cache[i]=world(parents[i])@m if i in parents else m;return cache[i]
            for i,v,j,w in meshes:
                if j is None:out=(world(i)@np.c_[v,np.ones(len(v))].T).T[:,:3]
                else:
                    skin=nodes[i]['skin'];mat=np.array([world(k) for k in g['skins'][skin]['joints']])@inverse[skin]
                    out=(np.einsum('nkjl,nl->nkj',mat[j],np.c_[v,np.ones(len(v))])*w[:,:,None]).sum(axis=1)[:,:3]
                assert np.isfinite(out).all(),(clip['name'],i,time)
                max_position=max(max_position,float(abs(out).max()))
                assert abs(out).max()<3,(clip['name'],nodes[i]['name'],time)
            samples+=1
    return {'file':path.name,'clips':len(g['animations']),'sampled_poses':samples,'topology':topology,'maximum_absolute_coordinate_m':max_position,'finite_and_bounded':True,'morph_deformation_included':False,'linguistic_validation':False}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('glb',type=Path);p.add_argument('--json',type=Path);args=p.parse_args();r=audit(args.glb)
    if args.json:args.json.write_text(json.dumps(r,indent=2)+'\n')
    print(json.dumps(r,indent=2))
