#!/usr/bin/env python3
"""Static SignaLink GLB structural audit. Does not replace Khronos validator or deformation renders.
Usage: python audit_signalink_glb.py model.glb [--json out.json]
No third-party dependencies. Tests rig structure, animation coverage, and raw skin weights.
"""
import argparse, collections, json, math, pathlib, struct, sys
COMPONENT_FORMAT = {5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'}
DIMENSIONS = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16,'MAT3':9,'MAT2':4}

def read_glb(path):
    raw=path.read_bytes()
    if len(raw)<20: raise ValueError('GLB is too short')
    magic,version,declared=struct.unpack_from('<4sII',raw)
    if magic!=b'glTF' or version!=2 or declared!=len(raw): raise ValueError('Invalid GLB header / length')
    pos=12; data=None; blob=None
    while pos+8<=len(raw):
        length,typ=struct.unpack_from('<I4s',raw,pos);pos+=8
        if pos+length>len(raw):raise ValueError('Out of bounds GLB chunk')
        payload=raw[pos:pos+length];pos+=length
        if typ==b'JSON':data=json.loads(payload)
        elif typ==b'BIN\x00':blob=payload
    if not data or blob is None:raise ValueError('Missing JSON or binary chunk')
    return data,blob

def get_accessor(g,blob,index):
    a=g['accessors'][index];v=g['bufferViews'][a['bufferView']]
    if a.get('sparse'): raise ValueError(f'Sparse accessor {index} needs full decoder')
    if v.get('buffer',0)!=0:raise ValueError('Only embedded GLB buffer=0 supported')
    fmt=COMPONENT_FORMAT[a['componentType']];n=DIMENSIONS[a['type']]
    size=struct.calcsize('<'+fmt);stride=v.get('byteStride',n*size)
    start=v.get('byteOffset',0)+a.get('byteOffset',0)
    unpack=struct.Struct('<'+fmt*n)
    values=[]
    for i in range(a['count']):
        off=start+i*stride
        if off+n*size>len(blob):raise ValueError(f'Accessor {index} out of range')
        values.append(unpack.unpack_from(blob,off))
    if a.get('normalized'):
        max_value={5120:127,5121:255,5122:32767,5123:65535}.get(a['componentType'])
        if max_value is not None:values=[tuple(max(-1,v/max_value) for v in row) for row in values]
    return values

def inspect(path):
    g,blob=read_glb(path)
    nodes=g.get('nodes',[]);meshes=g.get('meshes',[]);skins=g.get('skins',[]);animations=g.get('animations',[])
    parents={c:i for i,node in enumerate(nodes) for c in node.get('children',[])}
    named={n.get('name',''):i for i,n in enumerate(nodes)}
    mesh_nodes=[(i,n) for i,n in enumerate(nodes) if 'mesh' in n]
    skinned=[(i,n) for i,n in mesh_nodes if 'skin' in n]
    rigid=[(i,n) for i,n in mesh_nodes if 'skin' not in n]
    metrics={'file':str(path),'file_bytes':path.stat().st_size,'nodes':len(nodes),'meshes':len(meshes),'mesh_nodes':len(mesh_nodes),'skinned_mesh_nodes':len(skinned),'rigid_mesh_nodes':len(rigid),'skins':len(skins),'skin_joint_counts':[len(x['joints']) for x in skins], 'morph_target_primitives':sum(bool(p.get('targets')) for m in meshes for p in m.get('primitives',[]))}
    metrics['root_node_children'] = {n.get('name',str(i)):len(n.get('children',[])) for i,n in enumerate(nodes) if i not in parents}
    metrics['rigid_meshes_at_scene_root']= [n.get('name',str(i)) for i,n in rigid if parents.get(i) is not None and parents[i] not in parents]
    weights=[];metrics['skinned_details']=[]
    for idx,node in skinned:
        details={'node':node.get('name',str(idx)),'vertices':0,'single_influence_vertices':0,'invalid_weight_sum_vertices':0,'maximum_joint_influences':0,'out_of_range_joints':0}
        for prim in meshes[node['mesh']].get('primitives',[]):
            att=prim.get('attributes',{})
            if 'WEIGHTS_0' not in att or 'JOINTS_0' not in att:
                details['missing_weight_attributes']=True;continue
            w=get_accessor(g,blob,att['WEIGHTS_0'])
            joint=get_accessor(g,blob,att['JOINTS_0'])
            details['vertices']+=len(w)
            for ww,jj in zip(w,joint):
                active=sum(x>1e-5 for x in ww)
                details['single_influence_vertices']+=active==1
                details['invalid_weight_sum_vertices']+=abs(sum(ww)-1)>1e-3
                details['maximum_joint_influences']=max(details['maximum_joint_influences'],active)
                details['out_of_range_joints']+=sum((x>1e-5 and y>=len(skins[node['skin']]['joints'])) for x,y in zip(ww,jj))
        details['single_influence_percent']=round(100*details['single_influence_vertices']/details['vertices'],2) if details['vertices'] else None
        metrics['skinned_details'].append(details)
    metrics['animations']=[]
    for animation in animations:
        affected=set(ch['target']['node'] for ch in animation.get('channels',[]) if 'node' in ch.get('target',{}))
        metric={'name':animation.get('name','unnamed'),'channels':len(animation.get('channels',[])),'target_nodes':len(affected),'root_animated':0 in affected,'head_animated':any(('head' in nodes[i].get('name','').lower() or 'neck' in nodes[i].get('name','').lower()) for i in affected),'torso_animated':any(any(x in nodes[i].get('name','').lower() for x in ('spine','chest','torso','hips')) for i in affected),'shoulders_animated':any('upperarm' in nodes[i].get('name','').lower() or 'clavicle' in nodes[i].get('name','').lower() for i in affected)}
        metrics['animations'].append(metric)
    complaints=[]
    has_core=any('skin' in n and any(token in n.get('name','').lower() for token in ('torso','body','chest','blazer','jacket')) for n in nodes)
    if not has_core:complaints.append({'level':'BLOCK','rule':'CORE_SKIN','reason':'Torso/body lacks skinned mesh; cannot deform with spine and shoulder bones'})
    if not any('spine' in name.lower() for name in named):complaints.append({'level':'BLOCK','rule':'SPINE_RIG','reason':'No spine bone/node detected in named hierarchy'})
    if not any('clavicle' in name.lower() or 'shoulder' in name.lower() and 'joint' not in name.lower() for name in named):complaints.append({'level':'BLOCK','rule':'CLAVICLE_RIG','reason':'No clavicle bone/node detected to bridge chest and upper arms'})
    if not any('head' in n.get('name','').lower() and 'skin' in n for n in nodes):complaints.append({'level':'WARN','rule':'HEAD_SKIN','reason':'Head mesh is unskinned; should follow head/neck rig and facial controls'})
    for d in metrics['skinned_details']:
        if d['vertices'] and ('hand' in d['node'].lower() or 'body' in d['node'].lower()) and d['single_influence_percent']>=99:complaints.append({'level':'BLOCK','rule':'HARD_FINGER_WEIGHTS','reason':f"{d['node']} has {d['single_influence_percent']}% one-bone vertices, no joint blending"})
        if d['invalid_weight_sum_vertices'] or d['out_of_range_joints']:complaints.append({'level':'BLOCK','rule':'SKIN_DATA','reason':f"Invalid weight/joint entries in {d['node']}"})
    if metrics['morph_target_primitives']==0:complaints.append({'level':'WARN','rule':'FACIAL_MORPHS','reason':'No morph targets for brows, eyes, mouth, cheeks or other non-manual markers'})
    if not any(a['torso_animated'] for a in metrics['animations']):complaints.append({'level':'WARN','rule':'TORSO_CLIPS','reason':'No animation modifies chest/spine/torso'})
    # Head bound entirely to Head bone is intentional; do not confuse with finger skinning.
    if len(skins)!=1:complaints.append({'level':'BLOCK','rule':'ONE_HUMANOID_SKIN','reason':'Expected one shared full body skeleton'})
    if not any('Body_SkinnedJacketSleeves'==n.get('name') and 'skin' in n for n in nodes):
        complaints.append({'level':'BLOCK','rule':'CONTINUOUS_JACKET','reason':'Unified jacket and sleeves are missing'})
    names={a.get('name') for a in animations}
    for clip in ['DEMO_SHOULDER_STRESS','DEMO_FIST','DEMO_HEAD_TURN']:
        if clip not in names:complaints.append({'level':'BLOCK','rule':'STRESS_CLIP','reason':clip+' missing'})
    metrics['findings']=complaints
    metrics['release_gate']='BLOCKED' if any(x['level']=='BLOCK' for x in complaints) else 'REVIEW_REQUIRED'
    return metrics

def main():
    a=argparse.ArgumentParser();a.add_argument('glb',type=pathlib.Path);a.add_argument('--json',dest='out',type=pathlib.Path);args=a.parse_args()
    try:r=inspect(args.glb)
    except Exception as e:print('ERROR:',e,file=sys.stderr);sys.exit(2)
    print(f"{args.glb.name}: {r['release_gate']}, meshes={r['mesh_nodes']}, skinned={r['skinned_mesh_nodes']}, bones={r['skin_joint_counts']}, clips={len(r['animations'])}")
    for d in r['skinned_details']:print(' ',d['node'],'vertices',d['vertices'],'1-bone:',str(d['single_influence_percent'])+'%')
    for f in r['findings']:print(' ',f['level'],f['rule'],f['reason'])
    if args.out:args.out.write_text(json.dumps(r,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    sys.exit(1 if r['release_gate']=='BLOCKED' else 0)
if __name__=='__main__':main()
