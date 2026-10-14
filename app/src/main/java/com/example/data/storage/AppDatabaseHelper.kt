package com.example.data.storage

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class AppDatabaseHelper(context: Context) : SQLiteOpenHelper(
    context.applicationContext,
    DATABASE_NAME,
    null,
    DATABASE_VERSION
) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                last_seen INTEGER NOT NULL,
                is_contact INTEGER NOT NULL DEFAULT 1,
                is_blocked INTEGER NOT NULL DEFAULT 0,
                is_verified INTEGER NOT NULL DEFAULT 0,
                safety_number TEXT,
                queue_address TEXT,
                disappearing_timer INTEGER NOT NULL DEFAULT 0
            );
            """.trimIndent()
        )

        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                sender_id TEXT NOT NULL,
                receiver_id TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                is_read INTEGER NOT NULL DEFAULT 0,
                is_delivered INTEGER NOT NULL DEFAULT 1,
                is_group INTEGER NOT NULL DEFAULT 0,
                reply_to_id TEXT,
                reply_to_text TEXT,
                reply_to_sender TEXT,
                message_type TEXT NOT NULL DEFAULT 'TEXT',
                media_url TEXT,
                media_name TEXT,
                media_size INTEGER NOT NULL DEFAULT 0,
                audio_duration INTEGER NOT NULL DEFAULT 0,
                reactions TEXT NOT NULL DEFAULT '',
                is_edited INTEGER NOT NULL DEFAULT 0,
                disappearing_after INTEGER NOT NULL DEFAULT 0
            );
            """.trimIndent()
        )

        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS groups_table (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                avatar_color TEXT,
                member_ids TEXT NOT NULL,
                admin_ids TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            """.trimIndent()
        )

        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS invitations (
                id TEXT PRIMARY KEY,
                inviter_id TEXT NOT NULL,
                inviter_name TEXT NOT NULL,
                inviter_username TEXT NOT NULL,
                invite_code TEXT NOT NULL,
                invite_uri TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                status TEXT NOT NULL
            );
            """.trimIndent()
        )

        db.execSQL("CREATE INDEX IF NOT EXISTS idx_msg_participants ON messages(sender_id, receiver_id);")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_msg_timestamp ON messages(timestamp);")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            // Drop & recreate with new schema or add columns
            db.execSQL("DROP TABLE IF EXISTS invitations")
            db.execSQL("DROP TABLE IF EXISTS groups_table")
            db.execSQL("DROP TABLE IF EXISTS messages")
            db.execSQL("DROP TABLE IF EXISTS users")
            onCreate(db)
        }
    }

    companion object {
        private const val DATABASE_NAME = "simplexlink.db"
        private const val DATABASE_VERSION = 2
    }
}

