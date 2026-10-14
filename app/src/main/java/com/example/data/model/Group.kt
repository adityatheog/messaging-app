package com.example.data.model

data class Group(
    val id: String,
    val name: String,
    val description: String = "",
    val avatarColor: String = "#10B981",
    val memberIds: List<String> = emptyList(),
    val adminIds: List<String> = emptyList(),
    val createdAt: Long = System.currentTimeMillis(),
    val lastMessage: Message? = null,
    val unreadCount: Int = 0,
    val isEncrypted: Boolean = true
) {
    val initials: String
        get() {
            val trimmed = name.trim()
            if (trimmed.isEmpty()) return "G"
            val parts = trimmed.split("\\s+".toRegex()).filter { it.isNotEmpty() }
            return when {
                parts.size >= 2 -> "${parts[0].first()}${parts[1].first()}".uppercase()
                parts.isNotEmpty() -> parts[0].take(1).uppercase()
                else -> "G"
            }
        }
}
