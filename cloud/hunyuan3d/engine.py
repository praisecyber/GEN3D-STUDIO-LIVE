"""GEN3D adapter for the unmodified upstream Hunyuan3D-2mini pipeline.
Text uses SDXL-Turbo to make a reference image before Hunyuan shape inference.
"""
import gc
from pathlib import Path

MODEL = 'tencent/Hunyuan3D-2mini'

class HunyuanEngine:
    model = MODEL + '/hunyuan3d-dit-v2-mini'

    def ready(self):
        import torch
        return torch.cuda.is_available()

    def generate(self, spec, directory, stage, cancelled):
        import torch
        from PIL import Image
        if not self.ready():
            raise RuntimeError('CUDA GPU unavailable')
        image = None
        try:
            if spec['mode'] == 'text':
                stage('creating_reference')
                from diffusers import AutoPipelineForText2Image
                pipe = AutoPipelineForText2Image.from_pretrained('stabilityai/sdxl-turbo', torch_dtype=torch.float16, variant='fp16', use_safetensors=True)
                pipe.enable_model_cpu_offload()
                try:
                    image = pipe(prompt=spec['prompt'] + ', single complete object, centered, plain white background, product render', num_inference_steps=4, guidance_scale=0.0, height=512, width=512, generator=torch.Generator('cpu').manual_seed(spec['seed'])).images[0]
                finally:
                    del pipe
                    gc.collect()
                    torch.cuda.empty_cache()
            else:
                with Image.open(directory / 'input.png') as source:
                    image = source.convert('RGBA')
            if cancelled():
                return None
            stage('removing_background')
            from hy3dgen.rembg import BackgroundRemover
            remover = BackgroundRemover()
            image = remover(image)
            del remover
            gc.collect()
            if cancelled():
                return None
            stage('creating_shape')
            from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
            pipe = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(MODEL, subfolder='hunyuan3d-dit-v2-mini', use_safetensors=True, device='cuda')
            try:
                mesh = pipe(image=image, num_inference_steps=spec['steps'], octree_resolution=256, num_chunks=2000, generator=torch.Generator('cuda').manual_seed(spec['seed']))[0]
                if cancelled():
                    return None
                stage('exporting')
                target = directory / 'model.glb'
                mesh.export(str(target), file_type='glb')
                return target
            finally:
                del pipe
        finally:
            if image is not None:
                image.close()
            gc.collect()
            torch.cuda.empty_cache()
