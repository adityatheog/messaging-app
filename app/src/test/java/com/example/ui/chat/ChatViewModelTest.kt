package com.example.ui.chat

import com.example.data.model.User
import com.example.data.storage.MessageRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ChatViewModelTest {

    private lateinit var viewModel: ChatViewModel
    private lateinit var repository: MessageRepository
    private val testDispatcher = UnconfinedTestDispatcher()

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        repository = mockk(relaxed = true)
        coEvery { repository.messagesUpdateTrigger } returns MutableSharedFlow()
        viewModel = ChatViewModel(repository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial tab is CHATS`() {
        assertEquals(SimpleXTab.CHATS, viewModel.currentTab.value)
    }

    @Test
    fun `setTab changes currentTab`() {
        viewModel.setTab(SimpleXTab.GROUPS)
        assertEquals(SimpleXTab.GROUPS, viewModel.currentTab.value)
    }

    @Test
    fun `onSearchQueryChanged updates searchQuery`() {
        val query = "test query"
        viewModel.onSearchQueryChanged(query)
        assertEquals(query, viewModel.searchQuery.value)
    }

    @Test
    fun `selectUser updates selectedTarget and reset clears state`() {
        val user = User(
            id = "test-user-id",
            username = "testuser",
            fullName = "Test User",
            isOnline = true,
            lastSeen = 0L,
            isVerified = true,
            safetyNumber = "123",
            pairwiseQueueAddress = "addr"
        )
        viewModel.selectUser(user)
        val target = viewModel.selectedTarget.value as? ChatTarget.Direct
        assertEquals(user.id, target?.user?.id)

        viewModel.reset()
        assertNull(viewModel.selectedTarget.value)
        assertEquals(emptyList< Any >(), viewModel.messages.value)
    }
}
