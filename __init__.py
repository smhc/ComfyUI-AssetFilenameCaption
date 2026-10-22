"""Frontend-only extension: file name + download button in ComfyUI's media lightbox.

No Python nodes. The extension exists only to serve ``web/filename_caption.js``
via ComfyUI's ``WEB_DIRECTORY`` mechanism.
"""

WEB_DIRECTORY = "./web"

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

__all__ = ["WEB_DIRECTORY", "NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
