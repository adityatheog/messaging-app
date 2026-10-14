package com.example.data.storage

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import com.example.data.model.Message
import com.example.data.model.User
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.security.MessageDigest
import java.util.UUID

class MessageRepository(context: Context) {

    private val dbHelper = AppDatabaseHelper(context)
    private val scope = CoroutineScope(Dispatchers.IO)

    // Flow for realtime message updates
    private val _messagesUpdateTrigger = MutableSharedFlow<Pair<String, String>>(replay = 1)
    val messagesUpdateTrigger = _messagesUpdateTrigger.asSharedFlow()

    // Active session presence
    private val _activePresence = MutableStateFlow<Set<String>>(emptySet())
    val activePresence = _activePresence.asStateFlow()

    init {
        scope.launch {
            seedDemoDataIfNeeded()
        }
    }

    private suspend fun seedDemoDataIfNeeded() = withContext(Dispatchers.IO) {
        val db = dbHelper.writableDatabase
        val cursor = db.rawQuery("SELECT COUNT(*) FROM users", null)
        val count = if (cursor.moveToFirst()) cursor.getInt(0) else 0
        cursor.close()

        if (count == 0) {
            val now = System.currentTimeMillis()
            val demoUsers = listOf(
                User("user-sarah", "sarah_j", "Sarah Jenkins", true, now),
                User("user-alex", "alex_r", "Alex Rivera", true, now),
                User("user-david", "david_c", "David Chen", false, now - 3600_000),
                User("user-emily", "emily_w", "Emily Watson", true, now),
                User("user-michael", "mscott", "Michael Scott", false, now - 86400_000)
            )

            for (user in demoUsers) {
                val cv = ContentValues().apply {
                    put("id", user.id)
                    put("username", user.username)
                    put("password_hash", hashPassword("password123"))
                    put("full_name", user.fullName)
                    put("created_at", user.lastSeen)
                    put("last_seen", user.lastSeen)
                }
                db.insert("users", null, cv)
            }

            // Seed initial conversation messages between users
            val sampleMessages = listOf(
                Message(
                    id = UUID.randomUUID().toString(),
                    senderId = "user-sarah",
                    receiverId = "user-alex",
                    content = "Hey Alex! Did you get a chance to review the new design prototypes?",
                    timestamp = now - 1800_000,
                    isRead = true
                ),
                Message(
                    id = UUID.randomUUID().toString(),
                    senderId = "user-alex",
                    receiverId = "user-sarah",
                    content = "Yes, absolutely! The micro-interactions and color tokens look phenomenal.",
                    timestamp = now - 1500_000,
                    isRead = true
                ),
                Message(
                    id = UUID.randomUUID().toString(),
                    senderId = "user-sarah",
                    receiverId = "user-alex",
                    content = "Awesome. Let's sync up after the standup call.",
                    timestamp = now - 900_000,
                    isRead = true
                )
            )

            for (msg in sampleMessages) {
                insertMessageDirect(msg)
            }

            _activePresence.value = setOf("user-sarah", "user-alex", "user-emily")
        }
    }

    suspend fun registerUser(
        username: String,
        password: String,
        fullName: String
    ): Result<User> = withContext(Dispatchers.IO) {
        val cleanUsername = username.trim()
        val cleanFullName = fullName.trim().ifEmpty { cleanUsername }

        if (cleanUsername.length < 3) return@withContext Result.failure(IllegalArgumentException("Username must be at least 3 characters"))
        if (cleanUsername.length > 30) return@withContext Result.failure(IllegalArgumentException("Username must be at most 30 characters"))
        if (password.length < 6) return@withContext Result.failure(IllegalArgumentException("Password must be at least 6 characters"))
        if (password.length > 72) return@withContext Result.failure(IllegalArgumentException("Password must be at most 72 characters"))

        val db = dbHelper.writableDatabase
        val existing = db.rawQuery("SELECT id FROM users WHERE LOWER(username) = LOWER(?)", arrayOf(cleanUsername))
        val exists = existing.moveToFirst()
        existing.close()

        if (exists) {
            return@withContext Result.failure(IllegalArgumentException("Username already exists"))
        }

        val newId = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()
        val cv = ContentValues().apply {
            put("id", newId)
            put("username", cleanUsername)
            put("password_hash", hashPassword(password))
            put("full_name", cleanFullName)
            put("created_at", now)
            put("last_seen", now)
        }

        val rowId = db.insert("users", null, cv)
        if (rowId == -1L) {
            return@withContext Result.failure(IllegalStateException("Failed to save user"))
        }

        val user = User(
            id = newId,
            username = cleanUsername,
            fullName = cleanFullName,
            isOnline = true,
            lastSeen = now
        )

        // Seed an initial welcome message from Sarah Jenkins to the new user!
        insertMessageDirect(
            Message(
                id = UUID.randomUUID().toString(),
                senderId = "user-sarah",
                receiverId = newId,
                content = "Welcome to Messaging App! 👋 Feel free to send a message anytime.",
                timestamp = now,
                isRead = false
            )
        )

        _activePresence.value = _activePresence.value + newId
        Result.success(user)
    }

    suspend fun loginUser(username: String, password: String): Result<User> = withContext(Dispatchers.IO) {
        val cleanUsername = username.trim()
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery(
            "SELECT id, username, password_hash, full_name, last_seen FROM users WHERE LOWER(username) = LOWER(?)",
            arrayOf(cleanUsername)
        )

        if (!cursor.moveToFirst()) {
            cursor.close()
            return@withContext Result.failure(IllegalArgumentException("Invalid username or password"))
        }

        val id = cursor.getString(0)
        val fetchedUsername = cursor.getString(1)
        val storedHash = cursor.getString(2)
        val fullName = cursor.getString(3)
        val lastSeen = cursor.getLong(4)
        cursor.close()

        if (storedHash != hashPassword(password)) {
            return@withContext Result.failure(IllegalArgumentException("Invalid username or password"))
        }

        val now = System.currentTimeMillis()
        val updateCv = ContentValues().apply { put("last_seen", now) }
        dbHelper.writableDatabase.update("users", updateCv, "id = ?", arrayOf(id))

        val user = User(
            id = id,
            username = fetchedUsername,
            fullName = fullName,
            isOnline = true,
            lastSeen = now
        )

        _activePresence.value = _activePresence.value + id
        Result.success(user)
    }

    suspend fun logoutUser(userId: String) = withContext(Dispatchers.IO) {
        _activePresence.value = _activePresence.value - userId
    }

    suspend fun getUsers(currentUserId: String): List<User> = withContext(Dispatchers.IO) {
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery(
            "SELECT id, username, full_name, last_seen FROM users WHERE id != ? ORDER BY full_name ASC",
            arrayOf(currentUserId)
        )
        val users = mutableListOf<User>()
        val presence = _activePresence.value

        while (cursor.moveToNext()) {
            val id = cursor.getString(0)
            val username = cursor.getString(1)
            val fullName = cursor.getString(2)
            val lastSeen = cursor.getLong(3)
            val isOnline = presence.contains(id) || (id in setOf("user-sarah", "user-alex", "user-emily"))
            users.add(User(id, username, fullName, isOnline, lastSeen))
        }
        cursor.close()
        users
    }

    suspend fun getMessagesBetween(userId1: String, userId2: String): List<Message> = withContext(Dispatchers.IO) {
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery(
            """
            SELECT id, sender_id, receiver_id, content, timestamp, is_read 
            FROM messages 
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
            ORDER BY timestamp ASC
            """.trimIndent(),
            arrayOf(userId1, userId2, userId2, userId1)
        )
        val list = mutableListOf<Message>()
        while (cursor.moveToNext()) {
            list.add(
                Message(
                    id = cursor.getString(0),
                    senderId = cursor.getString(1),
                    receiverId = cursor.getString(2),
                    content = cursor.getString(3),
                    timestamp = cursor.getLong(4),
                    isRead = cursor.getInt(5) == 1
                )
            )
        }
        cursor.close()
        list
    }

    suspend fun getLastMessage(userId1: String, userId2: String): Message? = withContext(Dispatchers.IO) {
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery(
            """
            SELECT id, sender_id, receiver_id, content, timestamp, is_read 
            FROM messages 
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
            ORDER BY timestamp DESC LIMIT 1
            """.trimIndent(),
            arrayOf(userId1, userId2, userId2, userId1)
        )
        var msg: Message? = null
        if (cursor.moveToFirst()) {
            msg = Message(
                id = cursor.getString(0),
                senderId = cursor.getString(1),
                receiverId = cursor.getString(2),
                content = cursor.getString(3),
                timestamp = cursor.getLong(4),
                isRead = cursor.getInt(5) == 1
            )
        }
        cursor.close()
        msg
    }

    suspend fun getUnreadCount(currentUserId: String, fromUserId: String): Int = withContext(Dispatchers.IO) {
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery(
            "SELECT COUNT(*) FROM messages WHERE sender_id = ? AND receiver_id = ? AND is_read = 0",
            arrayOf(fromUserId, currentUserId)
        )
        val count = if (cursor.moveToFirst()) cursor.getInt(0) else 0
        cursor.close()
        count
    }

    suspend fun markMessagesAsRead(fromSenderId: String, forReceiverId: String) = withContext(Dispatchers.IO) {
        val cv = ContentValues().apply { put("is_read", 1) }
        dbHelper.writableDatabase.update(
            "messages",
            cv,
            "sender_id = ? AND receiver_id = ? AND is_read = 0",
            arrayOf(fromSenderId, forReceiverId)
        )
        _messagesUpdateTrigger.emit(Pair(fromSenderId, forReceiverId))
    }

    suspend fun sendMessage(
        senderId: String,
        receiverId: String,
        content: String
    ): Result<Message> = withContext(Dispatchers.IO) {
        val cleanContent = content.trim()
        if (cleanContent.isEmpty()) {
            return@withContext Result.failure(IllegalArgumentException("Message content cannot be empty"))
        }
        if (cleanContent.length > 5000) {
            return@withContext Result.failure(IllegalArgumentException("Message must be at most 5000 characters"))
        }

        val msg = Message(
            id = UUID.randomUUID().toString(),
            senderId = senderId,
            receiverId = receiverId,
            content = cleanContent,
            timestamp = System.currentTimeMillis(),
            isRead = false
        )

        insertMessageDirect(msg)
        _messagesUpdateTrigger.emit(Pair(senderId, receiverId))

        // If message is sent to one of the demo companions, simulate a smart companion reply
        scheduleCompanionReplyIfNeeded(senderId, receiverId, cleanContent)

        Result.success(msg)
    }

    private fun insertMessageDirect(msg: Message) {
        val cv = ContentValues().apply {
            put("id", msg.id)
            put("sender_id", msg.senderId)
            put("receiver_id", msg.receiverId)
            put("content", msg.content)
            put("timestamp", msg.timestamp)
            put("is_read", if (msg.isRead) 1 else 0)
        }
        dbHelper.writableDatabase.insert("messages", null, cv)
    }

    private fun scheduleCompanionReplyIfNeeded(userId: String, companionId: String, userPrompt: String) {
        val companionNames = mapOf(
            "user-sarah" to "Sarah Jenkins",
            "user-alex" to "Alex Rivera",
            "user-david" to "David Chen",
            "user-emily" to "Emily Watson",
            "user-michael" to "Michael Scott"
        )

        if (!companionNames.containsKey(companionId)) return

        scope.launch {
            // Realistic typing pause (1.2 seconds)
            delay(1200)

            val replyText = generateCompanionResponse(companionId, userPrompt)
            val replyMsg = Message(
                id = UUID.randomUUID().toString(),
                senderId = companionId,
                receiverId = userId,
                content = replyText,
                timestamp = System.currentTimeMillis(),
                isRead = false
            )

            insertMessageDirect(replyMsg)
            _messagesUpdateTrigger.emit(Pair(companionId, userId))
        }
    }

    private fun generateCompanionResponse(companionId: String, prompt: String): String {
        val lower = prompt.lowercase()
        return when (companionId) {
            "user-sarah" -> when {
                "hello" in lower || "hi" in lower || "hey" in lower -> "Hey there! How's your day going?"
                "design" in lower || "figma" in lower || "ui" in lower -> "I just updated the design tokens and typography hierarchy. Take a look when you get a chance!"
                "thanks" in lower || "thank" in lower -> "Anytime! Let me know if you need anything else."
                "meeting" in lower || "call" in lower -> "Sounds good! I'm free after 2 PM."
                else -> "Got it! Thanks for letting me know. I'll take a look right now."
            }
            "user-alex" -> when {
                "hello" in lower || "hi" in lower -> "Hi! Ready for the sprint demo?"
                "bug" in lower || "error" in lower -> "Let me pull the logs and check the stack trace."
                "pr" in lower || "code" in lower || "git" in lower -> "Reviewing your PR right now, looks very clean!"
                else -> "Great point! Let's get that implemented in the next patch."
            }
            "user-emily" -> when {
                "launch" in lower || "marketing" in lower -> "The launch campaign is all lined up and ready to go! 🚀"
                else -> "Thanks for keeping me in the loop! I'll update the team doc."
            }
            "user-michael" -> when {
                "work" in lower || "office" in lower -> "That's what she said! Just kidding, keep up the fantastic work!"
                else -> "You miss 100% of the shots you don't take. - Wayne Gretzky - Michael Scott"
            }
            else -> "Thanks for your message! Got it loud and clear."
        }
    }

    private fun hashPassword(password: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(password.toByteArray(Charsets.UTF_8))
        return hash.joinToString("") { "%02x".format(it) }
    }
}
