package gg.scala.universe.console

/**
 * ANSI color and style definitions for console output.
 * All colors use 256-color or standard ANSI codes.
 */
object Ansi {
    const val RESET = "\u001B[0m"
    const val BOLD = "\u001B[1m"
    const val DIM = "\u001B[2m"
    const val ITALIC = "\u001B[3m"

    // Standard colors
    const val BLACK = "\u001B[30m"
    const val RED = "\u001B[31m"
    const val GREEN = "\u001B[32m"
    const val YELLOW = "\u001B[33m"
    const val BLUE = "\u001B[34m"
    const val MAGENTA = "\u001B[35m"
    const val CYAN = "\u001B[36m"
    const val WHITE = "\u001B[37m"

    // Bright colors
    const val BRIGHT_BLACK = "\u001B[90m"
    const val BRIGHT_RED = "\u001B[91m"
    const val BRIGHT_GREEN = "\u001B[92m"
    const val BRIGHT_YELLOW = "\u001B[93m"
    const val BRIGHT_BLUE = "\u001B[94m"
    const val BRIGHT_MAGENTA = "\u001B[95m"
    const val BRIGHT_CYAN = "\u001B[96m"
    const val BRIGHT_WHITE = "\u001B[97m"

    // 256-color palette
    fun color256(code: Int) = "\u001B[38;5;${code}m"

    // Named palette colors (from screenshot aesthetic)
    val ORANGE = color256(208)      // #ff8700
    val AMBER = color256(214)       // #ffaf00
    val MUTED_GRAY = color256(245)  // #8a8a8a
    val DARK_GRAY = color256(240)   // #585858

    // Background colors
    fun bg256(code: Int) = "\u001B[48;5;${code}m"
}

/**
 * Styled string builder for composing ANSI-colored output.
 */
class StyledString(private val builder: StringBuilder = StringBuilder()) {
    fun append(text: String): StyledString {
        builder.append(text)
        return this
    }

    fun bold(text: String): StyledString = styled(Ansi.BOLD, text)
    fun dim(text: String): StyledString = styled(Ansi.DIM, text)
    fun red(text: String): StyledString = styled(Ansi.RED, text)
    fun green(text: String): StyledString = styled(Ansi.GREEN, text)
    fun yellow(text: String): StyledString = styled(Ansi.YELLOW, text)
    fun blue(text: String): StyledString = styled(Ansi.BLUE, text)
    fun cyan(text: String): StyledString = styled(Ansi.CYAN, text)
    fun magenta(text: String): StyledString = styled(Ansi.MAGENTA, text)
    fun white(text: String): StyledString = styled(Ansi.WHITE, text)
    fun brightGreen(text: String): StyledString = styled(Ansi.BRIGHT_GREEN, text)
    fun brightYellow(text: String): StyledString = styled(Ansi.BRIGHT_YELLOW, text)
    fun brightRed(text: String): StyledString = styled(Ansi.BRIGHT_RED, text)
    fun brightBlue(text: String): StyledString = styled(Ansi.BRIGHT_BLUE, text)
    fun brightCyan(text: String): StyledString = styled(Ansi.BRIGHT_CYAN, text)
    fun orange(text: String): StyledString = styled(Ansi.ORANGE, text)
    fun amber(text: String): StyledString = styled(Ansi.AMBER, text)
    fun muted(text: String): StyledString = styled(Ansi.MUTED_GRAY, text)
    fun darkGray(text: String): StyledString = styled(Ansi.DARK_GRAY, text)

    fun styled(color: String, text: String): StyledString {
        builder.append(color).append(text).append(Ansi.RESET)
        return this
    }

    override fun toString(): String = builder.toString()
}

fun styled(block: StyledString.() -> Unit): String {
    return StyledString().apply(block).toString()
}
