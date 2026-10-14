package com.example.data.model

data class User(
    val id: String,
    val username: String,
    val fullName: String,
    val isOnline: Boolean = false,
    val lastSeen: Long = System.currentTimeMillis(),
    val isContact: Boolean = true,
    val isBlocked: Boolean = false,
    val isVerified: Boolean = false,
    val safetyNumber: String = generateDefaultSafetyNumber(id),
    val pairwiseQueueAddress: String = "sx://broker.simplexlink.net/q/${id.take(8)}",
    val disappearingTimerSeconds: Int = 0
) {
    val displayName: String
        get() = if (fullName.isNotBlank()) fullName else username

    val initials: String
        get() {
            val name = displayName.trim()
            if (name.isEmpty()) return "?"
            val parts = name.split("\\s+".toRegex()).filter { it.isNotEmpty() }
            return when {
                parts.size >= 2 -> "${parts[0].first()}${parts[1].first()}".uppercase()
                parts.isNotEmpty() && parts[0].length >= 2 -> parts[0].take(2).uppercase()
                parts.isNotEmpty() -> parts[0].take(1).uppercase()
                else -> "?"
            }
        }

    companion object {
        fun generateDefaultSafetyNumber(id: String): String {
            val hash = (id.hashCode().toLong() and 0xFFFFFFFFL).toString(16).padStart(8, '0').uppercase()
            val chunk1 = hash.take(4)
            val chunk2 = hash.takeLast(4)
            val rev = hash.reversed()
            val chunk3 = rev.take(4)
            val chunk4 = rev.takeLast(4)
            return "$chunk1 · $chunk2 · $chunk3 · $chunk4"
        }
    }
}

