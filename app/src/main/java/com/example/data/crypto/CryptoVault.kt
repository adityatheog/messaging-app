package com.example.data.crypto

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Standard AES-256-GCM Cryptographic Vault for SimpleLink local payload encryption,
 * pairwise channel end-to-end ratchet simulation, and SHA-256 safety number fingerprint derivation.
 *
 * Fully compliant with Android API 26+ and JVM Unit Testing (using standard java.util.Base64).
 */
object CryptoVault {

    private const val AES_GCM_NO_PADDING = "AES/GCM/NoPadding"
    private const val GCM_TAG_LENGTH_BITS = 128
    private const val GCM_IV_LENGTH_BYTES = 12
    private const val CIPHER_PREFIX = "ENC:"

    private val secureRandom = SecureRandom()

    /**
     * Derives a 256-bit AES key from a seed or passphrase using SHA-256.
     */
    fun deriveKey(seed: String): SecretKeySpec {
        val digest = MessageDigest.getInstance("SHA-256").digest(seed.toByteArray(Charsets.UTF_8))
        return SecretKeySpec(digest, "AES")
    }

    /**
     * Derives a deterministic shared secret key for a pairwise channel between two peer IDs.
     * Sorts the two IDs so that Alice->Bob and Bob->Alice derive the identical symmetric key.
     */
    fun derivePairwiseKey(peerA: String, peerB: String): SecretKeySpec {
        val sorted = listOf(peerA, peerB).sorted().joinToString("::")
        return deriveKey("simplelink:pairwise:v1:$sorted")
    }

    /**
     * Encrypts plaintext bytes using AES-256-GCM with a fresh random 12-byte IV.
     * Output format: Base64( IV [12 bytes] + Ciphertext + GCM Tag [16 bytes] )
     */
    fun encrypt(plainText: String, secretKey: SecretKeySpec): String {
        val iv = ByteArray(GCM_IV_LENGTH_BYTES)
        secureRandom.nextBytes(iv)

        val cipher = Cipher.getInstance(AES_GCM_NO_PADDING)
        val spec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey, spec)

        val cipherBytes = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
        val combined = ByteArray(iv.size + cipherBytes.size)
        System.arraycopy(iv, 0, combined, 0, iv.size)
        System.arraycopy(cipherBytes, 0, combined, iv.size, cipherBytes.size)

        return Base64.getEncoder().encodeToString(combined)
    }

    /**
     * Decrypts ciphertext bytes using AES-256-GCM.
     */
    fun decrypt(encryptedBase64: String, secretKey: SecretKeySpec): Result<String> {
        return try {
            val combined = Base64.getDecoder().decode(encryptedBase64)
            if (combined.size < GCM_IV_LENGTH_BYTES) {
                return Result.failure(IllegalArgumentException("Ciphertext payload too short"))
            }

            val iv = ByteArray(GCM_IV_LENGTH_BYTES)
            val cipherBytes = ByteArray(combined.size - GCM_IV_LENGTH_BYTES)
            System.arraycopy(combined, 0, iv, 0, GCM_IV_LENGTH_BYTES)
            System.arraycopy(combined, GCM_IV_LENGTH_BYTES, cipherBytes, 0, cipherBytes.size)

            val cipher = Cipher.getInstance(AES_GCM_NO_PADDING)
            val spec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)
            cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)

            val decrypted = cipher.doFinal(cipherBytes)
            Result.success(String(decrypted, Charsets.UTF_8))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Encrypts plaintext for a pairwise channel between sender and receiver.
     * Prepends "ENC:" so the system knows the payload is encrypted.
     */
    fun encryptForChannel(plainText: String, senderId: String, receiverId: String): String {
        val key = derivePairwiseKey(senderId, receiverId)
        val encrypted = encrypt(plainText, key)
        return "$CIPHER_PREFIX$encrypted"
    }

    /**
     * Decrypts a payload for a pairwise channel if it starts with "ENC:".
     * If not encrypted, returns plaintext as-is.
     */
    fun decryptFromChannel(payload: String, senderId: String, receiverId: String): String {
        if (!payload.startsWith(CIPHER_PREFIX)) {
            return payload
        }
        val cipherBody = payload.removePrefix(CIPHER_PREFIX)
        val key = derivePairwiseKey(senderId, receiverId)
        return decrypt(cipherBody, key).getOrDefault(payload)
    }

    /**
     * Generates a 16-character cryptographic safety fingerprint using SHA-256.
     * Formatted as: ABCD · EF01 · 2345 · 6789
     */
    fun generateSafetyNumber(identityData: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(identityData.toByteArray(Charsets.UTF_8))
        val hex = digest.joinToString("") { "%02X".format(it) }
        return "${hex.substring(0, 4)} · ${hex.substring(4, 8)} · ${hex.substring(8, 12)} · ${hex.substring(12, 16)}"
    }
}
