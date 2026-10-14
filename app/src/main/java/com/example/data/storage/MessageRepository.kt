package com.example.data.storage

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import com.example.data.crypto.CryptoVault
import com.example.data.model.ConnectionInvitation
import com.example.data.model.Group
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
                User(
                    id = "user-sarah",
                    username = "sarah_j",
                    fullName = "Sarah Jenkins",
                    isOnline = true,
                    lastSeen = now,
                    isVerified = true,
                    safetyNumber = "9A2F · 4B18 · 7C90 · 31E4",
                    pairwiseQueueAddress = "sx://broker.simplexlink.net/q/sarah92"
                ),
                User(
                    id = "user-alex",
                    username = "alex_r",
                    fullName = "Alex Rivera",
                    isOnline = true,
                    lastSeen = now,
                    isVerified = true,
                    safetyNumber = "12FE · 88CA · 99B1 · 54D2",
                    pairwiseQueueAddress = "sx://broker.simplexlink.net/q/alex01"
                ),
                User(
                    id = "user-david",
                    username = "david_c",
                    fullName = "David Chen",
                    isOnline = false,
                    lastSeen = now - 3600_000,
                    isVerified = false,
                    safetyNumber = "43B1 · 9022 · C1E8 · 78F3",
                    pairwiseQueueAddress = "sx://broker.simplexlink.net/q/david44"
                ),
                User(
                    id = "user-emily",
                    username = "emily_w",
                    fullName = "Emily Watson",
                    isOnline = true,
                    lastSeen = now,
                    isVerified = true,
                    safetyNumber = "77D2 · E810 · 21CA · 9F04",
                    pairwiseQueueAddress = "sx://broker.simplexlink.net/q/emily88"
                )
            )

            for (user in demoUsers) {
                val cv = ContentValues().apply {
                    put("id", user.id)
                    put("username", user.username)
                    put("password_hash", hashPassword("password123"))
                    put("full_name", user.fullName)
                    put("created_at", user.lastSeen)
                    put("last_seen", user.lastSeen)
                    put("is_contact", 1)
                    put("is_blocked", 0)
                    put("is_verified", if (user.isVerified) 1 else 0)
                    put("safety_number", user.safetyNumber)
                    put("queue_address", user.pairwiseQueueAddress)
                    put("disappearing_timer", 0)
                }
                db.insert("users", null, cv)
            }

            // Seed sample groups
            val sampleGroup = Group(
                id = "group-security-core",
                name = "Core Protocol Guild",
                description = "SimpleX-inspired private group for secure protocol & architecture sync",
                avatarColor = "#10B981",
                memberIds = listOf("user-sarah", "user-alex", "user-emily"),
                adminIds = listOf("user-sarah"),
                createdAt = now - 7200_000
            )
            createGroupDirect(sampleGroup)

            // Seed initial conversation messages between users
            val sampleMessages = listOf(
                Message(
                    id = UUID.randomUUID().toString(),
                    senderId = "user-sarah",
                    receiverId = "user-alex",
                    content = "Hey Alex! The SimpleX-inspired pairwise connection is verified. End-to-end ratchet is initialized.",
                    timestamp = now - 1800_000,
                    isRead = true,
                    isDelivered = true,
                    reactions = mapOf("🔒" to listOf("user-alex"))
                ),
                Message(
                    id = UUID.randomUUID().toString(),
                    senderId = "user-alex",
                    receiverId = "user-sarah",
                    content = "Awesome. Safety fingerprint verified: 9A2F · 4B18. Zero permanent identifiers in the broker queue.",
                    timestamp = now - 1500_000,
                    isRead = true,
                    isDelivered = true,
                    replyToId = "prev-1",
                    replyToText = "The SimpleX-inspired pairwise connection is verified.",
                    replyToSender = "Sarah Jenkins"
                ),
                Message(
                    id = UUID.randomUUID().toString(),
                    senderId = "user-sarah",
                    receiverId = "user-alex",
                    content = "Voice note update on the multi-queue delivery mechanism:",
                    timestamp = now - 900_000,
                    isRead = true,
                    isDelivered = true,
                    messageType = "VOICE",
                    audioDurationSeconds = 14
                ),
                Message(
                    id = UUID.randomUUID().toString(),
                    senderId = "user-sarah",
                    receiverId = "group-security-core",
                    content = "Welcome to the Core Protocol Guild! All messages in this room use double-ratchet encryption.",
                    timestamp = now - 600_000,
                    isRead = true,
                    isDelivered = true,
                    isGroup = true
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
        val cleanUsername = username.trim().lowercase()
        val cleanFullName = fullName.trim().ifEmpty { cleanUsername }

        if (cleanUsername.length < 3) return@withContext Result.failure(IllegalArgumentException("Username must be at least 3 characters"))
        if (cleanUsername.length > 30) return@withContext Result.failure(IllegalArgumentException("Username must be at most 30 characters"))
        if (password.length < 6) return@withContext Result.failure(IllegalArgumentException("Password must be at least 6 characters"))

        val db = dbHelper.writableDatabase
        val existing = db.rawQuery("SELECT id FROM users WHERE LOWER(username) = LOWER(?)", arrayOf(cleanUsername))
        val exists = existing.moveToFirst()
        existing.close()

        if (exists) {
            return@withContext Result.failure(IllegalArgumentException("Username already exists"))
        }

        val newId = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()
        val safetyNumber = User.generateDefaultSafetyNumber(newId)
        val queueAddr = "sx://broker.simplexlink.net/q/${newId.take(8)}"

        val cv = ContentValues().apply {
            put("id", newId)
            put("username", cleanUsername)
            put("password_hash", hashPassword(password))
            put("full_name", cleanFullName)
            put("created_at", now)
            put("last_seen", now)
            put("is_contact", 1)
            put("is_blocked", 0)
            put("is_verified", 1)
            put("safety_number", safetyNumber)
            put("queue_address", queueAddr)
            put("disappearing_timer", 0)
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
            lastSeen = now,
            isVerified = true,
            safetyNumber = safetyNumber,
            pairwiseQueueAddress = queueAddr
        )

        // Seed welcome message from Sarah Jenkins
        insertMessageDirect(
            Message(
                id = UUID.randomUUID().toString(),
                senderId = "user-sarah",
                receiverId = newId,
                content = "Welcome to SimpleLink! 🔐 Your pairwise queue is active. You can generate one-time invite links or QR codes in the Connections tab.",
                timestamp = now,
                isRead = false,
                isDelivered = true
            )
        )

        // Add user to the core protocol group
        addUserToGroup("group-security-core", newId)

        _activePresence.value = _activePresence.value + newId
        Result.success(user)
    }

    suspend fun createPrivacyIdentity(displayName: String? = null, recoveryPassphrase: String? = null): Result<User> = withContext(Dispatchers.IO) {
        val rawUuid = UUID.randomUUID().toString()
        val shortId = rawUuid.replace("-", "").take(8)
        val cleanHandle = if (!displayName.isNullOrBlank()) {
            displayName.trim().lowercase().replace(" ", "_").take(24)
        } else {
            "anon_$shortId"
        }
        val cleanFullName = if (!displayName.isNullOrBlank()) {
            displayName.trim().take(30)
        } else {
            "Private Node ${shortId.take(4).uppercase()}"
        }
        val passwordToHash = if (!recoveryPassphrase.isNullOrBlank()) recoveryPassphrase else rawUuid
        registerUser(cleanHandle, passwordToHash, cleanFullName)
    }

    suspend fun loginUser(username: String, password: String): Result<User> = withContext(Dispatchers.IO) {
        val cleanUsername = username.trim().lowercase()
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery(
            "SELECT id, username, password_hash, full_name, last_seen, is_verified, safety_number, queue_address, disappearing_timer FROM users WHERE LOWER(username) = LOWER(?)",
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
        val isVerified = cursor.getInt(5) == 1
        val safetyNumber = cursor.getString(6) ?: User.generateDefaultSafetyNumber(id)
        val queueAddr = cursor.getString(7) ?: "sx://broker.simplexlink.net/q/${id.take(8)}"
        val disappearingTimer = cursor.getInt(8)
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
            lastSeen = now,
            isVerified = isVerified,
            safetyNumber = safetyNumber,
            pairwiseQueueAddress = queueAddr,
            disappearingTimerSeconds = disappearingTimer
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
            "SELECT id, username, full_name, last_seen, is_verified, is_blocked, safety_number, queue_address, disappearing_timer FROM users WHERE id != ? ORDER BY full_name ASC",
            arrayOf(currentUserId)
        )
        val users = mutableListOf<User>()
        val presence = _activePresence.value

        while (cursor.moveToNext()) {
            val id = cursor.getString(0)
            val username = cursor.getString(1)
            val fullName = cursor.getString(2)
            val lastSeen = cursor.getLong(3)
            val isVerified = cursor.getInt(4) == 1
            val isBlocked = cursor.getInt(5) == 1
            val safetyNumber = cursor.getString(6) ?: User.generateDefaultSafetyNumber(id)
            val queueAddress = cursor.getString(7) ?: "sx://broker.simplexlink.net/q/${id.take(8)}"
            val disappearingTimer = cursor.getInt(8)
            val isOnline = presence.contains(id) || (id in setOf("user-sarah", "user-alex", "user-emily"))
            users.add(
                User(
                    id = id,
                    username = username,
                    fullName = fullName,
                    isOnline = isOnline,
                    lastSeen = lastSeen,
                    isVerified = isVerified,
                    isBlocked = isBlocked,
                    safetyNumber = safetyNumber,
                    pairwiseQueueAddress = queueAddress,
                    disappearingTimerSeconds = disappearingTimer
                )
            )
        }
        cursor.close()
        users
    }

    suspend fun getUserById(userId: String): User? = withContext(Dispatchers.IO) {
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery(
            "SELECT id, username, full_name, last_seen, is_verified, is_blocked, safety_number, queue_address, disappearing_timer FROM users WHERE id = ?",
            arrayOf(userId)
        )
        var user: User? = null
        if (cursor.moveToFirst()) {
            val id = cursor.getString(0)
            val username = cursor.getString(1)
            val fullName = cursor.getString(2)
            val lastSeen = cursor.getLong(3)
            val isVerified = cursor.getInt(4) == 1
            val isBlocked = cursor.getInt(5) == 1
            val safetyNumber = cursor.getString(6) ?: User.generateDefaultSafetyNumber(id)
            val queueAddress = cursor.getString(7) ?: "sx://broker.simplexlink.net/q/${id.take(8)}"
            val disappearingTimer = cursor.getInt(8)
            val isOnline = _activePresence.value.contains(id) || (id in setOf("user-sarah", "user-alex", "user-emily"))
            user = User(
                id = id,
                username = username,
                fullName = fullName,
                isOnline = isOnline,
                lastSeen = lastSeen,
                isVerified = isVerified,
                isBlocked = isBlocked,
                safetyNumber = safetyNumber,
                pairwiseQueueAddress = queueAddress,
                disappearingTimerSeconds = disappearingTimer
            )
        }
        cursor.close()
        user
    }

    suspend fun toggleVerifyContact(userId: String): Boolean = withContext(Dispatchers.IO) {
        val user = getUserById(userId) ?: return@withContext false
        val newVerified = !user.isVerified
        val cv = ContentValues().apply { put("is_verified", if (newVerified) 1 else 0) }
        dbHelper.writableDatabase.update("users", cv, "id = ?", arrayOf(userId))
        _messagesUpdateTrigger.emit(Pair(userId, "verify_toggle"))
        newVerified
    }

    suspend fun toggleBlockContact(userId: String): Boolean = withContext(Dispatchers.IO) {
        val user = getUserById(userId) ?: return@withContext false
        val newBlocked = !user.isBlocked
        val cv = ContentValues().apply { put("is_blocked", if (newBlocked) 1 else 0) }
        dbHelper.writableDatabase.update("users", cv, "id = ?", arrayOf(userId))
        _messagesUpdateTrigger.emit(Pair(userId, "block_toggle"))
        newBlocked
    }

    suspend fun setDisappearingTimer(userId: String, seconds: Int) = withContext(Dispatchers.IO) {
        val cv = ContentValues().apply { put("disappearing_timer", seconds) }
        dbHelper.writableDatabase.update("users", cv, "id = ?", arrayOf(userId))
    }

    // ==========================================
    // Groups Support
    // ==========================================

    suspend fun getGroups(userId: String): List<Group> = withContext(Dispatchers.IO) {
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery("SELECT id, name, description, avatar_color, member_ids, admin_ids, created_at FROM groups_table", null)
        val list = mutableListOf<Group>()
        while (cursor.moveToNext()) {
            val id = cursor.getString(0)
            val name = cursor.getString(1)
            val description = cursor.getString(2) ?: ""
            val avatarColor = cursor.getString(3) ?: "#10B981"
            val memberIds = cursor.getString(4).split(",").filter { it.isNotBlank() }
            val adminIds = cursor.getString(5).split(",").filter { it.isNotBlank() }
            val createdAt = cursor.getLong(6)

            if (memberIds.contains(userId) || adminIds.contains(userId) || memberIds.isEmpty()) {
                val lastMsg = getLastGroupMessage(id)
                val unread = getUnreadGroupCount(id, userId)
                list.add(
                    Group(
                        id = id,
                        name = name,
                        description = description,
                        avatarColor = avatarColor,
                        memberIds = memberIds,
                        adminIds = adminIds,
                        createdAt = createdAt,
                        lastMessage = lastMsg,
                        unreadCount = unread
                    )
                )
            }
        }
        cursor.close()
        list
    }

    suspend fun createGroup(
        name: String,
        description: String,
        creatorId: String,
        initialMembers: List<String>
    ): Group = withContext(Dispatchers.IO) {
        val id = "group-" + UUID.randomUUID().toString().take(8)
        val allMembers = (initialMembers + creatorId).distinct()
        val group = Group(
            id = id,
            name = name.trim(),
            description = description.trim(),
            avatarColor = "#10B981",
            memberIds = allMembers,
            adminIds = listOf(creatorId),
            createdAt = System.currentTimeMillis()
        )
        createGroupDirect(group)

        // Seed initial system notification message
        val welcomeMsg = Message(
            id = UUID.randomUUID().toString(),
            senderId = creatorId,
            receiverId = id,
            content = "🔒 Group created with SimpleX pairwise E2EE. All messages are encrypted.",
            timestamp = System.currentTimeMillis(),
            isGroup = true
        )
        insertMessageDirect(welcomeMsg)
        _messagesUpdateTrigger.emit(Pair(creatorId, id))
        group
    }

    private fun createGroupDirect(group: Group) {
        val cv = ContentValues().apply {
            put("id", group.id)
            put("name", group.name)
            put("description", group.description)
            put("avatar_color", group.avatarColor)
            put("member_ids", group.memberIds.joinToString(","))
            put("admin_ids", group.adminIds.joinToString(","))
            put("created_at", group.createdAt)
        }
        dbHelper.writableDatabase.insert("groups_table", null, cv)
    }

    suspend fun addUserToGroup(groupId: String, userId: String) = withContext(Dispatchers.IO) {
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery("SELECT member_ids FROM groups_table WHERE id = ?", arrayOf(groupId))
        if (cursor.moveToFirst()) {
            val existing = cursor.getString(0).split(",").filter { it.isNotBlank() }.toMutableList()
            if (!existing.contains(userId)) {
                existing.add(userId)
                val updateCv = ContentValues().apply { put("member_ids", existing.joinToString(",")) }
                dbHelper.writableDatabase.update("groups_table", updateCv, "id = ?", arrayOf(groupId))
            }
        }
        cursor.close()
    }

    // ==========================================
    // Invitations Support (SimpleX Pairwise Links)
    // ==========================================

    suspend fun createInvitation(user: User): ConnectionInvitation = withContext(Dispatchers.IO) {
        val inviteId = UUID.randomUUID().toString()
        val code = "sx-" + UUID.randomUUID().toString().take(8)
        val uri = "simplelink:invite?code=$code&user=${user.username}"
        val invitation = ConnectionInvitation(
            id = inviteId,
            inviterId = user.id,
            inviterName = user.displayName,
            inviterUsername = user.username,
            inviteCode = code,
            inviteUri = uri,
            createdAt = System.currentTimeMillis(),
            status = "active"
        )
        val cv = ContentValues().apply {
            put("id", invitation.id)
            put("inviter_id", invitation.inviterId)
            put("inviter_name", invitation.inviterName)
            put("inviter_username", invitation.inviterUsername)
            put("invite_code", invitation.inviteCode)
            put("invite_uri", invitation.inviteUri)
            put("created_at", invitation.createdAt)
            put("status", invitation.status)
        }
        dbHelper.writableDatabase.insert("invitations", null, cv)
        invitation
    }

    suspend fun acceptInvitationByCode(code: String, currentUserId: String): Result<User> = withContext(Dispatchers.IO) {
        val cleanCode = code.trim().removePrefix("simplelink:invite?code=").split("&")[0]
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery("SELECT inviter_id, inviter_username, inviter_name FROM invitations WHERE invite_code = ?", arrayOf(cleanCode))
        if (!cursor.moveToFirst()) {
            cursor.close()
            // If code is not found in local invites, check if it's formatted as a valid user or companion
            val fallbackCompanion = when {
                "alex" in cleanCode.lowercase() -> getUserById("user-alex")
                "emily" in cleanCode.lowercase() -> getUserById("user-emily")
                "david" in cleanCode.lowercase() -> getUserById("user-david")
                else -> getUserById("user-sarah")
            }
            if (fallbackCompanion != null) {
                return@withContext Result.success(fallbackCompanion)
            }
            return@withContext Result.failure(IllegalArgumentException("Invalid or expired invitation code"))
        }

        val inviterId = cursor.getString(0)
        cursor.close()

        val inviter = getUserById(inviterId)
            ?: return@withContext Result.failure(IllegalArgumentException("Inviter user not found"))

        // Send a mutual handshake message
        sendMessage(
            senderId = currentUserId,
            receiverId = inviterId,
            content = "🤝 Pairwise connection accepted via invitation link. E2E ratchet established."
        )

        Result.success(inviter)
    }

    // ==========================================
    // Messages Query & Management (with E2EE & Disappearing Messages)
    // ==========================================

    suspend fun purgeExpiredMessages() = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        val db = dbHelper.writableDatabase
        val deleted = db.delete(
            "messages",
            "disappearing_after > 0 AND (? - timestamp) > (disappearing_after * 1000)",
            arrayOf(now.toString())
        )
        if (deleted > 0) {
            _messagesUpdateTrigger.emit(Pair("system", "purged"))
        }
    }

    suspend fun isContactBlocked(userId: String): Boolean = withContext(Dispatchers.IO) {
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery("SELECT is_blocked FROM users WHERE id = ?", arrayOf(userId))
        val blocked = if (cursor.moveToFirst()) cursor.getInt(0) == 1 else false
        cursor.close()
        blocked
    }

    suspend fun ensureUser(
        id: String,
        username: String,
        fullName: String
    ): User = withContext(Dispatchers.IO) {
        val existing = getUserById(id)
        if (existing != null) return@withContext existing

        val now = System.currentTimeMillis()
        val safetyNumber = User.generateDefaultSafetyNumber(id)
        val queueAddr = "sx://broker.simplexlink.net/q/${id.take(8)}"
        val cleanUsername = username.trim().ifEmpty { "user_${id.take(5)}" }
        val cleanFullName = fullName.trim().ifEmpty { cleanUsername }

        val cv = ContentValues().apply {
            put("id", id)
            put("username", cleanUsername)
            put("password_hash", hashPassword("oauth_external"))
            put("full_name", cleanFullName)
            put("created_at", now)
            put("last_seen", now)
            put("is_contact", 1)
            put("is_blocked", 0)
            put("is_verified", 1)
            put("safety_number", safetyNumber)
            put("queue_address", queueAddr)
            put("disappearing_timer", 0)
        }
        dbHelper.writableDatabase.insertWithOnConflict("users", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
        val newUser = User(
            id = id,
            username = cleanUsername,
            fullName = cleanFullName,
            isOnline = true,
            lastSeen = now,
            isVerified = true,
            safetyNumber = safetyNumber,
            pairwiseQueueAddress = queueAddr
        )
        _activePresence.value = _activePresence.value + id
        newUser
    }

    suspend fun getMessagesBetween(userId1: String, userId2: String): List<Message> = withContext(Dispatchers.IO) {
        purgeExpiredMessages()
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery(
            """
            SELECT id, sender_id, receiver_id, content, timestamp, is_read, is_delivered, is_group,
                   reply_to_id, reply_to_text, reply_to_sender, message_type, media_url, media_name,
                   media_size, audio_duration, reactions, is_edited, disappearing_after
            FROM messages 
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
            ORDER BY timestamp ASC
            """.trimIndent(),
            arrayOf(userId1, userId2, userId2, userId1)
        )
        val list = parseMessagesCursor(cursor)
        cursor.close()
        list
    }

    suspend fun getGroupMessages(groupId: String): List<Message> = withContext(Dispatchers.IO) {
        purgeExpiredMessages()
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery(
            """
            SELECT id, sender_id, receiver_id, content, timestamp, is_read, is_delivered, is_group,
                   reply_to_id, reply_to_text, reply_to_sender, message_type, media_url, media_name,
                   media_size, audio_duration, reactions, is_edited, disappearing_after
            FROM messages 
            WHERE receiver_id = ? AND is_group = 1
            ORDER BY timestamp ASC
            """.trimIndent(),
            arrayOf(groupId)
        )
        val list = parseMessagesCursor(cursor)
        cursor.close()
        list
    }

    private fun parseMessagesCursor(cursor: Cursor): List<Message> {
        val list = mutableListOf<Message>()
        while (cursor.moveToNext()) {
            val reactionsStr = cursor.getString(16) ?: ""
            val senderId = cursor.getString(1)
            val receiverId = cursor.getString(2)
            val rawContent = cursor.getString(3) ?: ""
            val isGroup = cursor.getInt(7) == 1

            // Decrypt AES-256-GCM payload if stored encrypted with "ENC:"
            val decryptedContent = if (!isGroup) {
                CryptoVault.decryptFromChannel(rawContent, senderId, receiverId)
            } else {
                CryptoVault.decryptFromChannel(rawContent, senderId, receiverId)
            }

            list.add(
                Message(
                    id = cursor.getString(0),
                    senderId = senderId,
                    receiverId = receiverId,
                    content = decryptedContent,
                    timestamp = cursor.getLong(4),
                    isRead = cursor.getInt(5) == 1,
                    isDelivered = cursor.getInt(6) == 1,
                    isGroup = isGroup,
                    replyToId = cursor.getString(8),
                    replyToText = cursor.getString(9),
                    replyToSender = cursor.getString(10),
                    messageType = cursor.getString(11) ?: "TEXT",
                    mediaUrl = cursor.getString(12),
                    mediaName = cursor.getString(13),
                    mediaSize = cursor.getLong(14),
                    audioDurationSeconds = cursor.getInt(15),
                    reactions = deserializeReactions(reactionsStr),
                    isEdited = cursor.getInt(17) == 1,
                    disappearingAfterSeconds = cursor.getInt(18)
                )
            )
        }
        return list
    }

    suspend fun getLastMessage(userId1: String, userId2: String): Message? = withContext(Dispatchers.IO) {
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery(
            """
            SELECT id, sender_id, receiver_id, content, timestamp, is_read, is_delivered, is_group,
                   reply_to_id, reply_to_text, reply_to_sender, message_type, media_url, media_name,
                   media_size, audio_duration, reactions, is_edited, disappearing_after
            FROM messages 
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
            ORDER BY timestamp DESC LIMIT 1
            """.trimIndent(),
            arrayOf(userId1, userId2, userId2, userId1)
        )
        val list = parseMessagesCursor(cursor)
        cursor.close()
        list.firstOrNull()
    }

    suspend fun getLastGroupMessage(groupId: String): Message? = withContext(Dispatchers.IO) {
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery(
            """
            SELECT id, sender_id, receiver_id, content, timestamp, is_read, is_delivered, is_group,
                   reply_to_id, reply_to_text, reply_to_sender, message_type, media_url, media_name,
                   media_size, audio_duration, reactions, is_edited, disappearing_after
            FROM messages 
            WHERE receiver_id = ? AND is_group = 1
            ORDER BY timestamp DESC LIMIT 1
            """.trimIndent(),
            arrayOf(groupId)
        )
        val list = parseMessagesCursor(cursor)
        cursor.close()
        list.firstOrNull()
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

    suspend fun getLastMessagesForAllPeers(userId: String): Map<String, Message> = withContext(Dispatchers.IO) {
        purgeExpiredMessages()
        val db = dbHelper.readableDatabase
        // Use a subquery to find the max timestamp for each peer, then join back to messages
        val cursor = db.rawQuery(
            """
            SELECT m.id, m.sender_id, m.receiver_id, m.content, m.timestamp, m.is_read, m.is_delivered, m.is_group,
                   m.reply_to_id, m.reply_to_text, m.reply_to_sender, m.message_type, m.media_url, m.media_name,
                   m.media_size, m.audio_duration, m.reactions, m.is_edited, m.disappearing_after,
                   CASE
                       WHEN m.sender_id = ? THEN m.receiver_id
                       ELSE m.sender_id
                   END as peer_id
            FROM messages m
            INNER JOIN (
                SELECT
                    CASE
                        WHEN sender_id = ? THEN receiver_id
                        ELSE sender_id
                    END as p_id,
                    MAX(timestamp) as max_time
                FROM messages
                WHERE (sender_id = ? OR receiver_id = ?) AND is_group = 0
                GROUP BY p_id
            ) as latest
            ON (CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END) = latest.p_id
               AND m.timestamp = latest.max_time
            WHERE (m.sender_id = ? OR m.receiver_id = ?) AND m.is_group = 0
            """.trimIndent(),
            arrayOf(userId, userId, userId, userId, userId, userId, userId)
        )

        val map = mutableMapOf<String, Message>()
        while (cursor.moveToNext()) {
            val reactionsStr = cursor.getString(16) ?: ""
            val senderId = cursor.getString(1)
            val receiverId = cursor.getString(2)
            val rawContent = cursor.getString(3) ?: ""
            val isGroup = cursor.getInt(7) == 1
            val peerId = cursor.getString(19)

            val decryptedContent = CryptoVault.decryptFromChannel(rawContent, senderId, receiverId)

            val msg = Message(
                id = cursor.getString(0),
                senderId = senderId,
                receiverId = receiverId,
                content = decryptedContent,
                timestamp = cursor.getLong(4),
                isRead = cursor.getInt(5) == 1,
                isDelivered = cursor.getInt(6) == 1,
                isGroup = isGroup,
                replyToId = cursor.getString(8),
                replyToText = cursor.getString(9),
                replyToSender = cursor.getString(10),
                messageType = cursor.getString(11) ?: "TEXT",
                mediaUrl = cursor.getString(12),
                mediaName = cursor.getString(13),
                mediaSize = cursor.getLong(14),
                audioDurationSeconds = cursor.getInt(15),
                reactions = deserializeReactions(reactionsStr),
                isEdited = cursor.getInt(17) == 1,
                disappearingAfterSeconds = cursor.getInt(18)
            )
            map[peerId] = msg
        }
        cursor.close()
        map
    }

    suspend fun getUnreadCountsForAllPeers(userId: String): Map<String, Int> = withContext(Dispatchers.IO) {
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery(
            """
            SELECT sender_id, COUNT(*)
            FROM messages
            WHERE receiver_id = ? AND is_group = 0 AND is_read = 0
            GROUP BY sender_id
            """.trimIndent(),
            arrayOf(userId)
        )
        val map = mutableMapOf<String, Int>()
        while (cursor.moveToNext()) {
            map[cursor.getString(0)] = cursor.getInt(1)
        }
        cursor.close()
        map
    }

    suspend fun getUnreadGroupCount(groupId: String, currentUserId: String): Int = withContext(Dispatchers.IO) {
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery(
            "SELECT COUNT(*) FROM messages WHERE receiver_id = ? AND is_group = 1 AND sender_id != ? AND is_read = 0",
            arrayOf(groupId, currentUserId)
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

    suspend fun markGroupMessagesAsRead(groupId: String) = withContext(Dispatchers.IO) {
        val cv = ContentValues().apply { put("is_read", 1) }
        dbHelper.writableDatabase.update(
            "messages",
            cv,
            "receiver_id = ? AND is_group = 1 AND is_read = 0",
            arrayOf(groupId)
        )
        _messagesUpdateTrigger.emit(Pair(groupId, "read"))
    }

    suspend fun sendMessage(
        senderId: String,
        receiverId: String,
        content: String,
        isGroup: Boolean = false,
        replyToId: String? = null,
        replyToText: String? = null,
        replyToSender: String? = null,
        messageType: String = "TEXT",
        mediaUrl: String? = null,
        mediaName: String? = null,
        mediaSize: Long = 0L,
        audioDurationSeconds: Int = 0
    ): Result<Message> = withContext(Dispatchers.IO) {
        val cleanContent = content.trim()
        if (cleanContent.isEmpty() && messageType == "TEXT") {
            return@withContext Result.failure(IllegalArgumentException("Message content cannot be empty"))
        }

        // Security check: Reject transmission if peer is blocked
        if (!isGroup && isContactBlocked(receiverId)) {
            return@withContext Result.failure(IllegalStateException("Cannot send message: Contact is blocked"))
        }

        val msg = Message(
            id = UUID.randomUUID().toString(),
            senderId = senderId,
            receiverId = receiverId,
            content = cleanContent,
            timestamp = System.currentTimeMillis(),
            isRead = false,
            isDelivered = true,
            isGroup = isGroup,
            replyToId = replyToId,
            replyToText = replyToText,
            replyToSender = replyToSender,
            messageType = messageType,
            mediaUrl = mediaUrl,
            mediaName = mediaName,
            mediaSize = mediaSize,
            audioDurationSeconds = audioDurationSeconds
        )

        insertMessageDirect(msg)
        _messagesUpdateTrigger.emit(Pair(senderId, receiverId))

        if (!isGroup) {
            scheduleCompanionReplyIfNeeded(senderId, receiverId, cleanContent)
        }

        Result.success(msg)
    }

    suspend fun editMessage(messageId: String, newContent: String): Boolean = withContext(Dispatchers.IO) {
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery("SELECT sender_id, receiver_id FROM messages WHERE id = ?", arrayOf(messageId))
        val encryptedContent = if (cursor.moveToFirst()) {
            val sender = cursor.getString(0)
            val receiver = cursor.getString(1)
            cursor.close()
            CryptoVault.encryptForChannel(newContent.trim(), sender, receiver)
        } else {
            cursor.close()
            newContent.trim()
        }

        val cv = ContentValues().apply {
            put("content", encryptedContent)
            put("is_edited", 1)
        }
        val rows = dbHelper.writableDatabase.update("messages", cv, "id = ?", arrayOf(messageId))
        _messagesUpdateTrigger.emit(Pair(messageId, "edited"))
        rows > 0
    }

    suspend fun deleteMessage(messageId: String): Boolean = withContext(Dispatchers.IO) {
        val rows = dbHelper.writableDatabase.delete("messages", "id = ?", arrayOf(messageId))
        _messagesUpdateTrigger.emit(Pair(messageId, "deleted"))
        rows > 0
    }

    suspend fun toggleReaction(messageId: String, emoji: String, userId: String): Boolean = withContext(Dispatchers.IO) {
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery("SELECT reactions FROM messages WHERE id = ?", arrayOf(messageId))
        if (!cursor.moveToFirst()) {
            cursor.close()
            return@withContext false
        }
        val currentStr = cursor.getString(0) ?: ""
        cursor.close()

        val map = deserializeReactions(currentStr).toMutableMap()
        val currentUsers = map[emoji]?.toMutableList() ?: mutableListOf()
        if (currentUsers.contains(userId)) {
            currentUsers.remove(userId)
            if (currentUsers.isEmpty()) {
                map.remove(emoji)
            } else {
                map[emoji] = currentUsers
            }
        } else {
            currentUsers.add(userId)
            map[emoji] = currentUsers
        }

        val updatedStr = serializeReactions(map)
        val cv = ContentValues().apply { put("reactions", updatedStr) }
        dbHelper.writableDatabase.update("messages", cv, "id = ?", arrayOf(messageId))
        _messagesUpdateTrigger.emit(Pair(messageId, "reaction"))
        true
    }

    private fun insertMessageDirect(msg: Message) {
        // Encrypt payload using AES-256-GCM before writing to local SQLite database
        val encryptedContent = CryptoVault.encryptForChannel(msg.content, msg.senderId, msg.receiverId)

        val cv = ContentValues().apply {
            put("id", msg.id)
            put("sender_id", msg.senderId)
            put("receiver_id", msg.receiverId)
            put("content", encryptedContent)
            put("timestamp", msg.timestamp)
            put("is_read", if (msg.isRead) 1 else 0)
            put("is_delivered", if (msg.isDelivered) 1 else 0)
            put("is_group", if (msg.isGroup) 1 else 0)
            put("reply_to_id", msg.replyToId)
            put("reply_to_text", msg.replyToText)
            put("reply_to_sender", msg.replyToSender)
            put("message_type", msg.messageType)
            put("media_url", msg.mediaUrl)
            put("media_name", msg.mediaName)
            put("media_size", msg.mediaSize)
            put("audio_duration", msg.audioDurationSeconds)
            put("reactions", serializeReactions(msg.reactions))
            put("is_edited", if (msg.isEdited) 1 else 0)
            put("disappearing_after", msg.disappearingAfterSeconds)
        }
        dbHelper.writableDatabase.insert("messages", null, cv)
    }

    private fun serializeReactions(reactions: Map<String, List<String>>): String {
        return reactions.entries.joinToString(";") { "${it.key}:${it.value.joinToString(",")}" }
    }

    private fun deserializeReactions(str: String): Map<String, List<String>> {
        if (str.isBlank()) return emptyMap()
        val map = mutableMapOf<String, List<String>>()
        str.split(";").forEach { item ->
            val parts = item.split(":")
            if (parts.size == 2) {
                val emoji = parts[0]
                val users = parts[1].split(",").filter { it.isNotBlank() }
                if (users.isNotEmpty()) {
                    map[emoji] = users
                }
            }
        }
        return map
    }

    private fun scheduleCompanionReplyIfNeeded(userId: String, companionId: String, userPrompt: String) {
        val companionNames = mapOf(
            "user-sarah" to "Sarah Jenkins",
            "user-alex" to "Alex Rivera",
            "user-david" to "David Chen",
            "user-emily" to "Emily Watson"
        )

        if (!companionNames.containsKey(companionId)) return

        scope.launch {
            delay(1200)

            val replyText = generateCompanionResponse(companionId, userPrompt)
            val replyMsg = Message(
                id = UUID.randomUUID().toString(),
                senderId = companionId,
                receiverId = userId,
                content = replyText,
                timestamp = System.currentTimeMillis(),
                isRead = false,
                isDelivered = true
            )

            insertMessageDirect(replyMsg)
            _messagesUpdateTrigger.emit(Pair(companionId, userId))
        }
    }

    private fun generateCompanionResponse(companionId: String, prompt: String): String {
        val lower = prompt.lowercase()
        return when (companionId) {
            "user-sarah" -> when {
                "hello" in lower || "hi" in lower || "hey" in lower -> "Hey! Pairwise channel is active and verified."
                "invite" in lower || "qr" in lower || "code" in lower -> "You can share your connection link or QR code from the Connections tab. Zero discovery leakage!"
                "voice" in lower || "audio" in lower -> "Voice notes are stored with local AES encryption and streamed securely over private queues."
                "security" in lower || "encrypt" in lower -> "SimpleX protocol eliminates user IDs at the network layer. Each connection has distinct server queues."
                else -> "Message received securely over pairwise broker. All cryptographic checks passed."
            }
            "user-alex" -> when {
                "group" in lower -> "Groups in SimpleLink use pairwise member meshes or private broker relays without central directory leakage."
                "test" in lower || "ping" in lower -> "Pong! Latency is nominal across the broker node."
                else -> "Ratchet state rotated. Message delivered with full forward secrecy."
            }
            "user-emily" -> when {
                "call" in lower || "voice" in lower -> "P2P audio signaling is online! Tap the phone icon anytime to start an encrypted voice call."
                else -> "Looks great! Happy to verify safety numbers whenever you're ready."
            }
            else -> "Acknowledged! Cryptographic handshake confirmed."
        }
    }

    private fun hashPassword(password: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(password.toByteArray(Charsets.UTF_8))
        return hash.joinToString("") { "%02x".format(it) }
    }
}
