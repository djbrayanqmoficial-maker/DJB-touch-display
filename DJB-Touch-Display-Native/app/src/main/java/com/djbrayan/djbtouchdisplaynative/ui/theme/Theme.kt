package com.djbrayan.djbtouchdisplaynative.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = DjbColors.Cyan,
    background = DjbColors.BgDark,
    surface = DjbColors.Surface,
    onPrimary = DjbColors.BgDark,
    onBackground = DjbColors.TextPrimary,
    onSurface = DjbColors.TextPrimary
)

@Composable
fun DjbTouchDisplayNativeTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = DjbTypography,
        content = content
    )
}
