"""Adapt the repository's own provisional HOLA motion to the V5 bind pose.
Uses source joint directions, not bone-name quaternion copying. No linguistic
validation is implied: target proportions and skin deformation still need review.
"""
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation, Slerp
from audit_signalink_glb_v4 import read_glb, get_accessor


def add_hola(g, nodes, source):
    source=Path(source)
    doc,blob=read_glb(source)
    clip=next(a for a in doc['animations'] if a['name']=='HOLA')
    sn=doc['nodes'];names={n['name']:i for i,n in enumerate(sn) if 'name' in n}
    parents={child:i for i,n in enumerate(sn) for child in n.get('children',[])}
    channels=[]
    for channel in clip['channels']:
        sampler=clip['samplers'][channel['sampler']]
        times=np.array(get_accessor(doc,blob,sampler['input'])).ravel()
        values=np.array(get_accessor(doc,blob,sampler['output']))
        channels.append((channel['target']['node'],channel['target']['path'],times,values))
    duration=max(c[2][-1] for c in channels)
    tracks={node:[] for node in nodes.values()}
    rest={n:g.world(i)[:3,3] for n,i in nodes.items()}
    def unit(v):return v/max(np.linalg.norm(v),1e-9)
    def frame(y,x):
        y=unit(y);x=unit(x-y*np.dot(x,y));return np.column_stack((x,y,unit(np.cross(x,y))))
    for time in np.linspace(0,duration,81):
        local=[dict(n) for n in sn]
        for i,path,times,values in channels:
            t=np.clip(time,times[0],times[-1])
            local[i][path]=(Slerp(times,Rotation.from_quat(values))([t]).as_quat()[0] if path=='rotation' else np.array([np.interp(t,times,values[:,k]) for k in range(values.shape[1])]))
        cache={}
        def world(i):
            if i in cache:return cache[i]
            n=local[i];m=np.eye(4);m[:3,:3]=Rotation.from_quat(n.get('rotation',[0,0,0,1])).as_matrix()@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0])
            cache[i]=world(parents[i])@m if i in parents else m
            return cache[i]
        def pos(n):return world(names[n])[:3,3]
        rotations={name:np.eye(3) for name in nodes}
        # Original MPFB uses opposite lateral labels to this procedural rig.
        for side,suffix in [('Left','r'),('Right','l')]:
            chain=[('UpperArm','upperarm','LowerArm','lowerarm'),('LowerArm','lowerarm','Hand','hand')]
            parent=np.eye(3)
            for part,src,child,srcchild in chain:
                direction=unit(pos(srcchild+'_'+suffix)-pos(src+'_'+suffix))
                bind=unit(rest[side+child]-rest[side+part])
                target=Rotation.align_vectors([direction],[bind])[0].as_matrix()
                rotations[side+part]=parent.T@target;parent=target
            wrist=pos('hand_'+suffix)
            y=pos('middle_01_'+suffix)-wrist
            x=pos('pinky_01_'+suffix)-pos('index_01_'+suffix)
            if side=='Right':x=-x
            hand=frame(y,x)
            rotations[side+'Hand']=parent.T@hand
            for finger,src in [('Index','index'),('Middle','middle'),('Ring','ring'),('Little','pinky'),('Thumb','thumb')]:
                parent=hand
                for k,part in enumerate(['Metacarpal','Proximal','Distal'] if finger=='Thumb' else ['Proximal','Intermediate','Distal']):
                    name=side+finger+part
                    if k<2:
                        direction=pos(f'{src}_0{k+2}_{suffix}')-pos(f'{src}_0{k+1}_{suffix}')
                        target=frame(direction,hand[:,0])
                    else:target=parent
                    rotations[name]=parent.T@target;parent=target
        for name,node in nodes.items():
            q=Rotation.from_matrix(rotations[name]).as_quat()
            if tracks[node] and np.dot(q,tracks[node][-1][1])<0:q=-q
            tracks[node].append((float(time),q.tolist()))
    g.add_animation('HOLA',tracks)
    g.doc['animations'][-1]['extras']={'source':'signalink_avatar.glb#HOLA','status':'provisional-retarget','linguisticValidation':'none','method':'world-space joint directions and palm frames'}
