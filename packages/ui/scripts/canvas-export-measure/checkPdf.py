"""Independent PDF decoder check; run with PyMuPDF installed outside the repo."""
import hashlib
import json
import re
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
    assert 'Inspect drawing' not in text, 'Print caption must be hidden, not orphaned'
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
    # The subject is the rendered DRAWING region, excluding page text. Build
    # an independent expected paint over the same document background using
    # the known PNG, rather than accepting a valid but invisible PDF resource.
    stripped = pdf.open(stream=doc.tobytes(), filetype='pdf')
    for page in stripped:
        page.delete_image(xref)
    expected = pdf.open(stream=stripped.tobytes(), filetype='pdf')
    rendered = []
    for index, page in enumerate(doc):
        for rect, transform in page.get_image_rects(xref, transform=True):
            clip = rect & page.rect
            if clip.is_empty:
                continue
            expected[index].insert_image(rect, filename=str(base) + '.reference.png', keep_proportion=False)
            # insert_image re-fits the image and can perturb its CTM even with
            # keep_proportion=False. Preserve the measured drawing transform,
            # not a second fitted box (which shifted smoothed stroke edges).
            a, b, c, d, x, y = transform
            assert b == c == 0 and a > 0 and d > 0, 'Unexpected rotated/reflected drawing'
            stream = expected[index].get_contents()[-1]
            content = expected.xref_stream(stream)
            matrix = f'{a:.12f} 0 0 {d:.12f} {x:.12f} {page.rect.height-y-d:.12f} cm'.encode()
            content, count = re.subn(rb'[-\d.]+ 0 0 [-\d.]+ [-\d.]+ [-\d.]+ cm', matrix, content)
            assert count == 1, 'Reference placement stream must contain one image transform'
            expected.update_stream(stream, content)
            assert tuple(expected[index].get_image_info()[-1]['transform']) == tuple(transform)
            target = expected[index].get_pixmap(matrix=pdf.Matrix(2, 2), clip=clip, alpha=False)
            actual = page.get_pixmap(matrix=pdf.Matrix(2, 2), clip=clip, alpha=False)
            missing = stripped[index].get_pixmap(matrix=pdf.Matrix(2, 2), clip=clip, alpha=False)
            def assert_drawing(pixels):
                assert (pixels.width, pixels.height) == (target.width, target.height)
                error = max(abs(a - b) for a, b in zip(pixels.samples, target.samples))
                # PDF transform rounding may differ by one 8-bit channel step.
                assert error <= 1, f'Rendered drawing differs from expected raster: max channel error {error}'
                return error
            error = assert_drawing(actual)
            try:
                assert_drawing(missing)
            except AssertionError:
                control_fired = True
            else:
                raise AssertionError('Stripping the PDF image did not fire the drawing-region check')
            rendered.append({'page': index + 1, 'clip': list(clip), 'transform': list(transform), 'width': actual.width, 'height': actual.height,
                             'maxChannelError': error, 'stripImageControlFired': control_fired})
    assert rendered
    rows.append({'mode': mode, 'pages': len(doc), 'imageWidth': image.width, 'imageHeight': image.height,
                 'exactEmbeddedRGBA': True, 'imagePixelSHA256': hashlib.sha256(image.samples).hexdigest(),
                 'visiblePlacements': [list(rect) for rect in locations], 'renderedDrawingRegions': rendered,
                 'text': text})
report = {'scope': 'Real toPdf outputs decoded independently with PyMuPDF. Exact embedded PNG RGBA and actual rendered drawing-region comparison against independent PNG placement over the document background (maximum 1/255 channel rounding), with stripped-image firing control and surrounding selectable text. Canvas text remains rasterized.', 'rows': rows}
output = Path(str(base) + '.pdf-readback.json')
output.write_text(json.dumps(report, indent=2))
assert json.loads(output.read_text()) == report
print('PASS: paged and continuous PDF retain exact drawing pixels, rendered drawing-region fidelity with strip-image control, and surrounding text.')
