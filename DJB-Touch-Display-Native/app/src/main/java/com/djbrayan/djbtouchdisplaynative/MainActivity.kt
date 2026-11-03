package com.djbrayan.djbtouchdisplaynative

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.djbrayan.djbtouchdisplaynative.ui.MainDjScreen
import com.djbrayan.djbtouchdisplaynative.ui.theme.DjbColors
import com.djbrayan.djbtouchdisplaynative.ui.theme.DjbTouchDisplayNativeTheme
import com.djbrayan.djbtouchdisplaynative.viewmodel.DjViewModel

/**
 * DJB Touch Display Native — Main Activity
 * Enforces immersive sticky landscape orientation and binds SAF audio picker.
 */
class MainActivity : ComponentActivity() {

    private val viewModel: DjViewModel by viewModels()

    // SAF Document Picker launcher with persistable URI permission grant
    private val audioPickerLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        uri?.let { pickedUri ->
            try {
                contentResolver.takePersistableUriPermission(
                    pickedUri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            } catch (_: Exception) {}

            // Load into Deck A by default or active target
            viewModel.registerDocumentUriAndLoad("A", pickedUri)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemUI()

        setContent {
            DjbTouchDisplayNativeTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = DjbColors.BgDark
                ) {
                    MainDjScreen(
                        viewModel = viewModel,
                        onOpenFilePicker = {
                            audioPickerLauncher.launch(
                                arrayOf("audio/*", "application/ogg", "application/x-flac")
                            )
                        }
                    )
                }
            }
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemUI()
        }
    }

    private fun hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let { controller ->
                controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                controller.systemBarsBehavior =
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
            )
        }
    }
}
