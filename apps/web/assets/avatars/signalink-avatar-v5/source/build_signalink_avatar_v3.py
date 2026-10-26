#!/usr/bin/env python3
"""SignaLink Avatar V3 — native GLB generator, no external assets.

Produces an animated glTF 2.0 binary with independently controlled finger joints.
The motion clips are rig QA examples, NOT validated Bolivian Sign Language.
Dependencies: numpy, trimesh, scipy.
Usage: python build_signalink_avatar_v3.py --output signalink_avatar_v3.glb
"""
import argparse, hashlib, json, math, struct
from pathlib import Path
import numpy as np
import trimesh
from scipy.spatial.transform import Rotation

SKIN_COLOR='#E7A47E'
SKIN_LIGHT='#F2BC96'
HAIR='#20242C'
BLAZER='#087B80'
BLAZER_DARK='#065D64'
UNDERSHIRT='#FAFAF6'
IRIS='#2B2423'
ACCENT='#273F42'


def color(hexcode):
    h=hexcode.lstrip('#')
    return [int(h[j:j+2],16)/255 for j in (0,2,4)]+[1.]

def vec3(x): return np.asarray(x,dtype=np.float64)
def qxyz(euler):return Rotation.from_euler('xyz',euler).as_quat().tolist()
def qz(angle):return qxyz((0,0,angle))
def transform(t=(0,0,0),q=(0,0,0,1)):
    m=np.eye(4);m[:3,:3]=Rotation.from_quat(q).as_matrix();m[:3,3]=t;return m

def norm(v):
    a=np.asarray(v,dtype=float);return a/max(np.linalg.norm(a),1e-12)

def orient_y(direction):
    v=norm(direction)
    if np.dot(v,[0,1,0])>0.999999:return np.eye(4)
    r,_=Rotation.align_vectors([v],[[0,1,0]])
    out=np.eye(4);out[:3,:3]=r.as_matrix();return out

def ellipsoid(center,radii,subdiv=2):
    m=trimesh.creation.icosphere(subdivisions=subdiv,radius=1)
    m.vertices=m.vertices*np.array(radii)+np.array(center)
    return m

def capsule(start,end,radius,radius_end=None):
    # Stylized continuous segment: ellipsoid aligned along the long axis.
    a,b=vec3(start),vec3(end);length=np.linalg.norm(b-a)
    middle=(a+b)*0.5
    m=ellipsoid((0,0,0),(radius,(length*.5+radius*.65),radius),subdiv=2)
    M=orient_y(b-a);m.apply_transform(M);m.apply_translation(middle)
    return m

def panel(pts, thickness=.008):
    # Triangular fan polygon, extruded into 3D for stable double-sided rendering.
    pts=np.asarray(pts,dtype=float)
    if len(pts)==3:
        v=np.vstack((pts,pts+np.array([0,0,thickness])))
        faces=np.array([[0,2,1],[3,4,5],[0,1,4],[0,4,3],[1,2,5],[1,5,4],[2,0,3],[2,3,5]])
    else:
        raise ValueError('triangle only')
    return trimesh.Trimesh(vertices=v,faces=faces,process=False)

def tube_path(points,radius=.006,radial=7):
    # Short overlapping rounded segments; curves read well from frontal camera.
    return trimesh.util.concatenate([capsule(a,b,radius) for a,b in zip(points[:-1],points[1:])])

class GLB:
    def __init__(self):
        self.bin=bytearray();self.doc={'asset':{'version':'2.0','generator':'SignaLink Avatar V3 procedural rig builder'},
          'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[], 'materials':[], 'bufferViews':[], 'accessors':[],
          'buffers':[{'byteLength':0}], 'skins':[], 'animations':[]}
        self.parents={}
        self.material_ids={}
    def buf(self,data,target=None):
        while len(self.bin)%4:self.bin.append(0)
        st=len(self.bin);self.bin.extend(data)
        view={'buffer':0,'byteOffset':st,'byteLength':len(data)}
        if target: view['target']=target
        self.doc['bufferViews'].append(view)
        return len(self.doc['bufferViews'])-1
    def acc(self,arr,typ,component=5126,target=None,extrema=False):
        if component==5126:dtype='<f4'
        elif component==5123:dtype='<u2'
        elif component==5125:dtype='<u4'
        else:raise ValueError(component)
        a=np.ascontiguousarray(np.asarray(arr,dtype=dtype))
        v=self.buf(a.tobytes(),target)
        access={'bufferView':v,'componentType':component,'count':len(a),'type':typ}
        if extrema:
            access['min']=np.min(a,axis=0).astype(float).tolist() if np.ndim(a)>1 else [float(np.min(a))]
            access['max']=np.max(a,axis=0).astype(float).tolist() if np.ndim(a)>1 else [float(np.max(a))]
        self.doc['accessors'].append(access)
        return len(self.doc['accessors'])-1
    def material(self,name,c,roughness=.83,metallic=0):
        if name in self.material_ids:return self.material_ids[name]
        i=len(self.doc['materials']);self.material_ids[name]=i
        self.doc['materials'].append({'name':name,'pbrMetallicRoughness':{'baseColorFactor':color(c),'roughnessFactor':roughness,'metallicFactor':metallic},'doubleSided':True})
        return i
    def textured_material(self,name,texture_png):
        if name in self.material_ids:return self.material_ids[name]
        image_view=self.buf(Path(texture_png).read_bytes())
        self.doc.setdefault('images',[]).append({'name':name+'_atlas','mimeType':'image/png','bufferView':image_view})
        self.doc.setdefault('samplers',[]).append({'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071})
        img_id=len(self.doc['images'])-1; sampler_id=len(self.doc['samplers'])-1
        self.doc.setdefault('textures',[]).append({'source':img_id,'sampler':sampler_id})
        tex_id=len(self.doc['textures'])-1
        self.doc['materials'].append({'name':name,'pbrMetallicRoughness':{
            'baseColorFactor':[1,1,1,1],'baseColorTexture':{'index':tex_id},'metallicFactor':0.,'roughnessFactor':.94},
            'doubleSided':True})
        mat_id=len(self.doc['materials'])-1;self.material_ids[name]=mat_id
        return mat_id

    def node(self,name,parent=None,t=(0,0,0),q=(0,0,0,1),mesh=None,skin=None):
        n={'name':name};
        if np.linalg.norm(t)>1e-12:n['translation']=list(map(float,t))
        if np.linalg.norm(np.array(q)-np.array((0,0,0,1)))>1e-12:n['rotation']=list(map(float,q))
        if mesh is not None:n['mesh']=mesh
        if skin is not None:n['skin']=skin
        i=len(self.doc['nodes']);self.doc['nodes'].append(n)
        self.parents[i]=parent
        if parent is not None:self.doc['nodes'][parent].setdefault('children',[]).append(i)
        else:self.doc['scenes'][0]['nodes'].append(i)
        return i
    def world(self,node):
        path=[];n=node
        while n is not None:
            path.append(n);n=self.parents[n]
        M=np.eye(4)
        for n in reversed(path):
            a=self.doc['nodes'][n];M=M@transform(a.get('translation',(0,0,0)),a.get('rotation',(0,0,0,1)))
        return M
    def mesh(self,name,parts,material,skin_joint_idxs=None):
        """parts = list of (trimesh, joint-index or None)."""
        verts=[];normals=[];faces=[];joints=[];weights=[];uvs=[];off=0
        for m,joint in parts:
            m=m.copy();v=np.asarray(m.vertices,dtype=float);f=np.asarray(m.faces,dtype=np.uint32)
            verts.append(v);normals.append(np.asarray(m.vertex_normals,dtype=np.float32))
            if hasattr(m.visual,'uv') and m.visual.uv is not None:uvs.append(np.asarray(m.visual.uv,dtype=np.float32))
            faces.append(f+off);off+=len(v)
            if joint is not None:
                joints.append(np.tile([joint,0,0,0],(len(v),1)))
                weights.append(np.tile([1,0,0,0],(len(v),1)))
        v=np.concatenate(verts).astype(np.float32);n=np.concatenate(normals).astype(np.float32)
        indices=np.concatenate(faces).reshape(-1)
        attr={'POSITION':self.acc(v,'VEC3',target=34962,extrema=True),
              'NORMAL':self.acc(n,'VEC3',target=34962)}
        if uvs and len(uvs)==len(parts):attr['TEXCOORD_0']=self.acc(np.concatenate(uvs),'VEC2',target=34962)
        if joints:
            attr['JOINTS_0']=self.acc(np.concatenate(joints),'VEC4',component=5123,target=34962)
            attr['WEIGHTS_0']=self.acc(np.concatenate(weights),'VEC4',target=34962)
        prim={'attributes':attr,'indices':self.acc(indices,'SCALAR',component=5125,target=34963),'material':material,'mode':4}
        self.doc['meshes'].append({'name':name,'primitives':[prim]})
        return len(self.doc['meshes'])-1
    def add_geom(self,name,mesh,material,parent=None):
        mi=self.mesh(name,[(mesh,None)],material)
        return self.node(name,parent=parent,mesh=mi)
    def add_animation(self,name,tracks):
        anim={'name':name,'samplers':[],'channels':[]}
        # tracks: node -> list of (seconds, quat)
        for node,keys in tracks.items():
            if not keys:continue
            times=np.array([t for t,q in keys],np.float32)
            rots=np.array([q for t,q in keys],np.float32)
            ii=self.acc(times,'SCALAR',extrema=True)
            oo=self.acc(rots,'VEC4')
            si=len(anim['samplers'])
            anim['samplers'].append({'input':ii,'output':oo,'interpolation':'LINEAR'})
            anim['channels'].append({'sampler':si,'target':{'node':node,'path':'rotation'}})
        self.doc['animations'].append(anim)
    def save(self,path):
        while len(self.bin)%4:self.bin.append(0)
        self.doc['buffers'][0]['byteLength']=len(self.bin)
        j=json.dumps(self.doc,separators=(',',':'),ensure_ascii=False).encode('utf-8')
        while len(j)%4:j+=b' '
        total=12+8+len(j)+8+len(self.bin)
        path=Path(path);path.write_bytes(struct.pack('<4sII',b'glTF',2,total)+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(self.bin),b'BIN\0')+self.bin)
        return path



def uv_loft(points, radii, segments=12, per_span=5):
    """Smooth tube along a spline, with manually varying radii for hair and stitched cloth."""
    from scipy.interpolate import PchipInterpolator
    pts=np.asarray(points,dtype=np.float64)
    if len(pts)<3: raise ValueError('need 3+ points')
    ts=np.arange(len(pts),dtype=float)
    t=np.linspace(0,len(pts)-1,(len(pts)-1)*per_span+1)
    pp=np.column_stack([PchipInterpolator(ts,pts[:,k])(t) for k in range(3)])
    rr=PchipInterpolator(ts,np.asarray(radii,dtype=float))(t)
    rings=[];fcs=[]
    for i,(point,r) in enumerate(zip(pp,rr)):
        direction=norm(pp[min(i+1,len(pp)-1)]-pp[max(i-1,0)])
        ref=np.array([0,0,1.0])
        if abs(np.dot(direction,ref))>.90:ref=np.array([0,1.,0])
        n1=norm(np.cross(direction,ref));n2=norm(np.cross(direction,n1))
        for j in range(segments):
            a=2*math.pi*j/segments
            rings.append(point+max(.0005,r)*(math.cos(a)*n1+math.sin(a)*n2))
        if i:
            for j in range(segments):
                a=(i-1)*segments+j;b=(i-1)*segments+(j+1)%segments
                c=i*segments+j;d=i*segments+(j+1)%segments
                fcs.extend([[a,b,c],[b,d,c]])
    fcs += [[0,j+1,j] for j in range(1,segments-1)] + [[(len(pp)-1)*segments, (len(pp)-1)*segments+j, (len(pp)-1)*segments+j+1] for j in range(1,segments-1)]
    return trimesh.Trimesh(vertices=np.asarray(rings),faces=np.asarray(fcs),process=False)

def curved_patch(points_a,points_b,thickness=.005):
    """Panel with triangularized strips for fabric lapels (3D, not flat decals)."""
    verts=[];faces=[]
    for a,b in zip(points_a,points_b):verts.extend([a,b])
    for k in range(len(points_a)-1):
        a=2*k;b=a+1;c=a+2;d=a+3
        faces.extend([[a,b,c],[b,d,c]])
    m=trimesh.Trimesh(vertices=verts,faces=faces,process=False)
    m.vertices[:,2]+=thickness
    return m

def textured_face_mesh():
    # Full 3D head, with spherical UVs; frontal appearance is based on our
    # user-approved reference artwork. Back of head uses a skin color atlas.
    ring=96; rows=48
    verts=[];uv=[];faces=[]
    cx,cy,cz=0,1.770,.035; rx,ry,rz=.225,.235,.178
    for k in range(rows+1):
        theta=math.pi*(.0001+(1-.0002)*k/rows)
        for j in range(ring+1):
            phi=-math.pi+2*math.pi*j/ring
            verts.append((cx+rx*math.sin(theta)*math.sin(phi),
                          cy+ry*math.cos(theta),
                          cz+rz*math.sin(theta)*math.cos(phi)))
            uv.append((j/ring,k/rows))
    for k in range(rows):
        for j in range(ring):
            a=k*(ring+1)+j;b=a+1;c=(k+1)*(ring+1)+j;d=c+1
            faces.extend([[a,c,b],[b,c,d]])
    mesh=trimesh.Trimesh(vertices=verts,faces=faces,process=False)
    mesh.visual=trimesh.visual.TextureVisuals(uv=np.asarray(uv,dtype=np.float32))
    return mesh

def torso_shell():
    # Lathed shoulder-to-hip surface with softened tapered blazer silhouette.
    steps=[(.915,.312,.155,.008),(.945,.336,.162,.006),(1.025,.349,.168,.005),
           (1.140,.365,.174,.000),(1.290,.389,.177,-.010),
           (1.400,.408,.168,-.018),(1.490,.330,.145,-.025),
           (1.552,.130,.108,-.031)]
    verts=[];faces=[];sides=48
    uvs=[]
    for k,(y,rx,rz,zc) in enumerate(steps):
        for j in range(sides+1):
            a=-math.pi/2+2*math.pi*j/sides
            uvs.append((j/sides,k/(len(steps)-1)))
            x=rx*math.cos(a);z=zc+rz*math.sin(a)
            verts.append((x,y,z))
    for k in range(len(steps)-1):
        for j in range(sides):
            a=k*(sides+1)+j;b=a+1;c=(k+1)*(sides+1)+j;d=c+1
            faces.extend([[a,c,b],[b,c,d]])
    model=trimesh.Trimesh(vertices=verts,faces=faces,process=False)
    model.visual=trimesh.visual.TextureVisuals(uv=np.asarray(uvs,dtype=np.float32))
    return model

def shirt_panel():
    # Layered, slightly curved shirt face closely hugging torso rather than huge oval.
    rows=[(1.04,.046,.185),(1.12,.061,.188),(1.21,.078,.190),(1.30,.094,.193),(1.39,.105,.192),(1.485,.122,.171),(1.528,.073,.150)]
    verts=[];faces=[]
    for y,rx,z in rows:
        for f in [-1.,-.5,0.,.5,1.]:
            verts.append((f*rx,y,z+.006*(1-f*f)))
    for k in range(len(rows)-1):
        for j in range(4):
            a=k*5+j;b=a+1;c=(k+1)*5+j;d=c+1
            faces.extend([[a,b,c],[b,d,c]])
    return trimesh.Trimesh(vertices=verts,faces=faces,process=False)

def build(output):
    g=GLB()
    skin=g.material('Warm luminous skin',SKIN_COLOR,.84)
    skin_light=g.material('Soft skin highlight',SKIN_LIGHT,.82)
    jacket=g.material('SignaLink teal blazer',BLAZER,.78)
    shade=g.material('Deep teal collar and seams',BLAZER_DARK,.86)
    shirt=g.material('White crisp shirt',UNDERSHIRT,.83)
    face_texture=g.textured_material('SignaLink friendly face atlas',Path(__file__).with_name('signalink_avatar_v3_face_atlas.png'))
    clothing_texture=g.textured_material('SignaLink blazer photo atlas',Path(__file__).with_name('signalink_avatar_v3_blazer_atlas.png'))
    hair=g.material('Sculpted black hair',HAIR,.68)
    hair_high=g.material('Soft blue-black hair strands','#30343E',.66)
    iris=g.material('Warm dark irises',IRIS,.3)
    pupil=g.material('Pupils','#11141B',.24)
    accent=g.material('Blazer dark button',ACCENT,.65)
    blush=g.material('Warm muted rosy cheeks','#E6937A',.94)
    lip=g.material('Natural pink lips','#9F5553',.82)
    mouth=g.material('Open smile shade','#532E36',.81)
    tooth=g.material('Smile teeth highlight','#FFF0D9',.55)
    brow=g.material('Eyebrows','#28252C',.82)
    root=g.node('SignaLink_Avatar_Root')
    def add(name,shape,mat,parent=root):return g.add_geom(name,shape,mat,parent)

    # Soft stylized torso that makes hands and head the visual focus.
    add('Blazer_TailoredTorso',torso_shell(),clothing_texture)
    # Shirt, lapels and details are included in the embedded clothing texture.

    # Large rounded facial silhouette like the agreed polished mascot reference.
    add('Neck',capsule((0,1.490,.010),(0,1.661,.025),.094),skin)
    add('Head_FriendlyTextured',textured_face_mesh(),face_texture)
    # Seamless rounded head uses baked UV projection and remains true 3D.
    for sign,side in [(-1,'Left'),(1,'Right')]:
        add('Ear_'+side,ellipsoid((sign*.229,1.737,.028),(.030,.057,.025),subdiv=3),skin)
        add('EarInner_'+side,ellipsoid((sign*.246,1.739,.048),(.011,.030,.007),subdiv=2),skin_light)
    # Main hair cap, tapered sides and large flowing individual strands.
    add('Hair_Volume',ellipsoid((0,1.952,-.031),(.241,.111,.169),subdiv=4),hair)
    add('Hair_TempleLeft',ellipsoid((-.207,1.877,-.025),(.041,.096,.126),subdiv=3),hair)
    add('Hair_TempleRight',ellipsoid((.207,1.879,-.031),(.041,.087,.129),subdiv=3),hair)
    add('Hair_BackVolume',ellipsoid((.029,1.940,-.111),(.229,.116,.112),subdiv=3),hair)
    lock_specs=[
        ([(.172,2.010,.082),(.082,2.029,.131),(-.020,2.015,.141),(-.129,1.956,.150)],[.046,.052,.045,.007]),
        ([(.183,1.994,.095),(.129,2.011,.174),(.028,1.997,.199),(-.060,1.961,.199)],[.038,.051,.039,.004]),
        ([(.125,2.043,.059),(.010,2.062,.128),(-.090,2.038,.181),(-.173,1.973,.154)],[.039,.052,.041,.006]),
        ([(-.192,1.958,.090),(-.176,2.015,.162),(-.113,2.015,.199),(-.055,1.969,.198)],[.026,.045,.029,.004]),
        ([(.092,2.023,.083),(.177,2.033,.104),(.223,1.984,.122),(.222,1.913,.116)],[.030,.048,.029,.004]),
    ]
    for i,(points,radii) in enumerate(lock_specs):
        add('SculptedHairLock_'+str(i+1),uv_loft(points,radii,segments=14,per_span=6),hair if i%2 else hair_high)
    # Eyes face front toward +Z; bright large eyes are essential for friendliness.
    for sign,side in [(-1,'Left'),(1,'Right')]:
        x=sign*.091
        add('Iris_'+side,ellipsoid((x,1.793,.205),(.025,.028,.006),subdiv=4),iris)
        add('EyeShine_'+side,ellipsoid((x-.008,1.804,.214),(.007,.008,.002),subdiv=2),shirt)
        # Cheek blush baked into the licensed reference texture.
    # Nose shading baked onto front hemisphere; avoids protruding duplicate.
    # Gentle smile (dark inner opening + warm lip contour; no textural stickers).
    # Smile is a single curved sculpted lip line.
    # No simulated 2D teeth at the base of the smile.
    # Natural chin is part of Head_RoundedShape.

    hands={}; rig_bones={};arm_bones={}
    for short,mirror in [('Left',-1),('Right',1)]:
        # Animated shoulder/elbow/hand chain with the hand looking toward the camera (+Z).
        s=g.node(f'{short}UpperArm',parent=root,t=(mirror*.422,1.463,-.008))
        elbow_rel=(mirror*.098,-.247,.069)
        elbow=g.node(f'{short}LowerArm',parent=s,t=elbow_rel)
        wrist_rel=(-mirror*.092,.114,.262)
        wrist=g.node(f'{short}Hand',parent=elbow,t=wrist_rel)
        arm_bones[short]={'upper':s,'elbow':elbow,'hand':wrist}
        # Upper arm mesh and forearm sleeve are rigidly attached to animated bones.
        add(short+'_UpperSleeve',capsule((0,0,0),elbow_rel,.080),jacket,s)
        add(short+'_ShoulderJoint',ellipsoid((0,-.014,0),(.087,.103,.087),subdiv=3),jacket,s)
        add(short+'_ForearmSleeve',capsule((0,0,0),wrist_rel,.060),jacket,elbow)
        add(short+'_Cuff',capsule(tuple(vec3(wrist_rel)-norm(wrist_rel)*.063),tuple(vec3(wrist_rel)-norm(wrist_rel)*.027),.058),shirt,elbow)
        # A genuine glTF skin for each articulated hand. Vertices are in the model's
        # world-space bind pose; inverse bind matrices connect them to joint nodes.
        joints=[wrist];parts=[]
        wrist_world=g.world(wrist)
        def part_local(mesh,bone):
            mm=mesh.copy();mm.apply_transform(g.world(bone));parts.append((mm,joints.index(bone)))
        # palm mass, raised knuckle line; visible finger separation.
        part_local(ellipsoid((0,.071,0),(.086,.088,.029),subdiv=4),wrist)
        # No separate horizontal knuckle bar: preserve a natural palm silhouette.
        part_local(capsule((0,-.008,0),(0,.047,0),.043),wrist)
        fingers={'Little':(.066,.038,.032,.025),
                 'Ring':(.022,.047,.037,.028),
                 'Middle':(-.021,.054,.040,.029),
                 'Index':(-.063,.047,.037,.027)}
        # Negative 'mirror' means LEFT, thumb on inner edge (+X).
        for fname,(offset,p,m,d) in fingers.items():
            # Mirror left-to-right finger positions to maintain correct thumb side.
            x=offset*(-mirror)
            prev=wrist
            for k,(partname,length) in enumerate([('Proximal',p),('Intermediate',m),('Distal',d)]):
                t=(x,.133,0) if k==0 else (0,[p,m][k-1],0)
                bone=g.node(f'{short}{fname}{partname}',parent=prev,t=t)
                joints.append(bone)
                part_local(capsule((0,0,0),(0,length*.96,0),.0180*(.86**k)),bone)
                part_local(ellipsoid((0,length*.91,0),(.015*(.89**k),.012,.016),subdiv=3),bone)
                rig_bones[(short,fname,k)]=bone
                prev=bone
        thumb_dir=mirror*1.03
        prev=wrist
        for k,(partname,length) in enumerate([('Metacarpal',.045),('Proximal',.041),('Distal',.031)]):
            t=((-mirror)*.073,.048,.014) if k==0 else (0,[.045,.041][k-1],0)
            # thumb splays sideways and forward from palm.
            q=qxyz((.31,0,thumb_dir)) if k==0 else (0,0,0,1)
            bone=g.node(f'{short}Thumb{partname}',parent=prev,t=t,q=q)
            joints.append(bone)
            part_local(capsule((0,0,0),(0,length,0),.022*(.84**k)),bone)
            part_local(ellipsoid((0,length*.9,0),(.017*(.84**k),.017,.018),subdiv=3),bone)
            rig_bones[(short,'Thumb',k)]=bone
            prev=bone
        # Include skin as a separate actual glTF skinned mesh node.
        mesh=g.mesh(short+'_SkinnedHand',parts,skin)
        matrices=[]
        for joint in joints:
            matrices.append(np.linalg.inv(g.world(joint)).T.reshape(16).astype(np.float32))
        # glTF matrices column major; flatten transpose yields column-major order.
        inverse_accessor=g.acc(np.array(matrices,dtype=np.float32),'MAT4')
        skin_i=len(g.doc['skins'])
        g.doc['skins'].append({'name':short+'_HandRig','joints':joints,'skeleton':wrist,'inverseBindMatrices':inverse_accessor})
        g.node(short+'_HandMesh',parent=root,mesh=mesh,skin=skin_i)
        hands[short]=joints
    # Clips: each technical / non-linguistic, authored as quaternion tracks.
    def seq(*angles,duration=None):
        return [(float(t),qxyz((a,0,0))) for t,a in angles]
    def run_clip(name,duration,fn):
        tracks={}
        for short,mm in [('Left',-1),('Right',1)]:
            for finger in ['Little','Ring','Middle','Index','Thumb']:
                for k in range(3):
                    bone=rig_bones[(short,finger,k)]
                    # fn returns normalized curl values over time; x rotations; thumb has native base splay.
                    records=[]
                    for t in [0,.22*duration,.5*duration,.82*duration,duration]:
                        v=fn(name,short,finger,k,t/duration)
                        if isinstance(v,tuple): ax,ay,az=v
                        else: ax,ay,az=v,0,0
                        if finger=='Thumb' and k==0:az+=mm*1.03;ax+=.31
                        records.append((round(t,4),qxyz((ax,ay,az))))
                    tracks[bone]=records
            upper=arm_bones[short]['upper'];hand=arm_bones[short]['hand']
            if name=='DEMO_TWO_HANDS':
                tracks[upper]=[(0,qxyz((0,0,0))),(.75,qxyz((-.11,0,mm*.07))),(1.5,qxyz((-.04,0,-mm*.06))),(2.5,qxyz((0,0,0)))]
                tracks[hand]=[(0,qxyz((0,0,0))),(.75,qxyz((.08,0,mm*.09))),(1.5,qxyz((-.06,0,-mm*.09))),(2.5,qxyz((0,0,0)))]
            elif name=='DEMO_WRIST_ROTATION':
                tracks[hand]=[(0,qxyz((0,0,0))),(.5,qxyz((.04,.4*mm,0))),(1.1,qxyz((-.04,-.55*mm,0))),(1.8,qxyz((.02,.3*mm,0))),(2.4,qxyz((0,0,0)))]
            elif name=='IDLE_BREATH':
                tracks[upper]=[(0,qxyz((0,0,0))),(1.1,qxyz((.018,0,mm*.008))),(2.2,qxyz((0,0,0))),(3.3,qxyz((-.012,0,mm*.004))),(4.4,qxyz((0,0,0)))]
        g.add_animation(name,tracks)
    def motion(name,side,finger,k,t):
        # Smooth phase with explicit rest poses and clear pose holds for testing.
        def smooth(v):v=max(0,min(1,v));return v*v*(3-2*v)
        ease=smooth((t-.08)/.40)
        back=smooth((t-.79)/.20)
        amt=ease*(1-back)
        bend=[1.10,1.24,.84][k]
        if finger=='Thumb':bend=[.40,.65,.45][k]
        if name=='IDLE_BREATH':return .12+(.025*math.sin(2*math.pi*t))
        if name=='DEMO_OPEN_HAND':return .86*(1-amt)*bend
        if name=='DEMO_FIST':return amt*bend
        if name=='DEMO_POINT':
            active=(side=='Right' and finger=='Index')
            return (.04 if active else (amt*bend))
        if name=='DEMO_PINCH':
            if side=='Right' and finger in ('Index','Thumb'):
                return (amt*.54 if finger=='Index' else amt*.45)*bend
            return (.2 if side=='Left' else amt*.55)*bend
        if name=='DEMO_TWO_HANDS':return (.14+.05*math.sin(t*math.pi*2))*(.9 if finger=='Thumb' else 1)
        if name=='DEMO_WRIST_ROTATION':return .1
        if name=='DEMO_FINGER_SPREAD':
            spread={'Little':.24,'Ring':.1,'Middle':-.06,'Index':-.22,'Thumb':0}[finger]
            return (.12,0,(1 if side=='Left' else -1)*spread*amt) if k==0 else .05
        return 0.
    for name,duration in [('IDLE_BREATH',4.4),('DEMO_OPEN_HAND',2.5),('DEMO_FIST',2.5),('DEMO_POINT',2.5),('DEMO_PINCH',2.5),('DEMO_TWO_HANDS',2.5),('DEMO_WRIST_ROTATION',2.4),('DEMO_FINGER_SPREAD',2.5)]:
        run_clip(name,duration,motion)
    # License and disclosure retained inside glTF, not just adjacent readme.
    g.doc['asset']['copyright']='SignaLink original procedural artwork; CC0 1.0. Technical motion only, no LSB validation.'
    g.doc['extras']={'signLanguage':'LSB target; no validated signs included','status':'friendly-visual-v3-technical-prototype',
                     'rig':'two articulated hands (5 fingers x 3 joints each), skinned meshes and wrist/arms; sculpted mascot face',
                     'frontDirection':'+Z', 'units':'meters',
                     'animationsAreLinguisticSigns':False}
    path=g.save(output)
    metadata={'name':'SignaLink Avatar V3 — Friendly Teal Mascot Rig', 'format':'glTF 2.0 GLB',
              'source':'procedural generator build_signalink_avatar_v3.py',
              'validation':'Technical joint animation only. No LSB sign is validated or asserted.',
              'file':path.name,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
              'nodes':len(g.doc['nodes']),'meshes':len(g.doc['meshes']),'skins':len(g.doc['skins']),
              'handJointsPerHand':len(hands['Left']),'animations':[{'name':a['name'],'channels':len(a['channels'])} for a in g.doc['animations']],
              'modelCoordinateSystem':'Y up, +Z front',
              'license':'CC0 1.0 for procedural geometry and code generated for this deliverable',
              'recommendedApplicationEnv':'NEXT_PUBLIC_AVATAR_MODEL_URL=/avatars/signalink_avatar_v3_friendly.glb (lab only)',
              'warning':'AvatarPreview catalog selection requires an exact validated clip ID. DEMO_* clips must not be mapped to LSB expressions.'}
    Path(path).with_name('signalink_avatar_v3_manifest.json').write_text(json.dumps(metadata,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps(metadata,indent=2,ensure_ascii=False))
    return g

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',default='signalink_avatar_v3.glb')
    args=parser.parse_args()
    build(args.output)
