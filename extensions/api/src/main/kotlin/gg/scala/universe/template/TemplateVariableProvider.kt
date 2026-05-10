package gg.scala.universe.template

/**
 * Implemented by extensions that wish to provide custom template variables.
 *
 * During instance deployment, [provideVariables] is called to collect
 * placeholder → value mappings that will be applied alongside built-in variables.
 */
interface TemplateVariableProvider {
    /**
     * Returns a map of placeholder → replacement value.
     *
     * Example: `mapOf("%CUSTOM_VAR%" to "customValue")`
     */
    fun provideVariables(): Map<String, String>
}
