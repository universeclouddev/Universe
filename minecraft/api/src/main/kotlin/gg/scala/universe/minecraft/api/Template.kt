package gg.scala.universe.minecraft.api

/**
 * Represents a Universe template.
 */
data class Template(
    val name: String,
    val group: String,
    val storage: String = "local",
    val priority: Int = 0
) {

    /**
     * Returns the full template path as "group/name".
     */
    fun getPath(): String = "$group/$name"

    class Builder {
        private var name: String = ""
        private var group: String = ""
        private var storage: String = "local"
        private var priority: Int = 0

        fun name(name: String) = apply { this.name = name }
        fun group(group: String) = apply { this.group = group }
        fun storage(storage: String) = apply { this.storage = storage }
        fun priority(priority: Int) = apply { this.priority = priority }

        fun build() = Template(
            name = name,
            group = group,
            storage = storage,
            priority = priority
        )
    }
}
