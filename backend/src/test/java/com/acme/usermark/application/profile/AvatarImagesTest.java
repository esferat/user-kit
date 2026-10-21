package com.acme.usermark.application.profile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.acme.usermark.domain.shared.DomainException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AvatarImagesTest {

    @Test
    @DisplayName("center crops the upload into two square renditions")
    void rendersTwoSquares() throws Exception {
        AvatarImages.Rendered rendered = AvatarImages.render(encoded(120, 80, "jpg", BufferedImage.TYPE_INT_RGB), 64, 16);

        BufferedImage full = decode(rendered.full());
        assertThat(full.getWidth()).isEqualTo(64);
        assertThat(full.getHeight()).isEqualTo(64);

        BufferedImage thumbnail = decode(rendered.thumbnail());
        assertThat(thumbnail.getWidth()).isEqualTo(16);
        assertThat(thumbnail.getHeight()).isEqualTo(16);
    }

    @Test
    @DisplayName("re-encodes the upload as PNG")
    void writesPng() throws Exception {
        byte[] rendered = AvatarImages.render(encoded(32, 32, "bmp", BufferedImage.TYPE_INT_RGB), 8, 4).full();

        assertThat(rendered[0] & 0xFF).isEqualTo(0x89);
        assertThat(new String(rendered, 1, 3, StandardCharsets.US_ASCII)).isEqualTo("PNG");
    }

    @Test
    @DisplayName("rejects content that is not a decodable image")
    void rejectsGarbage() {
        assertThatThrownBy(() -> AvatarImages.render("not an image".getBytes(StandardCharsets.UTF_8), 64, 16))
                .isInstanceOf(DomainException.class)
                .extracting(exception -> ((DomainException) exception).code())
                .isEqualTo("invalid_image");
    }

    @Test
    @DisplayName("rejects an empty payload")
    void rejectsEmptyPayload() {
        assertThatThrownBy(() -> AvatarImages.render(new byte[0], 64, 16)).isInstanceOf(DomainException.class);
    }

    private static byte[] encoded(int width, int height, String format, int type) throws Exception {
        BufferedImage image = new BufferedImage(width, height, type);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, format, out);
        return out.toByteArray();
    }

    private static BufferedImage decode(byte[] content) throws Exception {
        return ImageIO.read(new java.io.ByteArrayInputStream(content));
    }
}
