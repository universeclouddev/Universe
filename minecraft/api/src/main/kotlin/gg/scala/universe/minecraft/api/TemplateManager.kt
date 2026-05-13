package gg.scala.universe.minecraft.api

import java.util.concurrent.CompletableFuture

/**
 * Manager for Universe template operations.
 */
interface TemplateManager {

    /**
     * Lists all templates.
     *
     * @return A future that completes with the list of templates.
     */
    fun getTemplates(): CompletableFuture<List<Template>>

    /**
     * Lists templates in a specific group.
     *
     * @param group The template group.
     * @return A future that completes with the list of templates.
     */
    fun getTemplatesByGroup(group: String): CompletableFuture<List<Template>>

    /**
     * Triggers a template sync to all nodes.
     *
     * @return A future that completes when the sync is triggered.
     */
    fun syncTemplates(): CompletableFuture<Void>
}
