"""Image integrity checks against the retained, official NASA source frames."""
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('prepare_assets',ROOT/'tools'/'prepare-assets.py')
pipeline=importlib.util.module_from_spec(spec);spec.loader.exec_module(pipeline)
CACHED_ORIGINALS=[ROOT/f'sources/nasa-original-{year}.png' for year in (1890,1900,1920,1950,1980,2000,2023)]
DOWNLOAD_AUDIT=ROOT/'qa/map-assets/official-download-verification.json'


@unittest.skipUnless(all(path.is_file() for path in CACHED_ORIGINALS),
    'Faltan los originales NASA locales (no incluidos en Git). Generarlos con '
    'python tools/prepare-assets.py y después python tools/prepare-extra-frames.py.')
class MapAssets(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.meta=json.loads((ROOT/'dist/assets/sources.json').read_text(encoding='utf8'))
        cls.frames=cls.meta['frames']+json.loads((ROOT/'dist/assets/extra-sources.json').read_text(encoding='utf8'))
        cls.mask,cls.crop,cls.center=pipeline.map_geometry(Image.open(ROOT/'sources/nasa-original-2023.png'))
        cls.size=(cls.meta['width'],cls.meta['height'])
        # Nearest-neighbor sampling uses source pixel centers. Compute the
        # expected indices independently of the production Pillow transform.
        left,top,right,bottom=cls.crop
        cls.x=left+np.floor((np.arange(cls.size[0])+.5)*(right-left)/cls.size[0]).astype(int)
        cls.y=top+np.floor((np.arange(cls.size[1])+.5)*(bottom-top)/cls.size[1]).astype(int)
        cls.alpha=cls.mask[cls.y[:,None],cls.x]

    def test_exterior_follows_original_rim_and_excludes_legend_and_timeline(self):
        self.assertEqual(list(self.crop),self.meta['crop'])
        self.assertEqual(self.center,1922.5)
        self.assertEqual(int(np.count_nonzero(self.mask[1560:,:285])),0)
        self.assertEqual(int(np.count_nonzero(self.mask[1923:])),0)
        for row in self.alpha:
            opaque=np.flatnonzero(row)
            self.assertGreater(len(opaque),0)
            self.assertTrue(np.all(row[opaque[0]:opaque[-1]+1]==255),'interior hole')

    def test_all_seven_frames_preserve_original_rgb_and_share_solid_alpha(self):
        self.assertEqual({f['year'] for f in self.frames},{1890,1900,1920,1950,1980,2000,2023})
        for frame in self.frames:
            with self.subTest(year=frame['year']):
                source=ROOT/f"sources/nasa-original-{frame['year']}.png"
                original=np.asarray(Image.open(source).convert('RGB'))
                output=ROOT/'dist'/frame['image']
                actual=np.asarray(Image.open(output).convert('RGBA'))
                np.testing.assert_array_equal(actual[:,:,:3],original[self.y[:,None],self.x])
                np.testing.assert_array_equal(actual[:,:,3],self.alpha)
                self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(),frame['sourceSha256'])
                self.assertEqual(hashlib.sha256(output.read_bytes()).hexdigest(),frame['imageSha256'])

    def test_dark_gray_interior_is_visible_without_being_repainted(self):
        actual=np.asarray(Image.open(ROOT/'dist/assets/temperature-1890.png').convert('RGBA'))
        rgb=actual[:,:,:3]
        formerly_erased=(rgb.max(2)-rgb.min(2)<=5)&(rgb.mean(2)<222)&(self.alpha==255)
        self.assertGreater(int(np.count_nonzero(formerly_erased)),50000)
        self.assertTrue(np.all(actual[:,:,3][formerly_erased]==255))

    def test_embedded_images_are_identical_to_public_pngs(self):
        for name,prefix in [('manifest.js','window.NASA_DATA = '),('extra-frames.js','window.EXTRA_NASA_FRAMES = ')]:
            text=(ROOT/'dist/assets'/name).read_text(encoding='utf8')
            data=json.loads(text[len(prefix):].strip().removesuffix(';'))
            frames=data['frames'] if isinstance(data,dict) else data
            for frame in frames:
                self.assertEqual(base64.b64decode(frame['imageDataUrl'].split(',',1)[1]),(ROOT/'dist'/frame['image']).read_bytes())

    @unittest.skipUnless(DOWNLOAD_AUDIT.is_file(),
        'Falta la auditoría local independiente qa/map-assets/official-download-verification.json; '
        'este control requiere volver a descargar y comparar los originales oficiales de 1890 y 2023.')
    def test_two_originals_match_independent_official_downloads(self):
        audit=json.loads(DOWNLOAD_AUDIT.read_text(encoding='utf8'))
        self.assertEqual({item['year'] for item in audit},{1890,2023})
        for item in audit:
            self.assertTrue(item['sourceUrl'].startswith('https://svs.gsfc.nasa.gov/vis/'))
            self.assertTrue(item['matchesLocal'])
            source=ROOT/f"sources/nasa-original-{item['year']}.png"
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(),item['sha256'])


if __name__=='__main__':unittest.main()
