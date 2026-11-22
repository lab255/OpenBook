"""Independent PDF decoder check; run with PyMuPDF installed outside the repo."""
import hashlib
import json
import re
import sys
from pathlib import Path
import pymupdf as pdf

base = Path(sys.argv[1])
reference = pdf.Pixmap(str(base) + '.pdf-reference.png')
html_boxes = json.loads(base.read_text())['pdfBoxes']
rows = []
for mode_index, mode in enumerate(('paged', 'continuous')):
    doc = pdf.open(str(base) + '.' + mode + '.pdf')
    text = ''.join(page.get_text() for page in doc)
    assert 'Before the drawing' in text and 'After the drawing' in text
    assert 'Inspect drawing' not in text, 'Print caption must be hidden, not orphaned'
    images = {tuple(image[:2]) for page in doc for image in page.get_images(full=True)}
    assert len(images) == 1, images
    xref, mask = next(iter(images))
    def assert_compressed(document):
        for stream_xref in (xref, mask):
            assert stream_xref and document.xref_get_key(stream_xref, 'Filter') == ('name', '/FlateDecode'), 'Drawing RGB and alpha streams must be losslessly compressed'
    assert_compressed(doc)
    alpha_visible_control = None
    for stream_xref in (xref, mask):
        mutant = pdf.open(stream=doc.tobytes(), filetype='pdf')
        mutant.xref_set_key(stream_xref, 'Filter', 'null')
        try:
            assert_compressed(mutant)
        except AssertionError:
            pass
        else:
            raise AssertionError('Missing stream-compression control did not fire')
        if stream_xref == mask:
            clip = doc[0].get_image_rects(xref)[0]
            good = doc[0].get_pixmap(matrix=pdf.Matrix(2, 2), clip=clip, alpha=False)
            bad = mutant[0].get_pixmap(matrix=pdf.Matrix(2, 2), clip=clip, alpha=False)
            assert (good.width, good.height) == (bad.width, bad.height)
            errors = [abs(a-b) for a,b in zip(good.samples, bad.samples)]
            changed = sum(any(errors[i:i+good.n]) for i in range(0,len(errors),good.n))
            assert changed > 0 and max(errors) > 1, 'Alpha filter corruption must visibly fail the drawing-region pixel check'
            alpha_visible_control = {'changedPixels':changed,'maxChannelError':max(errors),'scope':'Only SMask Filter removed; RGB unchanged; actual drawing rectangle rendered at 2px/pt'}
            bad.save(str(base)+'.'+mode+'.alpha-filter-control.png')
        mutant.close()
    assert len(doc) == 1, 'Fixture PDF must remain one page'
    image = pdf.Pixmap(doc, xref)
    if mask:
        image = pdf.Pixmap(image, pdf.Pixmap(doc, mask))
    assert (image.width, image.height, image.n) == (reference.width, reference.height, reference.n)
    assert image.samples == reference.samples, 'PDF embedded raster changed canvas pixels'
    locations = [rect for page in doc for rect in page.get_image_rects(xref) if not (rect & page.rect).is_empty]
    assert locations, 'Image resource exists but is not placed on a visible PDF page'
    box = html_boxes[mode_index]
    assert box['image']['width'] == 624
    assert reference.width == 3 * box['image']['width']
    assert reference.height == 3 * box['image']['height']
    scale = (612 - 2 * 48) / box['main']['width']
    expected_rect = pdf.Rect(48 + (box['image']['x'] - box['main']['x']) * scale,
                             48 + (box['image']['y'] - box['main']['y']) * scale,
                             48 + (box['image']['right'] - box['main']['x']) * scale,
                             48 + (box['image']['bottom'] - box['main']['y']) * scale)
    def assert_placement(rect):
        # Float32 PDF geometry rounding only; derived from the actual HTML box.
        assert max(abs(a-b) for a,b in zip(rect, expected_rect)) < .001
        assert abs(rect.width / rect.height - reference.width / reference.height) < .00001
        assert (rect & doc[0].rect).get_area() / rect.get_area() > .99
    assert len(locations) == 1, 'Fixture drawing must occupy one page'
    assert_placement(locations[0])
    for bad in [pdf.Rect(expected_rect.x0, expected_rect.y0, expected_rect.x0+1, expected_rect.y0+1),
                expected_rect + (1000, 1000, 1000, 1000)]:
        try:
            assert_placement(bad)
        except AssertionError:
            pass
        else:
            raise AssertionError('Size/off-page placement control did not fire')
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
            expected[index].insert_image(rect, filename=str(base) + '.pdf-reference.png', keep_proportion=False)
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
    rows.append({'mode': mode, 'pages': len(doc), 'pdfBytes':Path(str(base)+'.'+mode+'.pdf').stat().st_size, 'rgbAndMaskFlateDecode':True, 'compressionControlsFired':True, 'alphaVisibleControl':alpha_visible_control, 'imageWidth': image.width, 'imageHeight': image.height,
                 'exactEmbeddedRGBA': True, 'imagePixelSHA256': hashlib.sha256(image.samples).hexdigest(),
                 'expectedHtmlPlacement': list(expected_rect), 'placementControlsFired': True, 'visiblePlacements': [list(rect) for rect in locations], 'renderedDrawingRegions': rendered,
                 'text': text})
report = {'scope': 'Real toPdf outputs decoded independently with PyMuPDF. Exact embedded PNG RGBA and actual rendered drawing-region comparison against independent PNG placement over the document background (maximum 1/255 channel rounding), with stripped-image firing control and surrounding selectable text. Canvas text remains rasterized.', 'rows': rows}
output = Path(str(base) + '.pdf-readback.json')
output.write_text(json.dumps(report, indent=2))
assert json.loads(output.read_text()) == report
print('PASS: paged and continuous PDF retain exact drawing pixels, rendered drawing-region fidelity with strip-image control, and surrounding text.')
