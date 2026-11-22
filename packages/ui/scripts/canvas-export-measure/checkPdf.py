"""Independent PDF decoder check; run with PyMuPDF installed outside the repo."""
import hashlib
import json
import sys
from pathlib import Path
import pymupdf as pdf

base = Path(sys.argv[1])
reference = pdf.Pixmap(str(base) + '.reference.png')
rows = []
for mode in ('paged', 'continuous'):
    doc = pdf.open(str(base) + '.' + mode + '.pdf')
    text = ''.join(page.get_text() for page in doc)
    assert 'Before the drawing' in text and 'After the drawing' in text
    assert 'Inspect drawing (5 objects)' in text
    images = {tuple(image[:2]) for page in doc for image in page.get_images(full=True)}
    assert len(images) == 1, images
    xref, mask = next(iter(images))
    image = pdf.Pixmap(doc, xref)
    if mask:
        image = pdf.Pixmap(image, pdf.Pixmap(doc, mask))
    assert (image.width, image.height, image.n) == (reference.width, reference.height, reference.n)
    assert image.samples == reference.samples, 'PDF embedded raster changed canvas pixels'
    locations = [rect for page in doc for rect in page.get_image_rects(xref) if not (rect & page.rect).is_empty]
    assert locations, 'Image resource exists but is not placed on a visible PDF page'
    visible_ink = sum(sum(value < 240 for value in page.get_pixmap(matrix=pdf.Matrix(.5,.5)).samples) for page in doc)
    assert visible_ink > 1000
    # Blank-raster control proves the pixel comparison detects a lost drawing.
    assert bytes(len(reference.samples)) != reference.samples
    rows.append({'mode': mode, 'pages': len(doc), 'imageWidth': image.width, 'imageHeight': image.height,
                 'exactEmbeddedRGBA': True, 'imagePixelSHA256': hashlib.sha256(image.samples).hexdigest(),
                 'visiblePlacements': [list(rect) for rect in locations], 'renderedDarkChannels': visible_ink,
                 'text': text})
report = {'scope': 'Real toPdf outputs decoded independently with PyMuPDF. Exact embedded PNG RGBA, visible image placement, rendered nonblank pages and surrounding selectable text. Canvas text remains rasterized.', 'rows': rows}
output = Path(str(base) + '.pdf-readback.json')
output.write_text(json.dumps(report, indent=2))
assert json.loads(output.read_text()) == report
print('PASS: paged and continuous PDF retain exact drawing pixels, visible placement and surrounding text.')
