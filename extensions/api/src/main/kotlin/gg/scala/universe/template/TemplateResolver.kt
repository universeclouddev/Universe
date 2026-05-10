package gg.scala.universe.template

/**
 * Resolves template directories matching a pattern string.
 *
 * Supported patterns:
 * - `*`            → all templates in all groups
 * - `group/(*)`    → all templates in the specified group
 * - `group/name`   → a single template
 *
 * Implementations are provided by the core app module; extensions may
 * inject this interface to resolve user-supplied patterns.
 */
interface TemplateResolver {
    /**
     * Resolves template directories matching the given [pattern].
     *
     * @return A list of (group, name) pairs.
     */
    fun resolveTemplates(pattern: String): List<Pair<String, String>>
}
