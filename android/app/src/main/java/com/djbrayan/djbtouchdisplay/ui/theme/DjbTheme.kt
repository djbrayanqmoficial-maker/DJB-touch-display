package com.djbrayan.djbtouchdisplay.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

object DjbColors {
    // Cross DJ Pro Inspired Palette from src/App.tsx
    val Background = Color(0xFF22252A)
    val HeaderBg = Color(0xFF0B0C0E)
    val NavigationBg = Color(0xFF15171B)
    val WorkspaceBg = Color(0xFF181A1E)
    val BottomBarBg = Color(0xFF1B1D22)
    val PanelBg = Color(0xFF25282F)
    val PanelActive = Color(0xFF3A3E46)
    val PanelBorder = Color(0xFF2A2E36)
    val PanelBorderLight = Color(0xFF525761)

    // Primary Accents
    val Cyan = Color(0xFF0099DB)
    val CyanBright = Color(0xFF28B5F4)
    val CyanDark = Color(0xFF1B313E)
    val Orange = Color(0xFFFF8A00)

    // Deck Theme Aliases — Both decks use Cross DJ Pro Cyan (#0099DB) per React reference
    val DeckACyan = Cyan
    val DeckABlue = CyanBright
    val DeckABg = Color(0xFF0B1924)
    val DeckBCyan = Cyan
    val DeckBBlue = CyanBright
    val DeckBOrange = Cyan // Unified to Cyan blue
    val DeckBCrimson = CyanBright
    val DeckBBg = Color(0xFF0B1924)

    // Hardware DJ Buttons & LEDs
    val CueAmber = Color(0xFFF59E0B)
    val PlayGreen = Color(0xFF10B981)
    val SyncCyan = Cyan

    // Typography
    val TextPrimary = Color(0xFFF3F4F6)
    val TextSecondary = Color(0xFF9CA3AF)
    val TextMuted = Color(0xFF6B7280)

    // Hardware VU / Status Colors
    val VuGreen = Color(0xFF059669)
    val VuCyan = Color(0xFF38BDF8)
    val VuYellow = Color(0xFFF59E0B)
    val VuRed = Color(0xFFEF4444)
    val VuOverload = Color(0xFFFF1E1E)
}

@Composable
fun DjbTouchTheme(content: @Composable () -> Unit) {
    val colorScheme = darkColorScheme(
        background = DjbColors.Background,
        surface = DjbColors.WorkspaceBg,
        primary = DjbColors.Cyan,
        secondary = DjbColors.Orange,
        onBackground = DjbColors.TextPrimary,
        onSurface = DjbColors.TextPrimary
    )

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
