package com.example.data.storage

import android.content.Context
import com.example.R
import com.example.data.model.FirestoreMessage
import com.example.data.model.FirestoreUserProfile
import com.example.data.model.Message
import com.example.data.model.User
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.util.UUID

class FirestoreMessageRepository(
    private val db: FirebaseFirestore,
    private val auth: FirebaseAuth
) {
    constructor(context: Context) : this(
        FirebaseFirestore.getInstance(context.getString(R.string.firestore_database_id)),
        FirebaseAuth.getInstance()
    )

    private fun requireUserId(): String {
        return auth.currentUser?.uid
            ?: throw IllegalStateException("User must be signed in before accessing Firestore.")
    }

    suspend fun createUserProfile(
        userId: String,
        username: String,
        fullName: String
    ): Result<User> {
        val path = "users/$userId"
        return try {
            val userRef = db.collection("users").document(userId)
            val snapshot = userRef.get().await()

            if (!snapshot.exists()) {
                val data = mapOf(
                    "id" to userId,
                    "username" to username.trim(),
                    "fullName" to fullName.trim().ifEmpty { username.trim() },
                    "isOnline" to true,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "lastSeen" to FieldValue.serverTimestamp()
                )
                userRef.set(data).await()
            } else {
                userRef.update(
                    mapOf(
                        "isOnline" to true,
                        "lastSeen" to FieldValue.serverTimestamp()
                    )
                ).await()
            }

            val updatedSnap = userRef.get().await()
            val profile = updatedSnap.toObject(FirestoreUserProfile::class.java)
                ?: FirestoreUserProfile(id = userId, username = username, fullName = fullName, isOnline = true)
            Result.success(profile.toDomainUser())
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, path)
            Result.failure(e)
        }
    }

    suspend fun updatePresence(isOnline: Boolean) {
        val uid = auth.currentUser?.uid ?: return
        val path = "users/$uid"
        try {
            db.collection("users").document(uid).update(
                mapOf(
                    "isOnline" to isOnline,
                    "lastSeen" to FieldValue.serverTimestamp()
                )
            ).await()
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, path)
        }
    }

    fun observeUsers(currentUserId: String): Flow<List<User>> = callbackFlow {
        val path = "users"
        val registration = db.collection("users")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    handleFirestoreError(error, OperationType.LIST, path)
                    close(error)
                    return@addSnapshotListener
                }

                if (snapshot != null) {
                    val users = snapshot.documents
                        .mapNotNull { it.toObject(FirestoreUserProfile::class.java)?.toDomainUser() }
                        .filter { it.id != currentUserId }
                    trySend(users)
                }
            }

        awaitClose { registration.remove() }
    }

    fun observeMessagesBetween(currentUserId: String, otherUserId: String): Flow<List<Message>> = callbackFlow {
        val path = "messages"
        // Query direct messages where current user is sender or receiver
        val registration = db.collection("messages")
            .whereIn("senderId", listOf(currentUserId, otherUserId))
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    handleFirestoreError(error, OperationType.LIST, path)
                    close(error)
                    return@addSnapshotListener
                }

                if (snapshot != null) {
                    val messages = snapshot.documents
                        .mapNotNull { it.toObject(FirestoreMessage::class.java)?.toDomainMessage() }
                        .filter {
                            (it.senderId == currentUserId && it.receiverId == otherUserId) ||
                                    (it.senderId == otherUserId && it.receiverId == currentUserId)
                        }
                        .sortedBy { it.timestamp }
                    trySend(messages)
                }
            }

        awaitClose { registration.remove() }
    }

    suspend fun sendMessage(
        senderId: String,
        receiverId: String,
        content: String
    ): Result<Message> {
        val uid = requireUserId()
        require(uid == senderId) { "Sender must be authenticated user" }

        val cleanContent = content.trim()
        if (cleanContent.isEmpty()) {
            return Result.failure(IllegalArgumentException("Message content cannot be empty"))
        }

        val msgId = UUID.randomUUID().toString()
        val path = "messages/$msgId"

        return try {
            val data = mapOf(
                "id" to msgId,
                "senderId" to senderId,
                "receiverId" to receiverId,
                "content" to cleanContent,
                "read" to false,
                "createdAt" to FieldValue.serverTimestamp()
            )
            db.collection("messages").document(msgId).set(data).await()

            val msg = Message(
                id = msgId,
                senderId = senderId,
                receiverId = receiverId,
                content = cleanContent,
                timestamp = System.currentTimeMillis(),
                isRead = false
            )
            Result.success(msg)
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, path)
            Result.failure(e)
        }
    }

    suspend fun markMessagesAsRead(senderId: String, receiverId: String) {
        val uid = requireUserId()
        require(uid == receiverId) { "Only recipient can mark message as read" }

        val path = "messages"
        try {
            val unreadDocs = db.collection("messages")
                .whereEqualTo("senderId", senderId)
                .whereEqualTo("receiverId", receiverId)
                .whereEqualTo("read", false)
                .get()
                .await()

            for (doc in unreadDocs.documents) {
                doc.reference.update("read", true).await()
            }
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, path)
        }
    }
}
