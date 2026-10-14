package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.credentials.CredentialManager
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.data.model.AuthState
import com.example.data.model.User
import com.example.data.storage.FirestoreMessageRepository
import com.example.data.storage.MessageRepository
import com.example.ui.auth.AuthViewModel
import com.example.ui.auth.GoogleAuthManager
import com.example.ui.auth.LoginScreen
import com.example.ui.auth.RegisterScreen
import com.example.ui.chat.ChatViewModel
import com.example.ui.chat.MainMessagingScreen
import com.example.ui.theme.Blue600
import com.example.ui.theme.MessagingAppTheme
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val repository = MessageRepository(applicationContext)
        val firestoreRepo = FirestoreMessageRepository(applicationContext)

        setContent {
            MessagingAppTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val authViewModel: AuthViewModel = viewModel(
                        factory = object : ViewModelProvider.Factory {
                            @Suppress("UNCHECKED_CAST")
                            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                                return AuthViewModel(repository) as T
                            }
                        }
                    )

                    val chatViewModel: ChatViewModel = viewModel(
                        factory = object : ViewModelProvider.Factory {
                            @Suppress("UNCHECKED_CAST")
                            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                                return ChatViewModel(repository) as T
                            }
                        }
                    )

                    AppContent(
                        authViewModel = authViewModel,
                        chatViewModel = chatViewModel,
                        firestoreRepo = firestoreRepo
                    )
                }
            }
        }
    }
}

@Composable
fun AppContent(
    authViewModel: AuthViewModel,
    chatViewModel: ChatViewModel,
    firestoreRepo: FirestoreMessageRepository,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val credentialManager = remember { CredentialManager.create(context) }

    val authState by authViewModel.authState.collectAsState()
    val isLoading by authViewModel.isLoading.collectAsState()
    val errorMessage by authViewModel.errorMessage.collectAsState()
    var showRegister by remember { mutableStateOf(false) }

    // Firebase Auth observer
    var firebaseUser by remember { mutableStateOf(FirebaseAuth.getInstance().currentUser) }
    var isGoogleLoading by remember { mutableStateOf(false) }

    DisposableEffect(Unit) {
        val listener = FirebaseAuth.AuthStateListener { auth ->
            firebaseUser = auth.currentUser
        }
        FirebaseAuth.getInstance().addAuthStateListener(listener)
        onDispose {
            FirebaseAuth.getInstance().removeAuthStateListener(listener)
        }
    }

    // Attempt silent auto-sign-in on app startup
    LaunchedEffect(Unit) {
        GoogleAuthManager.attemptAutoSignIn(
            context = context,
            credentialManager = credentialManager,
            onAuthSuccess = {
                val user = FirebaseAuth.getInstance().currentUser
                if (user != null) {
                    coroutineScope.launch {
                        firestoreRepo.createUserProfile(
                            userId = user.uid,
                            username = user.displayName?.lowercase()?.replace(" ", "_") ?: "user_${user.uid.take(5)}",
                            fullName = user.displayName ?: "Google User"
                        )
                    }
                }
            },
            onUnauthenticated = { /* stay on login screen */ },
            scope = coroutineScope
        )
    }

    // Sync user session
    val currentActiveUser: User? = when {
        firebaseUser != null -> {
            val fbUser = firebaseUser!!
            User(
                id = fbUser.uid,
                username = fbUser.displayName?.lowercase()?.replace(" ", "_") ?: "user_${fbUser.uid.take(5)}",
                fullName = fbUser.displayName ?: "Google User",
                isOnline = true
            )
        }
        authState is AuthState.Authenticated -> {
            (authState as AuthState.Authenticated).user
        }
        else -> null
    }

    if (currentActiveUser != null) {
        MainMessagingScreen(
            currentUser = currentActiveUser,
            chatViewModel = chatViewModel,
            onLogoutClick = {
                if (firebaseUser != null) {
                    coroutineScope.launch {
                        firestoreRepo.updatePresence(false)
                    }
                    GoogleAuthManager.signOut(
                        context = context,
                        credentialManager = credentialManager,
                        onSignOutComplete = {
                            firebaseUser = null
                            authViewModel.logout()
                            chatViewModel.selectUser(null)
                        },
                        scope = coroutineScope
                    )
                } else {
                    authViewModel.logout()
                    chatViewModel.selectUser(null)
                }
            },
            modifier = modifier
        )
    } else {
        if (showRegister) {
            RegisterScreen(
                onRegisterClick = { u, p, fn ->
                    authViewModel.register(u, p, fn)
                },
                onNavigateToLogin = {
                    authViewModel.clearError()
                    showRegister = false
                },
                isLoading = isLoading,
                errorMessage = errorMessage,
                modifier = modifier
            )
        } else {
            LoginScreen(
                onGoogleSignInClick = {
                    isGoogleLoading = true
                    GoogleAuthManager.onGoogleSignInClicked(
                        context = context,
                        credentialManager = credentialManager,
                        onAuthSuccess = {
                            isGoogleLoading = false
                            val user = FirebaseAuth.getInstance().currentUser
                            if (user != null) {
                                coroutineScope.launch {
                                    firestoreRepo.createUserProfile(
                                        userId = user.uid,
                                        username = user.displayName?.lowercase()?.replace(" ", "_") ?: "user_${user.uid.take(5)}",
                                        fullName = user.displayName ?: "Google User"
                                    )
                                }
                            }
                        },
                        onAuthError = { err ->
                            isGoogleLoading = false
                        },
                        scope = coroutineScope,
                        onAuthCancelled = {
                            isGoogleLoading = false
                        }
                    )
                },
                onLoginClick = { u, p ->
                    authViewModel.login(u, p)
                },
                onQuickLogin = { u ->
                    authViewModel.quickLoginDemo(u)
                },
                onNavigateToRegister = {
                    authViewModel.clearError()
                    showRegister = true
                },
                isLoading = isLoading || isGoogleLoading,
                errorMessage = errorMessage,
                modifier = modifier
            )
        }
    }
}
