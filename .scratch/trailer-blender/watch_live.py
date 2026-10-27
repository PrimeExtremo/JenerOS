# Opens trailer.blend in Blender and reloads it every time Codex saves a new version,
# so you watch the scene grow live. Started by "Watch live in Blender.bat".
import os
import bpy

BLEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "trailer.blend")
seen = [0.0]


def check():
    try:
        mtime = os.path.getmtime(BLEND)
    except OSError:
        return 2.0  # Codex hasn't saved the first version yet
    if mtime != seen[0]:
        seen[0] = mtime
        frame = bpy.context.scene.frame_current if bpy.data.filepath else None
        # load_ui=False keeps your own viewport layout and camera angle between reloads.
        bpy.ops.wm.open_mainfile(filepath=BLEND, load_ui=False)
        if frame is not None:
            bpy.context.scene.frame_set(frame)
    return 2.0


bpy.app.timers.register(check, first_interval=0.5, persistent=True)
