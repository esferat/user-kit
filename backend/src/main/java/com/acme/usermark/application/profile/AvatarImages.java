package com.acme.usermark.application.profile;

import com.acme.usermark.domain.shared.DomainException;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

/**
 * Normalizes an uploaded avatar into the square PNG renditions the UI needs.
 *
 * <p>The uploaded file is never stored as received: it is decoded, center cropped
 * to a square and re-encoded as PNG. Re-encoding drops every metadata block of the
 * original and rejects anything {@link ImageIO} cannot decode (SVG for example),
 * so no active content reaches the browser. The declared dimensions are checked
 * before the full decode, because a small file can still describe a huge bitmap.
 */
final class AvatarImages {

    /** Upper bound of decoded pixels; a few kilobytes can declare far more than that. */
    private static final long MAX_PIXELS = 25_000_000L;

    private AvatarImages() {
    }

    /**
     * Decodes the upload once and returns the two renditions, both a square PNG of
     * the requested edge length.
     */
    static Rendered render(byte[] source, int size, int thumbnailSize) {
        BufferedImage image = decode(source);
        return new Rendered(png(square(image, size)), png(square(image, thumbnailSize)));
    }

    private static BufferedImage decode(byte[] source) {
        try (ImageInputStream stream = ImageIO.createImageInputStream(new ByteArrayInputStream(source))) {
            if (stream == null) {
                throw invalidImage();
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) {
                throw invalidImage();
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(stream, true, true);
                long width = reader.getWidth(0);
                long height = reader.getHeight(0);
                // A short file can declare an enormous bitmap, so the dimensions are
                // checked before the decode that would allocate the pixels.
                if (width <= 0 || height <= 0 || width * height > MAX_PIXELS) {
                    throw DomainException.validation(
                            "invalid_image", "The image dimensions exceed the supported maximum");
                }
                BufferedImage image = reader.read(0);
                if (image == null) {
                    throw invalidImage();
                }
                return image;
            } finally {
                reader.dispose();
            }
        } catch (IOException exception) {
            throw invalidImage();
        }
    }

    /** Center crops the image to a square and scales it to {@code size} pixels. */
    private static BufferedImage square(BufferedImage image, int size) {
        int side = Math.min(image.getWidth(), image.getHeight());
        int x = (image.getWidth() - side) / 2;
        int y = (image.getHeight() - side) / 2;
        BufferedImage target = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
        Graphics2D graphics = target.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.drawImage(image, 0, 0, size, size, x, y, x + side, y + side, null);
        } finally {
            graphics.dispose();
        }
        return target;
    }

    private static byte[] png(BufferedImage image) {
        try {
            var out = new ByteArrayOutputStream();
            if (!ImageIO.write(image, "png", out)) {
                throw new IllegalStateException("The runtime has no PNG writer");
            }
            return out.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("The image could not be encoded as PNG", exception);
        }
    }

    private static DomainException invalidImage() {
        return DomainException.validation("invalid_image", "The uploaded file is not a supported image");
    }

    /** The two renditions of one upload. */
    record Rendered(byte[] full, byte[] thumbnail) {}
}
