package com.cheongyakone.infrastructure.kakao;

import com.cheongyakone.config.KakaoSelfProperties;
import org.springframework.stereotype.Component;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

@Component
public class KakaoSelfTokenCipher {
    private final KakaoSelfProperties properties;
    private final SecureRandom random = new SecureRandom();
    public KakaoSelfTokenCipher(KakaoSelfProperties properties) { this.properties = properties; }
    public String encrypt(String value) {
        try {
            byte[] iv = new byte[12]; random.nextBytes(iv);
            byte[] encrypted = cipher(Cipher.ENCRYPT_MODE, iv).doFinal(value.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + encrypted.length).put(iv).put(encrypted).array());
        } catch (Exception exception) { throw new IllegalStateException("Kakao credential encryption unavailable"); }
    }
    public String decrypt(String value) {
        try {
            byte[] payload = Base64.getDecoder().decode(value);
            if (payload.length < 29) throw new IllegalArgumentException();
            byte[] iv = java.util.Arrays.copyOfRange(payload, 0, 12);
            return new String(cipher(Cipher.DECRYPT_MODE, iv).doFinal(payload, 12, payload.length - 12), StandardCharsets.UTF_8);
        } catch (Exception exception) { throw new IllegalStateException("Kakao credentials require reconnection"); }
    }
    private Cipher cipher(int mode, byte[] iv) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(mode, new SecretKeySpec(Base64.getDecoder().decode(properties.tokenEncryptionKey()), "AES"), new GCMParameterSpec(128, iv));
        cipher.updateAAD("cheongyak:kakao-self:v1".getBytes(StandardCharsets.UTF_8));
        return cipher;
    }
}
