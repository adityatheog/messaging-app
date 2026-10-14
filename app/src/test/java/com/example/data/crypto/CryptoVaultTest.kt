package com.example.data.crypto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CryptoVaultTest {

    @Test
    fun testKeyDerivationSymmetry() {
        val key1 = CryptoVault.derivePairwiseKey("user-alice", "user-bob")
        val key2 = CryptoVault.derivePairwiseKey("user-bob", "user-alice")
        assertEquals("Pairwise key derivation must be symmetric regardless of argument order",
            key1.encoded.toList(), key2.encoded.toList())
    }

    @Test
    fun testEncryptionAndDecryptionRoundtrip() {
        val key = CryptoVault.deriveKey("test-secret-seed-42")
        val originalMessage = "Hello SimpleLink! End-to-end encryption with AES-256-GCM."

        val ciphertext = CryptoVault.encrypt(originalMessage, key)
        assertNotEquals("Ciphertext must not match original plaintext", originalMessage, ciphertext)

        val decrypted = CryptoVault.decrypt(ciphertext, key)
        assertTrue("Decryption should succeed", decrypted.isSuccess)
        assertEquals("Decrypted message must match original", originalMessage, decrypted.getOrNull())
    }

    @Test
    fun testChannelEncryptionDecryption() {
        val sender = "user-alice"
        val receiver = "user-bob"
        val original = "Pairwise queue test message with secret ratcheting"

        val cipherPayload = CryptoVault.encryptForChannel(original, sender, receiver)
        assertTrue("Cipher payload must start with ENC:", cipherPayload.startsWith("ENC:"))

        // Bob decrypts payload from Alice
        val decryptedByBob = CryptoVault.decryptFromChannel(cipherPayload, receiver, sender)
        assertEquals("Bob must decrypt message from Alice", original, decryptedByBob)

        // Third party Eve cannot decrypt with wrong key
        val eveDecrypted = CryptoVault.decryptFromChannel(cipherPayload, "user-eve", sender)
        // Decryption fails with wrong key, returns original payload
        assertEquals("Eve must not be able to decrypt with mismatched channel key", cipherPayload, eveDecrypted)
    }

    @Test
    fun testCiphertextTamperResistance() {
        val key = CryptoVault.deriveKey("integrity-check-key")
        val message = "Top secret broadcast"
        val ciphertext = CryptoVault.encrypt(message, key)

        // Tamper with one byte in the base64 payload
        val tampered = if (ciphertext.startsWith("A")) "B" + ciphertext.substring(1) else "A" + ciphertext.substring(1)
        val decryptResult = CryptoVault.decrypt(tampered, key)
        assertFalse("Tampered ciphertext must fail authentication (GCM tag check)", decryptResult.isSuccess)
    }

    @Test
    fun testSafetyNumberGeneration() {
        val fingerprint1 = CryptoVault.generateSafetyNumber("identity-user-1")
        val fingerprint2 = CryptoVault.generateSafetyNumber("identity-user-1")
        val fingerprint3 = CryptoVault.generateSafetyNumber("identity-user-2")

        assertEquals("Safety numbers must be deterministic for identical input", fingerprint1, fingerprint2)
        assertNotEquals("Different identities must produce distinct safety numbers", fingerprint1, fingerprint3)
        assertTrue("Safety number format must match ABCD · EF01 · 2345 · 6789", fingerprint1.contains(" · "))
    }
}
