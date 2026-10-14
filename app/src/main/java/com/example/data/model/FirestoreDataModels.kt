package com.example.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.ServerTimestamp

@IgnoreExtraProperties
data class FirestoreUserProfile(
    @DocumentId val id: String = "",
    val username: String = "",
    val fullName: String = "",
    val isOnline: Boolean = false,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val lastSeen: Timestamp? = null
) {
    fun toDomainUser(): User {
        return User(
            id = id,
            username = username,
            fullName = fullName,
            isOnline = isOnline,
            lastSeen = lastSeen?.toDate()?.time ?: System.currentTimeMillis()
        )
    }
}

@IgnoreExtraProperties
data class FirestoreMessage(
    @DocumentId val id: String = "",
    val senderId: String = "",
    val receiverId: String = "",
    val content: String = "",
    val read: Boolean = false,
    @ServerTimestamp val createdAt: Timestamp? = null
) {
    fun toDomainMessage(): Message {
        return Message(
            id = id,
            senderId = senderId,
            receiverId = receiverId,
            content = content,
            timestamp = createdAt?.toDate()?.time ?: System.currentTimeMillis(),
            isRead = read
        )
    }
}
