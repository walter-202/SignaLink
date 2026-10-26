#!/usr/bin/env python3
"""SignaLink V5: refined unified-skinned stylized torso, fingers and signed-safe clips.
Procedural approximation of approved friendly look; not a validated LSB signer.
Requires numpy, scipy, scikit-image, trimesh and local V3 source module/textures.
"""
from pathlib import Path
import argparse, hashlib, json, math
import numpy as np
import trimesh
from scipy.spatial.transform import Rotation
from skimage.measure import marching_cubes
import build_signalink_avatar_v3 as base

GLB=base.GLB
CENTER = {'Hips':(0,.96,0),'Spine':(0,1.15,0),'Chest':(0,1.42,0), 'Neck':(0,1.585,.015),'Head':(0,1.78,.025)}

# Add glTF skinned meshes with normalized four-bone weighting and optional UVs.
def mesh_weighted(self,name,m,material,joints,weights,uv=None,morphs=None):
    vv=np.asarray(m.vertices,np.float32);ff=np.asarray(m.faces,np.uint32).ravel()
    weights=np.asarray(weights,np.float32)
    assert weights.shape==(len(vv),4)
    assert len(vv)==len(weights)==len(joints)
    assert np.allclose(weights.sum(axis=1),1,atol=.0001)
    joints=np.asarray(joints,np.uint16).copy()
    joints[weights==0]=0
    attr={'POSITION':self.acc(vv,'VEC3',target=34962,extrema=True),
          'NORMAL':self.acc(np.asarray(m.vertex_normals,np.float32),'VEC3',target=34962),
          'JOINTS_0':self.acc(joints,'VEC4',5123,target=34962),
          'WEIGHTS_0':self.acc(weights,'VEC4',target=34962)}
    if uv is not None:attr['TEXCOORD_0']=self.acc(np.asarray(uv,np.float32),'VEC2',target=34962)
    mi=len(self.doc['meshes'])
    primitive={'attributes':attr,'indices':self.acc(ff,'SCALAR',5125,target=34963),'material':material,'mode':4}
    record={'name':name,'primitives':[primitive]}
    if morphs:
        primitive['targets']=[]
        record['weights']=[0.0]*len(morphs)
        record['extras']={'morphNames':list(morphs.keys()),'linguisticValidation':'none'}
        for morph_name,delta in morphs.items():
            delta=np.asarray(delta,dtype=np.float32)
            assert delta.shape==vv.shape,(morph_name,delta.shape,vv.shape)
            primitive['targets'].append({'POSITION':self.acc(delta,'VEC3',target=34962,extrema=True)})
    self.doc['meshes'].append(record)
    return mi
GLB.mesh_weighted=mesh_weighted

def mix_smin(a,b,k):
    if k<=0:return np.minimum(a,b)
    h=np.maximum(k-np.abs(a-b),0)/k
    return np.minimum(a,b)-h*h*k/4

def capsule_sdf(xx,yy,zz,a,b,rad):
    a=np.asarray(a);b=np.asarray(b)
    px=xx-a[0];py=yy-a[1];pz=zz-a[2]
    ba=b-a;div=np.dot(ba,ba)
    t=np.clip((px*ba[0]+py*ba[1]+pz*ba[2])/div,0,1)
    return np.sqrt((px-t*ba[0])**2+(py-t*ba[1])**2+(pz-t*ba[2])**2)-rad

def ellipsoid_sdf(xx,yy,zz,c,r):
    # Conservative approximate signed distance; sufficient for stylized surfaces.
    return (np.sqrt(((xx-c[0])/r[0])**2+((yy-c[1])/r[1])**2+((zz-c[2])/r[2])**2)-1)*min(r)

def organic_jacket(res=.0095):
    limits=[(-.72,.72),(.88,1.63),(-.29,.51)]
    axis=[np.arange(low,high+res/2,res,dtype=np.float32) for low,high in limits]
    x,y,z=axis
    xx=x[:,None,None];yy=y[None,:,None];zz=z[None,None,:]
    # Tailored elliptical torso with a flat jacket hem rather than a round balloon.
    rx=np.interp(yy.ravel(),[.89,.95,1.12,1.34,1.44,1.54,1.60],[.316,.324,.340,.358,.357,.247,.12]).reshape(yy.shape)
    rz=np.interp(yy.ravel(),[.89,.96,1.12,1.35,1.48,1.59],[.149,.157,.166,.172,.150,.085]).reshape(yy.shape)
    zcenter=np.interp(yy.ravel(),[.89,1.2,1.56],[.005,0,-.03]).reshape(yy.shape)
    field=(np.sqrt((xx/rx)**2+((zz-zcenter)/rz)**2)-1)*.17
    # Upper chest rounds into clavicle but keeps a narrow neck.
    field=mix_smin(field,ellipsoid_sdf(xx,yy,zz,(0,1.465,-.01),(.319,.102,.137)),.020)
    # soft shoulders and bent sleeves are inside same closed continuous jacket shell
    for s in (-1,1):
        shoulder=(s*.405,1.475,-.012)
        elbow=(s*.547,1.255,.074)
        wrist=(s*.525,1.390,.330)
        field=mix_smin(field,ellipsoid_sdf(xx,yy,zz,shoulder,(.092,.093,.087)),.055)
        field=mix_smin(field,capsule_sdf(xx,yy,zz,shoulder,elbow,.069),.046)
        sleeve_end=np.asarray(wrist)-(np.asarray(wrist)-np.asarray(elbow))/np.linalg.norm(np.asarray(wrist)-np.asarray(elbow))*.033
        field=mix_smin(field,capsule_sdf(xx,yy,zz,elbow,sleeve_end,.057),.034)
    # cropped flat bottom, high neck clearance
    field=np.maximum(field,.920-yy)
    field=np.maximum(field,yy-1.59)
    vertices,faces,normals,_=marching_cubes(field,level=0,spacing=(res,res,res))
    vertices+=np.array([axis[0][0],axis[1][0],axis[2][0]])
    mesh=trimesh.Trimesh(vertices=vertices,faces=faces,process=False)
    # Mild nonshrinking smoothing reduces Marching Cubes facets without changing silhouette.
    trimesh.smoothing.filter_taubin(mesh,lamb=.38,nu=.40,iterations=3)
    if mesh.volume<0:mesh.invert()
    return mesh

def sdf_box(xx,yy,zz,c,r,rounding):
    px=np.abs(xx-c[0])-r[0];py=np.abs(yy-c[1])-r[1];pz=np.abs(zz-c[2])-r[2]
    return np.sqrt(np.maximum(px,0)**2+np.maximum(py,0)**2+np.maximum(pz,0)**2)+np.minimum(np.maximum(px,np.maximum(py,pz)),0)-rounding

FINGERS={'Little':(.066,[.038,.032,.025]),'Ring':(.022,[.047,.037,.028]),'Middle':(-.021,[.054,.040,.029]),'Index':(-.063,[.047,.037,.027])}

def organic_hand(wrist,side,res=.0037):
    sx=-1 if side=='Left' else 1
    # Geometry constructed in LOCAL hand coordinates; positioned at the world bind pose.
    bounds=[(-.185,.185),(-.090,.315),(-.090,.110)]
    grids=[np.arange(a,b+res/2,res,dtype=np.float32) for a,b in bounds]
    xx=grids[0][:,None,None];yy=grids[1][None,:,None];zz=grids[2][None,None,:]
    sdf=ellipsoid_sdf(xx,yy,zz,(0,.071,.027),(.074,.098,.038))
    sdf=mix_smin(sdf,ellipsoid_sdf(xx,yy,zz,(0,.106,.023),(.082,.061,.037)),.018)
    sdf=mix_smin(sdf,ellipsoid_sdf(xx,yy,zz,(0,.008,.026),(.047,.051,.036)),.014)
    segments={}
    for fname,(x,lns) in FINGERS.items():
        x=x*(-sx)
        pt=np.array([x,.137,.025]);q=[]
        for k,L in enumerate(lns):
            nxt=pt+np.array([0,L,0]);rad=(.0158 if fname!="Little" else .0147)*(.92**k)
            sdf=mix_smin(sdf,capsule_sdf(xx,yy,zz,pt,nxt,rad),.007 if k>0 else .013)
            q.append((pt.copy(),nxt.copy()));pt=nxt
        segments[fname]=q
    # thumb splays toward thumb side, as in existing V3 pose
    tx=-sx
    pt=np.array([tx*.072,.052,.035]);q=[]
    for k,L in enumerate([.051,.042,.035]):
        direction=np.array([tx*(.68 if k==0 else .51),(.73 if k==0 else .86),(.11 if k==0 else 0.)]);direction/=np.linalg.norm(direction)
        nxt=pt+L*direction
        sdf=mix_smin(sdf,capsule_sdf(xx,yy,zz,pt,nxt,.020*(.87**k)),.011 if k==0 else .006)
        q.append((pt.copy(),nxt.copy()));pt=nxt
    segments['Thumb']=q
    vv,ff,_,_=marching_cubes(sdf,0,spacing=(res,res,res))
    vv+=np.array([t[0] for t in grids]);vv+=np.asarray(wrist)
    m=trimesh.Trimesh(vertices=vv,faces=ff,process=False)
    trimesh.smoothing.filter_taubin(m,lamb=.38,nu=.40,iterations=2)
    if m.volume<0:m.invert()
    return m,segments

def dist_segment(vertices,a,b):
    a=np.asarray(a);v=np.asarray(b)-a;p=vertices-a
    t=np.clip((p@v)/max(v@v,1e-7),0,1)
    return np.linalg.norm(p-t[:,None]*v,axis=1)

def smoothstep(x):
    x=np.clip(x,0,1);return x*x*(3-2*x)

def weight_packed(rows,total):
    # rows: list[(bone_index, array or scalar)]
    num=len(rows[0][1])
    dense=np.zeros((num,total),dtype=np.float32)
    for idx,w in rows:dense[:,idx]+=w
    selected=np.argsort(dense,axis=1)[:,-4:][:,::-1]
    weights=np.take_along_axis(dense,selected,axis=1)
    weights/=np.maximum(np.sum(weights,axis=1,keepdims=True),1e-9)
    return selected.astype(np.uint16),weights.astype(np.float32)

def jacket_weights(m,idx,total):
    p=np.asarray(m.vertices);x,y,z=p.T;ax=np.abs(x)
    # Local contributions: trunk/chest/spine and both arm segments.
    hi=smoothstep((y-1.10)/.32)
    trunk=np.clip(1-smoothstep((ax-.30)/.225),0.008,1)
    weights=[(idx['Spine'],trunk*(1-hi)),(idx['Chest'],trunk*hi)]
    for side in ('Left','Right'):
        sign=-1 if side=='Left' else 1
        correct=smoothstep((sign*x-.20)/.20)
        a=np.array([sign*.405,1.475,-.012]);b=np.array([sign*.547,1.255,.074]);c=np.array([sign*.525,1.390,.330])
        d1=dist_segment(p,a,b);d2=dist_segment(p,b,c)
        a1=np.exp(-(d1/.17)**2);a2=np.exp(-(d2/.14)**2)
        arm=smoothstep((ax-.31)/.195)*correct
        weights.append((idx[side+'Clavicle'],arm*.16*np.exp(-((p-a)**2).sum(axis=1)/.013)))
        weights.append((idx[side+'UpperArm'],arm*a1*.94))
        weights.append((idx[side+'LowerArm'],arm*a2*.97))
        weights.append((idx[side+'Hand'],arm*smoothstep((z-.25)/.11)*.35))
    return weight_packed(weights,total)

def hand_weights(mesh,world_wrist,side,indices,total,segments):
    p=mesh.vertices-np.asarray(world_wrist);num=len(p);x,y,z=p.T
    # Assign each finger to its closest centerline, then blend only across its
    # own joints. Palm influence fades at the knuckle instead of leaking to tips.
    names=list(segments)
    distance=np.column_stack([np.min(np.column_stack([dist_segment(p,a,b) for a,b in segments[f]]),axis=1) for f in names])
    nearest=np.argmin(distance,axis=1)
    dense=np.zeros((num,total),np.float32)
    dense[:,indices[side+'Hand']]=1
    for fi,fname in enumerate(names):
        segs=segments[fname]
        direction=(segs[-1][1]-segs[0][0]);direction/=np.linalg.norm(direction)
        along=(p-segs[0][0])@direction
        lengths=np.array([np.linalg.norm(b-a) for a,b in segs])
        starts=np.r_[0,np.cumsum(lengths)[:-1]]
        gate=smoothstep((along+.018)/.040)*(nearest==fi)
        dense[:,indices[side+'Hand']]-=gate
        # At each joint use a narrow, continuous blend; distal tips remain rigid.
        transfer=[smoothstep((along-starts[k]+.010)/.020) for k in (1,2)]
        influences=[1-transfer[0],transfer[0]*(1-transfer[1]),transfer[1]]
        for k,weight in enumerate(influences):
            suffix=(['Metacarpal','Proximal','Distal'] if fname=='Thumb' else ['Proximal','Intermediate','Distal'])[k]
            dense[:,indices[side+fname+suffix]]+=gate*weight
    return weight_packed([(i,dense[:,i]) for i in range(total)],total)

def refined_face_mesh():
    # Closed smooth skull with a tapered jaw and a nose built into the surface.
    m=trimesh.creation.uv_sphere(count=[32,64])
    v=np.array(m.vertices)
    y=v[:,2].copy(); x=v[:,0].copy(); z=v[:,1].copy()
    jaw=.78+.22*smoothstep((y+.9)/.8)
    v[:,0]=x*.208*jaw;v[:,1]=1.775+y*.234;v[:,2]=.025+z*.170
    front=smoothstep(z/.6)
    nose=np.exp(-(v[:,0]/.035)**2-((v[:,1]-1.764)/.052)**2)
    bridge=np.exp(-(v[:,0]/.024)**2-((v[:,1]-1.805)/.07)**2)
    v[:,2]+=front*(.047*nose+.013*bridge)
    m.vertices=v
    return m

def refined_hair():
    res=.006
    axes=[np.arange(a,b,res) for a,b in [(-.25,.255),(1.70,2.09),(-.21,.23)]]
    x,y,z=axes[0][:,None,None],axes[1][None,:,None],axes[2][None,None,:]
    field=ellipsoid_sdf(x,y,z,(0,1.81,.005),(.220,.244,.189))
    # Blend swept strands into the scalp surface; no floating rigid ribbons.
    for a,b,r in [((-.15,1.977,.113),(.08,1.985,.117),.024),
                  ((-.13,2.008,.080),(.09,2.015,.080),.021),
                  ((-.09,2.035,.035),(.10,2.033,.035),.018)]:
        field=mix_smin(field,capsule_sdf(x,y,z,a,b,r),.025)
    # One cap, with a clean hairline and no duplicate atlas hair or floating locks.
    hairline=1.872+.049*np.tanh((z-.035)/.065)+.015*np.sin(x*12)
    field=np.maximum(field,hairline-y)
    vv,ff,_,_=marching_cubes(field,0,spacing=(res,res,res))
    vv+=np.array([a[0] for a in axes])
    m=trimesh.Trimesh(vertices=vv,faces=ff,process=True)
    trimesh.smoothing.filter_taubin(m,iterations=3)
    if m.volume<0:m.invert()
    return m

def centered_from_world(n,g,world_parent):
    """Attach world-space rest mesh below animated parent via inverse rest translation."""
    return g.node(n,parent=world_parent,t=tuple(-g.world(world_parent)[:3,3]))

def build(out,res=.0095):
    out=Path(out);g=GLB();g.doc['asset']['generator']='SignaLink V5.1 sculpted face and localized finger skinning'
    mat_skin=g.material('Matte warm skin','#E8AF8D',.79)
    mat_hair=g.material('Deep charcoal hair','#222833',.68)
    mat_high=g.material('Hair charcoal light','#2C3039',.79)
    mat_jacket=g.material('Uniform teal PBR blazer','#087B80',.83)
    mat_shirt=g.material('Warm white shirt','#FCFBF7',.80)
    mat_cuff=g.material('White tailored cuffs','#F5F8F7',.85)
    mat_iris=g.material('Dark glossy eye','#2A2425',.23)
    mat_white=g.material('Eye sclera','#FFFAF1',.48)
    mat_lip=g.material('Soft lips','#B76A57',.7)
    mat_mouth=g.material('Mouth interior','#572D30',.9)
    atlas=g.textured_material('Teal blazer atlas',Path(__file__).with_name('signalink_avatar_v5_blazer_atlas.png'))
    root=g.node('AvatarRoot')
    nodes={}
    def bone(name,parent,xyz):
        p=np.array([0,0,0]) if parent==root else g.world(parent)[:3,3]
        n=g.node(name,parent=parent,t=np.asarray(xyz)-p)
        nodes[name]=n;return n
    hips=bone('Hips',root,CENTER['Hips'])
    spine=bone('Spine',hips,CENTER['Spine'])
    chest=bone('Chest',spine,CENTER['Chest'])
    neck=bone('Neck',chest,CENTER['Neck'])
    head=bone('Head',neck,CENTER['Head'])
    finger_lengths={key:np.array(value[1]) for key,value in FINGERS.items()}
    hands={}; world_wrist={};fingers={}
    for side,sgn in [('Left',-1),('Right',1)]:
        clav=bone(side+'Clavicle',chest,(sgn*.27,1.49,-.012))
        upper=bone(side+'UpperArm',clav,(sgn*.405,1.475,-.012))
        lower=bone(side+'LowerArm',upper,(sgn*.547,1.255,.074))
        wrist=(sgn*.525,1.390,.330)
        hand=bone(side+'Hand',lower,wrist)
        world_wrist[side]=np.asarray(wrist)
        fingers[side]={}
        for fname,(x,lns) in FINGERS.items():
            x=x*(-sgn)
            previous=hand;parts=[];cum=0
            for k,L in enumerate(lns):
                name=side+fname+['Proximal','Intermediate','Distal'][k]
                xyz=np.asarray(wrist)+[x,.137+cum,.025]
                nd=bone(name,previous,xyz);previous=nd;parts.append(nd);cum+=L
            fingers[side][fname]=parts
        previous=hand;cum=np.zeros(3);pt=np.array([-sgn*.072,.052,.035])
        parts=[]
        for k,L in enumerate([.051,.042,.035]):
            direction=np.array([-sgn*(.68 if k==0 else .51),(.73 if k==0 else .86),(.11 if k==0 else 0)]);direction/=np.linalg.norm(direction)
            nd=bone(side+'Thumb'+['Metacarpal','Proximal','Distal'][k],previous,np.asarray(wrist)+pt)
            previous=nd;parts.append(nd);pt=pt+L*direction
        fingers[side]['Thumb']=parts
        hands[side]=hand
    rig=[nodes[n] for n in nodes]
    idcs={name:i for i,name in enumerate(nodes.keys())};total=len(rig)
    bind=np.asarray([np.linalg.inv(g.world(j)).T.reshape(16) for j in rig],dtype=np.float32)
    skin_i=len(g.doc['skins'])
    g.doc['skins'].append({'name':'SignaLink_FullBodySkin','skeleton':hips,'joints':rig,'inverseBindMatrices':g.acc(bind,'MAT4')})

    # One smoothly unified surface for torso AND both sleeves; NO rigid sleeve meshes.
    jacket=organic_jacket(res)
    ji,jw=jacket_weights(jacket,idcs,total)
    mi=g.mesh_weighted('ContinuousBlazerBodySleeves',jacket,atlas,ji,jw,uv=np.column_stack((np.clip(.5-jacket.vertices[:,0]/1.16,.02,.98),np.clip((jacket.vertices[:,1]-.920)/.65,0,1))))
    g.node('Body_SkinnedJacketSleeves',parent=root,mesh=mi,skin=skin_i)

    # A narrow three-dimensional lapel seam follows the cloth front silhouette.
    # The white shirt / lapel design is already represented by the jacket atlas;
    # broad extra polygons would intersect it, so only restrained edge detail
    # is added and is skinned to chest + spine (never scene-root rigid parts).
    def torso_front(x,y):
        rx=float(np.interp(y,[.89,.95,1.12,1.34,1.44,1.54,1.60],[.316,.324,.340,.358,.357,.247,.12]))
        rz=float(np.interp(y,[.89,.96,1.12,1.35,1.48,1.59],[.149,.157,.166,.172,.150,.085]))
        return rz*np.sqrt(max(.02,1-(x/rx)**2))+.008
    for s,side in [(-1,'Left'),(1,'Right')]:
        # ribbon extending from neck to chest. Two vertices per row.
        centers=[(.143,1.50),(.170,1.43),(.175,1.36),(.174,1.30)]
        vv=[];ff=[]
        for x,y in centers:
            for dx in (-.0045,.0045):
                xx=x+dx
                vv.append([s*xx,y,torso_front(xx,y)])
        for k in range(len(centers)-1):
            a=k*2;ff.extend([(a,a+1,a+2),(a+1,a+3,a+2)])
        shape=trimesh.Trimesh(vertices=np.asarray(vv),faces=np.asarray(ff),process=False)
        chestweight=np.clip((np.asarray(vv)[:,1]-1.02)/.42,.55,.98).astype(np.float32)
        ids,w=weight_packed([(idcs['Chest'],chestweight),(idcs['Spine'],1-chestweight)],total)
        meshid=g.mesh_weighted(side+'_LapelEdge',shape,mat_jacket,ids,w)
        g.node(side+'_SkinnedLapelEdge',parent=root,mesh=meshid,skin=skin_i)

    # No second jacket shell: source of V3/V4 surface intersections removed.

    # Hands consist of continuous watertight fingers and palm, not segmented capsules.
    for side in ('Left','Right'):
        hand_mesh,segs=organic_hand(world_wrist[side],side)
        hji,hjw=hand_weights(hand_mesh,world_wrist[side],side,idcs,total,segs)
        handmi=g.mesh_weighted(side+'_AnatomicContinuousHand',hand_mesh,mat_skin,hji,hjw)
        g.node(side+'_SkinnedHandMesh',parent=root,mesh=handmi,skin=skin_i)
        # Cuff is also weighted to forearm and hand so it follows both joints.
        w=world_wrist[side];prev=np.asarray([(-1 if side=='Left' else 1)*.547,1.255,.074])
        # Compact tubular shirt cuff following forearm orientation instead of
        # a large capsule, which looked like a detached white ball at the wrist.
        direction=(w-prev)/np.linalg.norm(w-prev)
        cuff_mesh=trimesh.creation.cylinder(radius=.054,height=.027,sections=32)
        cuff_mesh.apply_transform(trimesh.geometry.align_vectors([0,0,1], direction))
        cuff_mesh.apply_translation(w-direction*.025)
        along=(np.asarray(cuff_mesh.vertices)-w)@direction
        t=smoothstep((along+.047)/.042)
        cji,cjw=weight_packed([(idcs[side+'LowerArm'],1-t),(idcs[side+'Hand'],t)],total)
        mi=g.mesh_weighted(side+'_Cuff',cuff_mesh,mat_cuff,cji,cjw)
        g.node(side+'_SkinnedCuff',parent=root,mesh=mi,skin=skin_i)

    # Neck skinned from chest -> neck -> head. Face, hair and eyes share head control.
    neck_mesh=base.capsule((0,1.497,.007),(0,1.651,.023),.095)
    v=neck_mesh.vertices[:,1];h=smoothstep((v-1.52)/.125)
    ni,nw=weight_packed([(idcs['Chest'],.3*(1-h)),(idcs['Neck'],.7*np.ones(len(v))),(idcs['Head'],.3*h)],total)
    mi=g.mesh_weighted('NeckSkinSmooth',neck_mesh,mat_skin,ni,nw)
    g.node('Neck_SkinnedMesh',parent=root,mesh=mi,skin=skin_i)
    # Every visible facial feature follows the same Head skin transform. Actual
    # geometry replaces the old illustration that duplicated ears/hair on the skull.
    facial_nodes=[]
    def feature(name,m,material,morph_index=None,delta=None):
        num=len(m.vertices); ids=np.tile([idcs['Head'],0,0,0],(num,1));ww=np.tile([1,0,0,0],(num,1))
        morphs={key:np.zeros((num,3)) for key in ['BrowLiftTechnical','CheekSmileTechnical','EyeBlinkTechnical','MouthOpenTechnical']}
        if morph_index is not None:morphs[list(morphs)[morph_index]]=delta
        mi=g.mesh_weighted(name,m,material,ids,ww,morphs=morphs)
        node=g.node(name+'_Skinned',parent=root,mesh=mi,skin=skin_i)
        facial_nodes.append(node)
        return node
    hm=refined_face_mesh();hv=np.asarray(hm.vertices)
    d=np.zeros_like(hv);d[:,1]=.008*np.exp(-((abs(hv[:,0])-.10)/.045)**2-((hv[:,1]-1.71)/.04)**2)*smoothstep((hv[:,2]-.10)/.05)
    face_node=feature('HeadFaceSculpted',hm,mat_skin,1,d)
    head_attach=centered_from_world('HeadAttachedDetails',g,head)
    def hd(name,mesh,material):return g.add_geom(name,mesh,material,head_attach)
    for sign,side in [(-1,'Left'),(1,'Right')]:
        hd('Ear_'+side,base.ellipsoid((sign*.204,1.758,.012),(.026,.047,.022),3),mat_skin)
        cx=sign*.080;cy=1.810
        for name,center,radii,material in [
            ('Sclera',(cx,cy,.182),(.041,.047,.018),mat_white),
            ('Iris',(cx,cy,.198),(.022,.030,.007),mat_iris),
            ('Pupil',(cx,cy,.204),(.012,.021,.004),mat_hair),
            ('Catchlight',(cx-.007,cy+.012,.208),(.006,.008,.003),mat_white)]:
            m=base.ellipsoid(center,radii,3);delta=np.zeros_like(m.vertices)
            delta[:,1]=-(m.vertices[:,1]-cy)*.96
            feature(side+name,m,material,2,delta)
        points=[(cx+dx,1.875+.011*(1-(dx/.041)**2),.171) for dx in np.linspace(-.041,.041,8)]
        m=base.uv_loft(points,[.008]*8,10,2);delta=np.zeros_like(m.vertices);delta[:,1]=.018
        feature(side+'Brow',m,mat_hair,0,delta)
    # A continuous smile follows the head surface rather than intersecting it.
    def face_front(x,y):
        return .025+.170*np.sqrt(max(.01,1-((y-1.775)/.234)**2-(x/.205)**2))
    xs=np.linspace(-.057,.057,15)
    mouthpoints=[(x,1.697+.014*(x/.057)**2,face_front(x,1.697+.014*(x/.057)**2)+.006) for x in xs]
    mouth=base.uv_loft(mouthpoints,[.004+.003*(1-abs(x)/.057) for x in xs],12,2)
    delta=np.zeros_like(mouth.vertices);delta[:,1]=-.012
    feature('MouthSmile',mouth,mat_mouth,3,delta)
    lowerpoints=[(x,1.690+.014*(x/.052)**2,face_front(x,1.690+.014*(x/.052)**2)+.004) for x in np.linspace(-.052,.052,13)]
    lip=base.uv_loft(lowerpoints,[.003]*13,10,2);delta=np.zeros_like(lip.vertices);delta[:,1]=-.014
    feature('LowerLip',lip,mat_lip,3,delta)
    hd('Hair_ContinuousCap',refined_hair(),mat_hair)
    # Animations: all hold rest at t0 and tEnd, with seamless transitions.
    def quata(x=0,y=0,z=0):return base.qxyz((x,y,z))
    def keys(poses):return [(float(t),quata(*angles)) for t,angles in poses]
    def ease(t):return float(smoothstep((t-.10)/.28)*(1-smoothstep((t-.77)/.18)))
    clipdefs=[('IDLE_BREATH',4.0),('DEMO_OPEN_HAND',2.5),('DEMO_FIST',2.5),('DEMO_POINT',2.5),('DEMO_PINCH',2.5),('DEMO_TWO_HANDS',2.5),('DEMO_WRIST_ROTATION',2.5),('DEMO_FINGER_SPREAD',2.5),('DEMO_FULL_BODY_TEST',3.2),('DEMO_SHOULDER_STRESS',3.5),('DEMO_HEAD_TURN',2.8),('DEMO_ELBOW_STRESS',3.0),('DEMO_WRIST_FLEX',2.8)]
    def track(name,duration):
        times=[0.,round(duration*.20,4),round(duration*.44,4),round(duration*.7,4),round(duration*.86,4),duration]
        tracks={}
        for side in ['Left','Right']:
            s=-1 if side=='Left' else 1
            for finger,arr in fingers[side].items():
                for k,node in enumerate(arr):
                    bend=[.82,.97,.73][k] if finger!='Thumb' else [.48,.64,.44][k]
                    spread={'Little':-.25,'Ring':-.09,'Middle':.07,'Index':.23,'Thumb':-.08}.get(finger,0.)
                    pose=[]
                    for t in times:
                        a=ease(t/duration)
                        if name=='DEMO_OPEN_HAND':curl=.80*(1-a)
                        elif name in ('DEMO_FIST','DEMO_FULL_BODY_TEST','DEMO_SHOULDER_STRESS'):curl=a
                        elif name=='DEMO_POINT':curl=.03 if (side=='Right' and finger=='Index') else a*.85
                        elif name=='DEMO_PINCH':curl=a*(.6 if finger in ('Index','Thumb') else .18)
                        elif name=='DEMO_FINGER_SPREAD':curl=.07
                        elif name=='IDLE_BREATH':curl=.045
                        else:curl=.14
                        pitch=curl*bend
                        zrot=(spread*a if k==0 and name=='DEMO_FINGER_SPREAD' else 0.)*(1 if s==1 else -1)
                        pose.append((t,(pitch,0.,zrot)))
                    tracks[node]=keys(pose)
            for part in ('Clavicle','UpperArm','LowerArm','Hand'):
                node=nodes[side+part]
                poses=[]
                for t in times:
                    a=ease(t/duration)
                    if name=='DEMO_SHOULDER_STRESS':
                        axis={'Clavicle':(0,0,s*.23),'UpperArm':(-.14,0,s*.42),'LowerArm':(.20,0,-s*.15),'Hand':(0,s*.18,0)}[part]
                    elif name in ('DEMO_FULL_BODY_TEST','DEMO_TWO_HANDS'):
                        axis={'Clavicle':(0,0,s*.10),'UpperArm':(.16,0,s*.21),'LowerArm':(-.21,0,0),'Hand':(0,s*.18,0)}[part]
                    elif name=='DEMO_WRIST_ROTATION':axis=(.15,.44*s,0) if part=='Hand' else (0,0,0)
                    elif name=='DEMO_WRIST_FLEX':axis=(.42,0,s*.16) if part=='Hand' else (0,0,0)
                    elif name=='DEMO_ELBOW_STRESS':axis=(-.85,0,0) if part=='LowerArm' else ((-.10,0,s*.14) if part=='UpperArm' else (0,0,0))
                    elif name=='IDLE_BREATH':axis=(.02,0,.008*s) if part in ('Clavicle','UpperArm') else (0,0,0)
                    else:axis=(0,0,0)
                    poses.append((t,tuple(a*np.asarray(axis))))
                tracks[node]=keys(poses)
        for part in ('Spine','Chest','Neck','Head'):
            ps=[]
            for t in times:
                a=ease(t/duration)
                if name in ('DEMO_FULL_BODY_TEST','DEMO_SHOULDER_STRESS'):
                    rot={'Spine':(.05,0,.05),'Chest':(.04,.10,0),'Neck':(0,0,0),'Head':(0,-.07,0)}[part]
                elif name=='DEMO_HEAD_TURN':
                    rot={'Spine':(0,0,0),'Chest':(0,0,0),'Neck':(0,.10,0),'Head':(0,.31,-.04)}[part]
                elif name=='IDLE_BREATH':rot={'Spine':(.007,0,0),'Chest':(-.018,0,0),'Neck':(0,0,0),'Head':(0,0,0)}[part]
                else:rot=(0,0,0)
                ps.append((t,tuple(np.asarray(rot)*a)))
            tracks[nodes[part]]=keys(ps)
        g.add_animation(name,tracks)
    for nam,dur in clipdefs:track(nam,dur)
    # Provisional static handshape studies derived from the visible alphabet
    # chart, for human review only. They are NOT linked to the LSB catalog.
    for letter in ('A','B','L'):
        tracks={}
        for finger,arr in fingers['Left'].items():
            for k,node in enumerate(arr):
                if letter=='A': curl=0.04 if finger=='Thumb' else 0.92
                elif letter=='B': curl=0.64 if finger=='Thumb' else 0.0
                else: curl=0.0 if finger in ('Thumb','Index') else 0.92
                angle=curl*([.82,.97,.73][k] if finger!='Thumb' else [.48,.64,.44][k])
                spread=({'L':-.30,'B':.48}.get(letter,0.)) if finger=='Thumb' and k==0 else 0.
                tracks[node]=keys([(0,(0,0,0)),(.45,(angle,0,spread)),(1.8,(angle,0,spread)),(2.2,(0,0,0))])
        g.add_animation('QA_DACTILO_'+letter,tracks)
        g.doc['animations'][-1]['extras']={'status':'provisional-handshape-study','linguisticValidation':'none','source':'Villca alphabet chart; visual interpretation only'}
    for name,index in [('DEMO_BROW_LIFT',0),('DEMO_CHEEK_SMILE',1),('DEMO_EYE_BLINK',2),('DEMO_MOUTH_OPEN',3)]:
        moments=np.array([0.,.45,.8,1.35,1.8],np.float32)
        weights=np.zeros((5,4),np.float32)
        weights[:,index]=[0.,.55,1.,.55,0.]
        anim={'name':name,'samplers':[{'input':g.acc(moments,'SCALAR',extrema=True),
                                      'output':g.acc(weights.reshape(-1),'SCALAR'),
                                      'interpolation':'LINEAR'}],
              'channels':[{'sampler':0,'target':{'node':n,'path':'weights'}} for n in facial_nodes]}
        g.doc['animations'].append(anim)
    from retarget_hola import add_hola
    add_hola(g,nodes,Path(__file__).resolve().parents[4]/'public/avatars/signalink_avatar.glb')
    # glTF material factors are linear; atlas pixels remain in their sRGB texture.
    for material in g.doc['materials']:
        pbr=material['pbrMetallicRoughness']
        if 'baseColorTexture' not in pbr:
            rgb=pbr['baseColorFactor'][:3]
            pbr['baseColorFactor'][:3]=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    g.doc['asset']['copyright']='Procedural SignaLink V5.1 demonstration; LSB motions not linguistically validated.'
    g.doc['extras']={'project':'SignaLink','version':'v5.1-sculpted-face-rig','scope':'technology and UX QA; not LSB interpretation',
      'status':'needs-real-device-and-linguistic-validation', 'isValidatedLSB':False,'coordinateSystem':'Y up, +Z forward',
      'improvements':['single humanoid hierarchy','continuous jacket and sleeves surface','weighted shoulders and elbows','watertight palms and fingers','shared full-body skin','skinned lapels and collar','smoother fingertips and shoulders','four facial technical morph targets'],
      'limits':['facial morphs are only preliminary, not full LSB nonmanual markers','procedural silhouette, not faithful film-quality sculpt','clips are technical demonstrations']}
    # Skinned mesh transforms are ignored by glTF; put them at scene root.
    for i,n in enumerate(g.doc['nodes']):
        if 'skin' in n:
            g.doc['nodes'][root]['children'].remove(i)
            g.doc['scenes'][0]['nodes'].append(i)
            g.parents[i]=None
    path=g.save(out)
    meta={'file':path.name,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
          'nodes':len(g.doc['nodes']),'skins':len(g.doc['skins']),'jointCount':len(rig),'skinnedMeshNames':[n['name'] for n in g.doc['nodes'] if 'skin' in n],
          'clips':[a['name'] for a in g.doc['animations']], 'notValidatedLSB':True,'source':'build_signalink_avatar_v5.py'}
    path.with_suffix('.manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
    print(json.dumps(meta,ensure_ascii=False,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',default='signalink_avatar_v5_refined.glb');p.add_argument('--resolution',type=float,default=.012)
    args=p.parse_args();build(args.output,args.resolution)
