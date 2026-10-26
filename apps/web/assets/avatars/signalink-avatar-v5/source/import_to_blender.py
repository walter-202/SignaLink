"""Blender 4.x/5.x CLI: import SignaLink V4 GLB and save editable .blend.
Usage: blender --background --python import_to_blender.py -- avatar.glb avatar.blend
"""
import bpy,sys
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if len(args)<2:raise SystemExit('Expected input.glb output.blend')
src=Path(args[0]).expanduser().resolve();dest=Path(args[1]).expanduser().resolve()
if not src.exists():raise SystemExit(f'File not found: {src}')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(src))
armatures=[o for o in bpy.data.objects if o.type=='ARMATURE']
meshes=[o for o in bpy.data.objects if o.type=='MESH']
print('Armatures:',len(armatures),'Meshes:',len(meshes))
if not armatures:raise RuntimeError('No armature in GLB')
for a in armatures:print('Armature:',a.name,'bones:',len(a.data.bones))
print('Shape keys:',[(m.name,list(m.data.shape_keys.key_blocks.keys())) for m in meshes if m.data.shape_keys])
bpy.ops.wm.save_as_mainfile(filepath=str(dest))
print('Saved',dest)
