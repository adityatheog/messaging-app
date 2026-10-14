package com.example.data.model

data class User(
    val id: String,
    val username: String,
    val fullName: String,
    val isOnline: Boolean = false,
    val lastSeen: Long = System.currentTimeMillis()
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
}
