package gg.scala.universe.command

/**
 * The command source represents a message receiving object. All messages regarding command execution and command
 * parsing are sent to the command source.
 *
 *
 * The console has its own CommandSource. If you want to use the console CommandSource use the jvm static
 * [CommandSource.console] method.
 *
 * @since 4.0
 */
interface CommandSource {
    /**
     * @param message the message that is sent to the source
     * @throws NullPointerException if message is null.
     */
    fun sendMessage(message: String)

    /**
     * @param messages the messages that are sent to the source
     * @throws NullPointerException if messages is null.
     */
    fun sendMessage(vararg messages: String)

    /**
     * @param messages the messages that are sent to the source
     * @throws NullPointerException if messages is null.
     */
    fun sendMessage(messages: MutableCollection<String>)

    /**
     * Used to check if the command source has the given permission
     *
     * @param permission the permission to check for
     * @return whether the source has the permission
     * @throws NullPointerException if permission is null.
     */
    fun checkPermission(permission: String): Boolean


    //todo: implement console command source AND inject it
//    companion object {
//        fun console(): CommandSource {
//            return ServiceRegistry.registry().instance(CommandSource::class.java, "console")
//        }
//    }
}