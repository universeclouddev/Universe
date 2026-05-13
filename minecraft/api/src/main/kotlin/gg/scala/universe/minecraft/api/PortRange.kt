package gg.scala.universe.minecraft.api

/**
 * Represents a range of available ports.
 */
data class PortRange(
    val min: Int,
    val max: Int
) {

    /**
     * Returns the number of ports in this range (inclusive).
     */
    fun getSize(): Int = max - min + 1

    /**
     * Returns true if the given port is within this range.
     */
    fun contains(port: Int): Boolean = port in min..max

    /**
     * Returns a random port within this range.
     */
    fun randomPort(): Int = min + (Math.random() * getSize()).toInt()
}
